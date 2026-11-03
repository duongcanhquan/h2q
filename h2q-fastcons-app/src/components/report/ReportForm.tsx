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
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectGridSkeleton } from "@/components/projects/ProjectCardSkeleton";
import { PhotoCapture, type PhotoItem } from "@/components/report/PhotoCapture";
import { useProjectWbs } from "@/hooks/useProjectWbs";
import { useH2qSettings } from "@/hooks/useH2qSettings";
import { useGeolocation } from "@/hooks/useGeolocation";
import { enqueueMeasurement } from "@/lib/supabase/measurements";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { evaluateGeofence } from "@/lib/geo/geofence";
import { fmtQty, previewQuantitySlip } from "@/lib/quantity/slip";
import type { BoqItemRow } from "@/lib/domain/types";
import Link from "next/link";

export function ReportForm({ projectId }: { projectId: string }) {
  const { tasks, projectName, geofence, loading, offline, error: wbsError } = useProjectWbs(projectId);
  const { settings, loading: settingsLoading, error: settingsError } = useH2qSettings();
  const { fix, loading: gpsLoading, error: gpsError, capture } = useGeolocation();

  const [taskId, setTaskId] = useState("");
  const [boqItemId, setBoqItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [workOrder, setWorkOrder] = useState("");
  const [remarks, setRemarks] = useState("");
  const [entryKind, setEntryKind] = useState<"thuc_hien" | "nghiem_thu">("thuc_hien");
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

  const slip = useMemo(() => {
    const qty = Number(quantity);
    if (!selectedBoq || !Number.isFinite(qty) || qty === 0) return null;
    return previewQuantitySlip({
      kind: entryKind,
      qty,
      contract: Number(selectedBoq.planned_qty ?? 0),
      executed: Number(selectedBoq.executed_qty ?? 0),
      accepted: Number(selectedBoq.accepted_qty ?? 0),
      pendingExecuted: Number(selectedBoq.executed_pending_qty ?? 0),
      policy: settings.boq_over_limit_policy,
      hasNote: Boolean(remarks.trim()),
    });
  }, [quantity, selectedBoq, entryKind, settings.boq_over_limit_policy, remarks]);

  const fence = useMemo(
    () => evaluateGeofence(settings.geofence_enforcement, fix?.lat, fix?.lng, geofence),
    [settings.geofence_enforcement, fix?.lat, fix?.lng, geofence],
  );

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

    if (!settingsLoading && !settingsError && !settings.enable_measurement_book) {
      setError("Sổ khối lượng đang tắt. Nhờ văn phòng bật Measurement Book trong H2Q Settings.");
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
      setError("Đang tải ảnh lên — vui lòng đợi xong.");
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

    if (slip?.action === "block") {
      setError(slip.message);
      return;
    }
    if (fence.action === "block") {
      setError(`${fence.message} Không gửi được.`);
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
        remarks: [`H2Q_ENTRY_KIND:${entryKind}`, remarks.trim()].filter(Boolean).join("\n"),
        entry_kind: entryKind,
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

      const kindLabel = entryKind === "nghiem_thu" ? "nghiệm thu" : "sản lượng";
      if (queued.mode === "indexeddb") {
        const hasSb = Boolean(getSupabaseBrowserClient());
        setSuccess(
          hasSb
            ? `Mất mạng. Phiếu ${kindLabel} nằm trên máy, sẽ gửi khi có mạng.`
            : `Chưa nối máy đồng bộ. Phiếu ${kindLabel} nằm trên máy.`,
        );
      } else {
        setSuccess(
          settings.auto_request_approval_default
            ? `Đã ghi phiếu ${kindLabel} vào sổ. Phiếu đang chờ duyệt.`
            : `Đã ghi phiếu ${kindLabel} vào sổ.`,
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

  const bookOff = !settingsLoading && !settingsError && !settings.enable_measurement_book;
  const fenceBlock = fence.action === "block" ? `${fence.message} Không gửi được.` : "";
  const fieldGloves = settings.ui_profile !== "Office";
  const inputClass = fieldGloves
    ? "min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-lg font-semibold text-slate-900 outline-none ring-amber-500 focus:border-amber-500 focus:ring-2"
    : "min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-500 focus:ring-2";

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4 pb-10">
      <Card>
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            {entryKind === "nghiem_thu" ? "Nghiệm thu khối lượng" : "Báo sản lượng"}
          </p>
          <CardTitle className="text-2xl text-slate-900">{projectName}</CardTitle>
          <CardDescription>{projectId}</CardDescription>
          <Link
            href={`/project/${encodeURIComponent(projectId)}/diary`}
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-amber-800"
          >
            Nhật ký thi công hôm nay
          </Link>
          {offline ? (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
              <WifiOff className="size-3.5" />
              WBS từ cache offline
            </p>
          ) : null}
        </CardHeader>
      </Card>

      {bookOff ? (
        <ErrorBanner message="Sổ khối lượng đang tắt. Nhờ văn phòng bật Measurement Book, lưu, rồi gửi lại." />
      ) : null}
      {wbsError ? <ErrorBanner message={wbsError} /> : null}
      {error && error !== slip?.message && error !== fenceBlock ? (
        <ErrorBanner message={error} />
      ) : null}
      {success ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>{success}</p>
        </div>
      ) : null}
      {slip && slip.action !== "ok" ? (
        slip.action === "block" ? (
          <ErrorBanner message={slip.message} />
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <p>{slip.message}</p>
          </div>
        )
      ) : null}
      {fence.action === "block" ? (
        <ErrorBanner message={`${fence.message} Không gửi được.`} />
      ) : null}
      {fence.action === "warn" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <MapPin className="mt-0.5 size-5 shrink-0" />
          <p>{fence.message} Vẫn gửi được. Phiếu sẽ gắn cờ ngoài vùng.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setEntryKind("thuc_hien")}
          className={`min-h-14 rounded-2xl text-base font-bold ${
            entryKind === "thuc_hien"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          Thực hiện
        </button>
        <button
          type="button"
          onClick={() => setEntryKind("nghiem_thu")}
          className={`min-h-14 rounded-2xl text-base font-bold ${
            entryKind === "nghiem_thu"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          Nghiệm thu
        </button>
      </div>
      <p className="text-sm text-slate-600">
        {entryKind === "thuc_hien"
          ? "Ghi phần đã làm. Sau khi duyệt, số vào cột Thực hiện và không được chứng nhận để thanh toán."
          : "Nhận phần đã làm. Sau khi duyệt đủ cấp, số vào cột Nghiệm thu và phiếu được chứng nhận."}
      </p>

      {tasks.length === 0 ? (
        <EmptyState
          title="Chưa có hạng mục"
          description="Công trình chưa có task để báo khối lượng. Nhờ văn phòng gắn hạng mục vào WBS."
        />
      ) : (
      <>
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
            <QuantityBoard item={selectedBoq} kind={entryKind} />
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
            {Number(quantity) < 0 ? (
              <span className="block text-sm font-normal text-slate-500">
                Số âm là điều chỉnh giảm trên cột đang chọn.
              </span>
            ) : null}
          </label>

          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">Lệnh thi công</span>
            <input
              className={inputClass}
              value={workOrder}
              onChange={(e) => setWorkOrder(e.target.value)}
              placeholder="Để trống nếu công trình chỉ có một lệnh"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">
              Ghi chú
              {slip?.over && settings.boq_over_limit_policy === "Warn Require Note" ? (
                <span className="ml-2 text-sm font-semibold text-red-700">bắt buộc vì vượt mức</span>
              ) : null}
            </span>
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

      {settings.min_photos_on_submit > 0 ? (
        <p className="text-sm text-slate-600">
          Cần ít nhất {settings.min_photos_on_submit} ảnh đã lưu trước khi gửi.
        </p>
      ) : null}
      <PhotoCapture value={photos} onChange={setPhotos} emptyLabel="Chưa có ảnh phiếu" />

      <button
        type="submit"
        disabled={submitting || bookOff}
        className="flex min-h-18 w-full items-center justify-center gap-3 rounded-2xl bg-amber-500 px-4 text-xl font-black text-slate-950 shadow-lg shadow-amber-500/30 disabled:opacity-60 active:scale-[0.99]"
      >
        {submitting ? <Loader2 className="size-7 animate-spin" /> : <Send className="size-7" />}
        {submitting
          ? "Đang lưu…"
          : entryKind === "nghiem_thu"
            ? "Gửi nghiệm thu"
            : "Gửi sản lượng"}
      </button>

      <p className="text-center text-xs text-slate-500">
        Phiếu lưu trên máy trước, rồi chuyển lên sổ.
        {settings.auto_request_approval_default ? " Sau đó phiếu vào hàng chờ duyệt." : ""}
      </p>
      </>
      )}
    </form>
  );
}

function QuantityBoard({
  item,
  kind,
}: {
  item: BoqItemRow;
  kind: "thuc_hien" | "nghiem_thu";
}) {
  const unit = item.unit ? ` ${item.unit}` : "";
  const pendingExecuted = Number(item.executed_pending_qty || 0);
  const pendingAccepted = Number(item.accepted_pending_qty || 0);
  const contract = Number(item.planned_qty || 0);
  const executionRoom =
    contract > 0
      ? contract - Number(item.executed_qty || 0) - pendingExecuted
      : null;
  const fourth =
    kind === "thuc_hien"
      ? { label: "Còn được ghi", value: executionRoom }
      : { label: "Còn nghiệm thu", value: item.acceptance_room ?? null };
  const cells = [
    { label: "Hợp đồng", value: item.planned_qty ?? null, hint: "" },
    {
      label: "Thực hiện",
      value: item.executed_qty ?? 0,
      hint: pendingExecuted > 0 ? `chờ ${fmtQty(pendingExecuted)}` : "",
    },
    {
      label: "Nghiệm thu",
      value: item.accepted_qty ?? 0,
      hint: pendingAccepted > 0 ? `chờ ${fmtQty(pendingAccepted)}` : "",
    },
    { label: fourth.label, value: fourth.value, hint: "" },
  ];

  return (
    <div className="rounded-2xl bg-slate-100 px-3 py-3">
      <p className="px-1 text-sm font-bold text-slate-900">Định mức của dòng này</p>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        {cells.map((cell, index) => (
          <div
            key={cell.label}
            className={`rounded-xl px-3 py-2 ${
              index === 3 ? "bg-white ring-2 ring-amber-400" : "bg-white/70"
            }`}
          >
            <dt className="text-xs font-medium text-slate-500">{cell.label}</dt>
            <dd className="text-lg font-bold text-slate-900">
              {cell.value == null ? "—" : fmtQty(Number(cell.value))}
              <span className="ml-1 text-xs font-medium text-slate-500">{unit}</span>
            </dd>
            {cell.hint ? <p className="text-xs text-amber-800">{cell.hint}</p> : null}
          </div>
        ))}
      </dl>
      <p className="mt-2 px-1 text-sm text-slate-600">
        {kind === "thuc_hien"
          ? "Ô viền vàng là phần còn ghi được trước khi vượt hợp đồng. Số chờ duyệt đã được giữ chỗ."
          : Number(item.executed_qty || 0) > 0
            ? "Ô viền vàng là phần còn nghiệm thu so với thực hiện đã duyệt."
            : "Chưa có thực hiện đã duyệt. Ô viền vàng tạm tính theo hợp đồng."}
      </p>
    </div>
  );
}
