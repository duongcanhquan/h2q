-- Stock ledger. On-hand changes only through post_stock_move.

create sequence if not exists public.stock_move_seq;

create table if not exists public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null default 'kho' check (kind in ('kho', 'cong_truong')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null check (kind in ('vat_lieu', 'cong_cu')),
  unit text not null,
  material_price_id uuid references public.material_prices (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('nhap', 'xuat', 'chuyen')),
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  to_location_id uuid references public.stock_locations (id) on delete restrict,
  supplier_id uuid references public.suppliers (id) on delete restrict,
  project_id uuid references public.projects (id) on delete restrict,
  task_id uuid references public.tasks (id) on delete restrict,
  receiver_worker_id uuid references public.workers (id) on delete restrict,
  receiver_name text,
  move_date date not null default current_date,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_move_lines (
  id uuid primary key default gen_random_uuid(),
  move_id uuid not null references public.stock_moves (id) on delete cascade,
  item_id uuid not null references public.stock_items (id) on delete restrict,
  qty numeric not null check (qty > 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0)
);

grant select on public.stock_locations, public.stock_items, public.stock_moves, public.stock_move_lines to authenticated;
grant insert, update, delete on public.stock_locations, public.stock_items to authenticated;

alter table public.stock_locations enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_moves enable row level security;
alter table public.stock_move_lines enable row level security;

drop policy if exists locations_read on public.stock_locations;
create policy locations_read on public.stock_locations for select to authenticated using (true);
drop policy if exists locations_write on public.stock_locations;
create policy locations_write on public.stock_locations for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists items_read on public.stock_items;
create policy items_read on public.stock_items for select to authenticated using (true);
drop policy if exists items_write on public.stock_items;
create policy items_write on public.stock_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists moves_read on public.stock_moves;
create policy moves_read on public.stock_moves for select to authenticated using (true);
drop policy if exists move_lines_read on public.stock_move_lines;
create policy move_lines_read on public.stock_move_lines for select to authenticated using (true);

create or replace function public.post_stock_move(p_body jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_kind text;
  v_location uuid;
  v_to uuid;
  v_supplier uuid;
  v_project uuid;
  v_task uuid;
  v_worker uuid;
  v_receiver text;
  v_date date;
  v_note text;
  v_code text;
  v_lines jsonb;
  v_line jsonb;
  v_item uuid;
  v_qty numeric;
  v_cost numeric;
  v_on_hand numeric;
  v_value numeric;
  v_index int;
begin
  if auth.uid() is null then
    raise exception 'Cần đăng nhập.';
  end if;
  if not public.is_admin() then
    raise exception 'Chỉ admin mới ghi kho.';
  end if;

  v_kind := p_body->>'kind';
  if v_kind not in ('nhap', 'xuat', 'chuyen') then
    raise exception 'Loại phiếu không hợp lệ.';
  end if;

  v_location := nullif(p_body->>'location_id', '')::uuid;
  v_to := nullif(p_body->>'to_location_id', '')::uuid;
  v_supplier := nullif(p_body->>'supplier_id', '')::uuid;
  v_project := nullif(p_body->>'project_id', '')::uuid;
  v_task := nullif(p_body->>'task_id', '')::uuid;
  v_worker := nullif(p_body->>'receiver_worker_id', '')::uuid;
  v_receiver := nullif(btrim(coalesce(p_body->>'receiver_name', '')), '');
  v_date := coalesce(nullif(p_body->>'move_date', '')::date, current_date);
  v_note := nullif(btrim(coalesce(p_body->>'note', '')), '');
  v_lines := p_body->'lines';

  if v_location is null then
    raise exception 'Chọn địa điểm.';
  end if;
  if not exists (select 1 from public.stock_locations where id = v_location) then
    raise exception 'Không có địa điểm.';
  end if;
  if v_kind = 'nhap' and v_supplier is null then
    raise exception 'Phiếu nhập phải chọn nhà cung cấp.';
  end if;
  if v_kind <> 'nhap' then
    v_supplier := null;
  end if;
  if v_kind = 'xuat' then
    if v_project is null then
      raise exception 'Phiếu xuất phải chọn công trình nhận.';
    end if;
    if v_worker is null and v_receiver is null then
      raise exception 'Ghi rõ người nhận bàn giao.';
    end if;
    v_to := null;
  end if;
  if v_kind = 'chuyen' then
    if v_to is null or v_to = v_location then
      raise exception 'Chọn kho đích khác kho nguồn.';
    end if;
    if not exists (select 1 from public.stock_locations where id = v_to) then
      raise exception 'Không có kho đích.';
    end if;
    v_project := null;
    v_task := null;
    v_worker := null;
    v_receiver := null;
  else
    v_to := null;
  end if;
  if v_task is not null then
    if v_project is null or not exists (
      select 1 from public.tasks where id = v_task and project_id = v_project
    ) then
      raise exception 'Hạng mục không thuộc công trình.';
    end if;
  end if;
  if jsonb_typeof(v_lines) is distinct from 'array' or jsonb_array_length(v_lines) = 0 then
    raise exception 'Phiếu chưa có dòng hàng.';
  end if;

  perform pg_advisory_xact_lock(814201);

  v_code := case v_kind
    when 'nhap' then 'NK-'
    when 'xuat' then 'XK-'
    else 'CK-'
  end || lpad(nextval('public.stock_move_seq')::text, 5, '0');

  insert into public.stock_moves (
    code, kind, location_id, to_location_id, supplier_id, project_id, task_id,
    receiver_worker_id, receiver_name, move_date, note, created_by
  ) values (
    v_code, v_kind, v_location, v_to, v_supplier, v_project, v_task,
    v_worker, v_receiver, v_date, v_note, auth.uid()
  ) returning id into v_id;

  for v_index in 0 .. jsonb_array_length(v_lines) - 1 loop
    v_line := v_lines->v_index;
    v_item := nullif(v_line->>'item_id', '')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    v_cost := coalesce((v_line->>'unit_cost')::numeric, 0);
    if v_item is null or not exists (select 1 from public.stock_items where id = v_item) then
      raise exception 'Không có mặt hàng.';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Số lượng phải lớn hơn 0.';
    end if;
    if v_cost < 0 then
      raise exception 'Đơn giá không âm.';
    end if;

    if v_kind <> 'nhap' then
      select coalesce(sum(signed_qty), 0), coalesce(sum(signed_value), 0)
      into v_on_hand, v_value
      from (
        select l.qty as signed_qty, l.qty * l.unit_cost as signed_value
        from public.stock_move_lines l
        join public.stock_moves m on m.id = l.move_id
        where l.item_id = v_item and m.kind = 'nhap' and m.location_id = v_location
        union all
        select -l.qty, -l.qty * l.unit_cost
        from public.stock_move_lines l
        join public.stock_moves m on m.id = l.move_id
        where l.item_id = v_item and m.kind = 'xuat' and m.location_id = v_location
        union all
        select -l.qty, -l.qty * l.unit_cost
        from public.stock_move_lines l
        join public.stock_moves m on m.id = l.move_id
        where l.item_id = v_item and m.kind = 'chuyen' and m.location_id = v_location
        union all
        select l.qty, l.qty * l.unit_cost
        from public.stock_move_lines l
        join public.stock_moves m on m.id = l.move_id
        where l.item_id = v_item and m.kind = 'chuyen' and m.to_location_id = v_location
      ) balances;
      if v_on_hand < v_qty then
        raise exception 'Không đủ tồn để xuất hoặc chuyển.';
      end if;
      v_cost := case when v_on_hand > 0 then v_value / v_on_hand else 0 end;
    end if;

    insert into public.stock_move_lines (move_id, item_id, qty, unit_cost)
    values (v_id, v_item, v_qty, v_cost);
  end loop;

  return v_id;
end;
$$;

revoke all on function public.post_stock_move(jsonb) from public;
grant execute on function public.post_stock_move(jsonb) to authenticated;
