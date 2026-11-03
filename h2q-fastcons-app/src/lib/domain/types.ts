export type ProjectRow = {
  name: string;
  project_name: string;
  status?: string;
  percent_complete?: number;
  boq_progress_percent?: number | null;
  percent_complete_display?: number | null;
  progress_source?: string;
  expected_start_date?: string | null;
  expected_end_date?: string | null;
  company?: string | null;
  customer?: string | null;
  priority?: string | null;
};

export type BoqItemRow = {
  name: string;
  boq?: string;
  code?: string;
  description?: string;
  unit?: string;
  planned_qty?: number;
  actual_qty?: number;
  remaining_qty?: number;
  executed_qty?: number;
  executed_pending_qty?: number;
  accepted_qty?: number;
  accepted_pending_qty?: number;
  acceptance_room?: number | null;
  rate?: number;
  planned_amount?: number;
  actual_amount?: number;
  progress_percent?: number | null;
  over_limit?: number;
  task?: string | null;
  group_code?: string;
  group_name?: string;
  cost_head?: string;
  work_package?: string;
};

export type TaskRow = {
  name: string;
  code?: string;
  subject: string;
  parent_task?: string | null;
  status?: string;
  progress?: number;
  is_group?: number;
  boq_items?: BoqItemRow[];
};

export type ProjectWbsData = {
  project: string;
  project_name: string;
  tasks: TaskRow[];
  boqs: Array<Record<string, unknown>>;
  boq_items: BoqItemRow[];
  site_geofence?: { ring: Array<[number, number]> } | null;
};

export type H2qPublicSettings = {
  enable_measurement_book: number;
  enable_site_diary: number;
  enable_client_ra_billing: number;
  enable_offline_sync: number;
  dashboard_progress_source: string;
  ui_profile: string;
  allow_mobile_revise_rejected: number;
  boq_over_limit_policy: "Warn" | "Block" | "Warn Require Note" | string;
  auto_request_approval_default: number;
  gps_required: number;
  geofence_enforcement: string;
  min_photos_on_submit: number;
  min_photos_on_approve: number;
  sync_retry_max: number;
  pending_ttl_hours: number;
  telegram_enabled: number;
  approval_chain_length?: number;
};

export type SubmitMeasurementPayload = {
  project: string;
  task: string;
  quantity: number;
  image_urls?: string[];
  image_url?: string;
  work_order?: string;
  boq_item?: string;
  description?: string;
  date?: string;
  remarks?: string;
  uom?: string;
  rate?: number;
  billed_amount?: number;
  gps_lat?: number;
  gps_lng?: number;
  gps_accuracy?: number;
  auto_request_approval?: number | boolean;
  entry_kind?: "thuc_hien" | "nghiem_thu" | string;
  client_request_id?: string;
};

export type PendingApprovalRow = {
  name: string;
  project?: string;
  project_name?: string | null;
  work_order?: string;
  date?: string;
  status?: string;
  measured_total?: number;
  measured_by?: string;
  custom_h2q_approval_status?: string;
  custom_h2q_task?: string;
  custom_h2q_boq_item?: string;
  custom_h2q_boq_over_limit?: number;
  custom_h2q_submitted_by_user?: string;
  custom_h2q_entry_kind?: string;
  approval_level?: number;
  approval_levels?: number;
  next_roles?: string[];
  entry_kind?: string | null;
  custom_h2q_geofence_outside?: number;
  image_urls?: string[];
  modified?: string;
};

export type MeasurementApprovalResult = {
  measurement_book: string;
  status?: string;
  approval_status?: string;
  project?: string;
  measured_total?: number;
  approval_level?: number;
  approval_levels?: number;
  awaiting_next_level?: number;
  entry_kind?: string | null;
  certified?: number;
  ledger?: string;
};

export type SiteDiaryLine = {
  task?: string;
  quantity?: number;
  description?: string;
  labour_count?: number;
  equipment_note?: string;
};

export type SiteDiaryPayload = {
  project: string;
  date?: string;
  weather?: string;
  site_condition?: string;
  safety_status?: string;
  work_note?: string;
  gps_lat?: number;
  gps_lng?: number;
  gps_accuracy?: number;
  image_urls?: string[];
  lines: SiteDiaryLine[];
  client_request_id?: string;
};

export type SiteDiaryResult = {
  project: string;
  date: string;
  entries: string[];
  count: number;
  geofence_outside?: number;
  geofence_reason?: string;
};
