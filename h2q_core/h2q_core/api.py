"""
H2Q Core — whitelisted REST APIs for the FastCons field PWA.

Endpoints (POST /api/method/...):
  h2q_core.api.get_h2q_settings
  h2q_core.api.get_active_projects
  h2q_core.api.get_project_wbs
  h2q_core.api.get_boq_item_defaults
  h2q_core.api.submit_measurement
  h2q_core.api.request_measurement_approval
  h2q_core.api.approve_measurement
  h2q_core.api.reject_measurement
  h2q_core.api.get_pending_approvals

Response contract (Frappe wraps the return value under top-level "message"):
  {"message": "success", "data": ...}

DocType mapping (BuildSuite / ERPNext — do NOT invent names):
  Project          → ERPNext Project
  Task (WBS)       → ERPNext Task
  BOQ / estimate   → BuildSuite "BOQ" (+ BOQ Item / BOQ Group)
  Measurement Book → BuildSuite "Measurement Book" (Draft → Certified, NOT submittable)
  H2Q approval     → custom_h2q_approval_status (Draft / Pending Approval / Approved / Rejected)
"""

from __future__ import annotations

import json
from typing import Any

import frappe
from frappe import _
from frappe.utils import cint, flt, getdate, today


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
# API 0 — Public H2Q Settings (PWA feature flags / policies)
# ---------------------------------------------------------------------------


@frappe.whitelist()
def get_h2q_settings() -> dict[str, Any]:
	"""Return admin-configurable knobs safe for the FastCons PWA."""
	try:
		from h2q_core.settings import get_public_settings

		return _ok(get_public_settings())
	except Exception:
		frappe.log_error(title="get_h2q_settings failed", message=frappe.get_traceback())
		frappe.throw(_("Unable to load H2Q Settings."))


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

		from h2q_core.settings import get_settings, progress_percent_for_project

		cfg = get_settings()
		enriched = []
		for row in rows:
			display = progress_percent_for_project(
				row.name, project_percent=flt(row.get("percent_complete"))
			)
			item = dict(row)
			item["boq_progress_percent"] = display
			item["percent_complete_display"] = display
			item["progress_source"] = cfg.get("dashboard_progress_source")
			enriched.append(item)

		return _ok({"projects": enriched, "count": len(enriched), "user": user})
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
				planned_qty = flt(it.planned_qty)
				actual_qty = flt(it.actual_qty)
				remaining_qty = planned_qty - actual_qty
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
					"planned_qty": planned_qty,
					"rate": it.rate,
					"planned_amount": it.planned_amount,
					"actual_qty": actual_qty,
					"actual_amount": it.actual_amount,
					"remaining_qty": remaining_qty,
					"progress_percent": (
						round((actual_qty / planned_qty) * 100.0, 2) if planned_qty else None
					),
					"over_limit": 1 if actual_qty > planned_qty and planned_qty > 0 else 0,
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
	Create a Draft Measurement Book from the field PWA / Supabase sync worker.

	BuildSuite Measurement Book mandatory parent fields (measurement_book.json):
	  - work_order (Link Subcontractor Work Order)
	  - project (Link Project)
	  - date (Date)

	BuildSuite Measurement Book Entry mandatory fields:
	  - description (Small Text)

	H2Q field extras (not on MB DocType; carried in remarks / entry mapping):
	  - task, uom, quantity, image_url(s), billed_amount/rate
	"""
	try:
		data = _parse_payload(payload)
		for key in (
			"project",
			"task",
			"quantity",
			"image_url",
			"image_urls",
			"images",
			"work_order",
			"work_order_line",
			"boq_item",
			"description",
			"date",
			"measurement_date",
			"remarks",
			"uom",
			"nos",
			"length",
			"breadth",
			"depth",
			"is_deduction",
			"rate",
			"billed_amount",
			"cost_code_type",
			"cost_code_group",
			"cost_code_item",
			"cost_code_label",
			"measured_by",
			"gps_lat",
			"gps_lng",
			"gps_accuracy",
			"latitude",
			"longitude",
			"auto_request_approval",
		):
			if key in kwargs and kwargs[key] not in (None, ""):
				data.setdefault(key, kwargs[key])

		project = data.get("project") or data.get("project_id")
		task = data.get("task") or data.get("task_id")
		quantity = flt(data.get("quantity"))
		work_order = data.get("work_order")
		boq_item_name = data.get("boq_item")
		description = (data.get("description") or "").strip()
		mb_date = data.get("date") or data.get("measurement_date") or today()
		remarks = data.get("remarks") or ""
		uom = data.get("uom")
		measured_by = data.get("measured_by") or frappe.session.user

		image_urls = data.get("image_urls") or data.get("images") or []
		if data.get("image_url"):
			if isinstance(image_urls, list):
				image_urls = [data.get("image_url"), *image_urls]
			else:
				image_urls = [data.get("image_url")]

		if isinstance(image_urls, str):
			try:
				image_urls = json.loads(image_urls)
			except json.JSONDecodeError:
				image_urls = [u.strip() for u in image_urls.split(",") if u.strip()]
		image_urls = [str(u).strip() for u in (image_urls or []) if str(u).strip()]

		# --- Validate against BuildSuite required parent fields ---
		if not project:
			frappe.throw(_("project is required (Measurement Book.project)."))
		if not work_order:
			# Still try resolve for older clients, but BuildSuite marks work_order reqd=1
			pass
		if not mb_date:
			frappe.throw(_("date is required (Measurement Book.date)."))
		if not task:
			frappe.throw(_("task is required (H2Q WBS / ERPNext Task)."))
		if quantity == 0:
			frappe.throw(_("quantity must be a non-zero number (Measurement Book Entry)."))

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
			cost_code_item=(boq_item or {}).get("code") or data.get("cost_code_item"),
		)
		if not work_order:
			frappe.throw(_("work_order is required (Measurement Book.work_order)."))

		wo_line = data.get("work_order_line") or _match_work_order_line(work_order, boq_item)

		# Entry.description is reqd=1 on Measurement Book Entry
		entry_description = (
			description
			or (boq_item or {}).get("description")
			or frappe.db.get_value("Task", task, "subject")
			or task
		)
		if not entry_description:
			frappe.throw(_("description is required (Measurement Book Entry.description)."))

		resolved_uom = uom or (boq_item or {}).get("unit")
		entry: dict[str, Any] = {
			"description": entry_description,
			"quantity": quantity,
			"is_deduction": 1 if data.get("is_deduction") in (1, "1", True, "true") else 0,
			"nos": flt(data.get("nos")) if data.get("nos") not in (None, "") else 1,
			"length": flt(data.get("length")) if data.get("length") not in (None, "") else None,
			"breadth": flt(data.get("breadth")) if data.get("breadth") not in (None, "") else None,
			"depth": flt(data.get("depth")) if data.get("depth") not in (None, "") else 1,
		}
		# Drop null dimension keys so Frappe defaults apply cleanly
		entry = {k: v for k, v in entry.items() if v is not None}

		if resolved_uom:
			entry["uom"] = resolved_uom
		if wo_line:
			entry["work_order_line"] = wo_line

		# Cost codes from payload or BOQ Item
		if data.get("cost_code_item") or data.get("cost_code_label") or boq_item:
			entry.update(
				{
					"cost_code_type": data.get("cost_code_type")
					or ("Item" if (boq_item or data.get("cost_code_item")) else None),
					"cost_code_group": data.get("cost_code_group")
					or (boq_item or {}).get("group_code")
					or "",
					"cost_code_item": data.get("cost_code_item") or (boq_item or {}).get("code") or "",
					"cost_code_label": data.get("cost_code_label")
					or (_cost_code_label(boq_item) if boq_item else ""),
				}
			)
			entry = {k: v for k, v in entry.items() if v not in (None, "")}

		rate = flt(data.get("rate") or (boq_item or {}).get("rate"))
		billed_amount = flt(data.get("billed_amount"))
		if not billed_amount and rate:
			billed_amount = rate * quantity

		from h2q_core.settings import get_settings

		cfg = get_settings()
		if not cint(cfg.get("enable_measurement_book", 1)):
			frappe.throw(_("Measurement Book is disabled in H2Q Settings."))

		# BOQ over-limit policy from H2Q Settings (Warn / Block / Warn Require Note)
		over_limit = 0
		remaining = None
		if boq_item:
			planned = flt(boq_item.get("planned_qty"))
			actual = flt(boq_item.get("actual_qty"))
			remaining = planned - actual
			if planned > 0 and quantity > remaining:
				over_limit = 1

		policy = cfg.get("boq_over_limit_policy") or "Warn"
		if over_limit and policy == "Block":
			frappe.throw(
				_(
					"Quantity {0} exceeds remaining BOQ qty {1}. "
					"Blocked by H2Q Settings (BOQ Over-Limit Policy = Block)."
				).format(quantity, remaining)
			)
		if over_limit and policy == "Warn Require Note" and not (remarks or "").strip():
			frappe.throw(
				_("BOQ over limit — remarks/note is required (H2Q Settings policy).")
			)

		gps_lat = data.get("gps_lat", data.get("latitude"))
		gps_lng = data.get("gps_lng", data.get("longitude"))
		gps_acc = data.get("gps_accuracy")
		if cint(cfg.get("gps_required")) and (gps_lat in (None, "") or gps_lng in (None, "")):
			frappe.throw(_("GPS is required (H2Q Settings)."))

		min_photos = cint(cfg.get("min_photos_on_submit"))
		if min_photos and len(image_urls) < min_photos:
			frappe.throw(
				_("At least {0} photo(s) required on submit (H2Q Settings).").format(min_photos)
			)

		if _child_has_field("Measurement Book Entry", "custom_h2q_boq_item") and boq_item:
			entry["custom_h2q_boq_item"] = boq_item.get("name")
		if _child_has_field("Measurement Book Entry", "custom_h2q_rate") and rate:
			entry["custom_h2q_rate"] = rate
		if _child_has_field("Measurement Book Entry", "custom_h2q_amount") and billed_amount:
			entry["custom_h2q_amount"] = billed_amount
		if _child_has_field("Measurement Book Entry", "custom_h2q_photo_url") and image_urls:
			entry["custom_h2q_photo_url"] = image_urls[0]

		meta_bits = [f"Task: {task}"]
		if boq_item:
			meta_bits.append(f"BOQ Item: {boq_item.get('code')}")
		if billed_amount:
			meta_bits.append(f"Billed Amount: {billed_amount}")
		if over_limit:
			meta_bits.append("WARN: over BOQ remaining qty")
		if image_urls:
			meta_bits.append(f"Photos: {len(image_urls)}")
			meta_bits.append(f"Image: {image_urls[0]}")
		suffix = " | ".join(meta_bits)
		composed_remarks = f"{remarks}\n{suffix}".strip() if remarks else suffix

		payload_doc: dict[str, Any] = {
			"doctype": "Measurement Book",
			"project": project,
			"work_order": work_order,
			"date": getdate(mb_date),
			"measured_by": measured_by,
			"status": "Draft",
			"remarks": composed_remarks,
			"entries": [entry],
		}
		_apply_mb_h2q_fields(
			payload_doc,
			task=task,
			boq_item_name=(boq_item or {}).get("name"),
			image_urls=image_urls,
			gps_lat=gps_lat,
			gps_lng=gps_lng,
			gps_acc=gps_acc,
			over_limit=over_limit,
			user=frappe.session.user,
		)

		doc = frappe.get_doc(payload_doc)
		doc.insert()
		attached = _attach_r2_images(doc.name, image_urls)

		if over_limit and cint(cfg.get("telegram_notify_on_over_limit", 1)):
			try:
				from h2q_core.telegram_bot import enqueue_over_limit_alert

				enqueue_over_limit_alert(doc.name)
			except Exception:
				frappe.log_error(title="over-limit telegram enqueue failed", message=frappe.get_traceback())

		approval_status = getattr(doc, "custom_h2q_approval_status", None) or "Draft"
		# Client override wins; else H2Q Settings default
		if "auto_request_approval" in data and data.get("auto_request_approval") not in (None, ""):
			auto_req = data.get("auto_request_approval") in (1, "1", True, "true")
		else:
			auto_req = bool(cint(cfg.get("auto_request_approval_default")))
		if auto_req:
			req = request_measurement_approval(measurement_book=doc.name)
			approval_status = (req.get("data") or {}).get("approval_status") or approval_status

		return _ok(
			{
				"measurement_book": doc.name,
				"status": doc.status,
				"approval_status": approval_status,
				"project": doc.project,
				"work_order": doc.work_order,
				"date": str(doc.date),
				"task": task,
				"description": entry_description,
				"uom": resolved_uom,
				"quantity": quantity,
				"billed_amount": billed_amount or None,
				"measured_total": doc.measured_total,
				"boq_item": (boq_item or {}).get("name"),
				"remaining_qty": remaining,
				"boq_over_limit_warn": over_limit,
				"image_url": image_urls[0] if image_urls else None,
				"attached_files": attached,
				"gps": {
					"lat": gps_lat,
					"lng": gps_lng,
					"accuracy": gps_acc,
				},
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
# API 4 — BOQ item defaults (autofill on hạng mục select)
# ---------------------------------------------------------------------------


@frappe.whitelist()
def get_boq_item_defaults(boq_item: str | None = None, project: str | None = None, task: str | None = None) -> dict[str, Any]:
	"""
	Return unit / planned_qty / rate / remaining for FastCons form autofill.
	Pass either boq_item name, or project+task to resolve the first linked item.
	"""
	try:
		frappe.has_permission("BOQ Item", ptype="read", throw=True)
		item = None
		if boq_item:
			if not frappe.db.exists("BOQ Item", boq_item):
				frappe.throw(_("BOQ Item {0} not found.").format(boq_item))
			item = frappe.get_doc("BOQ Item", boq_item)
			if project:
				boq_project = frappe.db.get_value("BOQ", item.boq, "project")
				if boq_project and boq_project != project:
					frappe.throw(_("BOQ Item {0} is not on Project {1}.").format(boq_item, project))
		elif project and task:
			resolved = _resolve_boq_item(project=project, task=task, boq_item_name=None)
			if not resolved:
				return _ok(None)
			item = frappe.get_doc("BOQ Item", resolved["name"])
		else:
			frappe.throw(_("Pass boq_item, or project + task."))

		# Enrich serialize with rate / actual
		planned = flt(item.planned_qty)
		actual = flt(item.actual_qty)
		remaining = planned - actual
		return _ok(
			{
				"name": item.name,
				"boq": item.boq,
				"code": item.code,
				"description": item.description,
				"unit": item.unit,
				"planned_qty": planned,
				"actual_qty": actual,
				"remaining_qty": remaining,
				"rate": flt(item.rate),
				"planned_amount": flt(item.planned_amount),
				"task": item.task,
				"work_package": item.work_package,
				"over_limit": 1 if actual > planned and planned > 0 else 0,
			}
		)
	except frappe.ValidationError:
		raise
	except Exception:
		frappe.log_error(title="get_boq_item_defaults failed", message=frappe.get_traceback())
		frappe.throw(_("Unable to load BOQ item defaults. See Error Log."))


# ---------------------------------------------------------------------------
# API 5–8 — Measurement approval lifecycle (wraps BuildSuite certify)
# ---------------------------------------------------------------------------


@frappe.whitelist()
def request_measurement_approval(measurement_book: str) -> dict[str, Any]:
	"""Draft → Pending Approval. Triggers Telegram via on_update hook."""
	try:
		if not measurement_book:
			frappe.throw(_("measurement_book is required."))
		doc = frappe.get_doc("Measurement Book", measurement_book)
		frappe.has_permission("Measurement Book", doc=doc, ptype="write", throw=True)

		if doc.status != "Draft":
			frappe.throw(
				_("Only BuildSuite Draft books can be sent for approval (got status={0}).").format(
					doc.status
				)
			)

		if not doc.meta.has_field("custom_h2q_approval_status"):
			frappe.throw(
				_("H2Q custom fields missing. Run: bench execute h2q_core.setup_phase2.run")
			)

		current = doc.custom_h2q_approval_status or "Draft"
		if current == "Pending Approval":
			return _ok(_mb_approval_payload(doc))
		if current == "Approved":
			frappe.throw(_("Measurement Book is already Approved."))

		doc.custom_h2q_approval_status = "Pending Approval"
		doc.custom_h2q_telegram_notified = 0
		doc.custom_h2q_reject_reason = None
		if doc.meta.has_field("custom_h2q_submitted_by_user"):
			doc.custom_h2q_submitted_by_user = frappe.session.user
		_link_employee_if_possible(doc)
		doc.save()
		frappe.db.commit()
		return _ok(_mb_approval_payload(doc))
	except frappe.ValidationError:
		raise
	except Exception:
		frappe.log_error(title="request_measurement_approval failed", message=frappe.get_traceback())
		frappe.throw(_("Unable to request approval. See Error Log."))


@frappe.whitelist()
def approve_measurement(measurement_book: str) -> dict[str, Any]:
	"""
	Pending Approval → Approved, then call BuildSuite
	`buildsuite_core.api.subcontract.certify_measurement_book` (canonical certify).
	"""
	try:
		if not measurement_book:
			frappe.throw(_("measurement_book is required."))
		doc = frappe.get_doc("Measurement Book", measurement_book)
		frappe.has_permission("Measurement Book", doc=doc, ptype="write", throw=True)

		if not doc.meta.has_field("custom_h2q_approval_status"):
			frappe.throw(
				_("H2Q custom fields missing. Run: bench execute h2q_core.setup_phase2.run")
			)

		current = doc.custom_h2q_approval_status or "Draft"
		if current not in ("Pending Approval", "Draft"):
			# Allow re-certify path only when already Approved but still Draft in BS (edge)
			if current == "Approved" and doc.status == "Certified":
				return _ok(_mb_approval_payload(doc))
			frappe.throw(_("Cannot approve from status {0}.").format(current))

		from h2q_core.settings import get_settings

		cfg = get_settings()
		min_photos = cint(cfg.get("min_photos_on_approve"))
		if min_photos:
			photo_count = 0
			raw = getattr(doc, "custom_h2q_photo_urls", None) or ""
			if raw:
				try:
					photo_count = len(json.loads(raw)) if isinstance(raw, str) else len(raw)
				except Exception:
					photo_count = 0
			file_count = frappe.db.count(
				"File", {"attached_to_doctype": "Measurement Book", "attached_to_name": doc.name}
			)
			if max(photo_count, file_count) < min_photos:
				frappe.throw(
					_("At least {0} photo(s) required before approve (H2Q Settings).").format(
						min_photos
					)
				)

		doc.custom_h2q_approval_status = "Approved"
		doc.custom_h2q_reject_reason = None
		doc.save()

		# Wrap BuildSuite core — do NOT set status=Certified manually
		from buildsuite_core.api.subcontract import certify_measurement_book

		certified = certify_measurement_book(measurement_book)
		frappe.db.commit()
		doc.reload()
		payload = _mb_approval_payload(doc)
		payload["buildsuite"] = certified
		return _ok(payload)
	except frappe.ValidationError:
		raise
	except Exception:
		frappe.log_error(title="approve_measurement failed", message=frappe.get_traceback())
		frappe.throw(_("Unable to approve measurement. See Error Log."))


@frappe.whitelist()
def reject_measurement(measurement_book: str, reason: str | None = None) -> dict[str, Any]:
	"""Pending Approval → Rejected. Keeps BuildSuite status=Draft so field can revise."""
	try:
		if not measurement_book:
			frappe.throw(_("measurement_book is required."))
		doc = frappe.get_doc("Measurement Book", measurement_book)
		frappe.has_permission("Measurement Book", doc=doc, ptype="write", throw=True)

		if not doc.meta.has_field("custom_h2q_approval_status"):
			frappe.throw(
				_("H2Q custom fields missing. Run: bench execute h2q_core.setup_phase2.run")
			)

		current = doc.custom_h2q_approval_status or "Draft"
		if current != "Pending Approval":
			frappe.throw(_("Only Pending Approval books can be rejected (got {0}).").format(current))

		if doc.status == "Certified":
			frappe.throw(_("Cannot reject a Certified Measurement Book. Revert in BuildSuite first."))

		doc.custom_h2q_approval_status = "Rejected"
		doc.custom_h2q_reject_reason = (reason or "").strip() or _("Rejected")
		doc.save()
		frappe.db.commit()
		return _ok(_mb_approval_payload(doc))
	except frappe.ValidationError:
		raise
	except Exception:
		frappe.log_error(title="reject_measurement failed", message=frappe.get_traceback())
		frappe.throw(_("Unable to reject measurement. See Error Log."))


@frappe.whitelist()
def get_pending_approvals(project: str | None = None, limit: int = 50) -> dict[str, Any]:
	"""Queue of Measurement Books awaiting FastCons approval."""
	try:
		frappe.has_permission("Measurement Book", ptype="read", throw=True)
		if not frappe.get_meta("Measurement Book").has_field("custom_h2q_approval_status"):
			return _ok({"items": [], "count": 0, "hint": "Run setup_phase2.run"})

		filters: dict[str, Any] = {"custom_h2q_approval_status": "Pending Approval"}
		if project:
			filters["project"] = project

		rows = frappe.get_list(
			"Measurement Book",
			filters=filters,
			fields=[
				"name",
				"project",
				"work_order",
				"date",
				"status",
				"measured_total",
				"measured_by",
				"custom_h2q_approval_status",
				"custom_h2q_task",
				"custom_h2q_boq_item",
				"custom_h2q_boq_over_limit",
				"custom_h2q_submitted_by_user",
				"modified",
			],
			order_by="modified desc",
			limit_page_length=cint_limit(limit),
		)
		for row in rows:
			row["project_name"] = (
				frappe.db.get_value("Project", row.project, "project_name") if row.project else None
			)
		return _ok({"items": rows, "count": len(rows)})
	except Exception:
		frappe.log_error(title="get_pending_approvals failed", message=frappe.get_traceback())
		frappe.throw(_("Unable to load pending approvals. See Error Log."))


# ---------------------------------------------------------------------------
# Resolvers / attachments
# ---------------------------------------------------------------------------


def _apply_mb_h2q_fields(
	payload: dict[str, Any],
	*,
	task: str | None,
	boq_item_name: str | None,
	image_urls: list[str],
	gps_lat: Any,
	gps_lng: Any,
	gps_acc: Any,
	over_limit: int,
	user: str,
) -> None:
	meta = frappe.get_meta("Measurement Book")
	if meta.has_field("custom_h2q_approval_status"):
		payload["custom_h2q_approval_status"] = "Draft"
	if meta.has_field("custom_h2q_task") and task:
		payload["custom_h2q_task"] = task
	if meta.has_field("custom_h2q_boq_item") and boq_item_name:
		payload["custom_h2q_boq_item"] = boq_item_name
	if meta.has_field("custom_h2q_photo_urls") and image_urls:
		payload["custom_h2q_photo_urls"] = json.dumps(image_urls, ensure_ascii=False)
	if meta.has_field("custom_h2q_gps_lat") and gps_lat not in (None, ""):
		payload["custom_h2q_gps_lat"] = flt(gps_lat)
	if meta.has_field("custom_h2q_gps_lng") and gps_lng not in (None, ""):
		payload["custom_h2q_gps_lng"] = flt(gps_lng)
	if meta.has_field("custom_h2q_gps_accuracy") and gps_acc not in (None, ""):
		payload["custom_h2q_gps_accuracy"] = flt(gps_acc)
	if meta.has_field("custom_h2q_boq_over_limit"):
		payload["custom_h2q_boq_over_limit"] = 1 if over_limit else 0
	if meta.has_field("custom_h2q_telegram_notified"):
		payload["custom_h2q_telegram_notified"] = 0
	if meta.has_field("custom_h2q_submitted_by_user"):
		payload["custom_h2q_submitted_by_user"] = user


def _child_has_field(doctype: str, fieldname: str) -> bool:
	try:
		return bool(frappe.get_meta(doctype).has_field(fieldname))
	except Exception:
		return False


def _link_employee_if_possible(doc) -> None:
	if not doc.meta.has_field("custom_h2q_submitted_by_employee"):
		return
	if not frappe.db.exists("DocType", "Employee"):
		return
	emp = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
	if emp:
		doc.custom_h2q_submitted_by_employee = emp


def _mb_approval_payload(doc) -> dict[str, Any]:
	return {
		"measurement_book": doc.name,
		"status": doc.status,
		"approval_status": getattr(doc, "custom_h2q_approval_status", None),
		"project": doc.project,
		"work_order": doc.work_order,
		"measured_total": doc.measured_total,
		"task": getattr(doc, "custom_h2q_task", None),
		"boq_item": getattr(doc, "custom_h2q_boq_item", None),
		"boq_over_limit": cint(getattr(doc, "custom_h2q_boq_over_limit", 0)),
		"reject_reason": getattr(doc, "custom_h2q_reject_reason", None),
		"certified_by": doc.get("certified_by"),
	}


def cint_limit(value: Any, default: int = 50, maximum: int = 200) -> int:
	from frappe.utils import cint

	n = cint(value) or default
	return max(1, min(n, maximum))


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
		fields=[
			"name",
			"boq",
			"boq_group",
			"code",
			"description",
			"unit",
			"planned_qty",
			"actual_qty",
			"rate",
			"task",
		],
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
		"actual_qty": it.get("actual_qty"),
		"rate": it.get("rate"),
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
