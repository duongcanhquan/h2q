# H2Q — Headless Construction ERP

Monorepo quản lý thi công [h2q.com.vn](https://h2q.com.vn).

| Thư mục | Vai trò |
|---------|---------|
| `h2q_core/` | Frappe app: R2, Telegram, HR seed, H2Q Settings, Measurement APIs, Supabase push |
| `h2q-fastcons-app/` | Next.js PWA FastCons (Vercel) — dashboard, báo cáo KL, offline Supabase |
| `docs/` | Mapping Fastwork, Settings, INSTALL |
| `buildsuite_src/` | Reference BuildSuite (không deploy từ monorepo) |
| `h2q_erp/` | frappe_docker reference |

## Cài đặt & deploy

→ **[`docs/INSTALL.md`](docs/INSTALL.md)** (Frappe → Supabase → Vercel).

## Dev nhanh (frontend)

```bash
cd h2q-fastcons-app
cp .env.example .env.local
npm install && npm run dev
```

## Remote

https://github.com/duongcanhquan/h2q
