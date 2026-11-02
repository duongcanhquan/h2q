"""
Telegram Bot helpers for H2Q field notifications.

Config (site_config.json / common_site_config.json):
  telegram_bot_token   — BotFather token (required)
  telegram_chat_id     — default destination (default: 485567058)
  telegram_api_timeout — seconds (default: 15)
  telegram_enabled     — 0 to mute without uninstalling

BuildSuite note
---------------
`Measurement Book` is NOT submittable. Lifecycle is Draft → Certified via
`buildsuite_core.api.subcontract.certify_measurement_book` (doc.save).
hooks.py therefore wires `on_update` (and `on_submit` as a no-op safety net).
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
# Doc events (wired from hooks.py)
# ---------------------------------------------------------------------------


def on_measurement_book_update(doc, method: str | None = None) -> None:
	"""Fire when MB status transitions to Certified (BuildSuite real path)."""
	if not _is_telegram_enabled():
		return
	if getattr(doc, "status", None) != "Certified":
		return
	if hasattr(doc, "has_value_changed") and not doc.has_value_changed("status"):
		return
	_enqueue_notify(doc.name)


def on_measurement_book_submit(doc, method: str | None = None) -> None:
	"""
	Safety net if a future BuildSuite release makes Measurement Book submittable.
	Today this never runs — keep for forward-compat without touching BuildSuite core.
	"""
	if not _is_telegram_enabled():
		return
	_enqueue_notify(doc.name)


def _enqueue_notify(measurement_book: str) -> None:
	frappe.enqueue(
		"h2q_core.telegram_bot.send_measurement_notification",
		queue="short",
		timeout=60,
		enqueue_after_commit=True,
		job_name=f"telegram_mb::{measurement_book}",
		measurement_book=measurement_book,
	)


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------


def send_measurement_notification(measurement_book: str) -> None:
	"""Background job: compose Markdown message and POST to Telegram."""
	try:
		doc = frappe.get_doc("Measurement Book", measurement_book)
		is_certified = getattr(doc, "status", None) == "Certified"
		is_submitted = cint(doc.docstatus) == 1
		if not (is_certified or is_submitted):
			return

		text = build_measurement_markdown(doc)
		send_telegram_message(text, chat_id=_chat_id())
	except Exception:
		frappe.log_error(
			title=f"Telegram notify failed · MB {measurement_book}",
			message=frappe.get_traceback(),
		)
		raise


def build_measurement_markdown(doc) -> str:
	project_name = _project_name(doc.project)
	wbs = _format_wbs_items(doc)
	inspector = _user_full_name(doc.get("certified_by") or doc.get("measured_by"))
	qty = flt(doc.get("measured_total"))

	return (
		"✅ *Nghiệm thu khối lượng (Measurement Book)*\n"
		f"• Phiếu: `{doc.name}`\n"
		f"• Dự án: *{_escape_md(project_name)}*\n"
		f"• Hạng mục WBS:\n{wbs}\n"
		f"• Người nghiệm thu: *{_escape_md(inspector)}*\n"
		f"• Khối lượng hoàn thành: *{qty:g}*\n"
		f"• Work Order: `{doc.get('work_order') or '—'}`"
	)


def send_telegram_message(text: str, chat_id: str | None = None) -> dict[str, Any]:
	"""
	Send a Markdown message to Telegram with retry + timeout.
	Errors are logged via frappe.log_error after retries are exhausted.
	"""
	token = frappe.conf.get("telegram_bot_token")
	if not token:
		frappe.throw(
			"Missing site_config key `telegram_bot_token`. "
			"Add the BotFather token before enabling Telegram notifications."
		)

	dest = str(chat_id or _chat_id())
	timeout = int(frappe.conf.get("telegram_api_timeout") or 15)
	url = TELEGRAM_API.format(token=token)
	body = parse.urlencode(
		{
			"chat_id": dest,
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
				return data
		except (error.URLError, error.HTTPError, TimeoutError, RuntimeError, ValueError) as exc:
			last_error = exc
			frappe.logger("h2q_core.telegram").warning(
				f"Telegram send attempt {attempt}/3 failed: {exc}"
			)

	frappe.log_error(
		title="Telegram sendMessage exhausted retries",
		message=frappe.as_json(
			{"chat_id": dest, "error": str(last_error), "text_preview": text[:500]},
			indent=2,
		),
	)
	raise last_error  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _chat_id() -> str:
	return str(frappe.conf.get("telegram_chat_id") or DEFAULT_CHAT_ID)


def _is_telegram_enabled() -> bool:
	if "telegram_enabled" not in frappe.conf:
		return True
	return bool(cint(frappe.conf.get("telegram_enabled")))


def _format_wbs_items(doc) -> str:
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
	return frappe.db.get_value("Project", project, "project_name") or project


def _user_full_name(user: str | None) -> str:
	if not user:
		return "—"
	return frappe.db.get_value("User", user, "full_name") or user


def _escape_md(value: str) -> str:
	if not value:
		return ""
	for ch in ("_", "*", "`", "["):
		value = value.replace(ch, f"\\{ch}")
	return value
