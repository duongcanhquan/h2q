"""
Whitelisted REST APIs for the H2Q React PWA (field engineers).

Endpoints (POST /api/method/<dotted.path>):
  h2q_core.api.get_project_tasks_and_boq
  h2q_core.api.create_draft_measurement_book

Response contract (function return value → Frappe wraps as top-level "message"):
  {"message": "success", "data": ...}
"""

from __future__ import annotations

import json
from typing import Any

import frappe
from frappe import _
from frappe.utils import flt, getdate, today


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------


def _ok(data: Any = None) -> dict[str, Any]:
	return {"message": "success", "data": data}


def _parse_payload(payload: Any) -> dict[str, Any]:
	"""Accept dict (frappe.call kwargs) or JSON string (raw body / form)."""
	if payload is None:
		return {}
	if isinstance(payload, dict):
		return payload
	if isinstance(payload, str):
		payload = payload.strip()
		if not payload:
			return {}
		try:
			parsed = json.loads(payload)
		except json.JSONDecodeError as exc:
			frappe.throw(_("Invalid JSON payload: {0}").format(str(exc)))
		if not isinstance(parsed, dict):
			frappe.throw(_("Payload must be a JSON object."))
		return parsed
	frappe.throw(_("Unsupported payload type."))


# ---------------------------------------------------------------------------
# API 1 — Project → Tasks (WBS) + BOQ
# ---------------------------------------------------------------------------


@frappe.whitelist()
def get_project_tasks_and_boq(project: str) -> dict[str, Any]:
	"""
	Return Tasks (WBS) for a Project and the BOQ items linked to each task.

	Call:
	  /api/method/h2q_core.api.get_project_tasks_and_boq
	  Args: project=<Project name>
	"""
	if not project:
		frappe.throw(_("project is required."))

	if not frappe.db.exists("Project", project):
		frappe.throw(_("Project {0} not found.").format(project))

	frappe.has_permission("Project", doc=project, throw=True)

	project_name = frappe.db.get_value("Project", project, "project_name") or project

	tasks = frappe.get_all(
		"Task",
		filters={"project": project},
		fields=[
			"name",
			"subject",
			"parent_task",
			"status",
			"priority",
			"exp_start_date",
			"exp_end_date",
			"progress",
			"is_group",
		],
		order_by="lft asc",
	)

	# Approved BOQs for this project (BuildSuite only costs against Approved)
	boq_rows = frappe.get_all(
		"BOQ",
		filters={"project": project, "status": "Approved"},
		fields=["name", "title", "revision", "status", "planned_amount", "total", "company"],
		order_by="revision desc",
	)
	boq_names = [b.name for b in boq_rows]

	boq_items: list[dict[str, Any]] = []
	items_by_task: dict[str, list[dict[str, Any]]] = {}

	if boq_names:
		raw_items = frappe.get_all(
			"BOQ Item",
			filters={"boq": ["in", boq_names]},
			fields=[
				"name",
				"boq",
				"boq_group",
				"code",
				"description",
				"unit",
				"planned_qty",
				"rate",
				"planned_amount",
				"actual_qty",
				"actual_amount",
				"task",
				"work_package",
				"cost_head",
			],
			order_by="code asc",
		)

		group_codes = {}
		group_names = {}
		groups = frappe.get_all(
			"BOQ Group",
			filters={"boq": ["in", boq_names]},
			fields=["name", "code", "group_name"],
		)
		for g in groups:
			group_codes[g.name] = g.code
			group_names[g.name] = g.group_name

		boq_title = {b.name: b.title for b in boq_rows}

		for it in raw_items:
			row = {
				"name": it.name,
				"boq": it.boq,
				"boq_title": boq_title.get(it.boq),
				"boq_group": it.boq_group,
				"group_code": group_codes.get(it.boq_group),
				"group_name": group_names.get(it.boq_group),
				"code": it.code,
				"description": it.description,
				"unit": it.unit,
				"planned_qty": it.planned_qty,
				"rate": it.rate,
				"planned_amount": it.planned_amount,
				"actual_qty": it.actual_qty,
				"actual_amount": it.actual_amount,
				"task": it.task,
				"work_package": it.work_package,
				"cost_head": it.cost_head,
			}
			boq_items.append(row)
			if it.task:
				items_by_task.setdefault(it.task, []).append(row)

	task_payload = []
	for t in tasks:
		task_payload.append(
			{
				**t,
				"boq_items": items_by_task.get(t.name, []),
			}
		)

	return _ok(
		{
			"project": project,
			"project_name": project_name,
			"tasks": task_payload,
			"boqs": boq_rows,
			"boq_items": boq_items,
		}
	)


# ---------------------------------------------------------------------------
# API 2 — Create Draft Measurement Book from field payload
# ---------------------------------------------------------------------------


@frappe.whitelist()
def create_draft_measurement_book(payload: str | dict | None = None, **kwargs) -> dict[str, Any]:
	"""
	Create a Draft Measurement Book from the React PWA.

	Payload (JSON object or form field `payload`):
	  {
	    "project": "PROJ-0001",              # required
	    "task": "TASK-0001",                 # required (WBS)
	    "quantity": 12.5,                    # required — khối lượng thi công kỳ này
	    "image_urls": ["https://files.../a.jpg"],  # optional — R2 URLs
	    "work_order": "SWO-2026-00001",      # recommended (required if >1 WO on project)
	    "boq_item": "hash...",               # optional — pin exact BOQ Item
	    "description": "...",                # optional override
	    "date": "2026-11-02",                # optional, default today
	    "remarks": "..."                     # optional
	  }

	Also accepts flat kwargs of the same keys (frappe.call style).
	"""
	data = _parse_payload(payload)
	# Merge flat kwargs so both calling styles work
	for key in (
		"project",
		"task",
		"quantity",
		"image_urls",
		"images",
		"work_order",
		"boq_item",
		"description",
		"date",
		"remarks",
	):
		if key in kwargs and kwargs[key] not in (None, ""):
			data.setdefault(key, kwargs[key])

	project = data.get("project")
	task = data.get("task")
	quantity = flt(data.get("quantity"))
	image_urls = data.get("image_urls") or data.get("images") or []
	work_order = data.get("work_order")
	boq_item_name = data.get("boq_item")
	description = data.get("description")
	mb_date = data.get("date") or today()
	remarks = data.get("remarks") or ""

	if isinstance(image_urls, str):
		try:
			image_urls = json.loads(image_urls)
		except json.JSONDecodeError:
			image_urls = [u.strip() for u in image_urls.split(",") if u.strip()]

	if not project:
		frappe.throw(_("project is required."))
	if not task:
		frappe.throw(_("task is required."))
	if quantity == 0:
		frappe.throw(_("quantity must be a non-zero number."))

	if not frappe.db.exists("Project", project):
		frappe.throw(_("Project {0} not found.").format(project))
	if not frappe.db.exists("Task", task):
		frappe.throw(_("Task {0} not found.").format(task))

	task_project = frappe.db.get_value("Task", task, "project")
	if task_project and task_project != project:
		frappe.throw(_("Task {0} does not belong to Project {1}.").format(task, project))

	frappe.has_permission("Measurement Book", ptype="create", throw=True)

	boq_item = _resolve_boq_item(project=project, task=task, boq_item_name=boq_item_name)
	work_order = _resolve_work_order(
		project=project,
		work_order=work_order,
		cost_code_item=(boq_item or {}).get("code"),
	)
	wo_line = _match_work_order_line(work_order, boq_item)

	entry_description = (
		description
		or (boq_item or {}).get("description")
		or frappe.db.get_value("Task", task, "subject")
		or task
	)

	entry: dict[str, Any] = {
		"description": entry_description,
		"quantity": quantity,
		"is_deduction": 0,
	}
	if boq_item:
		entry.update(
			{
				"cost_code_type": "Item",
				"cost_code_group": boq_item.get("group_code") or "",
				"cost_code_item": boq_item.get("code") or "",
				"cost_code_label": _cost_code_label(boq_item),
				"uom": boq_item.get("unit"),
			}
		)
	if wo_line:
		entry["work_order_line"] = wo_line

	# Tag task + R2 links into remarks so desk users see field context
	# (Measurement Book has no custom Task field in BuildSuite core).
	meta_bits = [f"Task: {task}"]
	if boq_item:
		meta_bits.append(f"BOQ Item: {boq_item.get('code')}")
	if image_urls:
		meta_bits.append(f"Photos: {len(image_urls)}")
	composed_remarks = remarks
	suffix = " | ".join(meta_bits)
	composed_remarks = f"{composed_remarks}\n{suffix}".strip() if composed_remarks else suffix

	doc = frappe.get_doc(
		{
			"doctype": "Measurement Book",
			"project": project,
			"work_order": work_order,
			"date": getdate(mb_date),
			"measured_by": frappe.session.user,
			"status": "Draft",
			"remarks": composed_remarks,
			"entries": [entry],
		}
	)
	doc.insert()

	attached = _attach_r2_images(doc.name, image_urls)

	return _ok(
		{
			"measurement_book": doc.name,
			"status": doc.status,
			"project": doc.project,
			"work_order": doc.work_order,
			"task": task,
			"measured_total": doc.measured_total,
			"boq_item": (boq_item or {}).get("name"),
			"attached_files": attached,
		}
	)


# ---------------------------------------------------------------------------
# Resolvers
# ---------------------------------------------------------------------------


def _resolve_boq_item(
	*, project: str, task: str, boq_item_name: str | None
) -> dict[str, Any] | None:
	if boq_item_name:
		if not frappe.db.exists("BOQ Item", boq_item_name):
			frappe.throw(_("BOQ Item {0} not found.").format(boq_item_name))
		it = frappe.get_doc("BOQ Item", boq_item_name)
		boq_project = frappe.db.get_value("BOQ", it.boq, "project")
		if boq_project and boq_project != project:
			frappe.throw(_("BOQ Item {0} is not on Project {1}.").format(boq_item_name, project))
		return _serialize_boq_item(it)

	# Prefer Approved BOQ items linked to this Task
	approved = frappe.get_all(
		"BOQ",
		filters={"project": project, "status": "Approved"},
		pluck="name",
	)
	if not approved:
		# Fallback: any BOQ on project (Draft/Submitted) so field crew can still log qty
		approved = frappe.get_all("BOQ", filters={"project": project}, pluck="name")
	if not approved:
		return None

	rows = frappe.get_all(
		"BOQ Item",
		filters={"boq": ["in", approved], "task": task},
		fields=[
			"name",
			"boq",
			"boq_group",
			"code",
			"description",
			"unit",
			"planned_qty",
			"task",
		],
		limit=1,
	)
	if not rows:
		return None
	return _serialize_boq_item(frappe._dict(rows[0]))


def _serialize_boq_item(it) -> dict[str, Any]:
	group_code = None
	if it.boq_group:
		group_code = frappe.db.get_value("BOQ Group", it.boq_group, "code")
	return {
		"name": it.name,
		"boq": it.boq,
		"boq_group": it.boq_group,
		"group_code": group_code,
		"code": it.code,
		"description": it.description,
		"unit": it.unit,
		"planned_qty": it.get("planned_qty"),
		"task": it.task,
	}


def _cost_code_label(boq_item: dict[str, Any]) -> str:
	code = boq_item.get("code") or ""
	desc = (boq_item.get("description") or "")[:50]
	return f"{code} · {desc}".strip(" ·")


def _resolve_work_order(
	*, project: str, work_order: str | None, cost_code_item: str | None
) -> str:
	"""
	Measurement Book.work_order is required by BuildSuite.
	Resolve from payload, else unique Submitted WO on project, else cost-code match.
	"""
	if work_order:
		if not frappe.db.exists("Subcontractor Work Order", work_order):
			frappe.throw(_("Work Order {0} not found.").format(work_order))
		wo_project = frappe.db.get_value("Subcontractor Work Order", work_order, "project")
		if wo_project != project:
			frappe.throw(
				_("Work Order {0} belongs to Project {1}, not {2}.").format(
					work_order, wo_project, project
				)
			)
		return work_order

	candidates = frappe.get_all(
		"Subcontractor Work Order",
		filters={"project": project, "docstatus": 1},
		pluck="name",
	)
	if not candidates:
		# Allow Draft WO as last resort for early site logging
		candidates = frappe.get_all(
			"Subcontractor Work Order",
			filters={"project": project, "docstatus": 0},
			pluck="name",
		)

	if not candidates:
		frappe.throw(
			_(
				"No Subcontractor Work Order found for Project {0}. "
				"Pass work_order in the payload."
			).format(project)
		)

	if len(candidates) == 1:
		return candidates[0]

	if cost_code_item:
		for name in candidates:
			if frappe.db.exists(
				"Subcontractor Work Order Line",
				{"parent": name, "cost_code_item": cost_code_item},
			):
				return name

	frappe.throw(
		_(
			"Multiple Work Orders on Project {0}. "
			"Pass work_order explicitly in the payload. Candidates: {1}"
		).format(project, ", ".join(candidates[:10]))
	)


def _match_work_order_line(work_order: str, boq_item: dict[str, Any] | None) -> str | None:
	if not boq_item or not boq_item.get("code"):
		return None
	line = frappe.db.get_value(
		"Subcontractor Work Order Line",
		{"parent": work_order, "cost_code_item": boq_item["code"]},
		"name",
	)
	return line


def _attach_r2_images(measurement_book: str, image_urls: list[Any]) -> list[dict[str, str]]:
	"""Attach already-uploaded R2 URLs as File rows linked to the Measurement Book."""
	attached: list[dict[str, str]] = []
	for raw in image_urls or []:
		url = str(raw or "").strip()
		if not url:
			continue
		if not url.startswith(("http://", "https://")):
			frappe.throw(_("image_urls must be absolute R2/HTTP URLs. Got: {0}").format(url))

		file_name = url.rstrip("/").split("/")[-1].split("?")[0] or "site-photo.jpg"
		file_doc = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": file_name,
				"file_url": url,
				"attached_to_doctype": "Measurement Book",
				"attached_to_name": measurement_book,
				"is_private": 0,
			}
		)
		# Remote URL — skip content write; insert metadata only
		file_doc.flags.ignore_permissions = True
		file_doc.insert()
		attached.append({"name": file_doc.name, "file_url": file_doc.file_url})
	return attached
