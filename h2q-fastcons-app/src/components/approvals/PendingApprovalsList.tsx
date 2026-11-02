"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import {
  approveMeasurement,
  getPendingApprovals,
  rejectMeasurement,
} from "@/lib/frappe/client";
import type { PendingApprovalRow } from "@/lib/frappe/types";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FrappeApiError } from "@/lib/frappe/errors";

export function PendingApprovalsList() {
  const [items, setItems] = useState<PendingApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPendingApprovals();
      setItems(data.items || []);
    } catch (err) {
      setError(
        err instanceof FrappeApiError || err instanceof Error
          ? err.message
          : "Không tải được hàng đợi duyệt",
      );
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
    try {
      await approveMeasurement(name);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duyệt thất bại");
    } finally {
      setBusyId("");
    }
  }

  async function onReject(name: string) {
    const reason = window.prompt("Lý do từ chối?") || "";
    if (!reason.trim()) return;
    setBusyId(name);
    setError("");
    try {
      await rejectMeasurement(name, reason.trim());
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

      {!loading && items.length === 0 ? (
        <EmptyState
          title="Không có phiếu chờ"
          description="Khi hiện trường gửi duyệt, phiếu Pending Approval sẽ hiện ở đây."
        />
      ) : null}

      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.name}>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">{row.name}</CardTitle>
                <p className="text-sm text-slate-600">
                  {row.project_name || row.project} · KL {row.measured_total ?? "—"}
                </p>
                <p className="text-xs text-slate-500">
                  Task {row.custom_h2q_task || "—"} · WO {row.work_order || "—"}
                  {row.custom_h2q_boq_over_limit ? " · ⚠ vượt BOQ" : ""}
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={busyId === row.name}
                  onClick={() => void onApprove(row.name)}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white disabled:opacity-60"
                >
                  {busyId === row.name ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Check className="size-5" />
                  )}
                  Duyệt
                </button>
                <button
                  type="button"
                  disabled={busyId === row.name}
                  onClick={() => void onReject(row.name)}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-base font-bold text-white disabled:opacity-60"
                >
                  <X className="size-5" />
                  Từ chối
                </button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
