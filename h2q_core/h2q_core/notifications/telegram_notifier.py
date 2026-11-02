"""
Telegram notifier for BuildSuite Measurement Book certification.

BuildSuite note
---------------
`Measurement Book` is NOT a submittable DocType. Lifecycle is:
  Draft → Certified  (via buildsuite_core.api.subcontract.certify_measurement_book)

Therefore we hook `on_update` and fire only when `status` transitions to "Certified".
Hooking `on_submit` would never run against current BuildSuite core.

Config (site_config.json)
-------------------------
  "telegram_bot_token": "<bot token from @BotFather>",
  "telegram_chat_id": "485567058",          # optional override
  "telegram_api_timeout": 15,               # optional
  "telegram_enabled": 1                     # set 0 to disable without uninstalling
"""

from __future__ import annotations

import json
from typing import Any
from urllib import error, parse, request

import frappe
from frappe.utils import cint, flt


DEFAULT_CHAT_ID = "485567058"
TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


# ---------------------------------------------------------------------------
# Doc event (wired in hooks.py → doc_events["Measurement Book"]["on_update"])
# ---------------------------------------------------------------------------


def on_measurement_book_update(doc, method: str | None = None) -> None:
	"""Enqueue Telegram alert when a Measurement Book is newly Certified."""
	if not _is_telegram_enabled():
		return

	if doc.status != "Certified":
		return

	# Only fire on Draft → Certified (or first save as Certified), not every edit after.
	if hasattr(doc, "has_value_changed") and not doc.has_value_changed("status"):
		return

	frappe.enqueue(
		"h2q_core.notifications.telegram_notifier.send_measurement_certified_telegram",
		queue="short",
		timeout=60,
		enqueue_after_commit=True,
		job_name=f"telegram_mb::{doc.name}",
		measurement_book=doc.name,
	)


# ---------------------------------------------------------------------------
# Background job
# ---------------------------------------------------------------------------


def send_measurement_certified_telegram(measurement_book: str) -> None:
	"""Worker: load MB, build message, POST to Telegram Bot API."""
	try:
		doc = frappe.get_doc("Measurement Book", measurement_book)
		if doc.status != "Certified":
			return

		payload = _build_message_payload(doc)
		_send_telegram_message(payload["text"])
	except Exception:
		frappe.log_error(
			title=f"Telegram notify failed · MB {measurement_book}",
			message=frappe.get_traceback(),
		)
		raise


# ---------------------------------------------------------------------------
# Message composition
# ---------------------------------------------------------------------------


def _build_message_payload(doc) -> dict[str, Any]:
	project_name = _project_name(doc.project)
	wbs_lines = _format_wbs_items(doc)
	inspector = _user_full_name(doc.certified_by or doc.measured_by)
	qty = flt(doc.measured_total)

	text = (
		"✅ *Nghiệm thu khối lượng (Measurement Book)*\n"
		f"• Phiếu: `{doc.name}`\n"
		f"• Dự án: *{_escape_md(project_name)}*\n"
		f"• Hạng mục WBS:\n{wbs_lines}\n"
		f"• Người nghiệm thu: *{_escape_md(inspector)}*\n"
		f"• Khối lượng hoàn thành: *{qty:g}*\n"
		f"• Work Order: `{doc.work_order or '—'}`"
	)
	return {"text": text, "project_name": project_name, "qty": qty}


def _format_wbs_items(doc) -> str:
	"""
	BuildSuite stores WBS/cost-code context on Measurement Book Entry:
	cost_code_label / cost_code_group / cost_code_item / description.
	There is no separate 'WBS' DocType on the MB itself.
	"""
	if not doc.get("entries"):
		return "  — (không có dòng nghiệm thu)"

	lines: list[str] = []
	for row in doc.entries:
		label = (
			row.get("cost_code_label")
			or row.get("cost_code_item")
			or row.get("cost_code_group")
			or row.get("description")
			or "—"
		)
		signed_qty = flt(row.quantity) * (-1 if cint(row.is_deduction) else 1)
		deduct = " (trừ)" if cint(row.is_deduction) else ""
		lines.append(f"  – {_escape_md(str(label))}: {signed_qty:g}{deduct}")
	return "\n".join(lines)


def _project_name(project: str | None) -> str:
	if not project:
		return "—"
	name = frappe.db.get_value("Project", project, "project_name")
	return name or project


def _user_full_name(user: str | None) -> str:
	if not user:
		return "—"
	full_name = frappe.db.get_value("User", user, "full_name")
	return full_name or user


def _escape_md(value: str) -> str:
	"""Minimal MarkdownV2-safe escaping for Telegram parse_mode=Markdown (legacy)."""
	if not value:
		return ""
	# Using legacy Markdown — escape * _ ` [
	for ch in ("_", "*", "`", "["):
		value = value.replace(ch, f"\\{ch}")
	return value


# ---------------------------------------------------------------------------
# Telegram HTTP client (retry + timeout + error log)
# ---------------------------------------------------------------------------


def _send_telegram_message(text: str) -> None:
	token = frappe.conf.get("telegram_bot_token")
	if not token:
		frappe.throw(
			"Missing site_config key `telegram_bot_token`. "
			"Add the BotFather token before enabling Telegram notifications."
		)

	chat_id = str(frappe.conf.get("telegram_chat_id") or DEFAULT_CHAT_ID)
	timeout = int(frappe.conf.get("telegram_api_timeout") or 15)
	url = TELEGRAM_API.format(token=token)

	body = parse.urlencode(
		{
			"chat_id": chat_id,
			"text": text,
			"parse_mode": "Markdown",
			"disable_web_page_preview": "1",
		}
	).encode("utf-8")

	last_error: Exception | None = None
	for attempt in range(1, 4):
		try:
			req = request.Request(
				url,
				data=body,
				method="POST",
				headers={"Content-Type": "application/x-www-form-urlencoded"},
			)
			with request.urlopen(req, timeout=timeout) as resp:
				raw = resp.read().decode("utf-8", errors="replace")
				data = json.loads(raw) if raw else {}
				if not data.get("ok"):
					raise RuntimeError(f"Telegram API rejected message: {raw}")
				return
		except (error.URLError, error.HTTPError, TimeoutError, RuntimeError, ValueError) as exc:
			last_error = exc
			frappe.logger("h2q_core.telegram").warning(
				f"Telegram send attempt {attempt}/3 failed: {exc}"
			)

	frappe.log_error(
		title="Telegram sendMessage exhausted retries",
		message=frappe.as_json(
			{"chat_id": chat_id, "error": str(last_error), "text_preview": text[:500]},
			indent=2,
		),
	)
	raise last_error  # type: ignore[misc]


def _is_telegram_enabled() -> bool:
	# Default ON when key missing; set telegram_enabled: 0 to mute.
	if "telegram_enabled" not in frappe.conf:
		return True
	return bool(cint(frappe.conf.get("telegram_enabled")))
