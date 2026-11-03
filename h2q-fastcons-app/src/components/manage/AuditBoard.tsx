"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type Row = { id: string; created_at: string; action: string; entity_label: string; summary: string };

const ACTION: Record<string, string> = { INSERT: "Thêm", UPDATE: "Sửa", DELETE: "Xóa" };

export function AuditBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/registers/audit", { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { message?: string; rows?: Row[] };
        if (!res.ok) throw new Error(data.message || "Không tải được sổ kiểm toán.");
        setRows(data.rows || []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không tải được sổ kiểm toán."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Đang tải sổ kiểm toán…</p>;

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} /> : null}
      <p>Mỗi lần thêm, sửa hoặc xóa công trình, dự toán, giao thầu, phát sinh, giá, vật tư và báo giá đều ghi một dòng ở đây. Chỉ admin xem được.</p>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full">
          <thead>
            <tr>
              {["Thời điểm", "Việc", "Sổ", "Nội dung"].map((header) => (
                <th key={header} className="px-3 py-3 text-left font-medium text-stone-600">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-3">{new Date(row.created_at).toLocaleString("vi-VN")}</td>
                <td className="px-3 py-3">{ACTION[row.action] || row.action}</td>
                <td className="px-3 py-3">{row.entity_label}</td>
                <td className="px-3 py-3">{row.summary}</td>
              </tr>
            ))}
            {rows.length === 0 && !error ? (
              <tr><td colSpan={4} className="px-3 py-8 text-stone-600">Chưa có dòng kiểm toán. Hãy chạy SQL sổ này rồi sửa một chứng từ.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
