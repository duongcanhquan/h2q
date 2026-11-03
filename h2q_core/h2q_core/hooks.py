"""
Frappe app hooks for h2q_core.

All custom logic lives here — never patch ERPNext / BuildSuite core.
"""

app_name = "h2q_core"
app_title = "H2Q Core"
app_publisher = "H2Q"
app_description = "Construction Headless ERP core for h2q.com.vn"
app_email = "dev@h2q.com.vn"
app_license = "MIT"

# ---------------------------------------------------------------------------
# File storage → Cloudflare R2 (S3-compatible via boto3)
# Overrides Frappe File write/delete — see storage/r2_file.py
# ---------------------------------------------------------------------------
write_file = "h2q_core.storage.r2_file.write_file"
delete_file_data_content = "h2q_core.storage.r2_file.delete_file_data_content"

# ---------------------------------------------------------------------------
# Measurement Book notifications
#
# BuildSuite today: NOT submittable → certify sets status="Certified" + save().
# We hook on_update for the real path, and on_submit for forward-compat.
# Both enqueue Telegram via frappe.enqueue (non-blocking).
# ---------------------------------------------------------------------------
doc_events = {
	"Measurement Book": {
		"validate": "h2q_core.measurement_book_events.validate",
		"on_update": "h2q_core.measurement_book_events.on_update",
		"on_submit": "h2q_core.measurement_book_events.on_submit",
	},
}

# Sync H2Q custom fields + Measurement Book workflow after every migrate
after_migrate = ["h2q_core.setup_phase2.after_migrate"]

