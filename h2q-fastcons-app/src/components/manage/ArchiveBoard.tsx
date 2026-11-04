"use client";

import { useEffect, useState } from "react";
import { DeskTabs } from "@/components/ui/DeskTabs";
import { getJson, invalidate } from "@/lib/api/cache";

type Project = { code: string; name: string };
type Task = { id: string; code: string | null; subject: string };
type Doc = { id: string; kind: string; title: string; file_url: string; note: string | null; taken_on: string; task_id: string | null };
type Person = { id: string; full_name: string };
type Material = { id: string; name: string };
type Machine = { id: string; code: string; name: string };

const KINDS = [
  ["tien_do", "Tiến độ hạng mục"],
  ["cong_trinh", "Ảnh công trình"],
  ["vat_lieu", "Ảnh vật liệu"],
  ["cong_nhan", "Ảnh công nhân"],
  ["hoa_don", "Hóa đơn"],
  ["tep", "Tệp khác"],
];

export function ArchiveBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState("");
  const [taskId, setTaskId] = useState("");
  const [rows, setRows] = useState<Doc[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    let fallbackId: number | null = null;

    void getJson("/api/projects?all=1&lite=1").then((entry) => {
      if (cancelled) return;
      const body = entry.body as { projects?: { name: string; project_name: string }[] };
      const rows = body.projects || [];
      setProjects(rows.map((row) => ({ code: row.name, name: row.project_name })));
    });

    const loadExtras = () => {
      if (cancelled) return;
      void getJson("/api/registers/control").then((entry) => {
        if (cancelled) return;
        const body = entry.body as { workers?: Person[]; equipment?: Machine[] };
        setPeople(body.workers || []);
        setMachines(body.equipment || []);
      });
      void getJson("/api/registers/supply").then((entry) => {
        if (cancelled) return;
        const body = entry.body as { prices?: Material[] };
        setMaterials(body.prices || []);
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(loadExtras);
    } else {
      fallbackId = window.setTimeout(loadExtras, 500);
    }

    return () => {
      cancelled = true;
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (fallbackId != null) window.clearTimeout(fallbackId);
    };
  }, []);

  useEffect(() => {
    if (!project) return;
    const timer = window.setTimeout(() => {
      void getJson(`/api/projects/${encodeURIComponent(project)}/wbs`).then((entry) => {
        const body = entry.body as { tasks?: { name: string; code: string | null; subject: string }[] };
        const rows = body.tasks || [];
        setTasks(rows.map((task) => ({ id: task.name, code: task.code, subject: task.subject })));
      });
      void getJson(`/api/documents?project=${encodeURIComponent(project)}`).then((entry) => {
        const body = entry.body as { message?: string; rows?: Doc[] };
        if (!entry.ok) setMessage(body.message || "Chưa có sổ hồ sơ. Chạy SQL mới trong Supabase.");
        else { setRows(body.rows || []); setMessage(""); }
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [project]);

  const byDay = new Map<string, Doc[]>();
  for (const row of rows) {
    const day = row.taken_on || "";
    byDay.set(day, [...(byDay.get(day) || []), row]);
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{message}</p> : null}
      <DeskTabs tabs={["Tải hồ sơ", "Ảnh theo ngày"]}>
      {[
      <form key="upload" className="rounded-xl bg-white p-4 ring-1 ring-slate-200" onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const file = data.get("file");
        if (file instanceof File && file.type.startsWith("image/")) {
          const { compressImageFile } = await import("@/lib/media/compress");
          const slim = await compressImageFile(file);
          data.set("file", slim);
        }
        setBusy(true);
        const response = await fetch("/api/documents", { method: "POST", body: data });
        const body = await response.json();
        setBusy(false);
        if (!response.ok) { setMessage(body.message || "Không lưu được tệp."); return; }
        form.reset();
        invalidate(`/api/documents?project=${encodeURIComponent(project)}`);
        const fresh = await getJson(`/api/documents?project=${encodeURIComponent(project)}`, true);
        const next = fresh.body as { rows?: Doc[] };
        setRows(next.rows || []);
        setMessage(body.store === "r2" ? "Đã lưu lên R2." : "Đã lưu. Chưa có biến R2 nên tệp nằm trong Supabase, cùng thư mục logic.");
      }}>
        <h2 className="font-semibold">Ảnh và tệp theo hạng mục</h2>
        <p className="mt-1 text-sm text-slate-600">Chọn đúng ngày và hạng mục. Tệp được xếp thư mục theo loại và ngày: vật liệu, công nhân, công trình, tiến độ, hóa đơn.</p>
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          <select name="project_code" required value={project} onChange={(event) => { setProject(event.target.value); setTaskId(""); }} className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">Công trình</option>
            {projects.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
          </select>
          <select name="task_id" value={taskId} onChange={(event) => setTaskId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">Hạng mục</option>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.code || ""} {task.subject}</option>)}
          </select>
          <select name="worker_id" className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">Nhân sự trong ảnh</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </select>
          <select name="material_price_id" className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">Vật tư trong ảnh</option>
            {materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select name="equipment_id" className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">Thiết bị trong ảnh</option>
            {machines.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </select>
          <select name="kind" className="rounded-xl border border-slate-200 px-3 py-2">
            {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input name="taken_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-xl border border-slate-200 px-3 py-2" />
          <input name="title" required placeholder="Tiêu đề, ví dụ ảnh đổ bê tông sáng" className="rounded-xl border border-slate-200 px-3 py-2 lg:col-span-2" />
          <input name="note" placeholder="Ghi chú" className="rounded-xl border border-slate-200 px-3 py-2 lg:col-span-2" />
          <input name="file" type="file" required accept="image/*,.pdf" className="text-sm" />
        </div>
        <button disabled={busy} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Lưu hồ sơ</button>
      </form>,
      <div key="days" className="space-y-3">
      {rows.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm ring-1 ring-slate-200">Chưa có ảnh. Chọn công trình ở tab Tải hồ sơ.</p> : null}
      {[...byDay.entries()].map(([day, items]) => (
        <section key={day} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="font-semibold">{day}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => {
              const task = tasks.find((row) => row.id === item.task_id);
              const image = /\.(png|jpe?g|webp|gif)$/i.test(item.file_url);
              return (
                <a key={item.id} href={item.file_url} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-50 p-2">
                  {image ? <img src={item.file_url} alt={item.title} className="h-36 w-full rounded-lg object-cover" /> : <div className="flex h-36 items-center justify-center rounded-lg bg-slate-200 text-sm">Tệp</div>}
                  <b className="mt-2 block text-sm">{item.title}</b>
                  <span className="text-sm text-slate-600">{KINDS.find(([value]) => value === item.kind)?.[1]}{task ? ` · ${task.subject}` : ""}</span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
      </div>,
      ]}
      </DeskTabs>
    </div>
  );
}
