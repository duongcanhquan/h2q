"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { getJson, invalidate } from "@/lib/api/cache";

type Row = { id: string; code: string; title: string; amount: number; status: string; score: number | null; review: string | null; supplier_name: string; project_code: string };
type Rating = { supplier_id: string; supplier_name: string; average: number; count: number };
type Option = { id: string; name?: string; code?: string };
const field = "field text-sm";
const money = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n || 0);

export function QuoteBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ project_code: "", supplier_id: "", code: "", title: "", amount: "" });
  const [scores, setScores] = useState<Record<string, string>>({});

  async function reload(force = false) {
    const [res, session] = await Promise.all([
      getJson("/api/registers/quotes", force),
      getJson("/api/auth/session", force),
    ]);
    const data = (res.body || {}) as { message?: string; rows?: Row[]; ratings?: Rating[]; suppliers?: Option[]; projects?: Option[] };
    if (!res.ok) throw new ApiError(data.message || "Không tải được báo giá.", res.status);
    const who = (session.body || {}) as { app_role?: string };
    setRows(data.rows || []);
    setRatings(data.ratings || []);
    setSuppliers(data.suppliers || []);
    setProjects(data.projects || []);
    setAdmin(who.app_role === "admin");
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được báo giá.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/registers/quotes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return setError(data.message || "Không tạo được báo giá.");
    setForm({ ...form, code: "", title: "", amount: "" });
    invalidate("/api/registers/quotes");
    await reload(true);
  }

  async function review(id: string, status: string, score?: string) {
    setError("");
    if (!score) return setError("Chọn điểm từ 1 đến 5 trước khi chọn hoặc loại.");
    const res = await fetch("/api/registers/quotes", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, score: score ? Number(score) : undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return setError(data.message || "Không lưu được đánh giá.");
    invalidate("/api/registers/quotes");
    await reload(true);
  }

  if (loading) return <p className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Đang tải báo giá…</p>;

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} /> : null}
      {admin ? (
        <form onSubmit={onCreate} className="grid gap-3 rounded-2xl p-4 md:grid-cols-5">
          <select className={field} required value={form.project_code} onChange={(e) => setForm({ ...form, project_code: e.target.value })}>
            <option value="">Công trình</option>
            {projects.map((row) => <option key={row.id} value={row.code}>{row.code}</option>)}
          </select>
          <select className={field} value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
            <option value="">Nhà cung cấp</option>
            {suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <input className={field} required placeholder="Số báo giá" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className={field} required placeholder="Nội dung" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className={field} placeholder="Giá trị" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <button className="min-h-11 rounded-xl bg-stone-900 font-medium text-white shadow-none md:col-span-5">Tạo báo giá</button>
        </form>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full">
            <thead>
              <tr>
                {["Công trình", "Báo giá", "Nhà cung cấp", "Giá trị", "Đánh giá"].map((header) => (
                  <th key={header} className="px-3 py-3 text-left font-medium text-stone-600">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{row.project_code}</td>
                  <td className="px-3 py-3">{row.code} · {row.title}</td>
                  <td className="px-3 py-3">{row.supplier_name || "—"}</td>
                  <td className="px-3 py-3 text-right">{money(Number(row.amount))}</td>
                  <td className="px-3 py-3">
                    {row.status}{row.score ? ` · ${row.score}/5` : ""}
                    {admin ? (
                      <span className="ml-3 inline-flex flex-wrap items-center gap-2">
                        <select className="rounded-lg border border-slate-200 px-2 py-1" value={scores[row.id] || ""} onChange={(event) => setScores({ ...scores, [row.id]: event.target.value })}>
                          <option value="">Điểm</option>
                          {["1", "2", "3", "4", "5"].map((score) => <option key={score} value={score}>{score}</option>)}
                        </select>
                        <button type="button" className="font-medium text-amber-800" onClick={() => void review(row.id, "Accepted", scores[row.id])}>Chọn</button>
                        <button type="button" className="font-medium text-stone-700" onClick={() => void review(row.id, "Rejected", scores[row.id])}>Loại</button>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="mb-3">Điểm nhà cung cấp</h2>
          {ratings.length === 0 ? <p className="text-stone-600">Chưa có đánh giá.</p> : null}
          {ratings.map((row) => (
            <p key={row.supplier_id} className="flex justify-between py-2">
              <span>{row.supplier_name}</span>
              <span>{row.average.toFixed(1)} / 5</span>
            </p>
          ))}
        </aside>
      </div>
    </div>
  );
}
