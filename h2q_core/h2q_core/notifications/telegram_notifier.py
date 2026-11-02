"""
Compatibility shim — prefer `h2q_core.telegram_bot`.

Keeps older hooks/imports working after the Step-1 rename.
"""

from h2q_core.telegram_bot import (  # noqa: F401
	build_measurement_markdown,
	on_measurement_book_submit,
	on_measurement_book_update,
	send_measurement_notification,
	send_telegram_message,
)

# Old worker name used by previous enqueue jobs
send_measurement_certified_telegram = send_measurement_notification
