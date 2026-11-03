"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import {
  approveMeasurement,
  getPendingApprovals,
  rejectMeasurement,
} from "@/lib/api/client";
import type { PendingApprovalRow } from "@/lib/domain/types";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api/errors";

export function PendingApprovalsList() {
  const [items, setItems] = useState<PendingApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [rejectId, setRejectId] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [canApprove, setCanApprove] = useState(true);
  const [truncated, setTruncated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPendingApprovals();
      setItems(data.items || []);
      setCanApprove(data.viewer_can_approve !== false);
      setTruncated(Boolean(data.truncated));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Không tải được hàng đợi duyệt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function onApprove(name: string) {
    setBusyId(name);
    setError("");
    setNotice("");
    try {
      const result = await approveMeasurement(name);
      if (result.awaiting_next_level) {
        setNotice(`Đã duyệt ${name}. Phiếu chuyển cấp tiếp theo và vẫn nằm ở đây.`);
      } else if (result.certified === 0 || result.ledger === "executed") {
        setNotice(`Đã duyệt ${name}. Ghi sản lượng, không chứng nhận.`);
      } else {
        setNotice(`Đã chứng nhận ${name}.`);
      }
      setConfirmId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duyệt thất bại");
    } finally {
      setBusyId("");
    }
  }

  async function onReject(name: string) {
    const text = reason.trim();
    if (!text) return;
    setBusyId(name);
    setError("");
    setNotice("");
    try {
      await rejectMeasurement(name, text);
      setNotice(`Đã từ chối ${name}. Phiếu không bị chứng nhận.`);
      setRejectId("");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Từ chối thất bại");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {loading ? "Đang tải…" : `${items.length} phiếu chờ duyệt`}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {notice ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>{notice}</p>
        </div>
      ) : null}

      {truncated ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">Đang hiện 300 phiếu mới nhất. Duyệt hoặc từ chối bớt để thấy phiếu cũ hơn.</p> : null}
      {!loading && items.length === 0 ? (
        <EmptyState
          title={canApprove ? "Không có phiếu chờ" : "Bạn chưa được giao duyệt"}
          description={canApprove ? "Khi hiện trường gửi phiếu và bật chuyển duyệt, phiếu sẽ hiện ở đây." : "Cần được giao vai trò chỉ huy hoặc phụ trách trên công trình. Vai trò hệ thống không đủ."}
        />
      ) : null}

      <ul className="space-y-3">
        {items.map((row) => {
          const kind = describeSlip(row);
          const confirming = confirmId === row.name;
          const rejecting = rejectId === row.name;
          const busy = busyId === row.name;
          return (
          <li key={row.name}>
            <Card>
              <CardHeader className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{row.name}</CardTitle>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${kind.badge}`}>
                    {kind.label}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {row.project_name || row.project} · KL {row.measured_total ?? "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {row.approval_levels
                    ? `Cấp ${Math.min((row.approval_level || 0) + 1, row.approval_levels)}/${row.approval_levels}`
                    : "Một cấp duyệt"}
                  {row.next_roles?.length ? ` · cần ${row.next_roles.join(" / ")}` : ""}
                  {" · "}Hạng mục {row.custom_h2q_task || "—"} · Lệnh {row.work_order || "—"}
                  {row.custom_h2q_boq_over_limit ? " · vượt mức" : ""}
                  {row.custom_h2q_geofence_outside ? " · ngoài vùng" : ""}
                </p>
                <p className="text-sm font-medium text-slate-800">{kind.effect}</p>
                <p className="text-xs text-slate-500">{row.date || "—"} · {row.measured_by || "Chưa rõ người gửi"}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {row.image_urls?.length ? (
                  <div className="flex gap-2 overflow-x-auto">
                    {row.image_urls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="Ảnh phiếu" className="h-20 w-20 rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {rejecting ? (
                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-slate-800">Lý do từ chối</span>
                    <textarea
                      className="min-h-24 w-full rounded-2xl border-2 border-slate-300 px-3 py-2 text-base text-slate-900 outline-none focus:border-amber-500"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Viết lý do. Bỏ trống thì phiếu không bị từ chối."
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busy || !reason.trim()}
                        onClick={() => void onReject(row.name)}
                        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-base font-bold text-white disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="size-5 animate-spin" /> : <X className="size-5" />}
                        Gửi từ chối
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRejectId("");
                          setReason("");
                        }}
                        className="min-h-14 rounded-2xl bg-white text-base font-bold text-slate-700 ring-1 ring-slate-200"
                      >
                        Huỷ
                      </button>
                    </div>
                  </label>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (confirming) {
                          void onApprove(row.name);
                          return;
                        }
                        setRejectId("");
                        setReason("");
                        setConfirmId(row.name);
                      }}
                      className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
                      {confirming ? "Xác nhận" : "Duyệt"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setConfirmId("");
                        setReason("");
                        setRejectId(row.name);
                      }}
                      className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-base font-bold text-white disabled:opacity-60"
                    >
                      <X className="size-5" />
                      Từ chối
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
          );
        })}
      </ul>
    </div>
  );
}

function describeSlip(row: PendingApprovalRow) {
  const raw = (row.entry_kind || row.custom_h2q_entry_kind || "").trim();
  const levels = row.approval_levels || 0;
  const level = row.approval_level || 0;
  const final = levels === 0 || level + 1 >= levels;
  const nextLevel = Math.min(level + 2, Math.max(levels, 1));
  const folded = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  const nghiem = !raw || folded.includes("nghiem");
  const label = !raw ? "Sổ cũ" : nghiem ? "Nghiệm thu" : "Thực hiện";
  let effect = "Duyệt chỉ ghi sản lượng. Không chứng nhận.";
  if (!final) {
    effect = `Bấm Duyệt rồi Xác nhận để chuyển lên cấp ${nextLevel}. Phiếu vẫn ở hàng chờ.`;
  } else if (nghiem) {
    effect = "Bấm Duyệt rồi Xác nhận. Phiếu được chứng nhận để thanh toán.";
  }
  return {
    label,
    effect,
    badge: nghiem ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-800",
  };
}
