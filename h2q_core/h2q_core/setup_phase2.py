"""
H2Q Giai đoạn 2 — one-shot seed: custom fields + Measurement Book workflow.

  bench --site <site> migrate
  bench --site <site> execute h2q_core.setup_phase2.run

Also wired as after_migrate (idempotent).
"""

from __future__ import annotations

from typing import Any

import frappe


def run() -> dict[str, Any]:
	from h2q_core.settings import ensure_settings_defaults
	from h2q_core.setup_custom_fields import setup_custom_fields
	from h2q_core.setup_workflow import setup_measurement_workflow

	fields = setup_custom_fields()
	settings = ensure_settings_defaults()
	workflow = setup_measurement_workflow()
	summary = {"custom_fields": fields, "h2q_settings": settings, "workflow": workflow}
	frappe.logger("h2q_core.setup_phase2").info(frappe.as_json(summary))
	return summary


def after_migrate() -> None:
	"""Safe to call on every migrate — custom fields + H2Q Settings seed + workflow."""
	try:
		run()
	except Exception:
		frappe.log_error(title="h2q_core.setup_phase2.after_migrate failed", message=frappe.get_traceback())
