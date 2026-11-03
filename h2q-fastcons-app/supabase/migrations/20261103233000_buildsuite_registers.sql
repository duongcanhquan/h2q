-- BuildSuite registers used by the office desk: BOQ revision, work package,
-- subcontractor work order, and scope change. Field slips stay in measurements.

create table if not exists public.boq_headers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  code text not null,
  title text not null,
  revision int not null default 0,
  status text not null default 'Draft'
    check (status in ('Draft', 'Submitted', 'Approved', 'Superseded')),
  note text,
  created_at timestamptz not null default now(),
  unique (project_id, code, revision)
);

create table if not exists public.work_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  code text not null,
  name text not null,
  budget numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, code)
);

alter table public.boq_items add column if not exists boq_id uuid references public.boq_headers (id) on delete set null;
alter table public.boq_items add column if not exists work_package_id uuid references public.work_packages (id) on delete set null;

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_code text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors (id) on delete restrict,
  code text not null,
  title text not null,
  retention_percent numeric not null default 0,
  status text not null default 'Draft' check (status in ('Draft', 'Active', 'Closed')),
  created_at timestamptz not null default now(),
  unique (project_id, code)
);

create table if not exists public.work_order_lines (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  boq_item_id uuid references public.boq_items (id) on delete set null,
  description text not null,
  unit text,
  qty numeric not null default 0,
  rate numeric not null default 0
);

create table if not exists public.scope_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  code text not null,
  title text not null,
  reason text,
  amount numeric not null default 0,
  status text not null default 'Draft'
    check (status in ('Draft', 'Submitted', 'Approved', 'Rejected')),
  created_at timestamptz not null default now(),
  unique (project_id, code)
);

grant select, insert, update, delete on public.boq_headers, public.work_packages, public.subcontractors,
  public.work_orders, public.work_order_lines, public.scope_changes to authenticated;

alter table public.boq_headers enable row level security;
alter table public.work_packages enable row level security;
alter table public.subcontractors enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_lines enable row level security;
alter table public.scope_changes enable row level security;

drop policy if exists boq_headers_select on public.boq_headers;
create policy boq_headers_select on public.boq_headers
  for select to authenticated using (public.is_project_member(project_id));
drop policy if exists boq_headers_write on public.boq_headers;
create policy boq_headers_write on public.boq_headers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists packages_select on public.work_packages;
create policy packages_select on public.work_packages
  for select to authenticated using (public.is_project_member(project_id));
drop policy if exists packages_write on public.work_packages;
create policy packages_write on public.work_packages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists subs_select on public.subcontractors;
create policy subs_select on public.subcontractors for select to authenticated using (true);
drop policy if exists subs_write on public.subcontractors;
create policy subs_write on public.subcontractors
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_select on public.work_orders;
create policy orders_select on public.work_orders
  for select to authenticated using (public.is_project_member(project_id));
drop policy if exists orders_write on public.work_orders;
create policy orders_write on public.work_orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_lines_select on public.work_order_lines;
create policy order_lines_select on public.work_order_lines
  for select to authenticated using (
    exists (
      select 1 from public.work_orders o
      where o.id = work_order_lines.work_order_id and public.is_project_member(o.project_id)
    )
  );
drop policy if exists order_lines_write on public.work_order_lines;
create policy order_lines_write on public.work_order_lines
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists changes_select on public.scope_changes;
create policy changes_select on public.scope_changes
  for select to authenticated using (public.is_project_member(project_id));
drop policy if exists changes_write on public.scope_changes;
create policy changes_write on public.scope_changes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
