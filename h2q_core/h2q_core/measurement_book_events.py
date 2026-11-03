"""Composite Measurement Book doc_events — keep hooks.py to one handler per event."""

from __future__ import annotations


def on_update(doc, method: str | None = None) -> None:
	from h2q_core.sync.supabase_push import on_measurement_book_update as supabase_on_update
	from h2q_core.telegram_bot import on_measurement_book_update as telegram_on_update

	telegram_on_update(doc, method)
	supabase_on_update(doc, method)


def validate(doc, method: str | None = None) -> None:
	"""Block a jump to Approved while a configured approval chain is unfinished."""
	if not getattr(doc, "meta", None) or not doc.meta.has_field("custom_h2q_approval_level"):
		return
	if (getattr(doc, "custom_h2q_approval_status", None) or "") != "Approved":
		return
	from frappe.utils import cint

	from h2q_core.approval_chain import chain_steps
	from h2q_core.settings import get_settings

	steps = chain_steps(get_settings().get("approval_roles") or [])
	if steps and cint(doc.custom_h2q_approval_level) < len(steps):
		import frappe
		from frappe import _

		frappe.throw(
			_("Phiếu chưa đủ cấp duyệt ({0}/{1}).").format(
				cint(doc.custom_h2q_approval_level), len(steps)
			)
		)


def on_submit(doc, method: str | None = None) -> None:
	from h2q_core.telegram_bot import on_measurement_book_submit

	on_measurement_book_submit(doc, method)
