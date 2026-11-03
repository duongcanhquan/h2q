# Lộ trình cài đặt H2Q (bản Frappe, không còn dùng cho PWA)

App `h2q-fastcons-app` đã chuyển sang Supabase. Cài PWA theo `h2q-fastcons-app/supabase/README.md`. Phần dưới đây chỉ còn giá trị nếu bạn tự chạy site Frappe cũ.

# Lộ trình cài đặt H2Q (chạy thật)

Thứ tự: **Frappe/BuildSuite → h2q_core → Supabase → FastCons (Vercel)**.

---

## 0. Kiểm tra sẵn sàng

| Thành phần | Cần có |
|---|---|
| Frappe v16 + ERPNext + `buildsuite_core` | Site bench đang chạy |
| Cloudflare R2 | Bucket + API token |
| Telegram Bot | Token BotFather |
| Supabase project | URL + anon + service_role |
| GitHub `duongcanhquan/h2q` | Đã push |
| Vercel account | Link GitHub |

---

## 1. Backend Frappe (`h2q_core`)

```bash
# Trong frappe-bench
cd apps
# clone hoặc link monorepo/h2q_core
bench get-app /path/to/H2Q/h2q_core   # hoặc ln -s
bench --site <site> install-app h2q_core
bench pip install -r apps/h2q_core/requirements.txt

# site_config.json (merge keys — xem h2q_core/site_config.r2.example.json)
# r2_*, telegram_bot_token, telegram_chat_id,
# supabase_url, supabase_service_role_key

bench --site <site> migrate
bench --site <site> execute h2q_core.setup_phase2.run
bench --site <site> execute h2q_core.setup_hr.setup_construction_hr
bench --site <site> clear-cache && bench restart
```

**Desk kiểm tra:** H2Q Settings · Custom fields trên Measurement Book · Workflow *H2Q Measurement Book Approval*.

**API smoke (Administrator):**

```bash
bench --site <site> execute h2q_core.api.get_h2q_settings
bench --site <site> execute h2q_core.api.get_active_projects
```

CORS / cookie: site phải cho phép origin Vercel (Frappe → Website Settings / CORS nếu cần).

---

## 2. Supabase

SQL Editor chạy lần lượt:

1. `h2q-fastcons-app/supabase/migrations/20261102120000_measurements_sync.sql`  
   *(bỏ qua nếu đã apply bản align)*
2. `.../20261102140000_measurements_sync_align_buildsuite.sql`
3. `.../20261102150000_h2q_phase2_gps_approval.sql`

Bật Realtime cho `project_progress` (migration đã cố gắng add publication).

**Database Webhook (khuyến nghị):**

- Table `measurements_sync` · INSERT  
- URL `https://<vercel-domain>/api/sync/on-measurement`  
- Header `x-sync-secret: <SYNC_WEBHOOK_SECRET>`

---

## 3. Vercel — FastCons PWA

1. Import repo `duongcanhquan/h2q`
2. **Root Directory:** `h2q-fastcons-app`
3. Framework: Next.js (auto)
4. Env (Production):

```
NEXT_PUBLIC_FRAPPE_URL=https://<frappe-site>
FRAPPE_URL=https://<frappe-site>
NEXT_PUBLIC_APP_NAME=H2Q FastCons
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SYNC_WEBHOOK_SECRET=<random-long>
FRAPPE_API_KEY=<optional service>
FRAPPE_API_SECRET=<optional>
```

5. Deploy → mở `https://<app>/api/health` phải `{ ok: true }`
6. Login user Frappe có quyền Project / Measurement Book

**Cookie note:** Frappe `sid` qua BFF same-site Vercel; nếu Frappe khác domain, đảm bảo login API set cookie trên domain Vercel (đã làm qua `/api/auth/login`).

---

## 4. Smoke test hiện trường

1. Login → Dashboard thấy dự án + % BOQ  
2. Mở dự án → chọn Task → thấy định mức  
3. Lấy GPS · chụp ảnh (R2 URL) · Gửi  
4. Supabase: row `measurements_sync` → `synced` + `frappe_measurement_book`  
5. Frappe: Measurement Book Draft/Pending · Telegram nếu bật  
6. Duyệt: `approve_measurement` hoặc Desk Workflow → status Certified · Telegram ✅  

---

## 5. Việc CHƯA có trên production (cố ý / phụ thuộc hạ tầng)

| Hạng mục | Trạng thái |
|---|---|
| Live E2E trên bench Docker trong máy agent | Không có site Frappe chạy tại đây — cần bạn migrate trên server |
| Geofence polygon enforce | Setting có; thuật toán trong/ngoài vùng chưa code |
| Duyệt đa cấp (>1 bước) | Matrix role 1 cấp Pending→Approved |
| Client RA / HĐ CĐT | Feature flag tắt |
| Nhật ký TPE PWA | Flag `enable_site_diary` tắt |
| Zalo OA | Chưa |

---

## 6. Rollback nhanh

- Vercel: Instant Rollback previous deployment  
- Frappe: tắt `telegram_enabled` / `enable_offline_sync` trong H2Q Settings  
- Supabase: pause webhook  
