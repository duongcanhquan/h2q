"""
H2Q — Frappe Workflow for Measurement Book approval (FastCons).

States live on custom field `custom_h2q_approval_status` so we never overwrite
BuildSuite native `status` (Draft / Certified).

  Draft → Pending Approval → Approved  (+ certify via API)
                         ↘ Rejected

  bench --site <site> execute h2q_core.setup_workflow.setup_measurement_workflow
"""

from __future__ import annotations

from typing import Any

import frappe
from frappe import _

WORKFLOW_NAME = "H2Q Measurement Book Approval"
DOCUMENT_TYPE = "Measurement Book"
STATE_FIELD = "custom_h2q_approval_status"

STATES = (
	("Draft", "Primary"),
	("Pending Approval", "Warning"),
	("Approved", "Success"),
	("Rejected", "Danger"),
)

ACTIONS = (
	"Submit for Approval",
	"Approve",
	"Reject",
	"Revise",
)

# Prefer BuildSuite personas when present; always include System Manager
ROLE_SUBMITTERS = (
	"System Manager",
	"Employee",
	"Projects User",
	"BuildSuite Site Engineer",
	"BuildSuite Foreman",
	"BuildSuite PM",
	"BuildSuite Project User",
)

ROLE_APPROVERS = (
	"System Manager",
	"Projects Manager",
	"BuildSuite PM",
	"BuildSuite Director",
	"BuildSuite QS",
	"BuildSuite Administrator",
)


def setup_measurement_workflow() -> dict[str, Any]:
	"""Seed workflow from H2Q Settings approval matrix (fallback: built-in role lists)."""
	submitters, approvers = _roles_from_settings_or_defaults()
	return _setup_with_roles(submitters, approvers)


def setup_measurement_workflow_from_settings(settings_doc) -> dict[str, Any]:
	"""Called from H2Q Settings.on_update when resync_workflow_on_save is on."""
	submitters: list[str] = []
	approvers: list[str] = []
	for row in sorted(settings_doc.approval_roles or [], key=lambda r: r.sort_order or 0):
		if not row.role or not frappe.db.exists("Role", row.role):
			continue
		if row.can_submit and row.role not in submitters:
			submitters.append(row.role)
		if row.can_approve and row.role not in approvers:
			approvers.append(row.role)
	if "System Manager" not in submitters and frappe.db.exists("Role", "System Manager"):
		submitters.insert(0, "System Manager")
	if "System Manager" not in approvers and frappe.db.exists("Role", "System Manager"):
		approvers.insert(0, "System Manager")
	return _setup_with_roles(submitters or ["System Manager"], approvers or ["System Manager"])


def _roles_from_settings_or_defaults() -> tuple[list[str], list[str]]:
	if frappe.db.exists("DocType", "H2Q Settings"):
		try:
			from h2q_core.settings import get_settings

			s = get_settings()
			rows = s.get("approval_roles") or []
			if rows:
				submitters = [r["role"] for r in rows if r.get("can_submit") and r.get("role")]
				approvers = [r["role"] for r in rows if r.get("can_approve") and r.get("role")]
				submitters = _existing_roles(tuple(submitters))
				approvers = _existing_roles(tuple(approvers))
				return submitters, approvers
		except Exception:
			pass
	return (
		_existing_roles(ROLE_SUBMITTERS),
		_existing_roles(ROLE_APPROVERS),
	)


def _setup_with_roles(submitters: list[str], approvers: list[str]) -> dict[str, Any]:
	if not frappe.db.exists("DocType", DOCUMENT_TYPE):
		frappe.throw(_("DocType {0} is not installed.").format(DOCUMENT_TYPE))

	meta = frappe.get_meta(DOCUMENT_TYPE)
	if not meta.has_field(STATE_FIELD):
		frappe.throw(
			_(
				"Custom field {0} missing on {1}. "
				"Run h2q_core.setup_custom_fields.setup_custom_fields first."
			).format(STATE_FIELD, DOCUMENT_TYPE)
		)

	_ensure_states()
	_ensure_actions()
	doc = _upsert_workflow(submitters=submitters, approvers=approvers)
	frappe.db.commit()
	frappe.clear_cache()
	return {
		"workflow": doc.name,
		"document_type": DOCUMENT_TYPE,
		"state_field": STATE_FIELD,
		"submitters": submitters,
		"approvers": approvers,
		"is_active": 1,
	}


def _ensure_states() -> None:
	for name, style in STATES:
		if frappe.db.exists("Workflow State", name):
			continue
		frappe.get_doc(
			{
				"doctype": "Workflow State",
				"workflow_state_name": name,
				"style": style,
			}
		).insert(ignore_permissions=True)


def _ensure_actions() -> None:
	for name in ACTIONS:
		if frappe.db.exists("Workflow Action Master", name):
			continue
		frappe.get_doc(
			{
				"doctype": "Workflow Action Master",
				"workflow_action_name": name,
			}
		).insert(ignore_permissions=True)


def _existing_roles(candidates: tuple[str, ...]) -> list[str]:
	out: list[str] = []
	seen: set[str] = set()
	for role in candidates:
		if role in seen:
			continue
		if frappe.db.exists("Role", role):
			out.append(role)
			seen.add(role)
	if "System Manager" not in seen and frappe.db.exists("Role", "System Manager"):
		out.insert(0, "System Manager")
	return out or ["System Manager"]


def _upsert_workflow(*, submitters: list[str], approvers: list[str]) -> Any:
	if not submitters:
		submitters = ["System Manager"]
	if not approvers:
		approvers = ["System Manager"]

	states = [
		{
			"state": name,
			"doc_status": "0",
			"allow_edit": "System Manager",
			"is_optional_state": 0,
		}
		for name, _style in STATES
	]

	transitions: list[dict[str, Any]] = []
	for role in submitters:
		transitions.append(
			{
				"state": "Draft",
				"action": "Submit for Approval",
				"next_state": "Pending Approval",
				"allowed": role,
				"allow_self_approval": 1,
				"condition": "",
			}
		)
		transitions.append(
			{
				"state": "Rejected",
				"action": "Revise",
				"next_state": "Draft",
				"allowed": role,
				"allow_self_approval": 1,
				"condition": "",
			}
		)

	for role in approvers:
		transitions.append(
			{
				"state": "Pending Approval",
				"action": "Approve",
				"next_state": "Approved",
				"allowed": role,
				"allow_self_approval": 1,
				"condition": "",
			}
		)
		transitions.append(
			{
				"state": "Pending Approval",
				"action": "Reject",
				"next_state": "Rejected",
				"allowed": role,
				"allow_self_approval": 1,
				"condition": "",
			}
		)

	payload = {
		"doctype": "Workflow",
		"workflow_name": WORKFLOW_NAME,
		"document_type": DOCUMENT_TYPE,
		"is_active": 1,
		"override_status": 0,
		"send_email_alert": 0,
		"workflow_state_field": STATE_FIELD,
		"states": states,
		"transitions": transitions,
	}

	if frappe.db.exists("Workflow", WORKFLOW_NAME):
		doc = frappe.get_doc("Workflow", WORKFLOW_NAME)
		doc.update(payload)
		# Clear child tables before re-append via update may duplicate — rebuild
		doc.set("states", [])
		doc.set("transitions", [])
		for s in states:
			doc.append("states", s)
		for t in transitions:
			doc.append("transitions", t)
		doc.is_active = 1
		doc.workflow_state_field = STATE_FIELD
		doc.flags.ignore_permissions = True
		doc.save()
		return doc

	doc = frappe.get_doc(payload)
	doc.flags.ignore_permissions = True
	doc.insert()
	return doc
