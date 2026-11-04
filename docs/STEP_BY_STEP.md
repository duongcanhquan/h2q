# Hướng dẫn từng bước (làm chậm, xong bước mới qua bước)

Làm **đúng thứ tự**. Mỗi bước xong thì tick ☐ → ☑ rồi mới làm bước sau.  
Không nhét hết biến lên Vercel — xem ghi chú từng bước.

> **Superadmin dự kiến:** `duongcanhquan@gmail.com`  
> Mật khẩu: đặt trên Desk/bench — **không ghi vào git / chat công khai**.

---

## Bước 0 — Bạn đang có site Frappe chưa?

Chọn **một** tình huống:

| | Tình huống | Làm gì |
|---|---|---|
| A | Đã có site Frappe chạy (vd `https://dev.h2q.com.vn` hoặc IP) | Ghi URL đó ra giấy → sang **Bước 1** |
| B | Chưa có, mới clone `h2q_erp` (frappe_docker) | Làm **nhánh B** bên dưới (Docker → Dev Container → bench) |
| C | Thuê hosting Frappe / Frappe Cloud | Lấy URL site + quyền Administrator → **Bước 1** |

### Nhánh B — dựng Frappe local (H2Q cần custom app)

> **Không dùng** `pwd.yml` làm môi trường chính: demo đó **không cài được** `h2q_core` / BuildSuite.  
> Dùng **Dev Container** (development) trong `h2q_erp`.

#### B.0 — Cài Docker Desktop (làm ngay)

Máy Mac hiện **chưa có lệnh `docker`** trong PATH.

1. Tải: https://www.docker.com/products/docker-desktop/  
2. Cài → mở **Docker Desktop** → đợi icon cá voi chạy.  
3. Settings → Resources: RAM **≥ 4 GB** (khuyến nghị 6–8 GB).  
4. Terminal mới, chạy:

```bash
docker --version
docker compose version
```

Cả hai ra số version → báo “Docker OK” rồi sang **B.1**.

#### B.1 — Mở Dev Container (sau khi Docker OK)

```bash
cd /Users/mac/H2Q/h2q_erp
cp -R devcontainer-example .devcontainer
cp -R development/vscode-example development/.vscode
```

Cursor/VS Code: mở folder `h2q_erp` → Command Palette → **Dev Containers: Reopen in Container**  
(đợi build lần đầu 5–20 phút).

#### B.2 — Trong container: tạo bench + site

```bash
cd /workspace/development
bench init --skip-redis-config-generation --frappe-branch version-16 frappe-bench
cd frappe-bench
# cấu hình redis/db theo docs development (MariaDB trong compose)
bench new-site h2q.localhost --admin-password 'Canquan@1221' --mariadb-root-password ...
bench get-app erpnext --branch version-16
bench --site h2q.localhost install-app erpnext
```

(Chi tiết lệnh redis/db đúng với compose sẽ bổ sung khi bạn xong B.0.)

#### B.3 — Tạo user superadmin của bạn

```bash
bench --site h2q.localhost add-user duongcanhquan@gmail.com \
  --first-name Duong --last-name CanhQuan \
  --password 'YOUR_PASSWORD' \
  --add-role "System Manager"
```

Rồi mới cài `buildsuite_core` + `h2q_core`.

---

## Bước 1 — Tạo Superadmin (Administrator)

### Cách 1 (khuyến nghị): tạo trên Desk

1. Mở URL Frappe → login bằng user Administrator hiện có (lúc tạo site).
2. Vào **User List** → **New**.
3. Điền:
   - Email: `duongcanhquan@gmail.com`
   - First Name: `Duong` (hoặc tên bạn)
   - Check **System Manager** (và để Frappe thêm Administrator nếu cần full quyền)
4. Set password: mật khẩu bạn đã chọn.
5. Save → Logout → Login lại bằng `duongcanhquan@gmail.com` để xác nhận.

Muốn đúng “Administrator” (toàn quyền hệ thống):

- Role: **System Manager** là đủ cho hầu hết Desk + API.
- Role đặc biệt `Administrator` chỉ có user `Administrator` mặc định; thường dùng System Manager + bỏ qua hạn chế.

### Cách 2: lệnh `bench` (site đang chạy)

SSH / terminal vào máy có bench:

```bash
# Thay <site> = tên site; thay 'YOUR_PASSWORD' = mật khẩu bạn chọn
bench --site <site> add-user duongcanhquan@gmail.com \
  --first-name Duong \
  --last-name CanhQuan \
  --password 'YOUR_PASSWORD' \
  --add-role "System Manager"
```

Hoặc Python (`bench --site <site> console`):

```python
import frappe
from frappe.utils.password import update_password

email = "duongcanhquan@gmail.com"
pwd = "YOUR_PASSWORD"  # điền mật khẩu thật khi chạy, đừng commit

if frappe.db.exists("User", email):
    u = frappe.get_doc("User", email)
else:
    u = frappe.get_doc({
        "doctype": "User",
        "email": email,
        "first_name": "Duong",
        "last_name": "CanhQuan",
        "send_welcome_email": 0,
        "user_type": "System User",
    })
    u.insert(ignore_permissions=True)

u.enabled = 1
u.add_roles("System Manager")
u.save(ignore_permissions=True)
update_password(email, pwd)
frappe.db.commit()
print("OK", email)
```

**Xong Bước 1 khi:** login Desk bằng `duongcanhquan@gmail.com` thành công.

---

## Bước 2 — Cài `h2q_core` + BuildSuite (chỉ sau Bước 1)

```bash
# apps đã có erpnext; thêm buildsuite_core nếu chưa
bench get-app https://github.com/BuildSuite-io/buildsuite_core.git
bench --site <site> install-app buildsuite_core

# h2q_core từ monorepo
bench get-app /path/to/H2Q/h2q_core
# hoặc: ln -s /Users/mac/H2Q/h2q_core apps/h2q_core && bench --site <site> install-app h2q_core

bench pip install -r apps/h2q_core/requirements.txt
bench --site <site> migrate
bench --site <site> execute h2q_core.setup_phase2.run
bench --site <site> clear-cache && bench restart
```

**Xong khi:** Desk tìm thấy **H2Q Settings**.

---

## Bước 3 — Chỉ R2 (chưa đụng Vercel)

1. Cloudflare → R2 → tạo bucket.  
2. Tạo API token.  
3. Sửa `sites/<site>/site_config.json` **chỉ** các key `r2_*` (xem `h2q_core/site_config.r2.example.json`).  
4. `bench restart`  
5. Desk → upload 1 ảnh File → xem `file_url` có domain R2 không.

**Xong khi:** ảnh lên R2 được.

---

## Bước 4 — Chỉ Telegram

1. BotFather lấy token.  
2. Thêm vào `site_config`: `telegram_bot_token`, `telegram_chat_id`.  
3. Desk → **H2Q Settings** → bật Telegram, điền chat id.  
4. Save.

**Xong khi:** Settings lưu được (tin thật test sau khi có MB).

---

## Bước 5 — Dữ liệu nghiệp vụ tối thiểu

1. Company (ERPNext)  
2. Project + gắn user `duongcanhquan@gmail.com` vào Project User  
3. Vài Task  
4. BOQ + BOQ Item (Approved) gắn project/task  
5. Subcontractor + Work Order (Submit) trên project  

```bash
bench --site <site> execute h2q_core.setup_hr.setup_construction_hr
```

**Xong khi:** `bench execute h2q_core.api.get_active_projects` (đăng nhập user đó) có project.

---

## Bước 6 — Supabase (SQL + key)

1. Tạo project Supabase.  
2. Chạy 3 file SQL trong `h2q-fastcons-app/supabase/migrations/` (theo thứ tự).  
3. Copy URL + anon + service_role.  
4. Thêm vào Frappe `site_config`: `supabase_url`, `supabase_service_role_key`.

**Xong khi:** bảng `measurements_sync` tồn tại trên Supabase.

---

## Bước 7 — Vercel (chỉ env Next — không copy R2/Telegram token)

Root Directory: `h2q-fastcons-app`

```
NEXT_PUBLIC_FRAPPE_URL=https://<frappe-của-bạn>
FRAPPE_URL=https://<frappe-của-bạn>
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SYNC_WEBHOOK_SECRET=<openssl rand -hex 32>
FRAPPE_API_KEY=...
FRAPPE_API_SECRET=...
```

Deploy → mở `/api/health` → `ok: true`.  
Login PWA bằng `duongcanhquan@gmail.com`.

**Xong khi:** vào được `/dashboard`.

---

## Bước 8 — Webhook Supabase → Vercel

URL: `https://<app>.vercel.app/api/sync/on-measurement`  
Header: `x-sync-secret` = `SYNC_WEBHOOK_SECRET`.

---

## Bước 9 — Smoke

Báo cáo hiện trường → `/approvals` duyệt → MB Certified.

Chi tiết biến: [`SETUP_ENV_AND_DATA.md`](SETUP_ENV_AND_DATA.md).
