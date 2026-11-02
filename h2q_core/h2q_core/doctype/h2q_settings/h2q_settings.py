# Copyright (c) 2026, H2Q and contributors
# License: MIT

from __future__ import annotations

import frappe
from frappe.model.document import Document


class H2QSettings(Document):
	def validate(self):
		self._dedupe_roles()
		if self.min_photos_on_submit is None or self.min_photos_on_submit < 0:
			self.min_photos_on_submit = 0
		if self.min_photos_on_approve is None or self.min_photos_on_approve < 0:
			self.min_photos_on_approve = 0

	def on_update(self):
		frappe.cache().delete_value("h2q_settings_public")
		frappe.cache().delete_value("h2q_settings_doc")
		if self.resync_workflow_on_save:
			try:
				from h2q_core.setup_workflow import setup_measurement_workflow_from_settings

				setup_measurement_workflow_from_settings(self)
			except Exception:
				frappe.log_error(
					title="H2Q Settings: workflow resync failed",
					message=frappe.get_traceback(),
				)

	def _dedupe_roles(self):
		seen: set[str] = set()
		keep = []
		for row in self.approval_roles or []:
			if not row.role or row.role in seen:
				continue
			seen.add(row.role)
			keep.append(row)
		self.set("approval_roles", keep)

		seen_e: set[str] = set()
		keep_e = []
		for row in self.default_employee_roles or []:
			if not row.role or row.role in seen_e:
				continue
			seen_e.add(row.role)
			keep_e.append(row)
		self.set("default_employee_roles", keep_e)
