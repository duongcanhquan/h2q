-- Suppliers, material prices, material control, quotations, and an audit trail.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_code text,
  phone text,
  trade text,
  created_at timestamptz not null default now()
);

create table if not exists public.material_prices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers (id) on delete set null,
  name text not null,
  unit text,
  price numeric not null default 0,
  effective_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.material_uses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  material_price_id uuid not null references public.material_prices (id) on delete cascade,
  planned_qty numeric not null default 0,
  used_qty numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  code text not null,
  title text not null,
  amount numeric not null default 0,
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Accepted', 'Rejected')),
  score int check (score between 1 and 5),
  review text,
  created_at timestamptz not null default now(),
  unique (project_id, code)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.suppliers, public.material_prices, public.material_uses, public.quotations to authenticated;
grant select on public.audit_log to authenticated;

alter table public.suppliers enable row level security;
alter table public.material_prices enable row level security;
alter table public.material_uses enable row level security;
alter table public.quotations enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers for select to authenticated using (true);
drop policy if exists suppliers_write on public.suppliers;
create policy suppliers_write on public.suppliers for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists prices_read on public.material_prices;
create policy prices_read on public.material_prices for select to authenticated using (true);
drop policy if exists prices_write on public.material_prices;
create policy prices_write on public.material_prices for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists uses_read on public.material_uses;
create policy uses_read on public.material_uses for select to authenticated using (public.is_project_member(project_id));
drop policy if exists uses_write on public.material_uses;
create policy uses_write on public.material_uses for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists quotes_read on public.quotations;
create policy quotes_read on public.quotations for select to authenticated using (public.is_project_member(project_id));
drop policy if exists quotes_write on public.quotations;
create policy quotes_write on public.quotations for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());

create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id text;
begin
  row_id := coalesce(new.id, old.id)::text;
  insert into public.audit_log (actor_id, action, entity, entity_id, summary)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    row_id,
    tg_op || ' ' || tg_table_name || ' ' || row_id
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.write_audit() from public, anon, authenticated;

do $$
declare
  target text;
begin
  foreach target in array ARRAY[
    'projects', 'boq_headers', 'work_orders', 'scope_changes',
    'suppliers', 'material_prices', 'material_uses', 'quotations'
  ]
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', target);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.write_audit()',
      target
    );
  end loop;
end $$;
