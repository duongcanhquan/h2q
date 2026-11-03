"""Multi-level approval decisions. No Frappe import.

A chain exists only when at least one approval_roles row has approval_level > 0
and can_approve. Otherwise the site stays on the legacy one-step approve.
Roles that share an approval_level can each clear that step.
System Manager can clear the current step.
"""

from __future__ import annotations

from typing import Any


def chain_steps(rows: list[dict[str, Any]] | None) -> list[list[str]]:
	grouped: dict[int, list[str]] = {}
	for row in rows or []:
		if not row.get("can_approve"):
			continue
		role = row.get("role")
		if not role or role == "System Manager":
			continue
		level = int(row.get("approval_level") or 0)
		if level <= 0:
			continue
		bucket = grouped.setdefault(level, [])
		if role not in bucket:
			bucket.append(role)
	return [grouped[level] for level in sorted(grouped)]


def decide_approval(
	current_level: int,
	steps: list[list[str]],
	actor_roles: list[str] | None,
) -> dict[str, Any]:
	"""Return allowed, final, next_level, required_roles, reason."""
	roles = list(actor_roles or [])
	level = max(int(current_level or 0), 0)
	if not steps:
		return {
			"allowed": True,
			"final": True,
			"next_level": level,
			"required_roles": [],
			"reason": "legacy",
		}
	if level >= len(steps):
		return {
			"allowed": True,
			"final": True,
			"next_level": level,
			"required_roles": [],
			"reason": "complete",
		}
	required = steps[level]
	if "System Manager" in roles or any(role in roles for role in required):
		nxt = level + 1
		return {
			"allowed": True,
			"final": nxt >= len(steps),
			"next_level": nxt,
			"required_roles": required,
			"reason": "ok",
		}
	return {
		"allowed": False,
		"final": False,
		"next_level": level,
		"required_roles": required,
		"reason": "role",
	}
