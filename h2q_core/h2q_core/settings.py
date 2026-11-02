"""
Runtime access to Single DocType **H2Q Settings**.

Desk: H2Q Core → H2Q Settings
Secrets (bot token, R2 keys) stay in site_config — never on this DocType.
"""

from __future__ import annotations

from typing import Any

import frappe
from frappe.utils import cint, flt

DOCTYPE = "H2Q Settings"

# Safe defaults when DocType not yet migrated
_DEFAULTS: dict[str, Any] = {
	"enable_measurement_book": 1,
	"enable_site_diary": 0,
	"enable_client_ra_billing": 0,
	"enable_offline_sync": 1,
	"dashboard_progress_source": "BOQ Qty",
	"ui_profile": "Field Gloves",
	"allow_mobile_revise_rejected": 1,
	"boq_over_limit_policy": "Warn",
	"auto_request_approval_default": 0,
	"gps_required": 0,
	"geofence_enforcement": "Off",
	"min_photos_on_submit": 0,
	"min_photos_on_approve": 0,
	"resync_workflow_on_save": 1,
	"telegram_enabled": 1,
	"telegram_chat_id_pending": "485567058",
	"telegram_chat_id_certified": "485567058",
	"telegram_chat_id_alerts": "485567058",
	"telegram_notify_on_pending": 1,
	"telegram_notify_on_certified": 1,
	"telegram_notify_on_over_limit": 1,
	"workforce_mode": "Both",
	"sync_retry_max": 5,
	"pending_ttl_hours": 72,
	"approval_roles": [],
	"default_employee_roles": ["Employee", "Projects User"],
}


def get_settings() -> dict[str, Any]:
	"""Full settings dict (admin + server). Cached briefly."""
	cached = frappe.cache().get_value("h2q_settings_doc")
	if cached:
		return cached

	if not frappe.db.exists("DocType", DOCTYPE):
		return dict(_DEFAULTS)

	try:
		doc = frappe.get_single(DOCTYPE)
	except Exception:
		return dict(_DEFAULTS)

	data = {k: doc.get(k) if doc.get(k) is not None else _DEFAULTS.get(k) for k in _DEFAULTS}
	# Fill missing keys from defaults
	for k, v in _DEFAULTS.items():
		if data.get(k) is None:
			data[k] = v

	data["approval_roles"] = [
		{
			"role": r.role,
			"can_submit": cint(r.can_submit),
			"can_approve": cint(r.can_approve),
			"sort_order": cint(r.sort_order),
		}
		for r in (doc.approval_roles or [])
		if r.role
	]
	emp_roles = [r.role for r in (doc.default_employee_roles or []) if r.role]
	data["default_employee_roles"] = emp_roles or list(_DEFAULTS["default_employee_roles"])

	frappe.cache().set_value("h2q_settings_doc", data, expires_in_sec=60)
	return data


def get_public_settings() -> dict[str, Any]:
	"""Subset safe for PWA (no internal-only noise)."""
	cached = frappe.cache().get_value("h2q_settings_public")
	if cached:
		return cached

	s = get_settings()
	public = {
		"enable_measurement_book": cint(s["enable_measurement_book"]),
		"enable_site_diary": cint(s["enable_site_diary"]),
		"enable_client_ra_billing": cint(s["enable_client_ra_billing"]),
		"enable_offline_sync": cint(s["enable_offline_sync"]),
		"dashboard_progress_source": s["dashboard_progress_source"],
		"ui_profile": s["ui_profile"],
		"allow_mobile_revise_rejected": cint(s["allow_mobile_revise_rejected"]),
		"boq_over_limit_policy": s["boq_over_limit_policy"],
		"auto_request_approval_default": cint(s["auto_request_approval_default"]),
		"gps_required": cint(s["gps_required"]),
		"geofence_enforcement": s["geofence_enforcement"],
		"min_photos_on_submit": cint(s["min_photos_on_submit"]),
		"min_photos_on_approve": cint(s["min_photos_on_approve"]),
		"sync_retry_max": cint(s["sync_retry_max"]),
		"pending_ttl_hours": cint(s["pending_ttl_hours"]),
		"telegram_enabled": cint(s["telegram_enabled"]),
	}
	frappe.cache().set_value("h2q_settings_public", public, expires_in_sec=60)
	return public


def ensure_settings_defaults() -> dict[str, Any]:
	"""Create Single + seed default role rows if empty. Idempotent."""
	if not frappe.db.exists("DocType", DOCTYPE):
		return {"skipped": True, "reason": "DocType not installed yet — run bench migrate"}

	doc = frappe.get_single(DOCTYPE)
	changed = False

	if not doc.approval_roles:
		for role, submit, approve, sort in (
			("System Manager", 1, 1, 0),
			("Projects User", 1, 0, 10),
			("Employee", 1, 0, 20),
			("Projects Manager", 0, 1, 5),
		):
			if frappe.db.exists("Role", role):
				doc.append(
					"approval_roles",
					{"role": role, "can_submit": submit, "can_approve": approve, "sort_order": sort},
				)
				changed = True
		# BuildSuite roles if present
		for role, submit, approve, sort in (
			("BuildSuite Site Engineer", 1, 0, 15),
			("BuildSuite Foreman", 1, 0, 16),
			("BuildSuite PM", 1, 1, 6),
			("BuildSuite Director", 0, 1, 4),
			("BuildSuite QS", 0, 1, 7),
			("BuildSuite Administrator", 1, 1, 1),
		):
			if frappe.db.exists("Role", role):
				doc.append(
					"approval_roles",
					{"role": role, "can_submit": submit, "can_approve": approve, "sort_order": sort},
				)
				changed = True

	if not doc.default_employee_roles:
		for role in ("Employee", "Projects User"):
			if frappe.db.exists("Role", role):
				doc.append("default_employee_roles", {"role": role})
				changed = True

	# Ensure scalar defaults for empty selects
	for field, default in (
		("boq_over_limit_policy", "Warn"),
		("dashboard_progress_source", "BOQ Qty"),
		("ui_profile", "Field Gloves"),
		("geofence_enforcement", "Off"),
		("workforce_mode", "Both"),
		("telegram_chat_id_pending", "485567058"),
		("telegram_chat_id_certified", "485567058"),
		("telegram_chat_id_alerts", "485567058"),
	):
		if not doc.get(field):
			doc.set(field, default)
			changed = True

	if changed:
		doc.flags.ignore_permissions = True
		doc.resync_workflow_on_save = 0  # avoid recursion during seed
		doc.save()
		doc.resync_workflow_on_save = 1
		frappe.db.set_value(DOCTYPE, DOCTYPE, "resync_workflow_on_save", 1, update_modified=False)
		frappe.db.commit()

	frappe.cache().delete_value("h2q_settings_doc")
	frappe.cache().delete_value("h2q_settings_public")
	return {"seeded": changed, "settings": get_public_settings()}


def boq_policy() -> str:
	return get_settings().get("boq_over_limit_policy") or "Warn"


def telegram_chat_for(kind: str) -> str:
	"""kind: pending | certified | alerts"""
	s = get_settings()
	key = {
		"pending": "telegram_chat_id_pending",
		"certified": "telegram_chat_id_certified",
		"alerts": "telegram_chat_id_alerts",
	}.get(kind, "telegram_chat_id_pending")
	return str(s.get(key) or frappe.conf.get("telegram_chat_id") or "485567058")


def is_telegram_feature_on() -> bool:
	"""Desk flag AND site_config mute switch."""
	if "telegram_enabled" in frappe.conf and not cint(frappe.conf.get("telegram_enabled")):
		return False
	return bool(cint(get_settings().get("telegram_enabled", 1)))


def progress_percent_for_project(project: str, *, project_percent: float | None = None) -> float | None:
	"""Respect dashboard_progress_source."""
	source = get_settings().get("dashboard_progress_source") or "BOQ Qty"
	if source == "Project Percent Complete":
		return (
			flt(project_percent)
			if project_percent is not None
			else flt(frappe.db.get_value("Project", project, "percent_complete"))
		)

	pct = boq_progress_percent(project, use_amount=(source == "BOQ Amount"))
	if pct is not None:
		return pct
	return flt(project_percent) if project_percent is not None else None


def boq_progress_percent(project: str, *, use_amount: bool = False) -> float | None:
	"""Σ actual / Σ planned across BOQ Items (Approved BOQ preferred)."""
	try:
		if not frappe.db.exists("DocType", "BOQ"):
			return None
		boqs = frappe.get_all(
			"BOQ", filters={"project": project, "status": "Approved"}, pluck="name"
		) or frappe.get_all("BOQ", filters={"project": project}, pluck="name")
		if not boqs:
			return None

		if use_amount:
			items = frappe.get_all(
				"BOQ Item",
				filters={"boq": ["in", boqs]},
				fields=["planned_amount", "actual_amount"],
			)
			planned = sum(flt(i.planned_amount) for i in items)
			if planned <= 0:
				return None
			actual = sum(flt(i.actual_amount) for i in items)
			return round(min(actual / planned * 100.0, 999.0), 2)

		items = frappe.get_all(
			"BOQ Item",
			filters={"boq": ["in", boqs]},
			fields=["planned_qty", "actual_qty"],
		)
		planned = sum(flt(i.planned_qty) for i in items)
		if planned <= 0:
			return boq_progress_percent(project, use_amount=True)
		actual = sum(flt(i.actual_qty) for i in items)
		return round(min(actual / planned * 100.0, 999.0), 2)
	except Exception:
		return None
