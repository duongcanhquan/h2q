# Supabase for H2Q FastCons (Giai đoạn 3)

Frappe/MariaDB = system of record. Supabase/Postgres = offline queue + Realtime UI buffer.

## 1. Apply migrations (in order)

1. `migrations/20261102120000_measurements_sync.sql` (or skip if already applied)
2. `migrations/20261102140000_measurements_sync_align_buildsuite.sql`
3. `migrations/20261102150000_h2q_phase2_gps_approval.sql` ← GPS / approval columns

```bash
supabase db push
# or paste each file into SQL Editor
```

## 2. Env

**Next.js (Vercel / `.env.local`):**

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SYNC_WEBHOOK_SECRET=...
FRAPPE_API_KEY=...
FRAPPE_API_SECRET=...
```

**Frappe `site_config.json` (chiều Frappe → Supabase):**

```json
{
  "supabase_url": "https://xxxx.supabase.co",
  "supabase_service_role_key": "eyJ..."
}
```

## 3. Webhook (Supabase → Next → Frappe)

Dashboard → Database → Webhooks:

- Table: `measurements_sync` · Events: INSERT
- URL: `https://<app>/api/sync/on-measurement`
- Header: `x-sync-secret: <SYNC_WEBHOOK_SECRET>`

Cron (optional): `GET /api/sync/flush-measurements` + same header.

## Flow 2 chiều

```
PWA ──insert──► measurements_sync (pending)
                    │
                    ├─ webhook/flush ──► h2q_core.api.submit_measurement ──► MB Draft(+Pending)
                    │
Frappe MB update ──► h2q_core.sync.supabase_push ──PATCH──► measurements_sync
                    │
project_progress trigger ──Realtime──► Dashboard
```

H2Q Settings `enable_offline_sync` tắt → Frappe không push; PWA vẫn có thể ghi local nếu anon key còn.
