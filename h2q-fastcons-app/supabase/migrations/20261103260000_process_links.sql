-- Link crew handover, materials, people, and daily evidence to the same project and task.

alter table public.crew_jobs add column if not exists work_package_id uuid references public.work_packages (id) on delete set null;
alter table public.crew_jobs add column if not exists task_id uuid references public.tasks (id) on delete set null;

alter table public.workers add column if not exists profile_id uuid references public.profiles (id) on delete set null;
create unique index if not exists workers_profile_id_key on public.workers (profile_id) where profile_id is not null;

alter table public.material_uses add column if not exists task_id uuid references public.tasks (id) on delete set null;

alter table public.documents add column if not exists worker_id uuid references public.workers (id) on delete set null;
alter table public.documents add column if not exists material_price_id uuid references public.material_prices (id) on delete set null;
alter table public.documents add column if not exists equipment_id uuid references public.equipment (id) on delete set null;
alter table public.documents add column if not exists crew_job_id uuid references public.crew_jobs (id) on delete set null;
alter table public.documents add column if not exists created_by uuid references auth.users (id) on delete set null;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  crew_id uuid references public.crews (id) on delete set null,
  worker_id uuid not null references public.workers (id) on delete cascade,
  work_date date not null default current_date,
  status text not null default 'Có mặt' check (status in ('Có mặt', 'Vắng', 'Nửa ngày')),
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (worker_id, project_id, work_date)
);

grant select, insert, update, delete on public.attendance to authenticated;
alter table public.attendance enable row level security;

drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance
  for select to authenticated using (public.is_project_member(project_id));
drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert to authenticated with check (public.is_project_member(project_id));
drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update to authenticated using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
