"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { getProjectWbs } from "@/lib/frappe/client";
import { cacheProjectWbs, readCachedProjectWbs } from "@/lib/offline/wbs-cache";
import type { TaskRow } from "@/lib/frappe/types";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Spinner } from "@/components/ui/Spinner";
import { PhotoCapture, type PhotoItem } from "@/components/report/PhotoCapture";
import { FrappeApiError } from "@/lib/frappe/errors";
import {
  drainLocalMeasurementQueue,
  enqueueMeasurement,
} from "@/lib/supabase/measurements";

export function ReportForm({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projectName, setProjectName] = useState(projectId);
  const [taskId, setTaskId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loadingWbs, setLoadingWbs] = useState(true);
  const [offline, setOffline] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingWbs(true);
      setError("");
      setOffline(false);
      try {
        const data = await getProjectWbs(projectId);
        if (cancelled) return;
        cacheProjectWbs(projectId, data);
        setProjectName(data.project_name || projectId);
        setTasks((data.tasks || []).filter((t) => !t.is_group));
        void drainLocalMeasurementQueue();
      } catch (err) {
        const cached = readCachedProjectWbs(projectId);
        if (cached) {
          if (cancelled) return;
          setOffline(true);
          setProjectName(cached.project_name || projectId);
          setTasks((cached.tasks || []).filter((t) => !t.is_group));
        } else {
          setError(
            err instanceof FrappeApiError || err instanceof Error
              ? err.message
              : "Không tải được WBS",
          );
        }
      } finally {
        if (!cancelled) setLoadingWbs(false);
      }
    }
    void load();

    const onOnline = () => {
      void drainLocalMeasurementQueue();
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [projectId]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.name === taskId),
    [tasks, taskId],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const qty = Number(quantity);
    if (!taskId) {
      setError("Chọn hạng mục WBS / Task");
      return;
    }
    if (!Number.isFinite(qty) || qty === 0) {
      setError("Nhập khối lượng hoàn thành (khác 0)");
      return;
    }
    if (photos.some((p) => p.uploading)) {
      setError("Đang upload ảnh — vui lòng đợi");
      return;
    }
    if (photos.some((p) => p.error)) {
      setError("Có ảnh upload lỗi — xóa hoặc thử lại");
      return;
    }

    const imageUrls = photos.map((p) => p.remoteUrl).filter(Boolean) as string[];
    setSubmitting(true);
    try {
      // Offline-first: Supabase measurements_sync (+ IndexedDB fallback) → flush → Frappe
      const queued = await enqueueMeasurement({
        project: projectId,
        task: taskId,
        quantity: qty,
        image_urls: imageUrls,
        description: selectedTask?.subject,
        remarks,
        boq_item: selectedTask?.boq_items?.[0]?.name,
        project_name: projectName,
      });

      if (queued.mode === "indexeddb") {
        setSuccess(
          "Đã lưu offline trên thiết bị. Sẽ đồng bộ Supabase → Frappe khi có mạng.",
        );
      } else {
        setSuccess(
          `Đã ghi vào hàng đợi Supabase (${queued.sync_id || queued.client_request_id}). Đang đẩy sang Frappe…`,
        );
      }
      setQuantity("");
      setRemarks("");
      setPhotos([]);
    } catch (err) {
      setError(
        err instanceof FrappeApiError || err instanceof Error
          ? err.message
          : "Gửi báo cáo thất bại",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingWbs) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-slate-600">
        <Spinner />
        Đang tải hạng mục WBS…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Dự án</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{projectName}</h2>
        <p className="text-sm text-slate-500">{projectId}</p>
        {offline ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            <WifiOff className="size-3.5" /> Đang dùng cache offline
          </p>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {success ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>{success}</p>
        </div>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Hạng mục (WBS / Task)</span>
        <select
          className="min-h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          required
        >
          <option value="">— Chọn hạng mục —</option>
          {tasks.map((t) => (
            <option key={t.name} value={t.name}>
              {t.subject} ({t.name})
            </option>
          ))}
        </select>
      </label>

      {selectedTask?.boq_items?.length ? (
        <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
          BOQ: {selectedTask.boq_items[0]?.code} — {selectedTask.boq_items[0]?.description}
          {selectedTask.boq_items[0]?.unit ? ` (${selectedTask.boq_items[0]?.unit})` : ""}
        </p>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Khối lượng hoàn thành</span>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          className="min-h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="VD: 12.5"
          required
        />
      </label>

      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Ảnh / bản vẽ nghiệm thu</span>
        <PhotoCapture value={photos} onChange={setPhotos} />
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Ghi chú</span>
        <textarea
          className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Vị trí, điều kiện thi công…"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-base font-bold text-slate-950 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="size-5 animate-spin" /> : null}
        {submitting ? "Đang gửi…" : "Gửi nghiệm thu"}
      </button>
    </form>
  );
}
