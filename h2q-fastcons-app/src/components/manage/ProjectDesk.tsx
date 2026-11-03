"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import type { BoqItemRow, ProjectWbsData, TaskRow } from "@/lib/domain/types";

const fieldClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none ring-amber-500 focus:border-amber-500 focus:ring-2";

type ProjectInfo = {
  code: string;
  name: string;
  status: string;
  company: string | null;
  customer: string | null;
  expected_start_date: string | null;
  expected_end_date: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);
}

function qty(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value || 0);
}

function day(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function ProjectDesk({ code }: { code: string }) {
  const [info, setInfo] = useState<ProjectInfo | null>(null);
  const [wbs, setWbs] = useState<ProjectWbsData | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [task, setTask] = useState({ id: "", code: "", subject: "" });
  const [boq, setBoq] = useState({ id: "", code: "", description: "", unit: "", planned_qty: "", rate: "", task_id: "" });

  async function reload() {
    const [projectRes, wbsRes, sessionRes] = await Promise.all([
      fetch(`/api/projects/${encodeURIComponent(code)}`, { credentials: "include" }),
      fetch(`/api/projects/${encodeURIComponent(code)}/wbs`, { credentials: "include" }),
      fetch("/api/auth/session", { credentials: "include" }),
    ]);
    const project = (await projectRes.json().catch(() => ({}))) as ProjectInfo & { message?: string };
    const book = (await wbsRes.json().catch(() => ({}))) as ProjectWbsData & { message?: string };
    if (!projectRes.ok) throw new ApiError(project.message || "Không tải được công trình.", projectRes.status);
    if (!wbsRes.ok) throw new ApiError(book.message || "Không tải được khối lượng.", wbsRes.status);
    const session = (await sessionRes.json().catch(() => ({}))) as { app_role?: string };
    setInfo(project);
    setWbs(book);
    setAdmin(session.app_role === "admin");
  }

  useEffect(() => {
    reload()
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được sổ công trình."))
      .finally(() => setLoading(false));
  }, [code]);

  const totals = useMemo(() => {
    const items = wbs?.boq_items || [];
    return items.reduce(
      (sum, item) => {
        const planned = Number(item.planned_qty || 0);
        const rate = Number(item.rate || 0);
        const executed = Number(item.executed_qty || 0);
        sum.planned += planned;
        sum.executed += executed;
        sum.accepted += Number(item.accepted_qty || 0);
        sum.plannedAmount += planned * rate;
        sum.executedAmount += executed * rate;
        return sum;
      },
      { planned: 0, executed: 0, accepted: 0, plannedAmount: 0, executedAmount: 0 },
    );
  }, [wbs]);

  async function send(path: string, method: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    if (!response.ok) throw new ApiError(data.message || "Không lưu được.", response.status);
    return data;
  }

  async function onSaveProject(event: FormEvent) {
    event.preventDefault();
    if (!info) return;
    setSaving(true);
    setError("");
    try {
      const saved = await send(`/api/projects/${encodeURIComponent(code)}`, "PATCH", info);
      if (saved.code && saved.code !== code) {
        window.location.href = `/manage/${encodeURIComponent(saved.code)}`;
        return;
      }
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được công trình.");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveTask(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const path = `/api/projects/${encodeURIComponent(code)}/catalog`;
      if (task.id) await send(path, "PATCH", { kind: "task", ...task, status: "Open" });
      else await send(path, "POST", { kind: "task", code: task.code, subject: task.subject });
      setTask({ id: "", code: "", subject: "" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được hạng mục.");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveBoq(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const path = `/api/projects/${encodeURIComponent(code)}/catalog`;
      const payload = {
        kind: "boq",
        id: boq.id,
        code: boq.code,
        description: boq.description,
        unit: boq.unit,
        planned_qty: Number(boq.planned_qty || 0),
        rate: Number(boq.rate || 0),
        task_id: boq.task_id || null,
      };
      if (boq.id) await send(path, "PATCH", payload);
      else await send(path, "POST", payload);
      setBoq({ id: "", code: "", description: "", unit: "", planned_qty: "", rate: "", task_id: "" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được công việc.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(kind: "task" | "boq", id: string) {
    if (!window.confirm("Xóa dòng này?")) return;
    setError("");
    try {
      await send(`/api/projects/${encodeURIComponent(code)}/catalog?kind=${kind}&id=${encodeURIComponent(id)}`, "DELETE");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không xóa được.");
    }
  }

  if (loading || !info || !wbs) {
    return loading ? (
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" /> Đang tải sổ…
      </p>
    ) : (
      <ErrorBanner message={error || "Không tải được sổ."} />
    );
  }

  const tasks = wbs.tasks || [];
  const items = wbs.boq_items || [];

  return (
    <div className="space-y-6">
      {error ? <ErrorBanner message={error} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{info.name}</h2>
          <p className="text-sm text-slate-600">{info.code}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/project/${encodeURIComponent(info.code)}/diary`} className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
            Nhật ký
          </Link>
          <Link href={`/project/${encodeURIComponent(info.code)}/report`} className="inline-flex min-h-11 items-center rounded-xl bg-amber-500 px-4 text-sm font-semibold text-slate-900">
            Phiếu hiện trường
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Khối lượng kế hoạch" value={qty(totals.planned)} />
        <Stat label="Đã thực hiện" value={qty(totals.executed)} />
        <Stat label="Đã nghiệm thu" value={qty(totals.accepted)} />
        <Stat label="Thành tiền kế hoạch" value={money(totals.plannedAmount)} />
        <Stat label="Thành tiền đã làm" value={money(totals.executedAmount)} />
      </section>

      {admin ? (
        <form onSubmit={onSaveProject} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:grid-cols-3">
          <input className={fieldClass} value={info.code} onChange={(e) => setInfo({ ...info, code: e.target.value })} required />
          <input className={fieldClass} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} required />
          <select className={fieldClass} value={info.status} onChange={(e) => setInfo({ ...info, status: e.target.value })}>
            <option value="Open">Đang thi công</option>
            <option value="On Hold">Tạm dừng</option>
            <option value="Completed">Hoàn thành</option>
          </select>
          <input className={fieldClass} placeholder="Chủ đầu tư" value={info.customer || ""} onChange={(e) => setInfo({ ...info, customer: e.target.value })} />
          <input className={fieldClass} placeholder="Đơn vị thi công" value={info.company || ""} onChange={(e) => setInfo({ ...info, company: e.target.value })} />
          <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white disabled:opacity-60">
            Lưu công trình
          </button>
          <label className="text-xs text-slate-500">
            Bắt đầu
            <input className={fieldClass} type="date" value={day(info.expected_start_date)} onChange={(e) => setInfo({ ...info, expected_start_date: e.target.value })} />
          </label>
          <label className="text-xs text-slate-500">
            Kết thúc
            <input className={fieldClass} type="date" value={day(info.expected_end_date)} onChange={(e) => setInfo({ ...info, expected_end_date: e.target.value })} />
          </label>
        </form>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Hạng mục</h3>
        {admin ? (
          <form onSubmit={onSaveTask} className="grid gap-3 md:grid-cols-[140px_1fr_auto]">
            <input className={fieldClass} placeholder="Mã HM" value={task.code} onChange={(e) => setTask({ ...task, code: e.target.value })} required />
            <input className={fieldClass} placeholder="Tên hạng mục" value={task.subject} onChange={(e) => setTask({ ...task, subject: e.target.value })} required />
            <button className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white" disabled={saving}>
              {task.id ? "Lưu hạng mục" : "Thêm hạng mục"}
            </button>
          </form>
        ) : null}
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3">Hạng mục</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((row) => (
                <TaskLine key={row.name} task={row} admin={admin} onEdit={() => setTask({ id: row.name, code: row.code || "", subject: row.subject })} onDelete={() => void remove("task", row.name)} />
              ))}
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-slate-500">Chưa có hạng mục.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Công việc và khối lượng</h3>
        {admin ? (
          <form onSubmit={onSaveBoq} className="grid gap-3 md:grid-cols-6">
            <select className={fieldClass} value={boq.task_id} onChange={(e) => setBoq({ ...boq, task_id: e.target.value })}>
              <option value="">Hạng mục</option>
              {tasks.map((row) => (
                <option key={row.name} value={row.name}>{row.subject}</option>
              ))}
            </select>
            <input className={fieldClass} placeholder="Mã" value={boq.code} onChange={(e) => setBoq({ ...boq, code: e.target.value })} required />
            <input className={fieldClass} placeholder="Tên công việc" value={boq.description} onChange={(e) => setBoq({ ...boq, description: e.target.value })} required />
            <input className={fieldClass} placeholder="ĐVT" value={boq.unit} onChange={(e) => setBoq({ ...boq, unit: e.target.value })} />
            <input className={fieldClass} placeholder="KL kế hoạch" inputMode="decimal" value={boq.planned_qty} onChange={(e) => setBoq({ ...boq, planned_qty: e.target.value })} />
            <input className={fieldClass} placeholder="Đơn giá" inputMode="decimal" value={boq.rate} onChange={(e) => setBoq({ ...boq, rate: e.target.value })} />
            <button className="min-h-11 rounded-xl bg-amber-500 text-sm font-semibold text-slate-900 md:col-span-6" disabled={saving}>
              {boq.id ? "Lưu công việc" : "Thêm công việc"}
            </button>
          </form>
        ) : null}
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Mã</th>
                <th className="px-3 py-3">Công việc</th>
                <th className="px-3 py-3">ĐVT</th>
                <th className="px-3 py-3 text-right">Kế hoạch</th>
                <th className="px-3 py-3 text-right">Đơn giá</th>
                <th className="px-3 py-3 text-right">Thành tiền</th>
                <th className="px-3 py-3 text-right">Đã làm</th>
                <th className="px-3 py-3 text-right">Nghiệm thu</th>
                <th className="px-3 py-3 text-right">Còn lại</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <BoqLine
                  key={item.name}
                  item={item}
                  admin={admin}
                  onEdit={() =>
                    setBoq({
                      id: item.name,
                      code: item.code || "",
                      description: item.description || "",
                      unit: item.unit || "",
                      planned_qty: String(item.planned_qty || 0),
                      rate: String(item.rate || 0),
                      task_id: item.task || "",
                    })
                  }
                  onDelete={() => void remove("boq", item.name)}
                />
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-slate-500">Chưa có công việc.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TaskLine({ task, admin, onEdit, onDelete }: { task: TaskRow; admin: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 font-medium">{task.code}</td>
      <td className="px-4 py-3">{task.subject}</td>
      <td className="px-4 py-3 text-right">
        {admin ? (
          <span className="space-x-3">
            <button type="button" onClick={onEdit} className="font-semibold text-amber-700">Sửa</button>
            <button type="button" onClick={onDelete} className="font-semibold text-red-700">Xóa</button>
          </span>
        ) : null}
      </td>
    </tr>
  );
}

function BoqLine({
  item,
  admin,
  onEdit,
  onDelete,
}: {
  item: BoqItemRow;
  admin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const planned = Number(item.planned_qty || 0);
  const rate = Number(item.rate || 0);
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-3 py-3 font-medium">{item.code}</td>
      <td className="px-3 py-3">{item.description}</td>
      <td className="px-3 py-3">{item.unit || "—"}</td>
      <td className="px-3 py-3 text-right">{qty(planned)}</td>
      <td className="px-3 py-3 text-right">{money(rate)}</td>
      <td className="px-3 py-3 text-right">{money(planned * rate)}</td>
      <td className="px-3 py-3 text-right">{qty(Number(item.executed_qty || 0))}</td>
      <td className="px-3 py-3 text-right">{qty(Number(item.accepted_qty || 0))}</td>
      <td className="px-3 py-3 text-right">{qty(Number(item.remaining_qty || 0))}</td>
      <td className="px-3 py-3 text-right">
        {admin ? (
          <span className="space-x-3">
            <button type="button" onClick={onEdit} className="font-semibold text-amber-700">Sửa</button>
            <button type="button" onClick={onDelete} className="font-semibold text-red-700">Xóa</button>
          </span>
        ) : null}
      </td>
    </tr>
  );
}
