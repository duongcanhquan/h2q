# h2q_core

Custom Frappe app for H2Q Headless Construction ERP (`h2q.com.vn`).

Does **not** patch ERPNext or BuildSuite core.

## Install

```bash
# from frappe-bench
bench get-app /path/to/h2q_core   # or link into apps/
bench --site <site> install-app h2q_core
bench pip install -r apps/h2q_core/requirements.txt
bench --site <site> clear-cache && bench restart
```

## site_config.json keys

```json
{
  "r2_account_id": "...",
  "r2_access_key_id": "...",
  "r2_secret_access_key": "...",
  "r2_bucket": "h2q-construction-files",
  "r2_public_url": "https://files.h2q.com.vn",
  "telegram_bot_token": "...",
  "telegram_chat_id": "485567058"
}
```

## Whitelisted APIs

| Method | Path |
|--------|------|
| Active projects | `h2q_core.api.get_active_projects` |
| WBS + BOQ | `h2q_core.api.get_project_wbs` |
| Create Draft MB | `h2q_core.api.submit_measurement` |
