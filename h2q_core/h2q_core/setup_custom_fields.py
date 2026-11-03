"""
H2Q — Custom Fields for FastCons field UX on BuildSuite / ERPNext DocTypes.

Does NOT modify BuildSuite source. Uses Frappe Custom Field API only.

  bench --site <site> execute h2q_core.setup_custom_fields.setup_custom_fields
"""

from __future__ import annotations

from typing import Any

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

MODULE = "H2Q Core"

# Approval statuses (also used as Workflow states — see setup_workflow.py)
APPROVAL_OPTIONS = "Draft\nPending Approval\nApproved\nRejected"


def get_h2q_custom_fields() -> dict[str, list[dict[str, Any]]]:
	"""Field map passed to create_custom_fields(..., update=True)."""
	fields: dict[str, list[dict[str, Any]]] = {
		"Measurement Book": [
			{
				"fieldname": "custom_h2q_section",
				"fieldtype": "Section Break",
				"label": "H2Q FastCons",
				"insert_after": "remarks",
				"collapsible": 1,
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_approval_status",
				"fieldtype": "Select",
				"label": "H2Q Approval Status",
				"options": APPROVAL_OPTIONS,
				"default": "Draft",
				"in_list_view": 1,
				"in_standard_filter": 1,
				"insert_after": "custom_h2q_section",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_entry_kind",
				"fieldtype": "Select",
				"label": "H2Q Entry Kind",
				"options": "Thực hiện\nNghiệm thu",
				"default": "Thực hiện",
				"in_list_view": 1,
				"in_standard_filter": 1,
				"insert_after": "custom_h2q_approval_status",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_approval_level",
				"fieldtype": "Int",
				"label": "H2Q Approval Level",
				"default": "0",
				"read_only": 1,
				"insert_after": "custom_h2q_entry_kind",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_approval_log",
				"fieldtype": "Long Text",
				"label": "H2Q Approval Log (JSON)",
				"read_only": 1,
				"insert_after": "custom_h2q_approval_level",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_task",
				"fieldtype": "Link",
				"label": "H2Q Task (WBS)",
				"options": "Task",
				"insert_after": "custom_h2q_approval_log",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_boq_item",
				"fieldtype": "Link",
				"label": "H2Q BOQ Item",
				"options": "BOQ Item",
				"insert_after": "custom_h2q_task",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_col_break_gps",
				"fieldtype": "Column Break",
				"insert_after": "custom_h2q_boq_item",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_gps_lat",
				"fieldtype": "Float",
				"label": "GPS Latitude",
				"precision": "7",
				"insert_after": "custom_h2q_col_break_gps",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_gps_lng",
				"fieldtype": "Float",
				"label": "GPS Longitude",
				"precision": "7",
				"insert_after": "custom_h2q_gps_lat",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_gps_accuracy",
				"fieldtype": "Float",
				"label": "GPS Accuracy (m)",
				"precision": "2",
				"insert_after": "custom_h2q_gps_lng",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_photo_urls",
				"fieldtype": "Long Text",
				"label": "H2Q Photo URLs (JSON)",
				"insert_after": "custom_h2q_gps_accuracy",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_boq_over_limit",
				"fieldtype": "Check",
				"label": "BOQ Over Limit (warn)",
				"default": "0",
				"read_only": 1,
				"insert_after": "custom_h2q_photo_urls",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_geofence_outside",
				"fieldtype": "Check",
				"label": "Outside Site Geofence",
				"default": "0",
				"read_only": 1,
				"insert_after": "custom_h2q_boq_over_limit",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_telegram_notified",
				"fieldtype": "Check",
				"label": "Telegram Notified",
				"default": "0",
				"read_only": 1,
				"insert_after": "custom_h2q_geofence_outside",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_reject_reason",
				"fieldtype": "Small Text",
				"label": "Reject Reason",
				"insert_after": "custom_h2q_telegram_notified",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_submitted_by_user",
				"fieldtype": "Link",
				"label": "Submitted By User",
				"options": "User",
				"insert_after": "custom_h2q_reject_reason",
				"module": MODULE,
			},
		],
		"Measurement Book Entry": [
			{
				"fieldname": "custom_h2q_boq_item",
				"fieldtype": "Data",
				"label": "H2Q BOQ Item",
				"insert_after": "cost_code_label",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_photo_url",
				"fieldtype": "Data",
				"label": "H2Q Photo URL",
				"insert_after": "custom_h2q_boq_item",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_rate",
				"fieldtype": "Currency",
				"label": "H2Q Rate",
				"insert_after": "custom_h2q_photo_url",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_amount",
				"fieldtype": "Currency",
				"label": "H2Q Amount",
				"insert_after": "custom_h2q_rate",
				"module": MODULE,
			},
		],
		"Task Progress Entry": [
			{
				"fieldname": "custom_h2q_section",
				"fieldtype": "Section Break",
				"label": "H2Q FastCons",
				"insert_after": "blocker_detail",
				"collapsible": 1,
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_gps_lat",
				"fieldtype": "Float",
				"label": "GPS Latitude",
				"precision": "7",
				"insert_after": "custom_h2q_section",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_gps_lng",
				"fieldtype": "Float",
				"label": "GPS Longitude",
				"precision": "7",
				"insert_after": "custom_h2q_gps_lat",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_gps_accuracy",
				"fieldtype": "Float",
				"label": "GPS Accuracy (m)",
				"precision": "2",
				"insert_after": "custom_h2q_gps_lng",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_photo_urls",
				"fieldtype": "Long Text",
				"label": "H2Q Photo URLs (JSON)",
				"insert_after": "custom_h2q_gps_accuracy",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_safety_note",
				"fieldtype": "Small Text",
				"label": "Safety / ATSC Note",
				"insert_after": "custom_h2q_photo_urls",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_equipment_note",
				"fieldtype": "Small Text",
				"label": "Equipment Note",
				"insert_after": "custom_h2q_safety_note",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_weather",
				"fieldtype": "Select",
				"label": "Weather",
				"options": "Nắng\nMưa\nMưa nhỏ\nÂm u",
				"insert_after": "custom_h2q_equipment_note",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_site_condition",
				"fieldtype": "Select",
				"label": "Site Condition",
				"options": "Tốt\nTrung bình\nKém",
				"insert_after": "custom_h2q_weather",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_safety_status",
				"fieldtype": "Select",
				"label": "Safety Status",
				"options": "Tốt\nTrung bình\nKém",
				"insert_after": "custom_h2q_site_condition",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_labour_count",
				"fieldtype": "Int",
				"label": "Labour Count",
				"insert_after": "custom_h2q_safety_status",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_diary_qty",
				"fieldtype": "Float",
				"label": "Diary Quantity (not billable)",
				"precision": "3",
				"description": "Ước lượng trong nhật ký. Không cộng vào sổ nghiệm thu.",
				"insert_after": "custom_h2q_labour_count",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_work_note",
				"fieldtype": "Small Text",
				"label": "Work Note",
				"insert_after": "custom_h2q_diary_qty",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_diary_date",
				"fieldtype": "Date",
				"label": "Diary Date",
				"insert_after": "custom_h2q_work_note",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_geofence_outside",
				"fieldtype": "Check",
				"label": "Outside Site Geofence",
				"default": "0",
				"read_only": 1,
				"insert_after": "custom_h2q_diary_date",
				"module": MODULE,
			},
		],
		"Project": [
			{
				"fieldname": "custom_h2q_section",
				"fieldtype": "Section Break",
				"label": "H2Q FastCons",
				"insert_after": "priority",
				"collapsible": 1,
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_contract_no",
				"fieldtype": "Data",
				"label": "H2Q Contract No (CĐT)",
				"insert_after": "custom_h2q_section",
				"module": MODULE,
			},
			{
				"fieldname": "custom_h2q_site_geofence_json",
				"fieldtype": "Long Text",
				"label": "Site Geofence JSON",
				"insert_after": "custom_h2q_contract_no",
				"module": MODULE,
			},
		],
	}

	# Optional HR link — only if Employee DocType is installed
	if frappe.db.exists("DocType", "Employee"):
		fields["Measurement Book"].append(
			{
				"fieldname": "custom_h2q_submitted_by_employee",
				"fieldtype": "Link",
				"label": "Submitted By Employee",
				"options": "Employee",
				"insert_after": "custom_h2q_submitted_by_user",
				"module": MODULE,
			}
		)

	return fields


def setup_custom_fields() -> dict[str, Any]:
	"""Idempotent: create/update all H2Q custom fields."""
	field_map = get_h2q_custom_fields()
	# Skip DocTypes that are not installed on this site
	filtered: dict[str, list[dict[str, Any]]] = {}
	skipped: list[str] = []
	for dt, rows in field_map.items():
		if frappe.db.exists("DocType", dt):
			filtered[dt] = rows
		else:
			skipped.append(dt)

	if filtered:
		create_custom_fields(filtered, update=True)
		frappe.clear_cache()
		frappe.db.commit()

	created_counts = {dt: len(rows) for dt, rows in filtered.items()}
	return {
		"doctypes": created_counts,
		"skipped_missing_doctypes": skipped,
		"message": "H2Q custom fields synced",
	}
