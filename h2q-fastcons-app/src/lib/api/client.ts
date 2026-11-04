"use client";

import { getJson, invalidateAfterMutation } from "@/lib/api/cache";
import { ApiError } from "@/lib/api/errors";
import type {
  H2qPublicSettings,
  MeasurementApprovalResult,
  PendingApprovalRow,
  ProjectRow,
  ProjectWbsData,
  SiteDiaryPayload,
  SiteDiaryResult,
} from "@/lib/domain/types";

async function apiSend<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  if (method === "GET") {
    let entry: { ok: boolean; status: number; body: unknown };
    try {
      entry = await getJson(path);
    } catch {
      throw new ApiError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", 0);
    }
    const data = (entry.body || {}) as { message?: string };
    if (entry.status === 401) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        const url = new URL("/login", window.location.origin);
        url.searchParams.set("next", window.location.pathname + window.location.search);
        window.location.href = url.href;
      }
      throw new ApiError(data.message || "Phiên đăng nhập đã hết.", 401);
    }
    if (!entry.ok) throw new ApiError(data.message || "Yêu cầu thất bại.", entry.status);
    return data as T;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new ApiError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", 0);
  }

  const data = (await response.json().catch(() => ({}))) as { message?: string };
  if (response.ok) invalidateAfterMutation(path);
  if (response.status === 401) {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      const url = new URL("/login", window.location.origin);
      url.searchParams.set("next", window.location.pathname + window.location.search);
      window.location.href = url.href;
    }
    throw new ApiError(data.message || "Phiên đăng nhập đã hết.", 401);
  }
  if (!response.ok) {
    throw new ApiError(data.message || "Yêu cầu thất bại.", response.status);
  }
  return data as T;
}

export async function login(usr: string, pwd: string) {
  return apiSend<{ user: string; full_name?: string }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usr, pwd }),
  });
}

export async function logout() {
  await apiSend("/api/auth/logout", { method: "POST" });
}

export async function getActiveProjects(): Promise<{ projects: ProjectRow[]; count: number }> {
  return apiSend("/api/projects");
}

export async function getH2qSettings(): Promise<H2qPublicSettings> {
  return apiSend("/api/settings");
}

export async function getProjectWbs(project: string): Promise<ProjectWbsData> {
  return apiSend(`/api/projects/${encodeURIComponent(project)}/wbs`);
}

export async function getPendingApprovals(): Promise<{ items: PendingApprovalRow[]; count: number; truncated?: boolean; viewer_can_approve?: boolean }> {
  return apiSend("/api/approvals");
}

export async function approveMeasurement(slipCode: string): Promise<MeasurementApprovalResult> {
  return apiSend(`/api/approvals/${encodeURIComponent(slipCode)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve" }),
  });
}

export async function rejectMeasurement(
  slipCode: string,
  reason?: string,
): Promise<MeasurementApprovalResult> {
  return apiSend(`/api/approvals/${encodeURIComponent(slipCode)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reject", reason }),
  });
}

export async function submitSiteDiary(payload: SiteDiaryPayload): Promise<SiteDiaryResult> {
  return apiSend("/api/diaries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadSitePhoto(file: File): Promise<{ file_url: string; name?: string }> {
  const { compressImageFile } = await import("@/lib/media/compress");
  const slim = await compressImageFile(file);
  const form = new FormData();
  form.append("file", slim, slim.name);
  return apiSend("/api/photos?folder=hien-truong", { method: "POST", body: form });
}

export async function submitMeasurement(payload: unknown) {
  return apiSend("/api/measurements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
