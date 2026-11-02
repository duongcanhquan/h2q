"""
Frappe File DocType ↔ Cloudflare R2 integration.

Hook this module from h2q_core/hooks.py:

	write_file = "h2q_core.storage.r2_file.write_file"
	delete_file_data_content = "h2q_core.storage.r2_file.delete_file_data_content"

Flow:
1. User / React PWA uploads → Frappe File.save_file()
2. Frappe calls get_hook_method("write_file") instead of (or before) local disk write
3. Site photos + CAD drawings stream to R2 via boto3 upload_fileobj
4. file_url is set to the R2/CDN URL; any leftover local copy is deleted
5. Other file types fall back to Frappe's normal filesystem save
"""

from __future__ import annotations

import mimetypes
import os
import re
from io import BytesIO
from typing import Any
from urllib.parse import urlparse

import frappe
from frappe.utils import cint, get_url

from h2q_core.storage.r2_client import get_r2_client, get_transfer_config

# Ảnh nghiệm thu hiện trường + bản vẽ CAD / PDF kỹ thuật
DEFAULT_R2_EXTENSIONS = (
	# images
	".jpg",
	".jpeg",
	".png",
	".webp",
	".gif",
	".heic",
	".heif",
	".tif",
	".tiff",
	".bmp",
	# CAD / drawings
	".dwg",
	".dxf",
	".dgn",
	".rvt",
	".rfa",
	".ifc",
	".skp",
	".3dm",
	".pdf",
	".plt",
	".dwf",
	".dwfx",
)


# ---------------------------------------------------------------------------
# Public hooks (wired in hooks.py)
# ---------------------------------------------------------------------------


def write_file(file_doc_or_fname, content=None, content_type=None, is_private=0) -> dict[str, str]:
	"""
	Override Frappe local filesystem write.

	Supports both call signatures used across Frappe versions:
	- Modern File.save_file(): write_file(file_doc)
	- Legacy file_manager.save_file(): write_file(fname, content, content_type=, is_private=)

	MUST set file_url on the File doc (modern path) so the row stores the R2 URL.
	"""
	# Legacy: frappe.utils.file_manager.save_file
	if not hasattr(file_doc_or_fname, "file_name") and content is not None:
		return _write_file_legacy(
			fname=file_doc_or_fname,
			content=content,
			content_type=content_type,
			is_private=is_private,
		)

	file_doc = file_doc_or_fname

	# Non site-photo / non-CAD → keep default Frappe disk behaviour
	if not should_offload_to_r2(file_doc.file_name, getattr(file_doc, "content_type", None)):
		return file_doc.save_file_on_filesystem()

	try:
		payload = _get_file_bytes(file_doc)
		if not payload:
			frappe.throw("Cannot upload empty file content to R2.")

		# Capture possible local path before we rewrite file_url (rare race / retry cases)
		local_path = _safe_local_path(file_doc)

		key = build_object_key(file_doc)
		resolved_type = (
			getattr(file_doc, "content_type", None)
			or mimetypes.guess_type(file_doc.file_name or "")[0]
			or "application/octet-stream"
		)

		public_url = upload_bytes_to_r2(
			content=payload,
			key=key,
			content_type=resolved_type,
			is_private=cint(file_doc.is_private),
			file_name=file_doc.file_name,
		)

		file_doc.file_url = public_url
		file_doc.flags.r2_uploaded = True

		# Never leave a duplicate on the bench volume after a successful R2 put
		_delete_local_file(local_path)
		_delete_local_file(_guess_legacy_local_path(file_doc))

		return {
			"file_name": file_doc.file_name,
			"file_url": file_doc.file_url,
		}
	except Exception as exc:
		_log_r2_failure("R2 write_file failed", file_doc, exc)
		# Re-raise so the File insert rolls back instead of pointing at a missing object
		raise


def _write_file_legacy(
	*,
	fname: str,
	content: bytes | str,
	content_type: str | None,
	is_private: int,
) -> dict[str, str]:
	"""Legacy file_manager hook — returns dict consumed by save_file()."""
	if not should_offload_to_r2(fname, content_type):
		from frappe.utils.file_manager import save_file_on_filesystem

		return save_file_on_filesystem(fname, content, content_type=content_type, is_private=is_private)

	try:
		payload = content.encode("utf-8") if isinstance(content, str) else content
		fake_doc = frappe._dict(
			file_name=fname,
			is_private=cint(is_private),
			content_hash=frappe.generate_hash(length=12),
		)
		key = build_object_key(fake_doc)
		resolved_type = content_type or mimetypes.guess_type(fname)[0] or "application/octet-stream"
		public_url = upload_bytes_to_r2(
			content=payload,
			key=key,
			content_type=resolved_type,
			is_private=cint(is_private),
			file_name=fname,
		)
		# Remove any local copy that may already exist under the same name
		_delete_local_file(_path_for_fname(fname, is_private=cint(is_private)))
		return {"file_name": os.path.basename(fname), "file_url": public_url}
	except Exception as exc:
		frappe.log_error(
			title="R2 write_file (legacy) failed",
			message=frappe.as_json({"fname": fname, "error": str(exc)}, indent=2),
		)
		raise


def delete_file_data_content(file_doc, only_thumbnail: bool = False) -> None:
	"""
	Override Frappe local filesystem delete.

	- R2 URLs (http/https under our public base) → delete object in bucket
	- Local `/files` / `/private/files` → fall back to Frappe filesystem delete
	"""
	try:
		if _is_remote_url(file_doc.file_url) or _is_remote_url(file_doc.thumbnail_url):
			if only_thumbnail:
				_delete_r2_url_if_ours(file_doc.thumbnail_url)
				return
			_delete_r2_url_if_ours(file_doc.file_url)
			_delete_r2_url_if_ours(file_doc.thumbnail_url)
			return

		# Mixed mode: non-R2 attachments still live on disk
		if hasattr(file_doc, "delete_file_from_filesystem"):
			file_doc.delete_file_from_filesystem(only_thumbnail=only_thumbnail)
		else:
			from frappe.utils.file_manager import delete_file_from_filesystem

			delete_file_from_filesystem(file_doc, only_thumbnail=only_thumbnail)
	except Exception as exc:
		_log_r2_failure("R2 delete_file_data_content failed", file_doc, exc)
		frappe.log_error(
			title="R2 delete soft-failed",
			message=frappe.get_traceback(),
		)


def should_offload_to_r2(file_name: str | None, content_type: str | None = None) -> bool:
	"""
	True for site photos / CAD drawings.

	site_config:
	  r2_offload_all_files: 1          → every upload goes to R2
	  r2_allowed_extensions: ".jpg,.dwg"  → override default allow-list
	"""
	if cint(frappe.conf.get("r2_offload_all_files")):
		return True

	exts = _configured_extensions()
	name = (file_name or "").lower()
	ext = os.path.splitext(name)[1]
	if ext in exts:
		return True

	ctype = (content_type or mimetypes.guess_type(name)[0] or "").lower()
	if ctype.startswith("image/"):
		return True
	if ctype in {"application/pdf", "application/acad", "image/vnd.dwg", "image/x-dwg"}:
		return True
	return False


# ---------------------------------------------------------------------------
# Core upload / delete helpers
# ---------------------------------------------------------------------------


def upload_bytes_to_r2(
	*,
	content: bytes,
	key: str,
	content_type: str,
	is_private: int = 0,
	file_name: str | None = None,
) -> str:
	"""
	Stream bytes to R2 using upload_fileobj (multipart when over threshold).

	Returns the permanent URL to store in File.file_url.
	"""
	client, settings = get_r2_client()
	bucket = settings["bucket"]
	extra_args: dict[str, Any] = {
		"ContentType": content_type,
		"Metadata": {
			"is-private": "1" if is_private else "0",
			"site": frappe.local.site,
		},
	}
	if file_name:
		# Help browsers download CAD with original name
		safe_name = file_name.replace('"', "")
		extra_args["ContentDisposition"] = f'inline; filename="{safe_name}"'

	buffer = BytesIO(content)
	buffer.seek(0)

	try:
		client.upload_fileobj(
			Fileobj=buffer,
			Bucket=bucket,
			Key=key,
			ExtraArgs=extra_args,
			Config=get_transfer_config(settings),
		)
	except Exception:
		# Ensure buffer is closed; re-raise for write_file handler
		buffer.close()
		raise
	finally:
		buffer.close()

	return f"{settings['public_url']}/{key}"


def delete_object_by_key(key: str) -> None:
	client, settings = get_r2_client()
	client.delete_object(Bucket=settings["bucket"], Key=key)


def build_object_key(file_doc) -> str:
	"""
	Stable, collision-resistant object key.

	Example:
	  h2q.com.vn/private/a1b2c3/floor-plan.dwg
	  h2q.com.vn/public/d4e5f6/site-photo.jpg
	"""
	site = _safe_path_segment(frappe.local.site or "site")
	visibility = "private" if cint(file_doc.is_private) else "public"
	digest = (file_doc.content_hash or frappe.generate_hash(length=10))[:12]
	filename = _safe_filename(file_doc.file_name or "upload.bin")
	return f"{site}/{visibility}/{digest}/{filename}"


def enqueue_r2_upload_for_existing_local_file(file_name: str) -> None:
	"""
	Optional: migrate an already-local File to R2 in a background worker.

	Use for bulk migration of legacy /files attachments — NOT for the live
	write_file path (File.insert needs file_url immediately).
	"""
	frappe.enqueue(
		"h2q_core.storage.r2_file._migrate_local_file_to_r2",
		queue="long",
		timeout=1800,
		job_name=f"r2_migrate::{file_name}",
		file_name=file_name,
		enqueue_after_commit=True,
	)


def _migrate_local_file_to_r2(file_name: str) -> None:
	file_doc = frappe.get_doc("File", file_name)
	if file_doc.is_remote_file:
		return

	try:
		content = file_doc.get_content()
		if isinstance(content, str):
			content = content.encode("utf-8")

		key = build_object_key(file_doc)
		content_type = (
			getattr(file_doc, "content_type", None)
			or mimetypes.guess_type(file_doc.file_name or "")[0]
			or "application/octet-stream"
		)
		public_url = upload_bytes_to_r2(
			content=content,
			key=key,
			content_type=content_type,
			is_private=cint(file_doc.is_private),
			file_name=file_doc.file_name,
		)

		old_path = file_doc.get_full_path() if hasattr(file_doc, "get_full_path") else None
		file_doc.db_set("file_url", public_url, update_modified=False)

		# Best-effort local cleanup after successful R2 upload
		if old_path and os.path.exists(old_path):
			try:
				os.remove(old_path)
			except OSError:
				pass
	except Exception as exc:
		_log_r2_failure("R2 background migrate failed", file_doc, exc)
		raise


def generate_presigned_url(file_url: str, expires_in: int = 3600) -> str | None:
	"""
	Generate a temporary signed GET URL for private R2 objects.

	Call from a @frappe.whitelist() API when React needs to preview private CAD.
	"""
	key = extract_object_key(file_url)
	if not key:
		return None

	client, settings = get_r2_client()
	return client.generate_presigned_url(
		"get_object",
		Params={"Bucket": settings["bucket"], "Key": key},
		ExpiresIn=expires_in,
	)


@frappe.whitelist()
def get_signed_file_url(file_name: str, expires_in: int = 3600) -> dict[str, Any]:
	"""React-facing API: return a short-lived signed URL for a private File."""
	file_doc = frappe.get_doc("File", file_name)
	file_doc.check_permission("read")

	if not cint(file_doc.is_private):
		return {"file_url": file_doc.file_url, "signed": False}

	signed = generate_presigned_url(file_doc.file_url, expires_in=cint(expires_in) or 3600)
	if not signed:
		frappe.throw("Unable to generate signed URL for this file.")

	return {"file_url": signed, "signed": True, "expires_in": cint(expires_in) or 3600}


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _configured_extensions() -> set[str]:
	raw = frappe.conf.get("r2_allowed_extensions")
	if raw:
		parts = [p.strip().lower() for p in str(raw).split(",") if p.strip()]
		return {p if p.startswith(".") else f".{p}" for p in parts}
	return set(DEFAULT_R2_EXTENSIONS)


def _get_file_bytes(file_doc) -> bytes:
	content = getattr(file_doc, "_content", None)
	if content is None and hasattr(file_doc, "get_content"):
		content = file_doc.get_content()
	if content is None:
		return b""
	if isinstance(content, str):
		return content.encode("utf-8")
	return content


def _is_remote_url(url: str | None) -> bool:
	return bool(url and str(url).startswith(("http://", "https://")))


def _safe_local_path(file_doc) -> str | None:
	"""Best-effort absolute path if the File still points at a local URL."""
	try:
		if not file_doc.file_url or _is_remote_url(file_doc.file_url):
			return None
		if hasattr(file_doc, "get_full_path"):
			path = file_doc.get_full_path()
			return path if path and os.path.exists(path) else None
	except Exception:
		return None
	return None


def _guess_legacy_local_path(file_doc) -> str | None:
	"""Path Frappe would have used under /files or /private/files for this name."""
	if not file_doc.file_name:
		return None
	return _path_for_fname(file_doc.file_name, is_private=cint(file_doc.is_private))


def _path_for_fname(fname: str, *, is_private: int = 0) -> str | None:
	try:
		from frappe.utils.file_manager import get_files_path

		path = get_files_path(os.path.basename(fname), is_private=is_private)
		return path if path and os.path.exists(path) else path
	except Exception:
		return None


def _delete_local_file(path: str | None) -> None:
	"""Delete a leftover local attachment after a successful R2 upload."""
	if not path or not os.path.isfile(path):
		return
	try:
		os.remove(path)
		frappe.logger("h2q_core.r2").info(f"Removed local file after R2 upload: {path}")
	except OSError as exc:
		frappe.log_error(
			title="R2 local cleanup failed",
			message=frappe.as_json({"path": path, "error": str(exc)}, indent=2),
		)


def _delete_r2_url_if_ours(url: str | None) -> None:
	if not url:
		return
	key = extract_object_key(url)
	if not key:
		return
	delete_object_by_key(key)


def extract_object_key(file_url: str) -> str | None:
	"""
	Derive R2 object key from a stored file_url.

	Supports:
	  https://files.h2q.com.vn/site/public/abc/a.dwg
	  /files/... (ignored — local, not R2)
	"""
	if not file_url or not file_url.startswith(("http://", "https://")):
		return None

	try:
		_, settings = get_r2_client()
	except Exception:
		return None

	public_base = settings["public_url"]
	if file_url.startswith(public_base + "/"):
		return file_url[len(public_base) + 1 :]

	# Fallback: path after host
	parsed = urlparse(file_url)
	path = parsed.path.lstrip("/")
	return path or None


def _safe_filename(name: str) -> str:
	name = os.path.basename(name).strip() or "upload.bin"
	# Keep unicode letters/numbers, dots, dashes, underscores
	name = re.sub(r"[^\w.\-]+", "_", name, flags=re.UNICODE)
	return name[:180]


def _safe_path_segment(value: str) -> str:
	return re.sub(r"[^\w.\-]+", "_", value, flags=re.UNICODE)


def _log_r2_failure(title: str, file_doc, exc: Exception) -> None:
	payload = {
		"error": str(exc),
		"file_name": getattr(file_doc, "file_name", None),
		"file_url": getattr(file_doc, "file_url", None),
		"is_private": getattr(file_doc, "is_private", None),
		"content_hash": getattr(file_doc, "content_hash", None),
		"attached_to_doctype": getattr(file_doc, "attached_to_doctype", None),
		"attached_to_name": getattr(file_doc, "attached_to_name", None),
		"site_url": get_url(),
	}
	frappe.log_error(title=title, message=frappe.as_json(payload, indent=2))
