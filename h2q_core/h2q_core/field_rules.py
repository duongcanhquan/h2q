"""Field-slip rules shared by the measurement API. No Frappe import."""

from __future__ import annotations

ENTRY_THUC_HIEN = "Thực hiện"
ENTRY_NGHIEM_THU = "Nghiệm thu"
ENTRY_KIND_PREFIX = "H2Q_ENTRY_KIND:"


def normalize_entry_kind(value: str | None) -> str:
	raw = (value or "").strip().lower().replace(" ", "_")
	if raw in {"nghiem_thu", "nghiệm_thu", "nghiemthu", "acceptance"}:
		return ENTRY_NGHIEM_THU
	return ENTRY_THUC_HIEN


def split_entry_kind_remark(remarks: str | None) -> tuple[str | None, str]:
	"""Pull a transport token out of remarks. The token is not shown on the book."""
	kind: str | None = None
	kept: list[str] = []
	for line in (remarks or "").splitlines():
		if line.startswith(ENTRY_KIND_PREFIX):
			kind = line[len(ENTRY_KIND_PREFIX) :].strip() or kind
			continue
		kept.append(line)
	return kind, "\n".join(kept).strip()


def certifies_on_approval(kind: str | None) -> bool:
	"""Only accepted quantity may become a certified Measurement Book.

	Executed quantity stays Draft in BuildSuite so it cannot be billed.
	A book with no kind is legacy data and still certifies.
	"""
	if not (kind or "").strip():
		return True
	return normalize_entry_kind(kind) == ENTRY_NGHIEM_THU


def classify_slip(kind: str | None, approval: str | None, buildsuite_status: str | None) -> str:
	"""Map one book onto the QS columns. Pending slips are reserved, not official."""
	approval = approval or ""
	status = buildsuite_status or ""
	if approval == "Rejected":
		return "ignore"
	if not (kind or "").strip():
		if status == "Certified" or approval == "Approved":
			return "accepted"
		return "ignore"
	if normalize_entry_kind(kind) == ENTRY_THUC_HIEN:
		if approval == "Approved":
			return "executed"
		if approval == "Pending Approval":
			return "executed_pending"
		return "ignore"
	if status == "Certified" or approval == "Approved":
		return "accepted"
	if approval == "Pending Approval":
		return "accepted_pending"
	return "ignore"


def empty_ledger() -> dict[str, float]:
	return {
		"executed": 0.0,
		"executed_pending": 0.0,
		"accepted": 0.0,
		"accepted_pending": 0.0,
	}


def add_slip(
	ledger: dict[str, float],
	*,
	kind: str | None,
	approval: str | None,
	status: str | None,
	qty: float,
) -> dict[str, float]:
	bucket = classify_slip(kind, approval, status)
	if bucket != "ignore":
		ledger[bucket] = float(ledger.get(bucket) or 0) + float(qty or 0)
	return ledger


def check_quantity_slip(
	*,
	kind: str | None,
	qty: float,
	contract: float,
	executed: float,
	accepted: float,
	policy: str | None,
	has_note: bool,
	include_pending_executed: float = 0,
) -> dict[str, object]:
	"""Decide whether this slip may enter the book.

	Thực hiện accumulates against the contract quantity.
	Nghiệm thu accumulates against approved thực hiện.
	When no thực hiện has been approved yet, nghiệm thu falls back to the
	contract so older books that never used the split can still be accepted.
	"""
	normalized = normalize_entry_kind(kind) if (kind or "").strip() else ENTRY_THUC_HIEN
	contract_qty = float(contract or 0)
	executed_qty = float(executed or 0)
	accepted_qty = float(accepted or 0)
	pending_qty = float(include_pending_executed or 0)
	this_qty = float(qty or 0)
	mode = policy or "Warn"

	if normalized == ENTRY_THUC_HIEN:
		already = executed_qty + pending_qty
		total = already + this_qty
		cap = contract_qty
		basis = "khối lượng hợp đồng"
		column = "thực hiện"
	else:
		already = accepted_qty
		total = already + this_qty
		if executed_qty > 0:
			cap = executed_qty
			basis = "thực hiện đã duyệt"
		else:
			cap = contract_qty
			basis = "khối lượng hợp đồng, vì chưa có thực hiện đã duyệt"
		column = "nghiệm thu"

	over = bool(cap > 0 and total > cap + 1e-9)
	action = "ok"
	message = ""
	if over:
		message = (
			f"Khối lượng {column} lũy kế { _fmt(total) } vượt {basis} { _fmt(cap) }."
		)
		if mode == "Block" or (mode == "Warn Require Note" and not has_note):
			action = "block"
			if mode == "Warn Require Note" and not has_note:
				message += " Cần ghi chú trước khi gửi."
		else:
			action = "warn"

	room = None if cap <= 0 else cap - already
	return {
		"action": action,
		"over_limit": 1 if over else 0,
		"message": message,
		"contract": contract_qty,
		"executed": executed_qty,
		"accepted": accepted_qty,
		"room": room,
		"column": column,
	}


def _fmt(value: float) -> str:
	text = f"{value:.3f}".rstrip("0").rstrip(".")
	return text or "0"
