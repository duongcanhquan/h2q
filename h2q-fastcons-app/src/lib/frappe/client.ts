"use client";

import axios, { type AxiosError, type AxiosInstance } from "axios";
import { FrappeApiError, extractFrappeError } from "@/lib/frappe/errors";
import type {
  FrappeOk,
  ProjectRow,
  ProjectWbsData,
  SubmitMeasurementPayload,
  SubmitMeasurementResult,
} from "@/lib/frappe/types";

/**
 * Browser axios instance → Next.js BFF `/api/frappe/*`
 * which attaches the httpOnly Frappe `sid` cookie server-side.
 */
export const frappeClient: AxiosInstance = axios.create({
  baseURL: "/api/frappe",
  timeout: 60_000,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

frappeClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status ?? 0;
    if (status === 401 || status === 403) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?next=${next}`);
      }
    }
    const message = extractFrappeError(error.response?.data, error.message || "Network error");
    return Promise.reject(new FrappeApiError(message, status || 500, error.response?.data));
  },
);

function unwrapMethod<T>(raw: unknown): T {
  // Frappe: { message: <return> }
  // Our APIs return { message: "success", data: T }
  if (!raw || typeof raw !== "object") {
    throw new FrappeApiError("Empty response from Frappe");
  }
  const outer = raw as { message?: unknown };
  const inner = outer.message;
  if (inner && typeof inner === "object" && "data" in (inner as object)) {
    const body = inner as FrappeOk<T>;
    if (body.message === "error") {
      throw new FrappeApiError(extractFrappeError(body), 400, body);
    }
    return body.data as T;
  }
  return inner as T;
}

export async function login(usr: string, pwd: string) {
  const { data } = await axios.post(
    "/api/auth/login",
    { usr, pwd },
    { withCredentials: true },
  );
  return data as { user: string; full_name?: string };
}

export async function logout() {
  await axios.post("/api/auth/logout", null, { withCredentials: true });
}

export async function fetchSession() {
  const { data } = await axios.get("/api/auth/session", { withCredentials: true });
  return data as { authenticated: boolean; user?: string; full_name?: string };
}

export async function getActiveProjects(): Promise<{ projects: ProjectRow[]; count: number }> {
  const { data } = await frappeClient.post("/api/method/h2q_core.api.get_active_projects");
  return unwrapMethod(data);
}

export async function getProjectWbs(project: string): Promise<ProjectWbsData> {
  const body = new URLSearchParams({ project });
  const { data } = await frappeClient.post("/api/method/h2q_core.api.get_project_wbs", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return unwrapMethod(data);
}

export async function submitMeasurement(
  payload: SubmitMeasurementPayload,
): Promise<SubmitMeasurementResult> {
  const { data } = await frappeClient.post("/api/method/h2q_core.api.submit_measurement", {
    payload: JSON.stringify(payload),
  });
  return unwrapMethod(data);
}

/** Upload via Frappe File API → h2q_core R2 write_file hook returns remote file_url. */
export async function uploadSitePhoto(file: File): Promise<{ file_url: string; name?: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("is_private", "0");
  form.append("folder", "Home");

  const { data } = await frappeClient.post("/api/method/upload_file", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 180_000,
  });

  const msg = (data as { message?: Record<string, unknown> })?.message ?? data;
  const fileUrl =
    (msg as { file_url?: string })?.file_url ||
    (msg as { file_url?: string })?.["file_url"];
  if (!fileUrl || typeof fileUrl !== "string") {
    throw new FrappeApiError("Upload succeeded but file_url missing", 500, data);
  }
  return {
    file_url: fileUrl,
    name: (msg as { name?: string })?.name,
  };
}
