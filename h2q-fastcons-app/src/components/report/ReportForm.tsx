"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Send,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectGridSkeleton } from "@/components/projects/ProjectCardSkeleton";
import { PhotoCapture, type PhotoItem } from "@/components/report/PhotoCapture";
import { useProjectWbs } from "@/hooks/useProjectWbs";
import { useH2qSettings } from "@/hooks/useH2qSettings";
import { useGeolocation } from "@/hooks/useGeolocation";
import { enqueueMeasurement } from "@/lib/supabase/measurements";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { BoqItemRow } from "@/lib/frappe/types";

export function ReportForm({ projectId }: { projectId: string }) {
  const { tasks, projectName, loading, offline, error: wbsError } = useProjectWbs(projectId);
  const { settings } = useH2qSettings();
  const { fix, loading: gpsLoading, error: gpsError, capture } = useGeolocation();

  const [taskId, setTaskId] = useState("");
  const [boqItemId, setBoqItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [workOrder, setWorkOrder] = useState("");
  const [remarks, setRemarks] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedTask = useMemo(
    () => tasks.find((t) => t.name === taskId),
    [tasks, taskId],
  );

  const boqOptions: BoqItemRow[] = useMemo(
    () => selectedTask?.boq_items || [],
    [selectedTask],
  );

  const selectedBoq = useMemo(
    () => boqOptions.find((b) => b.name === boqItemId) || boqOptions[0],
    [boqOptions, boqItemId],
  );

  const overWarn = useMemo(() => {
    const qty = Number(quantity);
    if (!selectedBoq || !Number.isFinite(qty) || qty === 0) return "";
    const remaining = Number(selectedBoq.remaining_qty ?? 0);
    const planned = Number(selectedBoq.planned_qty ?? 0);
    if (planned > 0 && qty > remaining) {
      return `Vượt định mức: còn lại ${remaining} ${selectedBoq.unit || ""} / kế hoạch ${planned}. Policy: ${settings.boq_over_limit_policy}`;
    }
    return "";
  }, [quantity, selectedBoq, settings.boq_over_limit_policy]);

  useEffect(() => {
    const t = window.setTimeout(() => capture(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSelectTask(next: string) {
    setTaskId(next);
    const first = tasks.find((t) => t.name === next)?.boq_items?.[0];
    setBoqItemId(first?.name || "");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!settings.enable_measurement_book) {
      setError("Measurement Book đang tắt trong H2Q Settings.");
      return;
    }

    const qty = Number(quantity);
    if (!taskId) {
      setError("Vui lòng chọn Hạng mục (WBS / Task).");
      return;
    }
    if (!Number.isFinite(qty) || qty === 0) {
      setError("Nhập khối lượng hoàn thành (số khác 0).");
      return;
    }
    if (settings.gps_required && (!fix?.lat || !fix?.lng)) {
      setError("GPS bắt buộc (H2Q Settings). Bấm «Lấy GPS».");
      return;
    }
    if (photos.some((p) => p.uploading)) {
      setError("Đang upload ảnh lên R2 — vui lòng đợi xong.");
      return;
    }
    if (photos.some((p) => p.error)) {
      setError("Có ảnh upload lỗi. Xóa hoặc chọn lại ảnh.");
      return;
    }
    const imageUrls = photos
      .map((p) => p.remoteUrl)
      .filter((url): url is string => Boolean(url));
    if (settings.min_photos_on_submit > 0 && imageUrls.length < settings.min_photos_on_submit) {
      setError(`Cần tối thiểu ${settings.min_photos_on_submit} ảnh (H2Q Settings).`);
      return;
    }

    if (overWarn && settings.boq_over_limit_policy === "Block") {
      setError("Vượt BOQ — bị chặn bởi H2Q Settings (Block).");
      return;
    }
    if (
      overWarn &&
      settings.boq_over_limit_policy === "Warn Require Note" &&
      !remarks.trim()
    ) {
      setError("Vượt BOQ — bắt buộc ghi chú (Warn Require Note).");
      return;
    }

    const rate = Number(selectedBoq?.rate || 0) || undefined;
    const billed = rate ? rate * qty : undefined;

    setSubmitting(true);
    try {
      const queued = await enqueueMeasurement({
        project: projectId,
        task: taskId,
        quantity: qty,
        image_urls: imageUrls,
        description: selectedBoq?.description || selectedTask?.subject || taskId,
        remarks,
        boq_item: selectedBoq?.name,
        project_name: projectName,
        date: new Date().toISOString().slice(0, 10),
        uom: selectedBoq?.unit,
        work_order: workOrder || undefined,
        rate,
        billed_amount: billed,
        gps_lat: fix?.lat,
        gps_lng: fix?.lng,
        gps_accuracy: fix?.accuracy,
        auto_request_approval: settings.auto_request_approval_default ? 1 : 0,
      });

      if (queued.mode === "indexeddb") {
        const hasSb = Boolean(getSupabaseBrowserClient());
        setSuccess(
          hasSb
            ? "Mạng/Supabase tạm lỗi — đã lưu trên máy. Sẽ sync lại khi online."
            : "Chưa cấu hình Supabase — đã lưu offline trên thiết bị (IndexedDB).",
        );
      } else {
        setSuccess(
          `Đã ghi vào buffer offline` +
            (queued.sync_id ? ` (#${queued.sync_id.slice(0, 8)})` : "") +
            `. Worker đẩy Frappe…` +
            (settings.auto_request_approval_default ? " (tự gửi duyệt)" : ""),
        );
      }

      setTaskId("");
      setBoqItemId("");
      setQuantity("");
      setRemarks("");
      setWorkOrder("");
      setPhotos((prev) => {
        prev.forEach((p) => {
          if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
        });
        return [];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi báo cáo thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Đang tải hạng mục WBS…</p>
        <ProjectGridSkeleton count={2} />
      </div>
    );
  }

  const fieldGloves = settings.ui_profile !== "Office";
  const inputClass = fieldGloves
    ? "min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-lg font-semibold text-slate-900 outline-none ring-amber-500 focus:border-amber-500 focus:ring-2"
    : "min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-500 focus:ring-2";

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-10">
      <Card>
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            Nghiệm thu khối lượng
          </p>
          <CardTitle className="text-2xl text-slate-900">{projectName}</CardTitle>
          <CardDescription>{projectId}</CardDescription>
          {offline ? (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
              <WifiOff className="size-3.5" />
              WBS từ cache offline
            </p>
          ) : null}
        </CardHeader>
      </Card>

      {wbsError ? <ErrorBanner message={wbsError} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {success ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>{success}</p>
        </div>
      ) : null}
      {overWarn ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p>{overWarn}</p>
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-5 pt-4">
          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">1. Hạng mục WBS</span>
            <select
              className={inputClass}
              value={taskId}
              onChange={(e) => onSelectTask(e.target.value)}
              required
            >
              <option value="">— Chọn hạng mục —</option>
              {tasks.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.subject}
                </option>
              ))}
            </select>
          </label>

          {boqOptions.length > 1 ? (
            <label className="block space-y-2">
              <span className="text-base font-bold text-slate-800">Dòng BOQ / định mức</span>
              <select
                className={inputClass}
                value={boqItemId}
                onChange={(e) => setBoqItemId(e.target.value)}
              >
                {boqOptions.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.code} — {b.description}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedBoq ? (
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              <p className="font-bold text-slate-900">Định mức tự điền</p>
              <p className="mt-1">
                {selectedBoq.code} · ĐVT {selectedBoq.unit || "—"} · KH{" "}
                {selectedBoq.planned_qty ?? "—"} · Còn{" "}
                {selectedBoq.remaining_qty ?? "—"}
                {selectedBoq.rate != null ? ` · ĐG ${selectedBoq.rate}` : ""}
              </p>
            </div>
          ) : null}

          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">
              2. Khối lượng
              {selectedBoq?.unit ? (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({selectedBoq.unit})
                </span>
              ) : null}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              className={inputClass}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">
              Work Order (tuỳ chọn — Frappe tự resolve nếu chỉ 1 WO)
            </span>
            <input
              className={inputClass}
              value={workOrder}
              onChange={(e) => setWorkOrder(e.target.value)}
              placeholder="SWO-… (để trống nếu site tự chọn)"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">Ghi chú</span>
            <textarea
              className={`${inputClass} min-h-28 py-3 font-normal`}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Vị trí, điều kiện hiện trường…"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-bold text-slate-800">3. GPS hiện trường</p>
            <button
              type="button"
              onClick={() => capture()}
              disabled={gpsLoading}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {gpsLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MapPin className="size-4" />
              )}
              Lấy GPS
            </button>
          </div>
          {fix ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)} (±{Math.round(fix.accuracy)}m)
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              {settings.gps_required ? "Bắt buộc trước khi gửi." : "Khuyến nghị gắn vị trí."}
            </p>
          )}
          {gpsError ? <p className="text-sm text-red-600">{gpsError}</p> : null}
        </CardContent>
      </Card>

      <PhotoCapture value={photos} onChange={setPhotos} />

      <button
        type="submit"
        disabled={submitting}
        className="flex min-h-18 w-full items-center justify-center gap-3 rounded-2xl bg-amber-500 px-4 text-xl font-black text-slate-950 shadow-lg shadow-amber-500/30 disabled:opacity-60 active:scale-[0.99]"
      >
        {submitting ? <Loader2 className="size-7 animate-spin" /> : <Send className="size-7" />}
        {submitting ? "Đang lưu…" : "GỬI BÁO CÁO"}
      </button>

      <p className="text-center text-xs text-slate-500">
        Offline: IndexedDB → Supabase `measurements_sync` → Frappe `submit_measurement`
        {settings.auto_request_approval_default ? " → tự Pending Approval" : ""}
      </p>
    </form>
  );
}
