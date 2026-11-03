# H2Q — Catalog tính năng (chi tiết vận hành)

**Commit base:** `main` @ repo `duongcanhquan/h2q`  
**Kiểm tra code:** lint 0 error · `npm run build` OK (FastCons)  
**Runtime E2E Frappe:** cần site bench thật (`docs/INSTALL.md`) — agent không có MariaDB/bench sống.

Chú thích trạng thái:

| Ký hiệu | Nghĩa |
|---|---|
| ✅ Sẵn sàng | Code + đường chạy đã nối; hoạt động sau khi cấu hình hạ tầng |
| 🟡 Một phần | Backend/API có; UI hoặc enforce còn thiếu |
| ⚙️ Cần cấu hình | Phụ thuộc env / migrate / secrets |
| ❌ Chưa làm | Ngoài phạm vi hiện tại |

---

## A. Backend Frappe — `h2q_core`

### A1. Lưu trữ Cloudflare R2 ✅ ⚙️

| Chi tiết | |
|---|---|
| Hook | `hooks.write_file` → `h2q_core.storage.r2_file.write_file` |
| Xóa | `delete_file_data_content` |
| Config | `site_config`: `r2_account_id`, `r2_access_key_id`, `r2_secret_access_key`, `r2_bucket`, `r2_public_url`, … |
| API phụ | `h2q_core.storage.r2_file.get_signed_file_url` |
| Cách test | Upload File Desk hoặc PWA chụp ảnh → `file_url` là URL R2 |

### A2. H2Q Settings (Single DocType) ✅

Desk: **H2Q Settings**. Seed: `setup_phase2.run` / `after_migrate`.

| Field | Ảnh hưởng runtime |
|---|---|
| `enable_measurement_book` | Chặn `submit_measurement` nếu tắt |
| `enable_site_diary` | Flag (PWA chưa form TPE) 🟡 |
| `enable_client_ra_billing` | Flag tắt 🟡 |
| `enable_offline_sync` | Tắt Frappe→Supabase push |
| `dashboard_progress_source` | BOQ Qty / Amount / Project % trên dashboard |
| `ui_profile` | Field Gloves / Office (form) |
| `boq_over_limit_policy` | Warn / Block / Warn Require Note |
| `auto_request_approval_default` | Tự Pending sau submit |
| `gps_required` | Bắt GPS lúc submit |
| `geofence_enforcement` | Off/Warn/Block — **chưa enforce polygon** 🟡 |
| `min_photos_on_submit` / `_approve` | Số ảnh tối thiểu |
| `approval_roles` + `resync_workflow_on_save` | Seed Workflow transitions |
| `telegram_*` | Bật/tắt + chat id pending/certified/alerts |
| `default_employee_roles` | Role khi `create_employee_user` |
| `sync_retry_max` / `pending_ttl_hours` | Flag sync (PWA đọc public) |

**API PWA:** `POST /api/method/h2q_core.api.get_h2q_settings` → subset public (không secret).

### A3. Custom fields BuildSuite/ERPNext ✅ ⚙️

`setup_custom_fields` / `after_migrate`:

- **Measurement Book:** approval_status, task, boq_item, GPS×3, photo_urls, over_limit, telegram_notified, reject_reason, submitted_by_user/(employee)
- **MB Entry:** boq_item, photo_url, rate, amount
- **Task Progress Entry:** GPS, photos, safety, equipment
- **Project:** contract_no, geofence_json

### A4. Workflow nghiệm thu ✅ ⚙️

Tên: `H2Q Measurement Book Approval`  
Field: `custom_h2q_approval_status` (không đụng `status` Draft/Certified của BuildSuite)

```
Draft → Pending Approval → Approved  → API gọi certify_measurement_book
                       ↘ Rejected
```

### A5. REST API (whitelist + `has_permission`) ✅

| Method | Input chính | Output / hành vi |
|---|---|---|
| `get_h2q_settings` | — | Feature flags PWA |
| `get_active_projects` | session | Projects + `percent_complete_display` (theo Settings) |
| `get_project_wbs` | `project` | Tasks + BOQ items (`remaining_qty`, `over_limit`) |
| `get_boq_item_defaults` | `boq_item` hoặc `project`+`task` | unit, rate, remaining |
| `submit_measurement` | project, task, qty, optional WO/GPS/ảnh/entry_kind | Tạo MB Draft + custom fields; geofence; optional auto Pending |
| `submit_site_diary` | project, date, weather, lines, GPS, ảnh | Task Progress Entry; cập nhật nếu cùng ngày cùng hạng mục |
| `request_measurement_approval` | `measurement_book` | → Pending + Telegram |
| `approve_measurement` | `measurement_book` | → Approved + **`buildsuite_core.api.subcontract.certify_measurement_book`** |
| `reject_measurement` | `measurement_book`, `reason` | → Rejected, BS status vẫn Draft |
| `get_pending_approvals` | optional `project` | Hàng đợi Pending |

Alias cũ: `get_project_tasks_and_boq`, `create_draft_measurement_book`, `submit_daily_report`.

### A6. Telegram ✅ ⚙️

| Sự kiện | Điều kiện | Chat |
|---|---|---|
| Pending | Settings notify_on_pending | `telegram_chat_id_pending` |
| Certified | status→Certified + notify_on_certified | `telegram_chat_id_certified` |
| Over BOQ | submit over_limit + notify_on_over_limit | `telegram_chat_id_alerts` |

Secret token: `site_config.telegram_bot_token` (không lưu Desk).

### A7. HR seed ✅ ⚙️

`h2q_core.setup_hr.setup_construction_hr` — Department/Designation.  
`create_employee_user(email, full_name, department, designation)` — User + Employee + roles từ Settings.

### A8. Frappe → Supabase mirror ✅ ⚙️

`measurement_book_events.on_update` → Telegram + `sync.supabase_push`  
PATCH `measurements_sync` theo `frappe_measurement_book` khi đổi status/approval.  
Cần `supabase_url` + `supabase_service_role_key`.

---

## B. Middleware Supabase

### B1. Bảng buffer ✅ ⚙️

Migrations:

1. `20261102120000_measurements_sync.sql`
2. `20261102140000_…_align_buildsuite.sql` (WO, description, qty,…)
3. `20261102150000_…_gps_approval.sql` (gps_*, approval_status, auto_request_approval)

Cột chính: `work_order`, `project`, `task`, `description`, `quantity`, `image_urls`, `sync_status`, `frappe_measurement_book`, GPS, …

### B2. `project_progress` + Realtime ✅ ⚙️

Trigger cập nhật pending/synced/failed → Dashboard subscribe `postgres_changes`.

### B3. Chiều App → Frappe ✅ ⚙️

1. PWA `enqueueMeasurement` → IndexedDB + insert `measurements_sync`  
2. `POST /api/sync/flush-measurements` (sid hoặc API key hoặc `x-sync-secret`)  
3. Gọi `h2q_core.api.submit_measurement`  
4. Webhook Supabase INSERT → `/api/sync/on-measurement` → flush  

Proxy **không** yêu cầu sid cho `/api/sync/*`.

---

## C. Frontend FastCons (`h2q-fastcons-app`)

### C1. Auth BFF ✅ ⚙️

| Route | Việc |
|---|---|
| `/login` | Form → `/api/auth/login` → cookie `sid` httpOnly |
| `/api/auth/session` | Kiểm tra session |
| `/api/auth/logout` | Xóa cookie |
| `/api/frappe/[...path]` | Proxy method Frappe kèm sid |
| `proxy.ts` | Guard trang; public: login, auth, sync, health, PWA assets |

### C2. Dashboard `/dashboard` ✅

- `get_active_projects` → thẻ dự án  
- Progress = `percent_complete_display` (BOQ theo Settings)  
- Realtime badge sync từ `project_progress`  
- CTA → `/project/[id]/report`

### C3. Form báo cáo `/project/[id]/report` ✅

1. Load WBS (`get_project_wbs`) + cache offline  
2. Chọn Task → định mức BOQ (remaining/rate)  
3. Cảnh báo vượt BOQ theo Settings  
4. GPS (`useGeolocation`)  
5. Ảnh → `upload_file` → R2 URL (`PhotoCapture`)  
6. `enqueueMeasurement` → Supabase/IDB → flush Frappe  
7. Tôn trọng `gps_required`, `min_photos_*`, `auto_request_approval_default`, `enable_measurement_book`

### C4. Duyệt `/approvals` ✅

- `get_pending_approvals`  
- Nút Duyệt → `approve_measurement` (certify BuildSuite)  
- Nút Từ chối → `reject_measurement` + lý do  
- Icon trên AppShell

### C5. PWA ✅

`@ducanh2912/next-pwa` · `manifest.webmanifest` · icons 192/512 · SW (prod).

### C6. Health ✅

`GET /api/health` → `{ ok, frappe_url_configured, supabase_configured }`

---

## D. Luồng nghiệp vụ end-to-end (khi đã cấu hình)

```
KS hiện trường (PWA)
  → chụp ảnh R2 + GPS + KL
  → measurements_sync (pending)
  → submit_measurement → MB Draft (+ Pending nếu Settings)
  → Telegram ⏳ (nếu bật)
Chỉ huy / PMB (PWA /approvals hoặc Desk)
  → approve_measurement
  → BuildSuite status = Certified
  → Telegram ✅
  → supabase_push cập nhật row synced
Dashboard Realtime cập nhật project_progress
```

---

## E. Việc chưa / một phần (rõ ràng)

| Hạng mục | Trạng thái |
|---|---|
| Geofence polygon trong/ngoài vùng | ✅ `evaluate_geofence` trên submit MB và nhật ký. Policy Off / Warn / Block. Không có polygon thì bỏ qua |
| Duyệt nhiều cấp (>1 Pending) | ✅ Khi `approval_level` > 0 trên H2Q Settings Role. 0 = một cấp như cũ |
| Nhật ký TPE trên PWA | ✅ `/project/[id]/diary` + `submit_site_diary`. Cờ `enable_site_diary` vẫn mặc định tắt |
| Loại phiếu thực hiện / nghiệm thu | ✅ `custom_h2q_entry_kind` + cột `entry_kind` trên buffer |
| HĐ CĐT / RA client | ❌ Flag off |
| Zalo OA | ❌ |
| E2E tự động trên CI với Frappe sống | ❌ Cần bench server |
| `getBoqItemDefaults` | ✅ API+client; form đang dùng BOQ từ WBS (đủ) |

---

## F. Checklist xác nhận trên môi trường thật

1. `bench migrate` + `execute h2q_core.setup_phase2.run`  
2. Desk mở **H2Q Settings** — đổi Warn→Block, Save  
3. Supabase apply 3 migrations + webhook  
4. Vercel Root=`h2q-fastcons-app` + env → `/api/health` ok  
5. Login PWA → Dashboard có dự án  
6. Gửi báo cáo có ảnh+GPS → row Supabase → MB trên Frappe  
7. `/approvals` Duyệt → MB Certified + Telegram  
8. Tắt `enable_measurement_book` → submit bị chặn  

Chi tiết cài: [`INSTALL.md`](INSTALL.md) · Settings: [`H2Q_SETTINGS.md`](H2Q_SETTINGS.md).
