-- Contractor control: crews, package costs, equipment, workers, and daily files.

alter table public.projects
  add column if not exists contract_role text not null default 'tong_thau'
  check (contract_role in ('tong_thau', 'thau_van_hanh'));

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  crew_id uuid not null references public.crews (id) on delete cascade,
  title text not null,
  cost numeric not null default 0,
  status text not null default 'Open',
  created_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  code text not null unique,
  name text not null,
  kind text,
  status text not null default 'Sẵn sàng',
  created_at timestamptz not null default now()
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references public.crews (id) on delete set null,
  full_name text not null,
  role_title text,
  phone text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  kind text not null check (kind in ('vat_lieu', 'cong_nhan', 'cong_trinh', 'tien_do', 'hoa_don', 'tep')),
  title text not null,
  file_url text not null,
  storage_key text not null,
  note text,
  taken_on date not null default current_date,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.crews, public.crew_jobs, public.equipment, public.workers, public.documents to authenticated;

alter table public.crews enable row level security;
alter table public.crew_jobs enable row level security;
alter table public.equipment enable row level security;
alter table public.workers enable row level security;
alter table public.documents enable row level security;

drop policy if exists crews_read on public.crews;
create policy crews_read on public.crews for select to authenticated using (true);
drop policy if exists crews_write on public.crews;
create policy crews_write on public.crews for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists crew_jobs_read on public.crew_jobs;
create policy crew_jobs_read on public.crew_jobs for select to authenticated using (public.is_project_member(project_id));
drop policy if exists crew_jobs_write on public.crew_jobs;
create policy crew_jobs_write on public.crew_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists equipment_read on public.equipment;
create policy equipment_read on public.equipment for select to authenticated using (project_id is null or public.is_project_member(project_id));
drop policy if exists equipment_write on public.equipment;
create policy equipment_write on public.equipment for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists workers_read on public.workers;
create policy workers_read on public.workers for select to authenticated using (true);
drop policy if exists workers_write on public.workers;
create policy workers_write on public.workers for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select to authenticated
  using (project_id is null or public.is_project_member(project_id));
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
  for insert to authenticated
  with check (project_id is null or public.is_project_member(project_id));
