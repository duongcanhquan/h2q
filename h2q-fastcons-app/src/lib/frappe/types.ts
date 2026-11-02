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
  task?: string | null;
  group_code?: string;
  cost_head?: string;
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

export type SubmitMeasurementPayload = {
  project: string;
  task: string;
  quantity: number;
  image_urls?: string[];
  work_order?: string;
  boq_item?: string;
  description?: string;
  date?: string;
  remarks?: string;
};

export type SubmitMeasurementResult = {
  measurement_book: string;
  status: string;
  project: string;
  work_order?: string;
  task: string;
  measured_total?: number;
  attached_files?: Array<{ name: string; file_url: string }>;
};

export type SessionUser = {
  user: string;
  full_name?: string;
};
