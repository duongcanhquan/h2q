import unittest

from h2q_core.approval_chain import chain_steps, decide_approval
from h2q_core.field_rules import normalize_entry_kind, split_entry_kind_remark
from h2q_core.geo import evaluate_geofence, parse_ring, point_in_ring


SQUARE = [[0.0, 0.0], [0.0, 1.0], [1.0, 1.0], [1.0, 0.0]]


class GeofenceTests(unittest.TestCase):
	def test_center_is_inside_square(self):
		self.assertTrue(point_in_ring(0.5, 0.5, SQUARE))

	def test_outside_square(self):
		self.assertFalse(point_in_ring(1.5, 0.5, SQUARE))

	def test_vertex_counts_as_inside(self):
		self.assertTrue(point_in_ring(0.0, 0.0, SQUARE))

	def test_geojson_is_lng_lat(self):
		raw = {
			"type": "Polygon",
			"coordinates": [[[106.6, 10.7], [106.7, 10.7], [106.7, 10.8], [106.6, 10.8], [106.6, 10.7]]],
		}
		ring = parse_ring(raw)
		self.assertEqual(ring[0], [10.7, 106.6])
		self.assertTrue(point_in_ring(10.75, 106.65, ring))

	def test_closed_ring_drops_duplicate_end(self):
		ring = parse_ring(SQUARE + [[0.0, 0.0]])
		self.assertEqual(len(ring), 4)

	def test_off_policy_ignores_outside_point(self):
		verdict = evaluate_geofence("Off", 5, 5, SQUARE)
		self.assertEqual(verdict["action"], "ok")

	def test_block_outside(self):
		verdict = evaluate_geofence("Block", 5, 5, SQUARE)
		self.assertEqual(verdict["action"], "block")
		self.assertEqual(verdict["outside"], 1)

	def test_warn_outside_does_not_block(self):
		verdict = evaluate_geofence("Warn", 5, 5, SQUARE)
		self.assertEqual(verdict["action"], "warn")

	def test_inside_is_ok(self):
		verdict = evaluate_geofence("Block", 0.2, 0.2, SQUARE)
		self.assertEqual(verdict["action"], "ok")
		self.assertEqual(verdict["outside"], 0)

	def test_missing_fence_is_ok(self):
		verdict = evaluate_geofence("Block", None, None, "")
		self.assertEqual(verdict["reason"], "no_fence")

	def test_missing_gps_blocks_when_fence_exists(self):
		verdict = evaluate_geofence("Block", None, None, SQUARE)
		self.assertEqual(verdict["reason"], "missing_gps")
		self.assertEqual(verdict["action"], "block")


class ApprovalChainTests(unittest.TestCase):
	def test_legacy_when_no_level_is_set(self):
		steps = chain_steps(
			[
				{"role": "Projects Manager", "can_approve": 1, "approval_level": 0},
				{"role": "System Manager", "can_approve": 1, "approval_level": 1},
			]
		)
		self.assertEqual(steps, [])
		decision = decide_approval(0, steps, ["Projects User"])
		self.assertTrue(decision["final"])
		self.assertEqual(decision["reason"], "legacy")

	def test_two_steps_stop_before_certify(self):
		steps = chain_steps(
			[
				{"role": "Chỉ huy", "can_approve": 1, "approval_level": 1, "sort_order": 5},
				{"role": "QS", "can_approve": 1, "approval_level": 2, "sort_order": 9},
				{"role": "Employee", "can_approve": 0, "approval_level": 3},
			]
		)
		self.assertEqual(steps, [["Chỉ huy"], ["QS"]])
		first = decide_approval(0, steps, ["Chỉ huy"])
		self.assertTrue(first["allowed"])
		self.assertFalse(first["final"])
		self.assertEqual(first["next_level"], 1)
		second = decide_approval(1, steps, ["QS"])
		self.assertTrue(second["final"])
		denied = decide_approval(0, steps, ["QS"])
		self.assertFalse(denied["allowed"])
		self.assertEqual(denied["required_roles"], ["Chỉ huy"])

	def test_same_level_either_role(self):
		steps = chain_steps(
			[
				{"role": "PM", "can_approve": 1, "approval_level": 1},
				{"role": "Giám đốc", "can_approve": 1, "approval_level": 1},
			]
		)
		self.assertEqual(steps, [["PM", "Giám đốc"]])
		decision = decide_approval(0, steps, ["Giám đốc"])
		self.assertTrue(decision["final"])

	def test_system_manager_clears_current_step(self):
		steps = [["QS"]]
		decision = decide_approval(0, steps, ["System Manager"])
		self.assertTrue(decision["allowed"])
		self.assertTrue(decision["final"])


class EntryKindTests(unittest.TestCase):
	def test_aliases(self):
		self.assertEqual(normalize_entry_kind("nghiem_thu"), "Nghiệm thu")
		self.assertEqual(normalize_entry_kind("Nghiệm thu"), "Nghiệm thu")
		self.assertEqual(normalize_entry_kind(""), "Thực hiện")
		self.assertEqual(normalize_entry_kind("thuc_hien"), "Thực hiện")

	def test_remark_token_is_removed(self):
		kind, remarks = split_entry_kind_remark("H2Q_ENTRY_KIND:nghiem_thu\nMóng trục A")
		self.assertEqual(kind, "nghiem_thu")
		self.assertEqual(remarks, "Móng trục A")


class QuantityLedgerTests(unittest.TestCase):
	def test_execution_is_not_certified(self):
		from h2q_core.field_rules import certifies_on_approval

		self.assertFalse(certifies_on_approval("Thực hiện"))
		self.assertTrue(certifies_on_approval("Nghiệm thu"))
		self.assertTrue(certifies_on_approval(""))

	def test_columns_do_not_mix(self):
		from h2q_core.field_rules import add_slip, classify_slip, empty_ledger

		self.assertEqual(classify_slip("Thực hiện", "Approved", "Draft"), "executed")
		self.assertEqual(classify_slip("Nghiệm thu", "Approved", "Certified"), "accepted")
		self.assertEqual(classify_slip("Thực hiện", "Pending Approval", "Draft"), "executed_pending")
		self.assertEqual(classify_slip(None, "Approved", "Certified"), "accepted")
		ledger = empty_ledger()
		add_slip(ledger, kind="Thực hiện", approval="Approved", status="Draft", qty=12)
		add_slip(ledger, kind="Nghiệm thu", approval="Approved", status="Certified", qty=5)
		self.assertEqual(ledger["executed"], 12)
		self.assertEqual(ledger["accepted"], 5)

	def test_acceptance_cannot_pass_execution_when_blocked(self):
		from h2q_core.field_rules import check_quantity_slip

		verdict = check_quantity_slip(
			kind="Nghiệm thu",
			qty=8,
			contract=100,
			executed=10,
			accepted=5,
			policy="Block",
			has_note=False,
		)
		self.assertEqual(verdict["action"], "block")

	def test_acceptance_uses_contract_when_no_execution_yet(self):
		from h2q_core.field_rules import check_quantity_slip

		verdict = check_quantity_slip(
			kind="Nghiệm thu",
			qty=8,
			contract=100,
			executed=0,
			accepted=0,
			policy="Block",
			has_note=False,
		)
		self.assertEqual(verdict["action"], "ok")

	def test_execution_accumulates_against_contract(self):
		from h2q_core.field_rules import check_quantity_slip

		verdict = check_quantity_slip(
			kind="Thực hiện",
			qty=30,
			contract=100,
			executed=80,
			accepted=0,
			policy="Block",
			has_note=True,
			include_pending_executed=0,
		)
		self.assertEqual(verdict["action"], "block")

	def test_warn_keeps_the_slip(self):
		from h2q_core.field_rules import check_quantity_slip

		verdict = check_quantity_slip(
			kind="Thực hiện",
			qty=30,
			contract=100,
			executed=80,
			accepted=0,
			policy="Warn",
			has_note=False,
		)
		self.assertEqual(verdict["action"], "warn")
		self.assertEqual(verdict["over_limit"], 1)


if __name__ == "__main__":
	unittest.main()
