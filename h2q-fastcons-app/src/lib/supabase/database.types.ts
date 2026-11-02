export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MeasurementSyncStatus = "pending" | "syncing" | "synced" | "failed";

export type MeasurementsSyncRow = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  task_id: string;
  quantity: number;
  image_urls: string[];
  work_order: string | null;
  boq_item: string | null;
  description: string | null;
  remarks: string | null;
  report_date: string | null;
  frappe_user: string | null;
  client_request_id: string | null;
  status: MeasurementSyncStatus;
  frappe_measurement_book: string | null;
  last_error: string | null;
  synced_at: string | null;
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
          project_id: string;
          task_id: string;
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
