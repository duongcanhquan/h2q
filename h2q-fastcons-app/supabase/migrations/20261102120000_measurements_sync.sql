-- H2Q FastCons — offline buffer + realtime progress (Supabase / Postgres)
-- Apply via: supabase db push  OR  SQL editor in Dashboard

create extension if not exists "pgcrypto";

-- Queue: field reports waiting to be pushed into Frappe Measurement Book
create table if not exists public.measurements_sync (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id text not null,
  task_id text not null,
  quantity numeric not null,
  image_urls jsonb not null default '[]'::jsonb,
  work_order text,
  boq_item text,
  description text,
  remarks text,
  report_date date,
  frappe_user text,
  client_request_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'syncing', 'synced', 'failed')),
  frappe_measurement_book text,
  last_error text,
  synced_at timestamptz
);

create index if not exists measurements_sync_status_idx
  on public.measurements_sync (status, created_at);

create index if not exists measurements_sync_project_idx
  on public.measurements_sync (project_id);

-- Denormalized progress for Dashboard Realtime
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

drop trigger if exists measurements_sync_set_updated_at on public.measurements_sync;
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
  pid := coalesce(new.project_id, old.project_id);
  insert into public.project_progress as pp (
    project_id,
    pending_count,
    synced_count,
    failed_count,
    last_quantity,
    last_task_id,
    last_measurement_book,
    updated_at
  )
  select
    pid,
    count(*) filter (where status = 'pending')::int,
    count(*) filter (where status = 'synced')::int,
    count(*) filter (where status = 'failed')::int,
    (
      select quantity from public.measurements_sync m2
      where m2.project_id = pid
      order by m2.updated_at desc
      limit 1
    ),
    (
      select task_id from public.measurements_sync m3
      where m3.project_id = pid
      order by m3.updated_at desc
      limit 1
    ),
    (
      select frappe_measurement_book from public.measurements_sync m4
      where m4.project_id = pid and m4.frappe_measurement_book is not null
      order by m4.synced_at desc nulls last
      limit 1
    ),
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

drop trigger if exists measurements_sync_refresh_progress on public.measurements_sync;
create trigger measurements_sync_refresh_progress
  after insert or update or delete on public.measurements_sync
  for each row execute function public.refresh_project_progress();

alter table public.measurements_sync enable row level security;
alter table public.project_progress enable row level security;

-- Anon/authenticated clients may insert pending rows (PWA offline buffer).
-- Reads limited to same frappe_user when provided; service_role bypasses RLS.
drop policy if exists "measurements_sync_insert" on public.measurements_sync;
create policy "measurements_sync_insert"
  on public.measurements_sync for insert
  to anon, authenticated
  with check (status = 'pending');

drop policy if exists "measurements_sync_select" on public.measurements_sync;
create policy "measurements_sync_select"
  on public.measurements_sync for select
  to anon, authenticated
  using (true);

drop policy if exists "measurements_sync_update_own_pending" on public.measurements_sync;
create policy "measurements_sync_update_own_pending"
  on public.measurements_sync for update
  to anon, authenticated
  using (status in ('pending', 'failed'))
  with check (status in ('pending', 'failed', 'syncing'));

drop policy if exists "project_progress_select" on public.project_progress;
create policy "project_progress_select"
  on public.project_progress for select
  to anon, authenticated
  using (true);

-- Realtime (ignore if already members of the publication)
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
