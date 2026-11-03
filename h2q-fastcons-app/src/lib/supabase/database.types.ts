export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<T extends Record<string, unknown>> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  app_role: string;
  created_at: string;
};

export type ProjectRecord = {
  id: string;
  code: string;
  name: string;
  status: string;
  company: string | null;
  customer: string | null;
  expected_start_date: string | null;
  expected_end_date: string | null;
  geofence: Json | null;
  contract_role: string;
  created_at: string;
};

export type TaskRecord = {
  id: string;
  project_id: string;
  code: string;
  subject: string;
  parent_id: string | null;
  is_group: boolean;
  status: string;
};

export type BoqRecord = {
  id: string;
  project_id: string;
  task_id: string | null;
  code: string;
  description: string;
  unit: string | null;
  planned_qty: number;
  rate: number;
  boq_id: string | null;
  work_package_id: string | null;
};

export type AppSettingsRow = {
  id: number;
  enable_measurement_book: number;
  enable_site_diary: number;
  enable_client_ra_billing: number;
  enable_offline_sync: number;
  dashboard_progress_source: string;
  ui_profile: string;
  allow_mobile_revise_rejected: number;
  boq_over_limit_policy: string;
  auto_request_approval_default: number;
  gps_required: number;
  geofence_enforcement: string;
  min_photos_on_submit: number;
  min_photos_on_approve: number;
  sync_retry_max: number;
  pending_ttl_hours: number;
  telegram_enabled: number;
  approval_chain_length: number;
};

export type MeasurementRecord = {
  id: string;
  slip_code: string;
  project_id: string;
  task_id: string | null;
  boq_item_id: string | null;
  created_by: string;
  measurement_date: string;
  quantity: number;
  entry_kind: string;
  description: string | null;
  remarks: string | null;
  uom: string | null;
  rate: number | null;
  billed_amount: number | null;
  work_order: string | null;
  image_urls: string[];
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  geofence_outside: boolean;
  over_limit: boolean;
  approval_status: string;
  approval_level: number;
  certified: boolean;
  reject_reason: string | null;
  client_request_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DiaryRecord = {
  id: string;
  project_id: string;
  created_by: string;
  diary_date: string;
  weather: string | null;
  site_condition: string | null;
  safety_status: string | null;
  work_note: string | null;
  task_id: string | null;
  quantity: number | null;
  labour_count: number | null;
  equipment_note: string | null;
  image_urls: string[];
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  geofence_outside: boolean;
  client_request_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectProgressRow = {
  project_id: string;
  project_name: string | null;
  pending_count: number;
  synced_count: number;
  failed_count: number;
  last_quantity: number | null;
  last_task_id: string | null;
  last_measurement_book: string | null;
  updated_at: string;
};

export type MembershipRow = {
  project_id: string;
  user_id: string;
  member_role: string;
};

export type BoqHeaderRow = {
  id: string;
  project_id: string;
  code: string;
  title: string;
  revision: number;
  status: string;
  note: string | null;
  created_at: string;
};

export type WorkPackageRow = {
  id: string;
  project_id: string;
  code: string;
  name: string;
  budget: number;
  created_at: string;
};

export type SubcontractorRow = {
  id: string;
  name: string;
  tax_code: string | null;
  phone: string | null;
  created_at: string;
};

export type WorkOrderRow = {
  id: string;
  project_id: string;
  subcontractor_id: string;
  code: string;
  title: string;
  retention_percent: number;
  status: string;
  created_at: string;
};

export type WorkOrderLineRow = {
  id: string;
  work_order_id: string;
  boq_item_id: string | null;
  description: string;
  unit: string | null;
  qty: number;
  rate: number;
};

export type SupplierRow = {
  id: string;
  name: string;
  tax_code: string | null;
  phone: string | null;
  trade: string | null;
  created_at: string;
};

export type MaterialPriceRow = {
  id: string;
  supplier_id: string | null;
  name: string;
  unit: string | null;
  price: number;
  effective_on: string;
  created_at: string;
};

export type MaterialUseRow = {
  id: string;
  project_id: string;
  material_price_id: string;
  task_id: string | null;
  planned_qty: number;
  used_qty: number;
  created_at: string;
};

export type QuotationRow = {
  id: string;
  project_id: string;
  supplier_id: string | null;
  code: string;
  title: string;
  amount: number;
  status: string;
  score: number | null;
  review: string | null;
  created_at: string;
};

export type CrewRow = {
  id: string;
  name: string;
  leader: string | null;
  phone: string | null;
  created_at: string;
};

export type CrewJobRow = {
  id: string;
  project_id: string;
  crew_id: string;
  work_package_id: string | null;
  task_id: string | null;
  title: string;
  cost: number;
  status: string;
  created_at: string;
};

export type EquipmentRow = {
  id: string;
  project_id: string | null;
  code: string;
  name: string;
  kind: string | null;
  status: string;
  created_at: string;
};

export type WorkerRow = {
  id: string;
  crew_id: string | null;
  profile_id: string | null;
  full_name: string;
  role_title: string | null;
  phone: string | null;
  photo_url: string | null;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  project_id: string | null;
  task_id: string | null;
  worker_id: string | null;
  material_price_id: string | null;
  equipment_id: string | null;
  crew_job_id: string | null;
  created_by: string | null;
  kind: string;
  title: string;
  file_url: string;
  storage_key: string;
  note: string | null;
  taken_on: string | null;
  created_at: string;
};

export type StockLocationRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  note: string | null;
  created_at: string;
};

export type StockItemRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  unit: string;
  material_price_id: string | null;
  created_at: string;
};

export type StockMoveRow = {
  id: string;
  code: string;
  kind: string;
  location_id: string;
  to_location_id: string | null;
  supplier_id: string | null;
  project_id: string | null;
  task_id: string | null;
  receiver_worker_id: string | null;
  receiver_name: string | null;
  move_date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type StockMoveLineRow = {
  id: string;
  move_id: string;
  item_id: string;
  qty: number;
  unit_cost: number;
};

export type AttendanceRow = {
  id: string;
  project_id: string;
  task_id: string | null;
  crew_id: string | null;
  worker_id: string;
  work_date: string;
  status: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
};

export type ScopeChangeRow = {
  id: string;
  project_id: string;
  code: string;
  title: string;
  reason: string | null;
  amount: number;
  status: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      projects: Table<ProjectRecord>;
      project_members: Table<MembershipRow>;
      tasks: Table<TaskRecord>;
      boq_items: Table<BoqRecord>;
      app_settings: Table<AppSettingsRow>;
      measurements: Table<MeasurementRecord>;
      diaries: Table<DiaryRecord>;
      project_progress: Table<ProjectProgressRow>;
      boq_headers: Table<BoqHeaderRow>;
      work_packages: Table<WorkPackageRow>;
      subcontractors: Table<SubcontractorRow>;
      work_orders: Table<WorkOrderRow>;
      work_order_lines: Table<WorkOrderLineRow>;
      scope_changes: Table<ScopeChangeRow>;
      suppliers: Table<SupplierRow>;
      material_prices: Table<MaterialPriceRow>;
      material_uses: Table<MaterialUseRow>;
      quotations: Table<QuotationRow>;
      audit_log: Table<AuditLogRow>;
      crews: Table<CrewRow>;
      crew_jobs: Table<CrewJobRow>;
      equipment: Table<EquipmentRow>;
      workers: Table<WorkerRow>;
      documents: Table<DocumentRow>;
      attendance: Table<AttendanceRow>;
      stock_locations: Table<StockLocationRow>;
      stock_items: Table<StockItemRow>;
      stock_moves: Table<StockMoveRow>;
      stock_move_lines: Table<StockMoveLineRow>;
    };
    Views: Record<string, never>;
    Functions: {
      decide_measurement: {
        Args: { p_id: string; p_action: string; p_reason?: string | null };
        Returns: Json;
      };
      post_stock_move: {
        Args: { p_body: Json };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
