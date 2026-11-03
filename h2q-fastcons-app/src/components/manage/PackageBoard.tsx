"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type Project = { id: string; code: string; name: string };
type Row = { id: string; code: string; name: string; budget: number; project_code: string; project_name: string; planned_amount: number };
const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm";
const money = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n || 0);

export function PackageBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ project_code: "", code: "", name: "", budget: "" });

  async function reload() {
    const [res, session] = await Promise.all([
      fetch("/api/registers/packages", { credentials: "include" }),
      fetch("/api/auth/session", { credentials: "include" }),
    ]);
    const data = (await res.json().catch(() => ({}))) as { message?: string; rows?: Row[]; projects?: Project[] };
    if (!res.ok) throw new ApiError(data.message || "Không tải được gói việc.", res.status);
    const who = (await session.json().catch(() => ({}))) as { app_role?: string };
    setRows(data.rows || []);
    setProjects(data.projects || []);
    setAdmin(who.app_role === "admin");
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được gói việc.")).finally(() => setLoading(false));
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/registers/packages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return setError(data.message || "Không tạo được gói việc.");
    setForm({ ...form, code: "", name: "", budget: "" });
    await reload();
  }

  if (loading) return <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" /> Đang tải gói việc…</p>;

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} /> : null}
      <p className="text-sm text-slate-600">Gói việc gom ngân sách. Cột kế hoạch là tổng thành tiền các đầu việc đã gắn vào gói. Lệch ngân sách hiện ngay trên dòng.</p>
      {admin ? (
        <form onSubmit={onCreate} className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-5">
          <select className={field} required value={form.project_code} onChange={(e) => setForm({ ...form, project_code: e.target.value })}>
            <option value="">Công trình</option>
            {projects.map((project) => <option key={project.id} value={project.code}>{project.code}</option>)}
          </select>
          <input className={field} placeholder="Mã gói" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className={field} placeholder="Tên gói" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={field} placeholder="Ngân sách" inputMode="decimal" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          <button className="min-h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white">Tạo gói</button>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full text-sm">
          <thead className="border-b text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left">Công trình</th>
              <th className="px-3 py-3 text-left">Gói</th>
              <th className="px-3 py-3 text-right">Ngân sách</th>
              <th className="px-3 py-3 text-right">Kế hoạch</th>
              <th className="px-3 py-3 text-right">Lệch</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-3">{row.project_code} · {row.project_name}</td>
                <td className="px-3 py-3">{row.code} · {row.name}</td>
                <td className="px-3 py-3 text-right">{money(Number(row.budget))}</td>
                <td className="px-3 py-3 text-right">{money(row.planned_amount)}</td>
                <td className="px-3 py-3 text-right">{money(Number(row.budget) - row.planned_amount)}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Chưa có gói việc.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
