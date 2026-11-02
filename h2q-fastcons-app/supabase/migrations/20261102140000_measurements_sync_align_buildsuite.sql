-- Align measurements_sync with BuildSuite Measurement Book (+ Entry) fields.
-- Source of truth (repo): buildsuite_core/.../measurement_book.json
-- Path apps/buildsuite/.../measurement_book.json was NOT present in this workspace.
--
-- Parent MB reqd: work_order (Link), project (Link), date (Date)
-- Child Entry reqd: description (Small Text)
-- Child qty/uom: quantity (Float), uom (Link/UOM) — not reqd in JSON but used by field PWA
-- Task / billed_amount: NOT on MB DocType; kept here for H2Q offline buffer + Frappe mapping via API

create extension if not exists "pgcrypto";

drop trigger if exists measurements_sync_refresh_progress on public.measurements_sync;
drop trigger if exists measurements_sync_set_updated_at on public.measurements_sync;

drop table if exists public.measurements_sync cascade;

create table public.measurements_sync (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ===== Measurement Book (parent) — BuildSuite =====
  -- Link/Data → text (Frappe name/id)
  work_order text not null,                 -- Link Subcontractor Work Order (reqd)
  project text not null,                    -- Link Project (reqd)
  measurement_date date not null default current_date,  -- Date (reqd)
  measured_by text,                         -- Link User
  company text,                             -- Link Company (read_only on MB; optional buffer)
  remarks text,                             -- Small Text
  status text not null default 'Draft',     -- mirrors MB Draft/Certified intent before sync

  -- ===== H2Q WBS (not a MB field; required by field API) =====
  task text not null,                       -- Link Task (ERPNext)

  -- ===== Measurement Book Entry (child) — BuildSuite =====
  description text not null,                -- Small Text (reqd on Entry)
  work_order_line text,                     -- Data
  cost_code_type text,                      -- Select Group/Item
  cost_code_group text,                     -- Data
  cost_code_item text,                      -- Data
  cost_code_label text,                     -- Data
  uom text,                                 -- Link UOM → text name
  nos double precision default 1,           -- Float
  length double precision,                  -- Float
  breadth double precision,                 -- Float
  depth double precision default 1,         -- Float
  quantity double precision not null,       -- Float (field qty)
  is_deduction boolean not null default false, -- Check

  -- ===== Commercial buffer (not on MB JSON; used for sync/UI) =====
  rate numeric(18, 6),                      -- Currency-like
  billed_amount numeric(18, 6),             -- rate * quantity (or explicit)

  -- ===== Media / sync flags (requested) =====
  image_url text,                           -- primary R2 URL
  image_urls jsonb not null default '[]'::jsonb,
  is_synced_to_frappe boolean not null default false,

  -- ===== Sync bookkeeping =====
  boq_item text,
  frappe_user text,
  client_request_id text unique,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'syncing', 'synced', 'failed')),
  frappe_measurement_book text,
  last_error text,
  synced_at timestamptz,

  constraint measurements_sync_quantity_nonzero check (quantity <> 0)
);

create index measurements_sync_sync_status_idx
  on public.measurements_sync (sync_status, created_at);
create index measurements_sync_project_idx
  on public.measurements_sync (project);
create index measurements_sync_is_synced_idx
  on public.measurements_sync (is_synced_to_frappe);

-- Keep project_progress; recreate trigger against new column names
create table if not exists public.project_progress (
  project_id text primary key,
  project_name text,
  pending_count int not null default 0,
  synced_count int not null default 0,
  failed_count int not null default 0,
  last_quantity numeric,
  last_task_id text,
  last_measurement_book text,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger measurements_sync_set_updated_at
  before update on public.measurements_sync
  for each row execute function public.set_updated_at();

create or replace function public.refresh_project_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid text;
begin
  pid := coalesce(new.project, old.project);
  insert into public.project_progress as pp (
    project_id, pending_count, synced_count, failed_count,
    last_quantity, last_task_id, last_measurement_book, updated_at
  )
  select
    pid,
    count(*) filter (where sync_status = 'pending' or is_synced_to_frappe = false)::int,
    count(*) filter (where sync_status = 'synced' or is_synced_to_frappe = true)::int,
    count(*) filter (where sync_status = 'failed')::int,
    (select quantity from public.measurements_sync m2 where m2.project = pid order by m2.updated_at desc limit 1),
    (select task from public.measurements_sync m3 where m3.project = pid order by m3.updated_at desc limit 1),
    (select frappe_measurement_book from public.measurements_sync m4
      where m4.project = pid and m4.frappe_measurement_book is not null
      order by m4.synced_at desc nulls last limit 1),
    now()
  on conflict (project_id) do update set
    pending_count = excluded.pending_count,
    synced_count = excluded.synced_count,
    failed_count = excluded.failed_count,
    last_quantity = excluded.last_quantity,
    last_task_id = excluded.last_task_id,
    last_measurement_book = excluded.last_measurement_book,
    updated_at = now();
  return coalesce(new, old);
end;
$$;

create trigger measurements_sync_refresh_progress
  after insert or update or delete on public.measurements_sync
  for each row execute function public.refresh_project_progress();

alter table public.measurements_sync enable row level security;
alter table public.project_progress enable row level security;

drop policy if exists "measurements_sync_insert" on public.measurements_sync;
create policy "measurements_sync_insert"
  on public.measurements_sync for insert
  to anon, authenticated
  with check (is_synced_to_frappe = false and sync_status = 'pending');

drop policy if exists "measurements_sync_select" on public.measurements_sync;
create policy "measurements_sync_select"
  on public.measurements_sync for select
  to anon, authenticated
  using (true);

drop policy if exists "measurements_sync_update_own_pending" on public.measurements_sync;
create policy "measurements_sync_update_own_pending"
  on public.measurements_sync for update
  to anon, authenticated
  using (sync_status in ('pending', 'failed'))
  with check (sync_status in ('pending', 'failed', 'syncing'));

drop policy if exists "project_progress_select" on public.project_progress;
create policy "project_progress_select"
  on public.project_progress for select
  to anon, authenticated
  using (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.project_progress;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.measurements_sync;
  exception when duplicate_object then null;
  end;
end $$;
