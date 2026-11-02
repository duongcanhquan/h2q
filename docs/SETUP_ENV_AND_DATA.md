# Hướng dẫn cài biến số & dữ liệu H2Q

Tài liệu này liệt kê **mọi biến / secret / dữ liệu master** cần có để hệ thống chạy.  
Thứ tự: **(1) Cloudflare R2 → (2) Telegram → (3) Frappe site_config → (4) Seed master → (5) Supabase → (6) Vercel env → (7) Webhook**.

---

## 1. Bản đồ “biến nằm ở đâu”

| Nhóm | Nơi lưu | Ai đọc |
|------|---------|--------|
| R2, Telegram token, Supabase service (Frappe push) | Frappe `sites/<site>/site_config.json` | `h2q_core` |
| Chat id / bật tắt Telegram / policy nghiệp vụ | Desk **H2Q Settings** (không phải secret) | API + Telegram + PWA |
| Frappe URL, Supabase anon, sync secret | Vercel / `.env.local` | Next.js FastCons |
| Bot token Telegram | Chỉ `site_config` | Frappe gửi tin |
| Service role Supabase | `site_config` **và** Vercel `SUPABASE_SERVICE_ROLE_KEY` | Frappe push + Next flush |

**Không** commit file có secret (`.env.local`, `site_config.json` đã gitignore).

---

## 2. Cloudflare R2 — lấy giá trị

1. Cloudflare Dashboard → R2 → Create bucket (vd `h2q-construction-files`).
2. Manage R2 API Tokens → Create API token (Object Read & Write).
3. Ghi lại:

| Biến | Ví dụ | Bắt buộc |
|------|--------|----------|
| `r2_account_id` | `abc123…` (Account ID) | ✅ |
| `r2_access_key_id` | từ API token | ✅ |
| `r2_secret_access_key` | từ API token | ✅ |
| `r2_bucket` | `h2q-construction-files` | ✅ |
| `r2_public_url` | `https://files.h2q.com.vn` (custom domain hoặc r2.dev) | ✅ để PWA xem ảnh |
| `r2_endpoint_url` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | ✅ |
| `r2_region_name` | `auto` | khuyến nghị |
| `r2_offload_all_files` | `0` = chỉ extension whitelist; `1` = mọi file | tùy |
| `r2_allowed_extensions` | xem example JSON | khi `offload_all=0` |

---

## 3. Telegram — lấy giá trị

1. BotFather → `/newbot` → copy **token**.
2. Nhắn bot, lấy chat id (user hoặc group), mặc định H2Q dùng `485567058`.

| Biến | Nơi | Ghi chú |
|------|-----|---------|
| `telegram_bot_token` | **chỉ** `site_config` | Secret |
| `telegram_chat_id` | `site_config` (fallback) | Có thể ghi đè trên Desk |
| `telegram_chat_id_pending` / `_certified` / `_alerts` | **H2Q Settings** | Routing theo sự kiện |
| `telegram_enabled` | Settings + optional `site_config` | `0` = mute toàn site |

---

## 4. Frappe `site_config.json` (template merge)

File: `frappe-bench/sites/<site>/site_config.json`  
Tham chiếu repo: `h2q_core/site_config.r2.example.json`

```json
{
  "r2_account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID",
  "r2_access_key_id": "YOUR_R2_ACCESS_KEY_ID",
  "r2_secret_access_key": "YOUR_R2_SECRET_ACCESS_KEY",
  "r2_bucket": "h2q-construction-files",
  "r2_public_url": "https://files.h2q.com.vn",
  "r2_endpoint_url": "https://YOUR_CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com",
  "r2_region_name": "auto",
  "r2_offload_all_files": 0,
  "r2_allowed_extensions": ".jpg,.jpeg,.png,.webp,.gif,.heic,.pdf",

  "telegram_bot_token": "123456:ABC-DEF...",
  "telegram_chat_id": "485567058",

  "supabase_url": "https://xxxx.supabase.co",
  "supabase_service_role_key": "eyJhbGciOi..."
}
```

Sau khi sửa:

```bash
bench --site <site> clear-cache
bench restart
```

### Cài app + Python deps

```bash
# Link/copy h2q_core vào apps/
bench get-app /path/to/H2Q/h2q_core
# hoặc: ln -s /path/to/H2Q/h2q_core apps/h2q_core

bench --site <site> install-app h2q_core
bench pip install -r apps/h2q_core/requirements.txt   # boto3

# Đã cài buildsuite_core + erpnext trước đó
bench --site <site> migrate
bench --site <site> execute h2q_core.setup_phase2.run
```

`setup_phase2.run` làm gì:

1. Custom fields `custom_h2q_*`
2. Seed **H2Q Settings** + approval roles
3. Workflow **H2Q Measurement Book Approval**

---

## 5. Dữ liệu master trên Frappe (bắt buộc nghiệp vụ)

Không có data này thì PWA báo cáo sẽ lỗi / trống.

### 5.1 Company & Project

| DocType | Việc |
|---------|------|
| **Company** | Ít nhất 1 company (ERPNext) |
| **Project** | Dự án Open; gắn user vào **Project User** hoặc BuildSuite **Project Team** |
| **Customer** | Tùy (BOQ có thể gắn customer) |

### 5.2 WBS = Task

Trên mỗi Project: tạo **Task** (không group) — form PWA chọn hạng mục từ đây.

### 5.3 BOQ (BuildSuite)

| DocType | Việc |
|---------|------|
| **BOQ** | Gắn `project`, status **Approved** (hoặc ít nhất có BOQ) |
| **BOQ Group / BOQ Item** | Item có `planned_qty`, `rate`, `unit`, ideally link `task` |

Dashboard % lấy từ Σ actual/planned của BOQ Item.

### 5.4 Subcontractor Work Order (bắt buộc cho Measurement Book)

BuildSuite: MB **reqd** `work_order`.

| DocType | Việc |
|---------|------|
| **Supplier** (type Subcontractor) | Thầu phụ |
| **Subcontractor Work Order** | `project` + lines (SOV); nên **Submit** (`docstatus=1`) |
| Lines | Khớp `cost_code_item` với mã BOQ nếu muốn auto-match |

Nếu project chỉ có **1** WO: API tự chọn. Nhiều WO: PWA điền mã WO hoặc payload phải có `work_order`.

### 5.5 HR (phòng ban / user hiện trường)

```bash
# Seed phòng ban + chức danh
bench --site <site> execute h2q_core.setup_hr.setup_construction_hr

# Tạo User đăng nhập + Employee
bench --site <site> execute h2q_core.setup_hr.create_employee_user --kwargs '{
  "email": "ks.a@h2q.com.vn",
  "full_name": "Nguyen Van A",
  "department": "Đội Thi Công",
  "designation": "Kỹ sư hiện trường",
  "password": "DoiMatKhauManh123!",
  "send_welcome_email": 0
}'
```

**Phòng ban seed:** Ban Giám Đốc · Phòng Kế Toán · Ban Quản Lý Dự Án (PMB) · Đội Thi Công  

**Chức danh seed:** Giám đốc · Kế toán trưởng · Chỉ huy trưởng · Kỹ sư hiện trường · Công nhân  

Gán user vào Project (Project User / Project Team) và role đủ đọc Project + tạo Measurement Book (vd `Projects User`, BuildSuite Site Engineer, hoặc theo **H2Q Settings → Approval Roles**).

### 5.6 H2Q Settings (Desk) — chỉnh sau seed

Mở **H2Q Settings**, khuyến nghị lần đầu:

| Mục | Giá trị gợi ý |
|-----|----------------|
| Enable Measurement Book | ✅ |
| Enable Offline Sync | ✅ |
| BOQ Over-Limit Policy | `Warn` |
| Auto Request Approval on Submit | ✅ (PWA tự gửi duyệt) |
| GPS Required | tùy công trường |
| Min Photos on Submit | `1` (nếu muốn bắt ảnh) |
| Dashboard Progress Source | `BOQ Qty` |
| Telegram Enabled | ✅ |
| Chat ID Pending / Certified / Alerts | `485567058` (hoặc group riêng) |
| Approval Roles | System Manager + PM approve; Site Engineer submit |
| Resync Workflow on Save | ✅ khi sửa bảng role |

---

## 6. Supabase — biến & SQL

### 6.1 Lấy key (Project Settings → API)

| Biến | Dùng ở | Public? |
|------|--------|---------|
| Project URL | Vercel `NEXT_PUBLIC_SUPABASE_URL` + Frappe `supabase_url` | URL ok |
| `anon` `public` key | Vercel `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ browser |
| `service_role` | Vercel `SUPABASE_SERVICE_ROLE_KEY` + Frappe `supabase_service_role_key` | ❌ secret |

### 6.2 Chạy migration (SQL Editor, theo thứ tự)

1. `h2q-fastcons-app/supabase/migrations/20261102120000_measurements_sync.sql`  
   *(bỏ nếu đã chạy bản align)*
2. `.../20261102140000_measurements_sync_align_buildsuite.sql`
3. `.../20261102150000_h2q_phase2_gps_approval.sql`

Kiểm tra bảng: `measurements_sync`, `project_progress`.

### 6.3 Realtime

Dashboard → Database → Replication: bật `project_progress` (và `measurements_sync` nếu cần). Migration đã cố `alter publication`.

### 6.4 Tạo secret sync

```bash
openssl rand -hex 32
# → dán vào Vercel SYNC_WEBHOOK_SECRET và header webhook
```

---

## 7. Vercel / local Next — biến môi trường

File mẫu: `h2q-fastcons-app/.env.example`  
Local: copy thành `.env.local`  
Vercel: Project → Settings → Environment Variables (Production + Preview).

| Biến | Bắt buộc | Mô tả |
|------|----------|--------|
| `NEXT_PUBLIC_FRAPPE_URL` | ✅ | URL site Frappe (https, không slash cuối) |
| `FRAPPE_URL` | ✅ khuyến nghị | Target BFF server-side (có thể = public URL) |
| `NEXT_PUBLIC_APP_NAME` | tùy | Mặc định `H2Q FastCons` |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ offline/realtime | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ flush worker | Không expose client |
| `SYNC_WEBHOOK_SECRET` | ✅ webhook/cron | Khớp header `x-sync-secret` |
| `FRAPPE_API_KEY` | khuyến nghị production | User API Key (Desk User → API Access) |
| `FRAPPE_API_SECRET` | khuyến nghị | Đi cặp với key — webhook không cần cookie user |

**Root Directory trên Vercel:** `h2q-fastcons-app`

Local:

```bash
cd h2q-fastcons-app
cp .env.example .env.local
# điền giá trị thật
npm install
npm run dev
```

---

## 8. Webhook Supabase → Vercel

Sau khi có domain Vercel (vd `https://h2q-fastcons.vercel.app`):

1. Supabase → Database → Webhooks → Create  
2. Table: `measurements_sync` · Events: **Insert**  
3. URL: `https://<vercel>/api/sync/on-measurement`  
4. HTTP Headers: `x-sync-secret` = giá trị `SYNC_WEBHOOK_SECRET`  

Cron dự phòng (optional): `GET https://<vercel>/api/sync/flush-measurements` + cùng header.

---

## 9. Frappe API Key cho sync (khuyến nghị)

1. Desk → User (service account, vd `sync@h2q.com.vn`) có quyền tạo Measurement Book  
2. Settings → API Access → Generate Keys  
3. Vercel: `FRAPPE_API_KEY` / `FRAPPE_API_SECRET`  

Không có key: flush vẫn chạy nếu user đang login (cookie `sid`) — webhook nền sẽ fail nếu chỉ dựa sid.

---

## 10. CORS / cookie (PWA ↔ Frappe)

- Browser **không** gọi Frappe trực tiếp cho method; đi qua `/api/frappe` trên cùng domain Vercel → cookie `sid` set bởi `/api/auth/login`.  
- `FRAPPE_URL` phải reachable từ Vercel (HTTPS, firewall mở).  
- Nếu login lỗi CORS phía Frappe: đảm bảo site cho phép request server-to-server (BFF không bị CORS browser trên Frappe).

---

## 11. Checklist “đủ biến + đủ data” trước khi mở công trường

### Secrets / env

- [ ] R2 5–6 key trong `site_config`
- [ ] `telegram_bot_token` (+ chat id)
- [ ] `supabase_url` + `supabase_service_role_key` trên Frappe
- [ ] Vercel: `FRAPPE_URL`, Supabase anon + service, `SYNC_WEBHOOK_SECRET`
- [ ] (Prod) `FRAPPE_API_KEY` + `SECRET`

### Dữ liệu

- [ ] Company, Project, Task, BOQ(+Item), Subcontractor Work Order
- [ ] `setup_phase2.run` · `setup_hr` · user KS gắn Project
- [ ] H2Q Settings đã Save (policy + Telegram + roles)

### Hạ tầng

- [ ] 3 SQL migrations Supabase
- [ ] Webhook INSERT → Vercel
- [ ] `/api/health` = `ok: true`
- [ ] Smoke: login → báo cáo → `/approvals` duyệt → MB Certified

---

## 12. Lệnh smoke nhanh (sau khi đủ data)

```bash
# Frappe
bench --site <site> execute h2q_core.api.get_h2q_settings
bench --site <site> execute h2q_core.api.get_active_projects
bench --site <site> execute h2q_core.api.get_project_wbs --kwargs '{"project":"PROJ-...."}'

# Tạo user hiện trường
bench --site <site> execute h2q_core.setup_hr.create_employee_user --kwargs '{
  "email":"ks.a@h2q.com.vn",
  "full_name":"Nguyen Van A",
  "department":"Đội Thi Công",
  "designation":"Kỹ sư hiện trường",
  "password":"DoiMatKhauManh123!"
}'
```

PWA: mở `https://<vercel>/login` → Dashboard → Report → Approvals.

---

## 13. File tham chiếu trong repo

| File | Nội dung |
|------|----------|
| `h2q_core/site_config.r2.example.json` | Toàn bộ key Frappe |
| `h2q-fastcons-app/.env.example` | Toàn bộ env Next/Vercel |
| `docs/INSTALL.md` | Lộ trình tổng |
| `docs/H2Q_SETTINGS.md` | Knob Desk |
| `docs/FEATURES_CATALOG.md` | Catalog tính năng |
| `h2q-fastcons-app/supabase/README.md` | Sync 2 chiều |
