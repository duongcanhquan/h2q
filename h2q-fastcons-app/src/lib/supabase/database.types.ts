export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MeasurementSyncStatus = "pending" | "syncing" | "synced" | "failed";

export type MeasurementsSyncRow = {
  id: string;
  created_at: string;
  updated_at: string;
  work_order: string;
  project: string;
  measurement_date: string;
  measured_by: string | null;
  company: string | null;
  remarks: string | null;
  status: string;
  task: string;
  description: string;
  work_order_line: string | null;
  cost_code_type: string | null;
  cost_code_group: string | null;
  cost_code_item: string | null;
  cost_code_label: string | null;
  uom: string | null;
  nos: number | null;
  length: number | null;
  breadth: number | null;
  depth: number | null;
  quantity: number;
  is_deduction: boolean;
  rate: number | null;
  billed_amount: number | null;
  image_url: string | null;
  image_urls: string[];
  is_synced_to_frappe: boolean;
  boq_item: string | null;
  frappe_user: string | null;
  client_request_id: string | null;
  sync_status: MeasurementSyncStatus;
  frappe_measurement_book: string | null;
  last_error: string | null;
  synced_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  approval_status: string | null;
  auto_request_approval: boolean;
  boq_over_limit: boolean;
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

export type Database = {
  public: {
    Tables: {
      measurements_sync: {
        Row: MeasurementsSyncRow;
        Insert: Partial<MeasurementsSyncRow> & {
          work_order: string;
          project: string;
          task: string;
          description: string;
          quantity: number;
        };
        Update: Partial<MeasurementsSyncRow>;
        Relationships: [];
      };
      project_progress: {
        Row: ProjectProgressRow;
        Insert: Partial<ProjectProgressRow> & { project_id: string };
        Update: Partial<ProjectProgressRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
