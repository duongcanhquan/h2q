"""
H2Q Core — whitelisted REST APIs for the FastCons field PWA.

Endpoints (POST /api/method/...):
  h2q_core.api.get_active_projects
  h2q_core.api.get_project_wbs
  h2q_core.api.submit_measurement

Response contract (Frappe wraps the return value under top-level "message"):
  {"message": "success", "data": ...}

DocType mapping (BuildSuite / ERPNext — do NOT invent names):
  Project          → ERPNext Project
  Task (WBS)       → ERPNext Task
  BOQ / estimate   → BuildSuite "BOQ" (+ BOQ Item / BOQ Group)
  Measurement Book → BuildSuite "Measurement Book" (Draft → Certified, NOT submittable)
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


def _fail(error: str, *, code: str = "error") -> dict[str, Any]:
	return {"message": "error", "error": error, "code": code}


def _parse_payload(payload: Any) -> dict[str, Any]:
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
# API 1 — Active projects for current user
# ---------------------------------------------------------------------------


@frappe.whitelist()
def get_active_projects() -> dict[str, Any]:
	"""
	Projects assigned to / readable by the logged-in user.

	Sources (union, then permission-filter):
	  1. ERPNext Project User child table (`tabProject User`)
	  2. BuildSuite Project Team (`custom_team_members` / Project Team) when present
	  3. Fallback: all Open projects the user can read (frappe.get_list)
	"""
	try:
		user = frappe.session.user
		if not user or user == "Guest":
			frappe.throw(_("Authentication required."), frappe.AuthenticationError)

		project_ids = set(_projects_from_project_user(user))
		project_ids.update(_projects_from_buildsuite_team(user))

		filters: dict[str, Any] = {
			"status": ["not in", ["Completed", "Cancelled"]],
		}
		if project_ids and user not in ("Administrator",):
			filters["name"] = ["in", list(project_ids)]

		# get_list applies user permissions automatically
		rows = frappe.get_list(
			"Project",
			filters=filters,
			fields=[
				"name",
				"project_name",
				"status",
				"percent_complete",
				"expected_start_date",
				"expected_end_date",
				"company",
				"customer",
				"priority",
			],
			order_by="modified desc",
			limit_page_length=200,
		)

		# If team filters produced nothing but user can still see projects, fall back once
		if not rows and project_ids:
			rows = frappe.get_list(
				"Project",
				filters={"status": ["not in", ["Completed", "Cancelled"]]},
				fields=[
					"name",
					"project_name",
					"status",
					"percent_complete",
					"expected_start_date",
					"expected_end_date",
					"company",
					"customer",
					"priority",
				],
				order_by="modified desc",
				limit_page_length=200,
			)

		return _ok({"projects": rows, "count": len(rows), "user": user})
	except frappe.AuthenticationError:
		raise
	except Exception:
		frappe.log_error(title="get_active_projects failed", message=frappe.get_traceback())
		frappe.throw(_("Unable to load projects. See Error Log."))


def _projects_from_project_user(user: str) -> list[str]:
	if not frappe.db.table_exists("tabProject User"):
		return []
	return frappe.get_all("Project User", filters={"user": user}, pluck="parent")


def _projects_from_buildsuite_team(user: str) -> list[str]:
	"""BuildSuite stores team on Project.custom_team_members → child DocType Project Team."""
	if not frappe.db.exists("DocType", "Project Team"):
		return []
	try:
		return frappe.get_all("Project Team", filters={"user": user}, pluck="parent")
	except Exception:
		return []


# ---------------------------------------------------------------------------
# API 2 — WBS (Task) + BOQ for one project
# ---------------------------------------------------------------------------


@frappe.whitelist()
def get_project_wbs(project: str) -> dict[str, Any]:
	"""
	Return Tasks (WBS tree) and BuildSuite BOQ / BOQ Items for a project.

	Call: /api/method/h2q_core.api.get_project_wbs  args: project=<name>
	"""
	try:
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

		# BuildSuite DocType name is "BOQ" (not "Project BOQ")
		boq_rows = frappe.get_all(
			"BOQ",
			filters={"project": project, "status": "Approved"},
			fields=["name", "title", "revision", "status", "planned_amount", "total", "company"],
			order_by="revision desc",
		)
		if not boq_rows:
			boq_rows = frappe.get_all(
				"BOQ",
				filters={"project": project},
				fields=["name", "title", "revision", "status", "planned_amount", "total", "company"],
				order_by="revision desc",
			)

		boq_names = [b.name for b in boq_rows]
		boq_items: list[dict[str, Any]] = []
		items_by_task: dict[str, list[dict[str, Any]]] = {}

		if boq_names:
			group_codes: dict[str, str] = {}
			group_names: dict[str, str] = {}
			for g in frappe.get_all(
				"BOQ Group",
				filters={"boq": ["in", boq_names]},
				fields=["name", "code", "group_name"],
			):
				group_codes[g.name] = g.code
				group_names[g.name] = g.group_name

			boq_title = {b.name: b.title for b in boq_rows}
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

		task_payload = [{**t, "boq_items": items_by_task.get(t.name, [])} for t in tasks]

		return _ok(
			{
				"project": project,
				"project_name": project_name,
				"tasks": task_payload,
				"boqs": boq_rows,
				"boq_items": boq_items,
			}
		)
	except Exception:
		frappe.log_error(
			title=f"get_project_wbs failed · {project}",
			message=frappe.get_traceback(),
		)
		raise


# ---------------------------------------------------------------------------
# API 3 — Submit field measurement → Draft Measurement Book
# ---------------------------------------------------------------------------


@frappe.whitelist()
def submit_measurement(payload: str | dict | None = None, **kwargs) -> dict[str, Any]:
	"""
	Create a Draft Measurement Book from the field PWA.

	JSON payload:
	  {
	    "project": "PROJ-0001",                 # required
	    "task": "TASK-0001",                    # required (WBS)
	    "quantity": 12.5,                       # required
	    "image_urls": ["https://r2.../a.jpg"],  # optional R2 URLs
	    "work_order": "SWO-...",                # recommended (MB.work_order is required)
	    "boq_item": "...",                      # optional
	    "description": "...",
	    "date": "2026-11-02",
	    "remarks": "..."
	  }
	"""
	try:
		data = _parse_payload(payload)
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

		meta_bits = [f"Task: {task}"]
		if boq_item:
			meta_bits.append(f"BOQ Item: {boq_item.get('code')}")
		if image_urls:
			meta_bits.append(f"Photos: {len(image_urls)}")
		suffix = " | ".join(meta_bits)
		composed_remarks = f"{remarks}\n{suffix}".strip() if remarks else suffix

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
	except frappe.ValidationError:
		raise
	except Exception:
		frappe.log_error(title="submit_measurement failed", message=frappe.get_traceback())
		frappe.throw(_("Unable to create Measurement Book. See Error Log."))


# Backward-compatible aliases (older frontend drafts)
get_project_tasks_and_boq = get_project_wbs
create_draft_measurement_book = submit_measurement
submit_daily_report = submit_measurement


# ---------------------------------------------------------------------------
# Resolvers / attachments
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

	approved = frappe.get_all(
		"BOQ", filters={"project": project, "status": "Approved"}, pluck="name"
	) or frappe.get_all("BOQ", filters={"project": project}, pluck="name")
	if not approved:
		return None

	rows = frappe.get_all(
		"BOQ Item",
		filters={"boq": ["in", approved], "task": task},
		fields=["name", "boq", "boq_group", "code", "description", "unit", "planned_qty", "task"],
		limit=1,
	)
	if not rows:
		return None
	return _serialize_boq_item(frappe._dict(rows[0]))


def _serialize_boq_item(it) -> dict[str, Any]:
	group_code = frappe.db.get_value("BOQ Group", it.boq_group, "code") if it.boq_group else None
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
	) or frappe.get_all(
		"Subcontractor Work Order",
		filters={"project": project, "docstatus": 0},
		pluck="name",
	)

	if not candidates:
		frappe.throw(
			_(
				"No Subcontractor Work Order found for Project {0}. "
				"Pass work_order in the payload (BuildSuite requires it on Measurement Book)."
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
			"Multiple Work Orders on Project {0}. Pass work_order explicitly. Candidates: {1}"
		).format(project, ", ".join(candidates[:10]))
	)


def _match_work_order_line(work_order: str, boq_item: dict[str, Any] | None) -> str | None:
	if not boq_item or not boq_item.get("code"):
		return None
	return frappe.db.get_value(
		"Subcontractor Work Order Line",
		{"parent": work_order, "cost_code_item": boq_item["code"]},
		"name",
	)


def _attach_r2_images(measurement_book: str, image_urls: list[Any]) -> list[dict[str, str]]:
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
		file_doc.flags.ignore_permissions = True
		file_doc.insert()
		attached.append({"name": file_doc.name, "file_url": file_doc.file_url})
	return attached
