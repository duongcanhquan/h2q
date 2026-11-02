"""
R2-related hook entries — merge these into h2q_core/hooks.py

	# Cloudflare R2 (S3-compatible) file storage
	write_file = "h2q_core.storage.r2_file.write_file"
	delete_file_data_content = "h2q_core.storage.r2_file.delete_file_data_content"

After editing hooks.py:
	bench --site h2q.com.vn clear-cache
	bench restart
"""

# Copied here so the values are importable / greppable from one place.
write_file = "h2q_core.storage.r2_file.write_file"
delete_file_data_content = "h2q_core.storage.r2_file.delete_file_data_content"
