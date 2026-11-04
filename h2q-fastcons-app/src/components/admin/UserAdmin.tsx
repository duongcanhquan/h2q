"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type Role = "engineer" | "approver" | "admin";

type Person = {
  id: string;
  email: string;
  full_name: string;
  app_role: Role;
  assignments: { project_id: string; member_role: Role }[];
};

type Project = { id: string; code: string; name: string };

const ROLE_LABEL: Record<Role, string> = {
  engineer: "Kỹ sư",
  approver: "Chỉ huy",
  admin: "Admin",
};

const fieldClass =
  "min-h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 text-base outline-none ring-amber-500 focus:border-amber-500 focus:ring-2";

function blankForm() {
  return { email: "", password: "", full_name: "", app_role: "engineer" as Role, assigned: {} as Record<string, Role | ""> };
}

export function UserAdmin() {
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm());

  async function reload() {
    const response = await fetch("/api/admin/users", { credentials: "include" });
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      users?: Person[];
      projects?: Project[];
      me?: string;
    };
    if (!response.ok) throw new ApiError(data.message || "Không tải được danh sách.", response.status);
    setPeople(data.users || []);
    setProjects(data.projects || []);
    setMe(data.me || "");
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      reload()
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được danh sách."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  function openCreate() {
    setEditing("new");
    setForm(blankForm());
    setError("");
  }

  function openEdit(person: Person) {
    const assigned: Record<string, Role | ""> = {};
    for (const row of person.assignments) assigned[row.project_id] = row.member_role;
    setEditing(person.id);
    setForm({
      email: person.email,
      password: "",
      full_name: person.full_name,
      app_role: person.app_role,
      assigned,
    });
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const assignments = Object.entries(form.assigned)
      .filter((entry): entry is [string, Role] => entry[1] === "engineer" || entry[1] === "approver" || entry[1] === "admin")
      .map(([project_id, member_role]) => ({ project_id, member_role }));
    const payload = {
      email: form.email.trim(),
      password: form.password,
      full_name: form.full_name.trim(),
      app_role: form.app_role,
      assignments,
    };
    try {
      const path = editing === "new" ? "/api/admin/users" : `/api/admin/users/${editing}`;
      const response = await fetch(path, {
        method: editing === "new" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new ApiError(data.message || "Không lưu được.", response.status);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editing || editing === "new") return;
    const person = people.find((row) => row.id === editing);
    if (!window.confirm(`Xóa tài khoản ${person?.email || ""}?`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${editing}`, { method: "DELETE", credentials: "include" });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new ApiError(data.message || "Không xóa được.", response.status);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không xóa được.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" /> Đang tải người dùng…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} /> : null}
      <p className="text-sm text-slate-600">
        Admin thấy mọi công trình. Kỹ sư và chỉ huy chỉ vào công trình được phân công. Chỉ huy được duyệt phiếu của công trình đó.
      </p>
      <button
        type="button"
        onClick={openCreate}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-base font-semibold text-white"
      >
        Thêm người
      </button>

      <ul className="space-y-2">
        {people.map((person) => (
          <li key={person.id}>
            <button
              type="button"
              onClick={() => openEdit(person)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-slate-200"
            >
              <span>
                <span className="block font-semibold text-slate-900">{person.full_name}</span>
                <span className="block text-sm text-slate-500">{person.email}</span>
              </span>
              <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {ROLE_LABEL[person.app_role]}
                {person.id === me ? " · bạn" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {editing ? (
        <form onSubmit={onSubmit} className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">{editing === "new" ? "Tài khoản mới" : "Sửa tài khoản"}</h3>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Họ tên</span>
            <input className={fieldClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input className={fieldClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">{editing === "new" ? "Mật khẩu" : "Mật khẩu mới"}</span>
            <input
              className={fieldClass}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={editing === "new"}
              placeholder={editing === "new" ? "Ít nhất 6 ký tự" : "Để trống nếu giữ mật khẩu cũ"}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Vai trò hệ thống</span>
            <select className={fieldClass} value={form.app_role} onChange={(e) => setForm({ ...form, app_role: e.target.value as Role })}>
              <option value="engineer">Kỹ sư</option>
              <option value="approver">Chỉ huy</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Phân công công trình</legend>
            {projects.length === 0 ? <p className="text-sm text-slate-500">Chưa có công trình.</p> : null}
            {projects.map((project) => (
              <label key={project.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {project.code} · {project.name}
                </span>
                <select
                  className="min-h-11 rounded-xl border border-slate-300 bg-slate-50 px-2 text-sm"
                  value={form.assigned[project.id] || ""}
                  onChange={(e) => setForm({ ...form, assigned: { ...form.assigned, [project.id]: e.target.value as Role | "" } })}
                >
                  <option value="">Không giao</option>
                  <option value="engineer">Kỹ sư</option>
                  <option value="approver">Chỉ huy</option>
                  <option value="admin">Phụ trách</option>
                </select>
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={saving} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-amber-500 font-semibold text-slate-900 disabled:opacity-60">
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
          {editing !== "new" && editing !== me ? (
            <button type="button" onClick={onDelete} disabled={saving} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-red-50 font-semibold text-red-700 ring-1 ring-red-200 disabled:opacity-60">
              Xóa tài khoản
            </button>
          ) : null}
          <button type="button" onClick={() => setEditing(null)} className="flex min-h-12 w-full items-center justify-center rounded-2xl text-slate-600">
            Đóng
          </button>
        </form>
      ) : null}
    </div>
  );
}
