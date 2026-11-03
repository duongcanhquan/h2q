"""Bench tests for H2Q API gates.

Needs a site with this app installed. From the bench root:

    bench --site <site> run-tests --app h2q_core --module h2q_core.tests.test_api

Without Frappe, the class is skipped so `python -m unittest` on the pure
field-rule tests still passes.
"""

from __future__ import annotations

import unittest

try:
	import frappe
except ImportError:  # local checkout, no bench
	frappe = None


def _case_base():
	if frappe is None:
		return unittest.TestCase
	try:
		from frappe.tests.utils import FrappeTestCase

		return FrappeTestCase
	except ImportError:
		from frappe.tests import IntegrationTestCase

		return IntegrationTestCase


@unittest.skipUnless(frappe is not None, "Cần bench. Xem docstring của file này.")
class TestH2QApi(_case_base()):
	ACCOUNTING = ("GL Entry", "Payment Entry", "Sales Invoice", "Purchase Invoice")
	SITE_ROLE = "BuildSuite Site Engineer"
	QA_USER = "h2q.qa.site.engineer@example.com"

	def setUp(self):
		self.created_books: list[str] = []
		self.created_files: list[str] = []
		self.created_user = False
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.set_user("Administrator")
		for name in self.created_files:
			if frappe.db.exists("File", name):
				frappe.delete_doc("File", name, force=1, ignore_permissions=True)
		for name in self.created_books:
			if frappe.db.exists("Measurement Book", name):
				frappe.delete_doc("Measurement Book", name, force=1, ignore_permissions=True)
		if self.created_user and frappe.db.exists("User", self.QA_USER):
			frappe.delete_doc("User", self.QA_USER, force=1, ignore_permissions=True)
		if self.created_books or self.created_files or self.created_user:
			frappe.db.commit()

	def test_guest_cannot_load_projects(self):
		from h2q_core.api import get_active_projects

		frappe.set_user("Guest")
		with self.assertRaises(frappe.AuthenticationError):
			get_active_projects()

	def test_site_engineer_cannot_read_accounting(self):
		"""Field role must not open the accounting books. H2Q has no report API of its own."""
		import h2q_core.api as api

		for name in ("get_accounting_report", "get_gl_entries", "get_payment_status"):
			self.assertFalse(hasattr(api, name), name)

		if not frappe.db.exists("Role", self.SITE_ROLE):
			self.skipTest(f"Role {self.SITE_ROLE} chưa có. Cài BuildSuite rồi chạy lại.")
		present = [dt for dt in self.ACCOUNTING if frappe.db.exists("DocType", dt)]
		if not present:
			self.skipTest("Site không có DocType kế toán ERPNext.")

		self._ensure_site_engineer()
		frappe.set_user(self.QA_USER)
		for dt in present:
			self.assertFalse(
				frappe.has_permission(dt, "read"),
				f"{self.SITE_ROLE} đang đọc được {dt}",
			)

	def test_zero_quantity_is_rejected(self):
		from h2q_core.api import submit_measurement

		with self.assertRaises(frappe.ValidationError):
			submit_measurement(
				{
					"project": "QA-NO-PROJECT",
					"task": "QA-NO-TASK",
					"work_order": "QA-NO-WO",
					"quantity": 0,
				}
			)

	def test_submit_measurement_stores_gps_and_photo_url(self):
		doc = self._insert_qa_book()
		photo = "https://qa.example.r2.dev/h2q-qa-photo.jpg"
		self.assertEqual(doc.status, "Draft")
		self.assertEqual(int(doc.docstatus or 0), 0)
		self.assertEqual(doc.custom_h2q_entry_kind, "Thực hiện")
		self.assertAlmostEqual(float(doc.custom_h2q_gps_lat), 10.77689, places=5)
		self.assertAlmostEqual(float(doc.custom_h2q_gps_lng), 106.70098, places=5)
		self.assertIn(photo, doc.custom_h2q_photo_urls or "")
		self.assertTrue(
			frappe.db.exists(
				"File",
				{
					"attached_to_doctype": "Measurement Book",
					"attached_to_name": doc.name,
					"file_url": photo,
				},
			)
		)

	def test_doc_submit_does_not_certify(self):
		"""Draft → Submit trên DocType không phải cổng duyệt. submit() phải bị chặn."""
		meta = frappe.get_meta("Measurement Book") if frappe.db.exists("DocType", "Measurement Book") else None
		if meta is None:
			self.skipTest("Chưa cài Measurement Book của BuildSuite.")
		self.assertFalse(
			int(meta.is_submittable or 0),
			"Measurement Book đã submittable. on_submit đang gửi Telegram như chứng nhận.",
		)
		doc = self._insert_qa_book(required=False)
		if doc is None:
			return
		before = doc.status
		with self.assertRaises(frappe.ValidationError) as caught:
			doc.submit()
		self.assertIn("submittable", str(caught.exception).lower())
		doc.reload()
		self.assertEqual(doc.status, before)
		self.assertNotEqual(doc.status, "Certified")
		self.assertEqual(int(doc.docstatus or 0), 0)

	def _insert_qa_book(self, required: bool = True):
		if not frappe.db.exists("DocType", "Measurement Book"):
			self.skipTest("Chưa cài Measurement Book của BuildSuite.")
		project = frappe.db.get_value("Project", {"status": ["not in", ["Cancelled"]]}, "name")
		if not project:
			if not required:
				return None
			self.skipTest("Chưa có Project để gắn phiếu.")
		task = frappe.db.get_value("Task", {"project": project}, "name")
		if not task:
			if not required:
				return None
			self.skipTest(f"Project {project} chưa có Task.")
		work_order = None
		if frappe.db.exists("DocType", "Work Order"):
			work_order = frappe.db.get_value("Work Order", {"project": project}, "name")

		from h2q_core.api import submit_measurement

		photo = "https://qa.example.r2.dev/h2q-qa-photo.jpg"
		result = submit_measurement(
			{
				"project": project,
				"task": task,
				"work_order": work_order,
				"quantity": 1,
				"description": "QA slip",
				"entry_kind": "thuc_hien",
				"auto_request_approval": 0,
				"gps_lat": 10.77689,
				"gps_lng": 106.70098,
				"gps_accuracy": 12,
				"image_urls": [photo],
			}
		)
		data = result.get("data") or {}
		name = data.get("measurement_book")
		self.assertTrue(name, result)
		self.created_books.append(name)
		for row in data.get("attached_files") or []:
			if row.get("name"):
				self.created_files.append(row["name"])
		return frappe.get_doc("Measurement Book", name)

	def _ensure_site_engineer(self):
		if frappe.db.exists("User", self.QA_USER):
			user = frappe.get_doc("User", self.QA_USER)
		else:
			user = frappe.get_doc(
				{
					"doctype": "User",
					"email": self.QA_USER,
					"first_name": "QA",
					"send_welcome_email": 0,
					"user_type": "System User",
				}
			)
			user.insert(ignore_permissions=True)
			self.created_user = True
		if self.SITE_ROLE not in {row.role for row in user.roles}:
			user.append("roles", {"role": self.SITE_ROLE})
			user.save(ignore_permissions=True)
