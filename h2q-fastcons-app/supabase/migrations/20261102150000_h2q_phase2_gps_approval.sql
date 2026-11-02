-- Giai đoạn 3 (extend): align offline buffer with H2Q Phase-2 custom fields
-- GPS / approval / rate on Measurement Book path

alter table public.measurements_sync
  add column if not exists gps_lat double precision,
  add column if not exists gps_lng double precision,
  add column if not exists gps_accuracy double precision,
  add column if not exists approval_status text default 'Draft',
  add column if not exists auto_request_approval boolean not null default false,
  add column if not exists boq_over_limit boolean not null default false;

comment on column public.measurements_sync.gps_lat is 'H2Q custom_h2q_gps_lat';
comment on column public.measurements_sync.gps_lng is 'H2Q custom_h2q_gps_lng';
comment on column public.measurements_sync.gps_accuracy is 'H2Q custom_h2q_gps_accuracy meters';
comment on column public.measurements_sync.approval_status is 'H2Q custom_h2q_approval_status mirror';

-- Frappe → Supabase mirror uses service_role key (bypasses RLS). No new anon policy.
