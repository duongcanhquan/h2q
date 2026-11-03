"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MapPin, Send, WifiOff } from "lucide-react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectGridSkeleton } from "@/components/projects/ProjectCardSkeleton";
import { PhotoCapture, type PhotoItem } from "@/components/report/PhotoCapture";
import { useProjectWbs } from "@/hooks/useProjectWbs";
import { useH2qSettings } from "@/hooks/useH2qSettings";
import { useGeolocation } from "@/hooks/useGeolocation";
import { evaluateGeofence } from "@/lib/geo/geofence";
import { drainSiteDiaryQueue, enqueueSiteDiary } from "@/lib/offline/diary-queue";

const WEATHER = ["Nắng", "Mưa", "Mưa nhỏ", "Âm u"] as const;
const CONDITION = ["Tốt", "Trung bình", "Kém"] as const;

export function DiaryForm({ projectId }: { projectId: string }) {
  const { tasks, projectName, geofence, loading, offline, error: wbsError } = useProjectWbs(projectId);
  const { settings, loading: settingsLoading, error: settingsError } = useH2qSettings();
  const { fix, loading: gpsLoading, error: gpsError, capture } = useGeolocation();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState<(typeof WEATHER)[number]>("Nắng");
  const [siteCondition, setSiteCondition] = useState<(typeof CONDITION)[number]>("Tốt");
  const [safety, setSafety] = useState<(typeof CONDITION)[number]>("Tốt");
  const [workNote, setWorkNote] = useState("");
  const [taskId, setTaskId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [labour, setLabour] = useState("");
  const [equipment, setEquipment] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fence = useMemo(
    () => evaluateGeofence(settings.geofence_enforcement, fix?.lat, fix?.lng, geofence),
    [settings.geofence_enforcement, fix?.lat, fix?.lng, geofence],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      capture();
      void drainSiteDiaryQueue();
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!settingsLoading && !settingsError && !settings.enable_site_diary) {
      setError("Nhật ký đang tắt. Nhờ văn phòng bật Enable Site Diary rồi gửi lại.");
      return;
    }
    if (!date) {
      setError("Chọn ngày nhật ký.");
      return;
    }
    if (settings.gps_required && (fix?.lat == null || fix?.lng == null)) {
      setError("GPS bắt buộc (H2Q Settings). Bấm «Lấy GPS».");
      return;
    }
    if (fence.action === "block") {
      setError(`${fence.message} Không gửi được.`);
      return;
    }
    const imageUrls = photos.map((p) => p.remoteUrl).filter((url): url is string => Boolean(url));
    if (photos.some((p) => p.uploading)) {
      setError("Đang lưu ảnh — đợi xong rồi gửi.");
      return;
    }
    if (photos.some((p) => p.error)) {
      setError("Có ảnh lỗi. Xóa ảnh đó hoặc chọn lại.");
      return;
    }

    setSubmitting(true);
    try {
      const qty = Number(quantity);
      const saved = await enqueueSiteDiary({
        project: projectId,
        date,
        weather,
        site_condition: siteCondition,
        safety_status: safety,
        work_note: workNote,
        gps_lat: fix?.lat,
        gps_lng: fix?.lng,
        gps_accuracy: fix?.accuracy,
        image_urls: imageUrls,
        lines: [
          {
            task: taskId || undefined,
            quantity: Number.isFinite(qty) && qty !== 0 ? qty : undefined,
            description: workNote,
            labour_count: labour ? Number(labour) : undefined,
            equipment_note: equipment || undefined,
          },
        ],
      });
      setSuccess(
        saved.mode === "indexeddb"
          ? "Mất mạng — nhật ký nằm trên máy, sẽ gửi khi có mạng."
          : `Đã ghi nhật ký ${saved.entries?.join(", ") || ""}. Cùng ngày, cùng hạng mục sẽ được cập nhật.`,
      );
      setWorkNote("");
      setQuantity("");
      setLabour("");
      setEquipment("");
      setPhotos((prev) => {
        prev.forEach((photo) => {
          if (photo.previewUrl.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
        });
        return [];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không ghi được nhật ký");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Đang tải công trình…</p>
        <ProjectGridSkeleton count={2} />
      </div>
    );
  }

  const diaryOff = !settingsLoading && !settingsError && !settings.enable_site_diary;
  const fenceBlock = fence.action === "block" ? `${fence.message} Không gửi được.` : "";
  const inputClass =
    "min-h-14 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-base font-semibold text-slate-900 outline-none focus:border-amber-500";

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4 pb-10">
      <Card>
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            Nhật ký thi công
          </p>
          <CardTitle className="text-2xl text-slate-900">{projectName}</CardTitle>
          <CardDescription>{projectId}</CardDescription>
          <Link
            href={`/project/${encodeURIComponent(projectId)}/report`}
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-amber-800"
          >
            Sang báo cáo khối lượng
          </Link>
          {offline ? (
            <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-amber-900">
              <WifiOff className="size-3.5" />
              Danh mục từ cache
            </p>
          ) : null}
        </CardHeader>
      </Card>

      {diaryOff ? (
        <ErrorBanner message="Nhật ký đang tắt. Nhờ văn phòng bật Enable Site Diary, lưu, rồi gửi lại." />
      ) : null}
      {wbsError ? <ErrorBanner message={wbsError} /> : null}
      {error && error !== fenceBlock ? <ErrorBanner message={error} /> : null}
      {success ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>{success}</p>
        </div>
      ) : null}
      {fence.action === "block" ? (
        <ErrorBanner message={`${fence.message} Không gửi được.`} />
      ) : null}
      {fence.action === "warn" ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {fence.message} Vẫn gửi được. Nhật ký sẽ gắn cờ ngoài vùng.
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-4 pt-4">
          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">Ngày</span>
            <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <Choice label="Thời tiết" value={weather} options={WEATHER} columns={2} onChange={setWeather} />
          <Choice label="Hiện trường" value={siteCondition} options={CONDITION} onChange={setSiteCondition} />
          <Choice label="An toàn" value={safety} options={CONDITION} onChange={setSafety} />
          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">Công việc trong ngày</span>
            <textarea
              className={`${inputClass} min-h-28 py-3 font-normal`}
              value={workNote}
              onChange={(e) => setWorkNote(e.target.value)}
              placeholder="Hạng mục đang làm, vị trí, vướng mắc"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">Hạng mục</span>
            <select className={inputClass} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">— Cả công trường —</option>
              {tasks.map((task) => (
                <option key={task.name} value={task.name}>
                  {task.subject}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">
              Khối lượng ước tính trong ngày
            </span>
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
            <span className="block text-sm font-normal text-slate-500">
              Chỉ để đọc trong nhật ký. Muốn vào sổ sản lượng thì sang Khối lượng, chọn Thực hiện.
            </span>
          </label>
          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">Nhân công</span>
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={labour}
              onChange={(e) => setLabour(e.target.value)}
              placeholder="Số người trên công trường"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-base font-bold text-slate-800">Máy thi công</span>
            <input
              className={inputClass}
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Máy, số ca"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-slate-800">GPS</p>
            <button
              type="button"
              onClick={() => capture()}
              disabled={gpsLoading}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white"
            >
              {gpsLoading ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              Lấy GPS
            </button>
          </div>
          <p className="text-sm text-slate-600">
            {fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}` : "Chưa có toạ độ"}
          </p>
          {gpsError ? <p className="text-sm text-red-600">{gpsError}</p> : null}
        </CardContent>
      </Card>

      <PhotoCapture value={photos} onChange={setPhotos} emptyLabel="Chưa có ảnh nhật ký" />

      <button
        type="submit"
        disabled={submitting || diaryOff}
        className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-amber-500 text-xl font-black text-slate-950 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="size-6 animate-spin" /> : <Send className="size-6" />}
        {submitting ? "Đang gửi…" : "Gửi nhật ký"}
      </button>
    </form>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  columns = 3,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  columns?: 2 | 3;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-bold text-slate-800">{label}</legend>
      <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`min-h-12 rounded-2xl text-sm font-bold ${
              value === option ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
