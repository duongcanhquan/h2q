"""
H2Q — bootstrap HR masters for construction company (ERPNext / HRMS).

Run via bench (from frappe-bench):

  # Full seed: departments + designations
  bench --site <site> execute h2q_core.setup_hr.setup_construction_hr

  # Create one Employee + User
  bench --site <site> execute h2q_core.setup_hr.create_employee_user \\
    --kwargs '{"email":"ks.a@h2q.com.vn","full_name":"Nguyen Van A","department":"Đội Thi Công","designation":"Kỹ sư hiện trường"}'

  # Optional: pass company
  bench --site <site> execute h2q_core.setup_hr.setup_construction_hr \\
    --kwargs '{"company":"H2Q Construction"}'
"""

from __future__ import annotations

from typing import Any

import frappe
from frappe import _
from frappe.utils import getdate, today

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

# Tree: All Departments (root) → ...
DEPARTMENTS: list[dict[str, Any]] = [
	{"name": "Ban Giám Đốc", "is_group": 0},
	{"name": "Phòng Kế Toán", "is_group": 0},
	{"name": "Ban Quản Lý Dự Án (PMB)", "is_group": 0},
	{"name": "Đội Thi Công", "is_group": 0},
]

DESIGNATIONS: list[str] = [
	"Giám đốc",
	"Kế toán trưởng",
	"Chỉ huy trưởng",
	"Kỹ sư hiện trường",
	"Công nhân",
]

# Fallback when H2Q Settings / DocType not yet migrated
DEFAULT_EMPLOYEE_ROLES = (
	"Employee",
	"Projects User",
)


def _default_employee_roles() -> tuple[str, ...]:
	try:
		from h2q_core.settings import get_settings

		roles = get_settings().get("default_employee_roles") or []
		if roles:
			return tuple(roles)
	except Exception:
		pass
	return DEFAULT_EMPLOYEE_ROLES


# ---------------------------------------------------------------------------
# Public entrypoints (bench execute)
# ---------------------------------------------------------------------------


def setup_construction_hr(company: str | None = None) -> dict[str, Any]:
	"""
	Idempotent seed of Department tree + Designation masters.
	Returns a summary suitable for bench execute stdout.
	"""
	company = _resolve_company(company)
	created_deps, existing_deps = _ensure_departments(company)
	created_des, existing_des = _ensure_designations()

	summary = {
		"company": company,
		"departments_created": created_deps,
		"departments_existing": existing_deps,
		"designations_created": created_des,
		"designations_existing": existing_des,
	}
	frappe.logger("h2q_core.setup_hr").info(frappe.as_json(summary))
	return summary


def create_employee_user(
	email: str,
	full_name: str,
	department: str,
	designation: str,
	company: str | None = None,
	mobile: str | None = None,
	date_of_joining: str | None = None,
	gender: str | None = None,
	send_welcome_email: int = 0,
	password: str | None = None,
) -> dict[str, Any]:
	"""
	Create (or reuse) a Frappe User that can log in, then create/link an Employee.

	Args:
	  email: login id / User.name
	  full_name: display name (split into first/last)
	  department: Department name (must exist)
	  designation: Designation name (must exist)
	  company: optional; defaults to site default company
	  mobile: optional cell_number / mobile_no
	  date_of_joining: YYYY-MM-DD (default today)
	  gender: optional (Male/Female/Other) — set if your site requires it
	  send_welcome_email: 0/1
	  password: optional initial password; if omitted, user must reset / use invite
	"""
	try:
		email = (email or "").strip().lower()
		full_name = (full_name or "").strip()
		department = (department or "").strip()
		designation = (designation or "").strip()

		if not email or "@" not in email:
			frappe.throw(_("A valid email is required."))
		if not full_name:
			frappe.throw(_("full_name is required."))
		if not department:
			frappe.throw(_("department is required."))
		if not designation:
			frappe.throw(_("designation is required."))

		company = _resolve_company(company)
		_ensure_master_exists("Department", department)
		_ensure_master_exists("Designation", designation)

		first_name, last_name = _split_name(full_name)
		user_name = _ensure_user(
			email=email,
			first_name=first_name,
			last_name=last_name,
			send_welcome_email=cint_bool(send_welcome_email),
			password=password,
			mobile=mobile,
		)
		employee_name = _ensure_employee(
			user=user_name,
			first_name=first_name,
			last_name=last_name,
			department=department,
			designation=designation,
			company=company,
			mobile=mobile,
			date_of_joining=date_of_joining or today(),
			gender=gender,
		)

		frappe.db.commit()
		return {
			"user": user_name,
			"employee": employee_name,
			"department": department,
			"designation": designation,
			"company": company,
		}
	except Exception:
		frappe.log_error(
			title="create_employee_user failed",
			message=frappe.get_traceback(),
		)
		raise


def setup_and_seed_sample_staff(company: str | None = None) -> dict[str, Any]:
	"""
	Optional helper: run master seed then create a sample field engineer
	(skipped if email already used). Useful for smoke tests.
	"""
	summary = setup_construction_hr(company=company)
	sample_email = "ks.mau@h2q.com.vn"
	if not frappe.db.exists("User", sample_email):
		summary["sample_employee"] = create_employee_user(
			email=sample_email,
			full_name="Ky Su Mau",
			department="Đội Thi Công",
			designation="Kỹ sư hiện trường",
			company=summary["company"],
			send_welcome_email=0,
		)
	else:
		summary["sample_employee"] = {"skipped": True, "user": sample_email}
	return summary


# ---------------------------------------------------------------------------
# Masters
# ---------------------------------------------------------------------------


def _ensure_departments(company: str) -> tuple[list[str], list[str]]:
	created: list[str] = []
	existing: list[str] = []

	# ERPNext Department is a tree; root is usually "All Departments"
	root = _department_root()

	for row in DEPARTMENTS:
		name = row["name"]
		if frappe.db.exists("Department", name):
			existing.append(name)
			continue

		doc = frappe.get_doc(
			{
				"doctype": "Department",
				"department_name": name,
				"parent_department": root,
				"company": company,
				"is_group": cint_bool(row.get("is_group")),
			}
		)
		# Some sites use `disabled` / custom fields — insert ignore permissions for seed
		doc.flags.ignore_permissions = True
		doc.insert()
		created.append(doc.name)

	frappe.db.commit()
	return created, existing


def _ensure_designations() -> tuple[list[str], list[str]]:
	created: list[str] = []
	existing: list[str] = []

	for name in DESIGNATIONS:
		if frappe.db.exists("Designation", name):
			existing.append(name)
			continue
		doc = frappe.get_doc({"doctype": "Designation", "designation_name": name})
		doc.flags.ignore_permissions = True
		doc.insert()
		created.append(doc.name)

	frappe.db.commit()
	return created, existing


def _department_root() -> str:
	"""Return / create a valid parent for Department tree inserts."""
	candidates = [
		"All Departments",
		"All Department",
	]
	for name in candidates:
		if frappe.db.exists("Department", name):
			return name

	# Fallback: first group department, else create All Departments
	group = frappe.db.get_value("Department", {"is_group": 1}, "name")
	if group:
		return group

	company = _resolve_company(None)
	root = frappe.get_doc(
		{
			"doctype": "Department",
			"department_name": "All Departments",
			"company": company,
			"is_group": 1,
		}
	)
	root.flags.ignore_permissions = True
	root.insert()
	frappe.db.commit()
	return root.name


# ---------------------------------------------------------------------------
# User + Employee
# ---------------------------------------------------------------------------


def _ensure_user(
	*,
	email: str,
	first_name: str,
	last_name: str,
	send_welcome_email: bool,
	password: str | None,
	mobile: str | None,
) -> str:
	if frappe.db.exists("User", email):
		user = frappe.get_doc("User", email)
		# Ensure enabled + roles
		if user.enabled == 0:
			user.enabled = 1
		_assign_roles(user)
		if mobile and not user.mobile_no:
			user.mobile_no = mobile
		user.flags.ignore_permissions = True
		user.save()
		return user.name

	user = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": first_name,
			"last_name": last_name or None,
			"send_welcome_email": 1 if send_welcome_email else 0,
			"user_type": "System User",
			"mobile_no": mobile,
		}
	)
	user.flags.ignore_permissions = True
	user.insert()

	_assign_roles(user)
	user.save()

	if password:
		# Prefer API that hashes correctly across versions
		from frappe.utils.password import update_password

		update_password(user=user.name, pwd=password)

	return user.name


def _assign_roles(user) -> None:
	existing = {r.role for r in (user.roles or [])}
	for role in _default_employee_roles():
		if not frappe.db.exists("Role", role):
			continue
		if role in existing:
			continue
		user.append("roles", {"role": role})


def _ensure_employee(
	*,
	user: str,
	first_name: str,
	last_name: str,
	department: str,
	designation: str,
	company: str,
	mobile: str | None,
	date_of_joining: str,
	gender: str | None,
) -> str:
	# Prefer existing Employee linked to this User
	existing = frappe.db.get_value("Employee", {"user_id": user}, "name")
	if existing:
		emp = frappe.get_doc("Employee", existing)
		emp.department = department
		emp.designation = designation
		emp.company = company
		if mobile:
			_set_if_field(emp, "cell_number", mobile)
			_set_if_field(emp, "mobile_no", mobile)
		emp.flags.ignore_permissions = True
		emp.save()
		return emp.name

	payload: dict[str, Any] = {
		"doctype": "Employee",
		"first_name": first_name,
		"last_name": last_name or None,
		"employee_name": f"{first_name} {last_name}".strip(),
		"status": "Active",
		"company": company,
		"department": department,
		"designation": designation,
		"user_id": user,
		"date_of_joining": getdate(date_of_joining),
		"create_user_permission": 1,
	}
	if gender:
		payload["gender"] = gender
	if mobile:
		# ERPNext versions differ: cell_number vs mobile_no
		if _has_field("Employee", "cell_number"):
			payload["cell_number"] = mobile
		elif _has_field("Employee", "mobile_no"):
			payload["mobile_no"] = mobile

	# Preferential email fields
	if _has_field("Employee", "preferential_email"):
		payload["preferential_email"] = user
	if _has_field("Employee", "company_email"):
		payload["company_email"] = user
	if _has_field("Employee", "personal_email"):
		payload["personal_email"] = user

	emp = frappe.get_doc(payload)
	emp.flags.ignore_permissions = True
	emp.insert()
	return emp.name


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_company(company: str | None) -> str:
	if company and frappe.db.exists("Company", company):
		return company

	default = frappe.defaults.get_user_default("Company") or frappe.db.get_single_value(
		"Global Defaults", "default_company"
	)
	if default and frappe.db.exists("Company", default):
		return default

	first = frappe.db.get_value("Company", {}, "name", order_by="creation asc")
	if not first:
		frappe.throw(_("No Company found. Create a Company before seeding HR."))
	return first


def _ensure_master_exists(doctype: str, name: str) -> None:
	if frappe.db.exists(doctype, name):
		return
	frappe.throw(
		_("{0} '{1}' does not exist. Run setup_construction_hr first.").format(doctype, name)
	)


def _split_name(full_name: str) -> tuple[str, str]:
	parts = [p for p in full_name.split() if p]
	if not parts:
		return full_name, ""
	if len(parts) == 1:
		return parts[0], ""
	return parts[0], " ".join(parts[1:])


def _has_field(doctype: str, fieldname: str) -> bool:
	meta = frappe.get_meta(doctype)
	return bool(meta.has_field(fieldname))


def _set_if_field(doc, fieldname: str, value: Any) -> None:
	if _has_field(doc.doctype, fieldname):
		doc.set(fieldname, value)


def cint_bool(value: Any) -> int:
	from frappe.utils import cint

	return 1 if cint(value) else 0
