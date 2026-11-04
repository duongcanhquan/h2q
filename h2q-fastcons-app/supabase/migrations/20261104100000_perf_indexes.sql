-- Performance indexes for daily field activity filters and list screens.

-- Approvals queue filters by status first (status was trailing in old composite).
create index if not exists measurements_pending_created_idx
  on public.measurements (approval_status, created_at desc)
  where approval_status = 'Pending Approval';

-- Ledger / WBS progress by BOQ line.
create index if not exists measurements_boq_item_idx
  on public.measurements (boq_item_id)
  where boq_item_id is not null;

-- Date filter / reporting by project day.
create index if not exists measurements_project_date_idx
  on public.measurements (project_id, measurement_date desc);

-- Diary upsert key used by POST /api/diaries.
create index if not exists diaries_project_date_author_idx
  on public.diaries (project_id, diary_date, created_by);

-- Idempotent client retries.
create index if not exists measurements_client_request_idx
  on public.measurements (client_request_id)
  where client_request_id is not null;

create index if not exists diaries_client_request_idx
  on public.diaries (client_request_id)
  where client_request_id is not null;

-- Project list / member scoping.
create index if not exists project_members_user_idx
  on public.project_members (user_id, member_role);

-- Stock journal newest-first (UI only needs recent moves).
do $$
begin
  if to_regclass('public.stock_moves') is not null then
    execute 'create index if not exists stock_moves_date_idx on public.stock_moves (move_date desc, created_at desc)';
  end if;
end $$;
