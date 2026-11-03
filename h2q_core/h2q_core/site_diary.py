"""Create or update a Task Progress Entry for one site day.

BuildSuite field names differ by version, so only fields that exist on the
DocType are written. Required fields that we cannot fill are reported by name.
"""

from __future__ import annotations

import json
from typing import Any

import frappe
from frappe import _
from frappe.utils import cint, flt, getdate

from h2q_core.geo import evaluate_geofence

WEATHER = ("Nắng", "Mưa", "Mưa nhỏ", "Âm u")
CONDITION = ("Tốt", "Trung bình", "Kém")
DATE_FIELDS = ("date", "posting_date", "progress_date", "entry_date")
SKIP_TYPES = {
	"Section Break",
	"Column Break",
	"Tab Break",
	"Fold",
	"HTML",
	"Button",
	"Heading",
}


def create_site_diary(data: dict[str, Any]) -> dict[str, Any]:
	from h2q_core.settings import get_settings

	cfg = get_settings()
	if not cint(cfg.get("enable_site_diary")):
		frappe.throw(_("Nhật ký thi công đang tắt trong H2Q Settings."))
	if not frappe.db.exists("DocType", "Task Progress Entry"):
		frappe.throw(_("Task Progress Entry chưa được cài trên site."))

	project = data.get("project") or data.get("project_id")
	if not project:
		frappe.throw(_("project is required."))
	if not frappe.db.exists("Project", project):
		frappe.throw(_("Project {0} not found.").format(project))
	frappe.has_permission("Task Progress Entry", ptype="create", throw=True)

	diary_date = getdate(data.get("date") or data.get("diary_date"))
	weather = _choice(data.get("weather"), WEATHER, "Nắng")
	site_condition = _choice(data.get("site_condition"), CONDITION, "Tốt")
	safety_status = _choice(data.get("safety_status"), CONDITION, "Tốt")
	work_note = (data.get("work_note") or data.get("remarks") or "").strip()
	image_urls = _image_urls(data)
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

	verdict = _geofence_verdict(cfg, project, gps_lat, gps_lng)
	if verdict["action"] == "block":
		frappe.throw(_(verdict["message"]))

	lines = data.get("lines") or []
	if isinstance(lines, str):
		lines = json.loads(lines) if lines else []
	if not isinstance(lines, list) or not lines:
		lines = [
			{
				"task": data.get("task"),
				"quantity": data.get("quantity"),
				"description": data.get("description") or work_note,
				"labour_count": data.get("labour_count"),
				"equipment_note": data.get("equipment_note"),
			}
		]

	names: list[str] = []
	for line in lines:
		if not isinstance(line, dict):
			continue
		doc = _upsert_line(
			project=project,
			diary_date=diary_date,
			weather=weather,
			site_condition=site_condition,
			safety_status=safety_status,
			work_note=work_note,
			image_urls=image_urls,
			gps_lat=gps_lat,
			gps_lng=gps_lng,
			gps_acc=gps_acc,
			geofence_outside=verdict["outside"],
			line=line,
		)
		names.append(doc.name)

	if not names:
		frappe.throw(_("Nhật ký cần ít nhất một dòng công việc."))

	return {
		"project": project,
		"date": str(diary_date),
		"entries": names,
		"count": len(names),
		"geofence_outside": verdict["outside"],
		"geofence_reason": verdict["reason"],
	}


def _upsert_line(**kwargs) -> Any:
	meta = frappe.get_meta("Task Progress Entry")
	project = kwargs["project"]
	diary_date = kwargs["diary_date"]
	line = kwargs["line"]
	task = line.get("task") or line.get("task_id")
	if task:
		if not frappe.db.exists("Task", task):
			frappe.throw(_("Task {0} not found.").format(task))
		task_project = frappe.db.get_value("Task", task, "project")
		if task_project and task_project != project:
			frappe.throw(_("Task {0} does not belong to Project {1}.").format(task, project))

	date_field = next((name for name in DATE_FIELDS if meta.has_field(name)), None)
	existing = _find_existing(meta, project, diary_date, date_field, task)
	doc = frappe.get_doc("Task Progress Entry", existing) if existing else frappe.new_doc("Task Progress Entry")

	description = (line.get("description") or kwargs["work_note"] or task or "Nhật ký thi công").strip()
	values = {
		"project": project,
		"task": task,
		"remarks": description,
		"notes": description,
		"weather": kwargs["weather"],
		"progress": flt(line.get("progress")) if line.get("progress") not in (None, "") else None,
	}
	if date_field:
		values[date_field] = diary_date
	for fieldname, value in values.items():
		if value not in (None, "") and meta.has_field(fieldname):
			doc.set(fieldname, value)

	_set_if(doc, meta, "custom_h2q_weather", kwargs["weather"])
	_set_if(doc, meta, "custom_h2q_site_condition", kwargs["site_condition"])
	_set_if(doc, meta, "custom_h2q_safety_status", kwargs["safety_status"])
	_set_if(doc, meta, "custom_h2q_work_note", kwargs["work_note"] or description)
	_set_if(doc, meta, "custom_h2q_diary_date", diary_date)
	_set_if(doc, meta, "custom_h2q_geofence_outside", 1 if kwargs["geofence_outside"] else 0)
	if line.get("labour_count") not in (None, ""):
		_set_if(doc, meta, "custom_h2q_labour_count", cint(line.get("labour_count")))
	if line.get("equipment_note"):
		_set_if(doc, meta, "custom_h2q_equipment_note", line.get("equipment_note"))
	if kwargs["image_urls"]:
		_set_if(
			doc,
			meta,
			"custom_h2q_photo_urls",
			json.dumps(kwargs["image_urls"], ensure_ascii=False),
		)
	if kwargs["gps_lat"] not in (None, ""):
		_set_if(doc, meta, "custom_h2q_gps_lat", flt(kwargs["gps_lat"]))
		_set_if(doc, meta, "custom_h2q_gps_lng", flt(kwargs["gps_lng"]))
	if kwargs["gps_acc"] not in (None, ""):
		_set_if(doc, meta, "custom_h2q_gps_accuracy", flt(kwargs["gps_acc"]))
	if line.get("quantity") not in (None, ""):
		_set_if(doc, meta, "custom_h2q_diary_qty", flt(line.get("quantity")))

	missing = _missing_required(meta, doc)
	if missing:
		frappe.throw(
			_("Task Progress Entry còn trường bắt buộc chưa có dữ liệu: {0}").format(
				", ".join(missing)
			)
		)

	doc.flags.ignore_permissions = False
	if existing:
		doc.save()
	else:
		doc.insert()

	if kwargs["image_urls"]:
		from h2q_core.api import _attach_r2_images

		_attach_r2_images(doc.name, kwargs["image_urls"], doctype="Task Progress Entry")
	return doc


def _find_existing(meta, project: str, diary_date, date_field: str | None, task: str | None) -> str | None:
	if not date_field or not meta.has_field("project"):
		return None
	filters: dict[str, Any] = {"project": project, date_field: diary_date}
	if task and meta.has_field("task"):
		filters["task"] = task
	name = frappe.db.get_value("Task Progress Entry", filters, "name")
	return name


def _missing_required(meta, doc) -> list[str]:
	missing: list[str] = []
	for df in meta.fields:
		if not df.reqd or df.fieldtype in SKIP_TYPES:
			continue
		if df.fieldname in ("name", "owner", "creation", "modified", "docstatus"):
			continue
		value = doc.get(df.fieldname)
		if value in (None, ""):
			missing.append(df.fieldname)
	return missing


def _set_if(doc, meta, fieldname: str, value) -> None:
	if value is None or not meta.has_field(fieldname):
		return
	doc.set(fieldname, value)


def _choice(value: Any, allowed: tuple[str, ...], default: str) -> str:
	text = str(value or "").strip()
	return text if text in allowed else default


def _image_urls(data: dict[str, Any]) -> list[str]:
	image_urls = data.get("image_urls") or data.get("images") or []
	if data.get("image_url"):
		image_urls = [data.get("image_url"), *(image_urls if isinstance(image_urls, list) else [])]
	if isinstance(image_urls, str):
		try:
			image_urls = json.loads(image_urls)
		except json.JSONDecodeError:
			image_urls = [part.strip() for part in image_urls.split(",") if part.strip()]
	return [str(url).strip() for url in (image_urls or []) if str(url).strip()]


def _geofence_verdict(cfg: dict[str, Any], project: str, lat, lng) -> dict[str, Any]:
	raw = None
	if frappe.get_meta("Project").has_field("custom_h2q_site_geofence_json"):
		raw = frappe.db.get_value("Project", project, "custom_h2q_site_geofence_json")
	return evaluate_geofence(cfg.get("geofence_enforcement"), lat, lng, raw)
