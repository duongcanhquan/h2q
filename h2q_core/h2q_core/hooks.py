"""
Frappe app hooks for h2q_core.

All custom logic lives here — never patch BuildSuite / ERPNext core.
"""

app_name = "h2q_core"
app_title = "H2Q Core"
app_publisher = "H2Q"
app_description = "Construction Headless ERP core for h2q.com.vn"
app_email = "dev@h2q.com.vn"
app_license = "MIT"

# ---------------------------------------------------------------------------
# File storage → Cloudflare R2 (S3 API)
# ---------------------------------------------------------------------------
write_file = "h2q_core.storage.r2_file.write_file"
delete_file_data_content = "h2q_core.storage.r2_file.delete_file_data_content"

# ---------------------------------------------------------------------------
# DocType events
#
# Measurement Book (BuildSuite) is NOT submittable.
# Certification = status Draft → Certified (certify_measurement_book → doc.save).
# Use on_update, not on_submit.
# ---------------------------------------------------------------------------
doc_events = {
	"Measurement Book": {
		"on_update": "h2q_core.notifications.telegram_notifier.on_measurement_book_update",
	},
}
