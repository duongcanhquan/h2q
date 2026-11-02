"""Composite Measurement Book doc_events — keep hooks.py to one handler per event."""

from __future__ import annotations


def on_update(doc, method: str | None = None) -> None:
	from h2q_core.sync.supabase_push import on_measurement_book_update as supabase_on_update
	from h2q_core.telegram_bot import on_measurement_book_update as telegram_on_update

	telegram_on_update(doc, method)
	supabase_on_update(doc, method)


def on_submit(doc, method: str | None = None) -> None:
	from h2q_core.telegram_bot import on_measurement_book_submit

	on_measurement_book_submit(doc, method)
