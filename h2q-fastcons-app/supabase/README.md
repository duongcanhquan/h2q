# Supabase for H2Q FastCons

Frappe/MariaDB = system of record. Supabase/Postgres = offline queue + Realtime UI buffer.

## 1. Apply migration

In Supabase SQL Editor, run:

`migrations/20261102120000_measurements_sync.sql`

Or with CLI (linked project):

```bash
supabase db push
```

## 2. Env on Vercel / `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SYNC_WEBHOOK_SECRET=...
FRAPPE_API_KEY=...          # recommended for webhook path
FRAPPE_API_SECRET=...
```

## 3. Database Webhook (optional)

Dashboard → Database → Webhooks:

- Table: `measurements_sync`
- Events: Insert
- URL: `https://<your-app>/api/sync/on-measurement`
- Header: `x-sync-secret: <SYNC_WEBHOOK_SECRET>`

## Flow

1. PWA submit → IndexedDB + `measurements_sync` (pending)
2. `/api/sync/flush-measurements` → Frappe `h2q_core.api.submit_measurement`
3. Trigger updates `project_progress` → Dashboard Realtime channel
