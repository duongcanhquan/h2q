export type FrappeOk<T> = {
  message: "success" | string;
  data?: T;
  [key: string]: unknown;
};

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
};

export type BoqItemDefaults = {
  name: string;
  boq?: string;
  code?: string;
  description?: string;
  unit?: string;
  planned_qty?: number;
  actual_qty?: number;
  remaining_qty?: number;
  rate?: number;
  planned_amount?: number;
  task?: string | null;
  work_package?: string | null;
  over_limit?: number;
};

export type SubmitMeasurementPayload = {
  project: string;
  task: string;
  quantity: number;
  image_urls?: string[];
  image_url?: string;
  work_order?: string;
  work_order_line?: string;
  boq_item?: string;
  description?: string;
  date?: string;
  remarks?: string;
  uom?: string;
  nos?: number;
  length?: number;
  breadth?: number;
  depth?: number;
  is_deduction?: boolean;
  rate?: number;
  billed_amount?: number;
  gps_lat?: number;
  gps_lng?: number;
  gps_accuracy?: number;
  auto_request_approval?: number | boolean;
};

export type SubmitMeasurementResult = {
  measurement_book: string;
  status: string;
  approval_status?: string;
  project: string;
  work_order?: string;
  task: string;
  measured_total?: number;
  boq_over_limit_warn?: number;
  attached_files?: Array<{ name: string; file_url: string }>;
};

export type SessionUser = {
  user: string;
  full_name?: string;
};
