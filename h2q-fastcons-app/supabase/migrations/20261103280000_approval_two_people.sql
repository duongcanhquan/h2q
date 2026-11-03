-- A later approval level cannot be the same account as the level just recorded.

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
    if chain > 1 and rec.approval_level > 0 and rec.approved_by = actor then
      raise exception 'Cấp trước do bạn duyệt. Cấp này cần một người khác.';
    end if;
    next_level := rec.approval_level + 1;
    final_step := next_level >= chain;
    if not final_step then
      update public.measurements
        set approval_level = next_level,
            approved_by = actor,
            approved_at = now()
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

revoke all on function public.decide_measurement(uuid, text, text) from public, anon;
grant execute on function public.decide_measurement(uuid, text, text) to authenticated;
