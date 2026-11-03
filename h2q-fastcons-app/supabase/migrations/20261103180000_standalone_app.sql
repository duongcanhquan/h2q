-- H2Q FastCons without Frappe.
-- On a new Supabase project, run this file alone in the SQL editor.
-- It is the system of record: users, projects, quantity slips, diaries, approvals.

create extension if not exists pgcrypto;

create sequence if not exists public.measurement_slip_seq;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  app_role text not null default 'engineer' check (app_role in ('engineer', 'approver', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'Open',
  company text,
  customer text,
  expected_start_date date,
  expected_end_date date,
  geofence jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_role text not null default 'engineer' check (member_role in ('engineer', 'approver', 'admin')),
  primary key (project_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  code text not null,
  subject text not null,
  parent_id uuid references public.tasks (id) on delete set null,
  is_group boolean not null default false,
  status text not null default 'Open',
  unique (project_id, code)
);

create table if not exists public.boq_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  code text not null,
  description text not null default '',
  unit text,
  planned_qty numeric not null default 0,
  rate numeric not null default 0,
  unique (project_id, code)
);

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  enable_measurement_book int not null default 1,
  enable_site_diary int not null default 1,
  enable_client_ra_billing int not null default 0,
  enable_offline_sync int not null default 1,
  dashboard_progress_source text not null default 'BOQ Qty',
  ui_profile text not null default 'Field Gloves',
  allow_mobile_revise_rejected int not null default 1,
  boq_over_limit_policy text not null default 'Warn',
  auto_request_approval_default int not null default 1,
  gps_required int not null default 0,
  geofence_enforcement text not null default 'Off',
  min_photos_on_submit int not null default 0,
  min_photos_on_approve int not null default 0,
  sync_retry_max int not null default 5,
  pending_ttl_hours int not null default 72,
  telegram_enabled int not null default 0,
  approval_chain_length int not null default 1
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  slip_code text not null unique default (
    'PS-' || lpad(nextval('public.measurement_slip_seq')::text, 5, '0')
  ),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  boq_item_id uuid references public.boq_items (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  measurement_date date not null default current_date,
  quantity numeric not null,
  entry_kind text not null default 'thuc_hien' check (entry_kind in ('thuc_hien', 'nghiem_thu')),
  description text,
  remarks text,
  uom text,
  rate numeric,
  billed_amount numeric,
  work_order text,
  image_urls text[] not null default '{}',
  gps_lat numeric,
  gps_lng numeric,
  gps_accuracy numeric,
  geofence_outside boolean not null default false,
  over_limit boolean not null default false,
  approval_status text not null default 'Draft'
    check (approval_status in ('Draft', 'Pending Approval', 'Approved', 'Rejected')),
  approval_level int not null default 0,
  certified boolean not null default false,
  reject_reason text,
  client_request_id text unique,
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists measurements_project_status_idx
  on public.measurements (project_id, approval_status);

create table if not exists public.diaries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  diary_date date not null,
  weather text,
  site_condition text,
  safety_status text,
  work_note text,
  task_id uuid references public.tasks (id) on delete set null,
  quantity numeric,
  labour_count int,
  equipment_note text,
  image_urls text[] not null default '{}',
  gps_lat numeric,
  gps_lng numeric,
  gps_accuracy numeric,
  geofence_outside boolean not null default false,
  client_request_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diaries_project_date_idx
  on public.diaries (project_id, diary_date);

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

drop trigger if exists measurements_set_updated_at on public.measurements;
create trigger measurements_set_updated_at
  before update on public.measurements
  for each row execute function public.set_updated_at();

drop trigger if exists diaries_set_updated_at on public.diaries;
create trigger diaries_set_updated_at
  before update on public.diaries
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and app_role = 'admin'
  );
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.project_members
    where project_id = p_project and user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned text;
begin
  if exists (select 1 from public.profiles) then
    assigned := 'engineer';
  else
    assigned := 'admin';
  end if;
  insert into public.profiles (id, email, full_name, app_role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    assigned
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.refresh_slip_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  pcode text;
  pname text;
begin
  pid := coalesce(new.project_id, old.project_id);
  select code, name into pcode, pname from public.projects where id = pid;
  if pcode is null then
    return null;
  end if;

  insert into public.project_progress as pp (
    project_id,
    project_name,
    pending_count,
    synced_count,
    failed_count,
    last_quantity,
    last_task_id,
    last_measurement_book,
    updated_at
  )
  values (
    pcode,
    pname,
    (select count(*) from public.measurements m where m.project_id = pid and m.approval_status = 'Pending Approval'),
    (select count(*) from public.measurements m where m.project_id = pid and m.approval_status = 'Approved'),
    (select count(*) from public.measurements m where m.project_id = pid and m.approval_status = 'Rejected'),
    (select m2.quantity from public.measurements m2 where m2.project_id = pid order by m2.created_at desc limit 1),
    (select t.code from public.measurements m2 left join public.tasks t on t.id = m2.task_id where m2.project_id = pid order by m2.created_at desc limit 1),
    (select m2.slip_code from public.measurements m2 where m2.project_id = pid order by m2.created_at desc limit 1),
    now()
  )
  on conflict (project_id) do update set
    project_name = excluded.project_name,
    pending_count = excluded.pending_count,
    synced_count = excluded.synced_count,
    failed_count = excluded.failed_count,
    last_quantity = excluded.last_quantity,
    last_task_id = excluded.last_task_id,
    last_measurement_book = excluded.last_measurement_book,
    updated_at = excluded.updated_at;

  return null;
end;
$$;

drop trigger if exists measurements_refresh_progress on public.measurements;
create trigger measurements_refresh_progress
  after insert or update or delete on public.measurements
  for each row execute function public.refresh_slip_progress();

create or replace function public.decide_measurement(
  p_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.measurements%rowtype;
  actor uuid := auth.uid();
  can_decide boolean := false;
  chain int := 1;
  next_level int;
  final_step boolean;
begin
  if actor is null then
    raise exception 'Phiên đăng nhập đã hết.';
  end if;

  select * into rec from public.measurements where id = p_id;
  if not found then
    raise exception 'Không tìm thấy phiếu.';
  end if;
  if rec.approval_status <> 'Pending Approval' then
    raise exception 'Phiếu không ở hàng chờ duyệt.';
  end if;

  select public.is_admin() or exists (
    select 1 from public.project_members m
    where m.project_id = rec.project_id
      and m.user_id = actor
      and m.member_role in ('approver', 'admin')
  ) into can_decide;

  if not can_decide then
    raise exception 'Bạn không có quyền duyệt phiếu này.';
  end if;

  select greatest(coalesce(approval_chain_length, 1), 1)
    into chain
  from public.app_settings
  where id = 1;
  if chain is null or chain < 1 then
    chain := 1;
  end if;

  if p_action = 'reject' then
    if coalesce(btrim(p_reason), '') = '' then
      raise exception 'Cần lý do từ chối.';
    end if;
    update public.measurements
      set approval_status = 'Rejected',
          reject_reason = btrim(p_reason),
          approved_by = actor,
          approved_at = now(),
          approval_level = 0,
          certified = false
      where id = p_id
      returning * into rec;
  elsif p_action = 'approve' then
    next_level := rec.approval_level + 1;
    final_step := next_level >= chain;
    if not final_step then
      update public.measurements
        set approval_level = next_level
        where id = p_id
        returning * into rec;
    else
      update public.measurements
        set approval_status = 'Approved',
            approval_level = next_level,
            certified = (rec.entry_kind = 'nghiem_thu'),
            approved_by = actor,
            approved_at = now()
        where id = p_id
        returning * into rec;
    end if;
  else
    raise exception 'Thao tác duyệt không hợp lệ.';
  end if;

  return jsonb_build_object(
    'measurement_book', rec.slip_code,
    'approval_status', rec.approval_status,
    'approval_level', rec.approval_level,
    'approval_levels', chain,
    'awaiting_next_level', case when rec.approval_status = 'Pending Approval' then 1 else 0 end,
    'certified', case when rec.certified then 1 else 0 end,
    'entry_kind', rec.entry_kind,
    'ledger', case when rec.entry_kind = 'nghiem_thu' then 'accepted' else 'executed' end,
    'project', rec.project_id,
    'measured_total', rec.quantity
  );
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.refresh_slip_progress() from public, anon, authenticated;
revoke all on function public.decide_measurement(uuid, text, text) from public, anon;
grant execute on function public.decide_measurement(uuid, text, text) to authenticated;
grant usage, select on sequence public.measurement_slip_seq to authenticated;

grant select on public.profiles, public.projects, public.project_members, public.tasks,
  public.boq_items, public.app_settings, public.measurements, public.diaries, public.project_progress
  to authenticated;
grant insert on public.projects, public.project_members, public.tasks, public.boq_items,
  public.measurements, public.diaries to authenticated;
grant update on public.projects, public.app_settings, public.diaries, public.profiles, public.project_members to authenticated;
grant delete on public.project_members to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.boq_items enable row level security;
alter table public.app_settings enable row level security;
alter table public.measurements enable row level security;
alter table public.diaries enable row level security;
alter table public.project_progress enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.project_members mine
      join public.project_members theirs on theirs.project_id = mine.project_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (public.is_project_member(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members
  for select to authenticated
  using (public.is_admin() or public.is_project_member(project_id));

drop policy if exists members_write on public.project_members;
create policy members_write on public.project_members
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists members_update on public.project_members;
create policy members_update on public.project_members
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members
  for delete to authenticated
  using (public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists tasks_write on public.tasks;
create policy tasks_write on public.tasks
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists boq_select on public.boq_items;
create policy boq_select on public.boq_items
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists boq_write on public.boq_items;
create policy boq_write on public.boq_items
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists settings_select on public.app_settings;
create policy settings_select on public.app_settings
  for select to authenticated
  using (true);

drop policy if exists settings_update on public.app_settings;
create policy settings_update on public.app_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists measurements_select on public.measurements;
create policy measurements_select on public.measurements
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists measurements_insert on public.measurements;
create policy measurements_insert on public.measurements
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_project_member(project_id));

drop policy if exists diaries_select on public.diaries;
create policy diaries_select on public.diaries
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists diaries_insert on public.diaries;
create policy diaries_insert on public.diaries
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_project_member(project_id));

drop policy if exists diaries_update on public.diaries;
create policy diaries_update on public.diaries
  for update to authenticated
  using (created_by = auth.uid() and public.is_project_member(project_id))
  with check (created_by = auth.uid() and public.is_project_member(project_id));

drop policy if exists "project_progress_select" on public.project_progress;
drop policy if exists project_progress_member_select on public.project_progress;
create policy project_progress_member_select on public.project_progress
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.projects p
      join public.project_members m on m.project_id = p.id
      where p.code = project_progress.project_id and m.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('site-photos', 'site-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists site_photos_read on storage.objects;
create policy site_photos_read on storage.objects
  for select to public
  using (bucket_id = 'site-photos');

drop policy if exists site_photos_insert on storage.objects;
create policy site_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'site-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

do $$
begin
  begin
    alter publication supabase_realtime add table public.project_progress;
  exception when duplicate_object then null;
  end;
end $$;
