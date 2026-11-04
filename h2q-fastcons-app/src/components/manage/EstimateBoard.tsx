"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { getJson, invalidate } from "@/lib/api/cache";

type Project = { id: string; code: string; name: string };
type Item = { id: string; project_id: string; code: string; description: string; boq_id: string | null; planned_qty: number; rate: number };
type Row = {
  id: string;
  code: string;
  title: string;
  revision: number;
  status: string;
  project_id: string;
  project_code: string;
  project_name: string;
  line_count: number;
  planned_amount: number;
};

const field = "field text-sm";
const money = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n || 0);

export function EstimateBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ project_code: "", code: "", title: "", revision: "0" });

  async function reload(force = false) {
    const [res, session] = await Promise.all([
      getJson("/api/registers/boq", force),
      getJson("/api/auth/session", force),
    ]);
    const data = (res.body || {}) as { message?: string; rows?: Row[]; items?: Item[]; projects?: Project[] };
    if (!res.ok) throw new ApiError(data.message || "Không tải được dự toán.", res.status);
    const who = (session.body || {}) as { app_role?: string };
    setRows(data.rows || []);
    setItems(data.items || []);
    setProjects(data.projects || []);
    setAdmin(who.app_role === "admin");
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được dự toán.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/registers/boq", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return setError(data.message || "Không tạo được dự toán.");
    setForm({ project_code: form.project_code, code: "", title: "", revision: "0" });
    invalidate("/api/registers/boq");
    await reload(true);
  }

  async function setStatus(id: string, status: string) {
    setError("");
    const res = await fetch(`/api/registers/boq/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return setError(data.message || "Không đổi được trạng thái.");
    invalidate("/api/registers/boq");
    await reload(true);
  }

  async function attach(id: string, itemId: string) {
    setError("");
    const res = await fetch(`/api/registers/boq/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return setError(data.message || "Không gán được đầu việc.");
    invalidate("/api/registers/boq");
    await reload(true);
  }

  if (loading) return <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" /> Đang tải dự toán…</p>;

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} /> : null}
      <p className="text-sm text-slate-600">
        Một công trình có nhiều lần dự toán. Khi duyệt một lần, lần đã duyệt trước chuyển thành thay thế. Thành tiền là khối lượng kế hoạch nhân đơn giá của các đầu việc được gán.
      </p>
      {admin ? (
        <form onSubmit={onCreate} className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-5">
          <select className={field} value={form.project_code} onChange={(e) => setForm({ ...form, project_code: e.target.value })} required>
            <option value="">Công trình</option>
            {projects.map((project) => <option key={project.id} value={project.code}>{project.code} · {project.name}</option>)}
          </select>
          <input className={field} placeholder="Mã DT" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className={field} placeholder="Tên dự toán" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className={field} placeholder="Lần sửa" inputMode="numeric" value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} />
          <button className="min-h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white">Tạo dự toán</button>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Công trình</th>
              <th className="px-3 py-3">Dự toán</th>
              <th className="px-3 py-3">Lần</th>
              <th className="px-3 py-3">Trạng thái</th>
              <th className="px-3 py-3 text-right">Dòng</th>
              <th className="px-3 py-3 text-right">Thành tiền</th>
              <th className="px-3 py-3">Gán đầu việc</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const free = items.filter((item) => item.project_id === row.project_id && item.boq_id !== row.id);
              return (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-3 py-3">{row.project_code}</td>
                  <td className="px-3 py-3">{row.code} · {row.title}</td>
                  <td className="px-3 py-3">{row.revision}</td>
                  <td className="px-3 py-3">{row.status}</td>
                  <td className="px-3 py-3 text-right">{row.line_count}</td>
                  <td className="px-3 py-3 text-right">{money(row.planned_amount)}</td>
                  <td className="px-3 py-3">
                    {admin ? (
                      <div className="flex flex-wrap gap-2">
                        <select className="min-h-9 rounded-lg border px-2 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) void attach(row.id, e.target.value); }}>
                          <option value="">Gán đầu việc</option>
                          {free.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.description}</option>)}
                        </select>
                        {row.status !== "Approved" ? <button type="button" className="text-xs font-semibold text-amber-700" onClick={() => void setStatus(row.id, "Approved")}>Duyệt</button> : null}
                        {row.status === "Draft" ? <button type="button" className="text-xs font-semibold text-slate-700" onClick={() => void setStatus(row.id, "Submitted")}>Trình</button> : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Chưa có dự toán. Tạo đầu việc trong sổ công trình rồi gán vào đây.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
