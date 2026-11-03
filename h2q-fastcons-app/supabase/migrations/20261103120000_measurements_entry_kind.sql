-- P0: loại phiếu khối lượng trên buffer offline.
-- Giá trị: thuc_hien | nghiem_thu. Flush đọc cột này khi gọi submit_measurement.

alter table public.measurements_sync
  add column if not exists entry_kind text not null default 'thuc_hien';

comment on column public.measurements_sync.entry_kind is 'H2Q custom_h2q_entry_kind: thuc_hien | nghiem_thu';
