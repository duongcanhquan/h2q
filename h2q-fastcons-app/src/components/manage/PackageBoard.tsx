"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { getJson, invalidate } from "@/lib/api/cache";

type Project = { id: string; code: string; name: string };
type Row = { id: string; code: string; name: string; budget: number; project_code: string; project_name: string; planned_amount: number };
type Item = { id: string; code: string; description: string; project_code: string; work_package_id: string | null };
const field = "field text-sm";
const money = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n || 0);

export function PackageBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [attach, setAttach] = useState({ package_id: "", item_id: "" });
  const [projects, setProjects] = useState<Project[]>([]);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ project_code: "", code: "", name: "", budget: "" });

  async function reload(force = false) {
    const [res, session] = await Promise.all([
      getJson("/api/registers/packages", force),
      getJson("/api/auth/session", force),
    ]);
    const data = (res.body || {}) as { message?: string; rows?: Row[]; projects?: Project[]; items?: Item[] };
    if (!res.ok) throw new ApiError(data.message || "Không tải được gói việc.", res.status);
    const who = (session.body || {}) as { app_role?: string };
    setRows(data.rows || []);
    setItems(data.items || []);
    setProjects(data.projects || []);
    setAdmin(who.app_role === "admin");
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được gói việc.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/registers/packages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return setError(data.message || "Không tạo được gói việc.");
    setForm({ ...form, code: "", name: "", budget: "" });
    invalidate("/api/registers/packages");
    await reload(true);
  }

  if (loading) return <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" /> Đang tải gói việc…</p>;

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} /> : null}
      {admin ? (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-4 md:grid-cols-5">
          <select className={field} required value={form.project_code} onChange={(e) => setForm({ ...form, project_code: e.target.value })}>
            <option value="">Công trình</option>
            {projects.map((project) => <option key={project.id} value={project.code}>{project.code}</option>)}
          </select>
          <input className={field} placeholder="Mã gói" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className={field} placeholder="Tên gói" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={field} placeholder="Ngân sách" inputMode="decimal" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          <button type="submit" className="btn btn-primary text-sm">Tạo gói</button>
        </form>
      ) : null}
      {admin ? (
        <form className="glass-card grid gap-3 p-4 md:grid-cols-3" onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const res = await fetch("/api/registers/packages", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: attach.package_id, item_id: attach.item_id }),
          });
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          if (!res.ok) return setError(data.message || "Không gắn được đầu việc.");
          setAttach({ package_id: "", item_id: "" });
          invalidate("/api/registers/packages");
          await reload(true);
        }}>
          <select className={field} required value={attach.package_id} onChange={(e) => setAttach({ package_id: e.target.value, item_id: "" })}>
            <option value="">Gói việc</option>
            {rows.map((row) => <option key={row.id} value={row.id}>{row.project_code} · {row.code}</option>)}
          </select>
          <select className={field} required value={attach.item_id} onChange={(e) => setAttach({ ...attach, item_id: e.target.value })}>
            <option value="">Đầu việc cùng công trình</option>
            {items.filter((item) => item.project_code === rows.find((row) => row.id === attach.package_id)?.project_code).map((item) => (
              <option key={item.id} value={item.id}>{item.code} · {item.description}{item.work_package_id ? " · đã gắn" : ""}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary text-sm">Gắn vào gói</button>
        </form>
      ) : null}
      <div className="glass-card overflow-x-auto">
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
