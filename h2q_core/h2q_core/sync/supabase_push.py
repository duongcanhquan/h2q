"""
Frappe → Supabase: mirror Measurement Book status into `measurements_sync`.

site_config.json:
  supabase_url
  supabase_service_role_key
"""

from __future__ import annotations

import json
from typing import Any
from urllib import request
from urllib.parse import quote

import frappe
from frappe.utils import cint


def on_measurement_book_update(doc, method: str | None = None) -> None:
	"""Enqueue mirror when status / approval changes."""
	try:
		from h2q_core.settings import get_settings

		if not cint(get_settings().get("enable_offline_sync", 1)):
			return
	except Exception:
		pass

	if not _credentials():
		return

	interesting = True
	if hasattr(doc, "has_value_changed"):
		interesting = doc.has_value_changed("status") or doc.has_value_changed(
			"custom_h2q_approval_status"
		)
	if not interesting:
		return

	frappe.enqueue(
		"h2q_core.sync.supabase_push.push_measurement_book",
		queue="short",
		timeout=60,
		enqueue_after_commit=True,
		job_name=f"supabase_mb::{doc.name}",
		measurement_book=doc.name,
	)


def push_measurement_book(measurement_book: str) -> dict[str, Any] | None:
	"""Background: PATCH measurements_sync rows keyed by frappe_measurement_book."""
	try:
		creds = _credentials()
		if not creds:
			return None

		doc = frappe.get_doc("Measurement Book", measurement_book)
		payload: dict[str, Any] = {
			"frappe_measurement_book": doc.name,
			"project": doc.project,
			"work_order": doc.work_order,
			"status": doc.status,
			"approval_status": getattr(doc, "custom_h2q_approval_status", None) or "Draft",
			"boq_over_limit": bool(cint(getattr(doc, "custom_h2q_boq_over_limit", 0))),
		}
		if doc.status == "Certified":
			payload["sync_status"] = "synced"
			payload["is_synced_to_frappe"] = True

		for key, attr in (
			("gps_lat", "custom_h2q_gps_lat"),
			("gps_lng", "custom_h2q_gps_lng"),
			("gps_accuracy", "custom_h2q_gps_accuracy"),
		):
			val = getattr(doc, attr, None)
			if val not in (None, ""):
				payload[key] = val

		url = (
			f"{creds['url']}/rest/v1/measurements_sync"
			f"?frappe_measurement_book=eq.{quote(doc.name)}"
		)
		data = json.dumps(payload).encode("utf-8")
		req = request.Request(
			url,
			data=data,
			method="PATCH",
			headers={
				"Content-Type": "application/json",
				"apikey": creds["key"],
				"Authorization": f"Bearer {creds['key']}",
				"Prefer": "return=representation",
			},
		)
		with request.urlopen(req, timeout=20) as resp:
			raw = resp.read().decode("utf-8", errors="replace")
			rows = json.loads(raw) if raw else []
			return {"updated": len(rows) if isinstance(rows, list) else 0, "body": payload}
	except Exception:
		frappe.log_error(
			title=f"supabase_push failed · {measurement_book}",
			message=frappe.get_traceback(),
		)
		return None


def _credentials() -> dict[str, str] | None:
	url = frappe.conf.get("supabase_url") or frappe.conf.get("SUPABASE_URL")
	key = (
		frappe.conf.get("supabase_service_role_key")
		or frappe.conf.get("supabase_key")
		or frappe.conf.get("SUPABASE_SERVICE_ROLE_KEY")
	)
	if not url or not key:
		return None
	return {"url": str(url).rstrip("/"), "key": str(key)}
