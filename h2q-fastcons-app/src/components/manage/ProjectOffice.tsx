"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { getJson, invalidate } from "@/lib/api/cache";
import type { ProjectRow } from "@/lib/domain/types";

const fieldClass = "field text-sm";

export function ProjectOffice() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    customer: "",
    company: "",
    expected_start_date: "",
    expected_end_date: "",
    status: "Open",
  });

  async function reload(force = false) {
    const [listRes, sessionRes] = await Promise.all([
      getJson("/api/projects?all=1", force),
      getJson("/api/auth/session", force),
    ]);
    const list = (listRes.body || {}) as { message?: string; projects?: ProjectRow[] };
    if (!listRes.ok) throw new ApiError(list.message || "Không tải được công trình.", listRes.status);
    const session = (sessionRes.body || {}) as { app_role?: string };
    setProjects(list.projects || []);
    setAdmin(session.app_role === "admin");
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      reload()
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được công trình."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      if (!response.ok || !data.code) throw new ApiError(data.message || "Không tạo được công trình.", response.status);
      invalidate("/api/projects");
      router.push(`/manage/${encodeURIComponent(data.code)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tạo được công trình.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" /> Đang tải công trình…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorBanner message={error} /> : null}
      {admin ? (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-4 md:grid-cols-4">
          <input className={fieldClass} placeholder="Mã, ví dụ CT-02" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className={fieldClass} placeholder="Tên công trình" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className={fieldClass} placeholder="Chủ đầu tư" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
          <input className={fieldClass} placeholder="Đơn vị thi công" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <label className="text-xs text-slate-500">
            Bắt đầu
            <input className={fieldClass} type="date" value={form.expected_start_date} onChange={(e) => setForm({ ...form, expected_start_date: e.target.value })} />
          </label>
          <label className="text-xs text-slate-500">
            Kết thúc
            <input className={fieldClass} type="date" value={form.expected_end_date} onChange={(e) => setForm({ ...form, expected_end_date: e.target.value })} />
          </label>
          <select className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="Open">Đang thi công</option>
            <option value="On Hold">Tạm dừng</option>
            <option value="Completed">Hoàn thành</option>
          </select>
          <button type="submit" disabled={saving} className="btn btn-primary text-sm disabled:opacity-60">
            {saving ? "Đang tạo…" : "Tạo công trình"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-600">Bạn xem được các công trình được phân công. Admin mới tạo và sửa danh mục.</p>
      )}

      <div className="glass-card overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Công trình</th>
              <th className="px-4 py-3">Chủ đầu tư</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Tiến độ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.name} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{project.name}</td>
                <td className="px-4 py-3">{project.project_name}</td>
                <td className="px-4 py-3 text-slate-600">{project.customer || "—"}</td>
                <td className="px-4 py-3">{project.status || "Open"}</td>
                <td className="px-4 py-3 text-right">{Math.round(project.percent_complete || 0)}%</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/manage/${encodeURIComponent(project.name)}`} className="font-semibold text-blue-700 hover:text-blue-800">
                    Mở sổ
                  </Link>
                </td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Chưa có công trình.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
