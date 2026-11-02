# H2Q — Headless Construction ERP

Monorepo cho hệ thống quản lý thi công [h2q.com.vn](https://h2q.com.vn).

## Thành phần

| Thư mục | Mô tả |
|---------|--------|
| `h2q_core/` | Custom Frappe app (R2 storage, Telegram, REST API cho PWA) |
| `h2q-fastcons-app/` | Frontend Next.js (PWA) — Vercel |

## Backend phụ thuộc (clone riêng)

```bash
# Frappe Docker / bench
git clone https://github.com/frappe/frappe_docker.git h2q_erp

# BuildSuite (construction DocTypes)
git clone https://github.com/BuildSuite-io/buildsuite_core.git buildsuite_src
```

## Frontend

```bash
cd h2q-fastcons-app
cp .env.example .env.local   # điền FRAPPE_URL
npm install
npm run dev
```

## Frappe app

Copy / link `h2q_core` vào `apps/` trên bench, rồi:

```bash
bench --site <site> install-app h2q_core
bench pip install -r apps/h2q_core/requirements.txt
```

Remote: https://github.com/duongcanhquan/h2q
