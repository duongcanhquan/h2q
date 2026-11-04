"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { getJson, invalidate } from "@/lib/api/cache";

type Project = { id: string; code: string; name: string };
type Row = { id: string; code: string; title: string; reason: string | null; amount: number; status: string; project_code: string; project_name: string };
const field = "field text-sm";
const money = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n || 0);
const STATUS: Record<string, string> = { Draft: "Nháp", Submitted: "Đã trình", Approved: "Đã duyệt", Rejected: "Từ chối" };

export function ChangeBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ project_code: "", code: "", title: "", reason: "", amount: "" });

  async function reload(force = false) {
    const [res, session] = await Promise.all([
      getJson("/api/registers/changes", force),
      getJson("/api/auth/session", force),
    ]);
    const data = (res.body || {}) as { message?: string; rows?: Row[]; projects?: Project[] };
    if (!res.ok) throw new ApiError(data.message || "Không tải được phát sinh.", res.status);
    const who = (session.body || {}) as { app_role?: string };
    setRows(data.rows || []);
    setProjects(data.projects || []);
    setAdmin(who.app_role === "admin");
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được phát sinh.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/registers/changes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return setError(data.message || "Không tạo được phát sinh.");
    setForm({ ...form, code: "", title: "", reason: "", amount: "" });
    invalidate("/api/registers/changes");
    await reload(true);
  }

  async function setStatus(id: string, status: string) {
    setError("");
    const res = await fetch("/api/registers/changes", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return setError(data.message || "Không đổi được trạng thái.");
    invalidate("/api/registers/changes");
    await reload(true);
  }

  if (loading) return <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" /> Đang tải phát sinh…</p>;

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} /> : null}
      <p className="text-sm text-slate-600">Phát sinh phạm vi đi theo trạng thái Nháp, Trình, Duyệt hoặc Từ chối. Số tiền là giá trị thay đổi, chưa tự cộng vào dự toán.</p>
      {admin ? (
        <form onSubmit={onCreate} className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-5">
          <select className={field} required value={form.project_code} onChange={(e) => setForm({ ...form, project_code: e.target.value })}>
            <option value="">Công trình</option>
            {projects.map((project) => <option key={project.id} value={project.code}>{project.code}</option>)}
          </select>
          <input className={field} placeholder="Mã PS" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className={field} placeholder="Tên phát sinh" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className={field} placeholder="Lý do" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <input className={field} placeholder="Giá trị" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <button className="min-h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white md:col-span-5">Ghi phát sinh</button>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full text-sm">
          <thead className="border-b text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left">Công trình</th>
              <th className="px-3 py-3 text-left">Phát sinh</th>
              <th className="px-3 py-3 text-left">Lý do</th>
              <th className="px-3 py-3 text-right">Giá trị</th>
              <th className="px-3 py-3 text-left">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-3">{row.project_code}</td>
                <td className="px-3 py-3">{row.code} · {row.title}</td>
                <td className="px-3 py-3">{row.reason || "—"}</td>
                <td className="px-3 py-3 text-right">{money(Number(row.amount))}</td>
                <td className="px-3 py-3">
                  {STATUS[row.status] || row.status}
                  {admin && row.status === "Draft" ? (
                    <button type="button" className="ml-3 font-semibold text-amber-700" onClick={() => void setStatus(row.id, "Submitted")}>Trình</button>
                  ) : null}
                  {admin && row.status === "Submitted" ? (
                    <>
                      <button type="button" className="ml-3 font-semibold text-amber-700" onClick={() => void setStatus(row.id, "Approved")}>Duyệt</button>
                      <button type="button" className="ml-3 font-semibold text-red-700" onClick={() => void setStatus(row.id, "Rejected")}>Từ chối</button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Chưa có phát sinh.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
