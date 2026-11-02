# Giai đoạn 3 + 4 — Supabase sync & FastCons PWA

## Giai đoạn 3 (done in repo)

| Thành phần | Path |
|---|---|
| SQL GPS/approval | `h2q-fastcons-app/supabase/migrations/20261102150000_h2q_phase2_gps_approval.sql` |
| Flush GPS + auto approve | `src/app/api/sync/flush-measurements/route.ts` |
| Enqueue GPS fields | `src/lib/supabase/measurements.ts` |
| Frappe → Supabase | `h2q_core/sync/supabase_push.py` + `measurement_book_events.py` |

## Giai đoạn 4 (done in repo)

| Thành phần | Path |
|---|---|
| Settings runtime | `hooks/useH2qSettings.ts` + `get_h2q_settings` |
| GPS | `hooks/useGeolocation.ts` |
| Form field-gloves | `components/report/ReportForm.tsx` |
| Dashboard BOQ % | `ProjectCard` dùng `percent_complete_display` |
| PWA | `@ducanh2912/next-pwa` (đã có trong `next.config.ts`) |

## Việc bạn chạy

```bash
# Supabase
cd h2q-fastcons-app && supabase db push   # hoặc SQL Editor

# Frappe
# thêm supabase_url + supabase_service_role_key vào site_config
bench --site <site> migrate
bench --site <site> clear-cache

# Next
cd h2q-fastcons-app
npm install
npm run build
```

Smoke: login → Dashboard thấy % BOQ → mở report → Lấy GPS → chụp ảnh → Gửi → kiểm tra `measurements_sync` + MB trên Frappe.
