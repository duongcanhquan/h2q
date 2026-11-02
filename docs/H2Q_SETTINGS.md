# H2Q Settings — Cài đặt linh hoạt (Desk)

**Desk:** tìm **H2Q Settings** (Single DocType, module H2Q Core).  
**API PWA:** `h2q_core.api.get_h2q_settings` (không trả secret).

Secret (`telegram_bot_token`, R2 keys) vẫn chỉ trong `site_config.json`.

---

## Knob P0 (đã wire runtime)

| Setting | Ảnh hưởng |
|---|---|
| `boq_over_limit_policy` | Warn / Block / Warn Require Note khi submit MB |
| `auto_request_approval_default` | Tự Pending sau submit (client vẫn override) |
| `gps_required` | Bắt GPS khi submit |
| `min_photos_on_submit` / `min_photos_on_approve` | Số ảnh tối thiểu |
| `dashboard_progress_source` | BOQ Qty / BOQ Amount / Project % |
| `telegram_enabled` + chat id pending/certified/alerts | Routing Telegram |
| `telegram_notify_on_*` | Bật/tắt từng loại tin |
| `enable_measurement_book` | Tắt hẳn submit MB |
| `approval_roles` + `resync_workflow_on_save` | Matrix role → Workflow MB |
| `default_employee_roles` | Role khi `create_employee_user` |

## Feature flags (sẵn sàng UI / giai đoạn sau)

`enable_site_diary`, `enable_client_ra_billing`, `enable_offline_sync`, `ui_profile`, `allow_mobile_revise_rejected`, `geofence_enforcement` (policy lưu; enforce polygon = follow-up), `sync_retry_max`, `pending_ttl_hours`, `workforce_mode`.

---

## Cài trên site

```bash
bench --site <site> migrate
bench --site <site> execute h2q_core.setup_phase2.run
# Desk → H2Q Settings → chỉnh → Save (resync workflow nếu bật)
bench --site <site> execute h2q_core.api.get_h2q_settings
```
