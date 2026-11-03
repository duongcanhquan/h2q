"use client";

import { useEffect, useState } from "react";
import { DeskTabs } from "@/components/ui/DeskTabs";
import { getJson, invalidate } from "@/lib/api/cache";

type Project = { id: string; code: string; name: string; contract_role: string };
type Crew = { id: string; name: string; leader: string | null; phone: string | null };
type Job = { id: string; title: string; cost: number; status: string; project_code: string; crew_name: string; package_name: string; package_budget: number; task_subject: string; work_package_id: string | null };
type Pack = { id: string; code: string; name: string; budget: number; project_code: string };
type Task = { id: string; code: string; subject: string; project_code: string };
type Account = { id: string; full_name: string | null; email: string | null };
type Presence = { id: string; project_code: string; worker_name: string; task_subject: string; work_date: string; status: string };
type Machine = { id: string; code: string; name: string; kind: string | null; status: string; project_code: string };
type Worker = { id: string; full_name: string; role_title: string | null; phone: string | null; photo_url: string | null; crew_name: string };

const ROLES = [
  ["tong_thau", "Tổng thầu"],
  ["thau_van_hanh", "Thầu vận hành chính"],
] as const;

function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value || 0);
}

export function ControlBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [equipment, setEquipment] = useState<Machine[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [packages, setPackages] = useState<Pack[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [attendance, setAttendance] = useState<Presence[]>([]);
  const [jobProject, setJobProject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(force = false) {
    const entry = await getJson("/api/registers/control", force);
    const body = entry.body as {
      message?: string;
      projects?: Project[];
      crews?: Crew[];
      jobs?: Job[];
      equipment?: Machine[];
      workers?: Worker[];
      packages?: Pack[];
      tasks?: Task[];
      accounts?: Account[];
      attendance?: Presence[];
    };
    if (!entry.ok) {
      setMessage(body.message || "Chưa có bảng điều hành. Chạy SQL mới trong Supabase.");
      return;
    }
    setProjects(body.projects || []);
    setCrews(body.crews || []);
    setJobs(body.jobs || []);
    setEquipment(body.equipment || []);
    setWorkers(body.workers || []);
    setPackages(body.packages || []);
    setTasks(body.tasks || []);
    setAccounts(body.accounts || []);
    setAttendance(body.attendance || []);
    setMessage("");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch("/api/registers/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(body.message || "Không lưu được.");
      return false;
    }
    invalidate("/api/registers/control");
    await load(true);
    return true;
  }

  const costByProject = new Map<string, number>();
  for (const job of jobs) costByProject.set(job.project_code, (costByProject.get(job.project_code) || 0) + Number(job.cost || 0));

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{message}</p> : null}
      <p className="text-sm text-slate-700">Chọn một tab. Vai trò, đội, máy và điểm danh là bốn sổ riêng của cùng công trình.</p>
      <DeskTabs tabs={["Vai trò", "Đội và việc", "Máy và người", "Có mặt"]}>
      {[
      <section key="role" className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-900">Vai trò trên từng công trình</h2>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {projects.map((project) => (
            <label key={project.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="min-w-0">
                <b className="block truncate">{project.code}</b>
                <span className="block truncate text-sm text-slate-600">{project.name}</span>
              </span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                value={project.contract_role || "tong_thau"}
                disabled={busy}
                onChange={(event) => void send({ kind: "role", project_code: project.code, contract_role: event.target.value })}
              >
                {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>,

      <div key="jobs" className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <form className="rounded-xl bg-white p-4 ring-1 ring-slate-200" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const form = event.currentTarget;
          void send({ kind: "crew", name: data.get("name"), leader: data.get("leader"), phone: data.get("phone") }).then((ok) => { if (ok) form.reset(); });
        }}>
          <h2 className="font-semibold">Đội thi công</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input name="name" required placeholder="Tên đội" className="rounded-xl border border-slate-200 px-3 py-2" />
            <input name="leader" placeholder="Đội trưởng" className="rounded-xl border border-slate-200 px-3 py-2" />
            <input name="phone" placeholder="Điện thoại" className="rounded-xl border border-slate-200 px-3 py-2" />
          </div>
          <button disabled={busy} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Thêm đội</button>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {crews.map((crew) => <li key={crew.id}>{crew.name}{crew.leader ? ` · ${crew.leader}` : ""}{crew.phone ? ` · ${crew.phone}` : ""}</li>)}
          </ul>
        </form>

        <form className="rounded-2xl bg-white p-4 ring-1 ring-slate-200" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const form = event.currentTarget;
          void send({ kind: "job", project_code: data.get("project_code"), crew_id: data.get("crew_id"), task_id: data.get("task_id"), work_package_id: data.get("work_package_id"), title: data.get("title"), cost: data.get("cost") }).then((ok) => { if (ok) { form.reset(); setJobProject(""); } });
        }}>
          <h2 className="font-semibold">Giao gói nhỏ cho đội</h2>
          <p className="mt-1 text-sm text-slate-600">Việc phải thuộc một hạng mục của công trình. Chi phí của đội đứng riêng, để so với ngân sách gói việc.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select name="project_code" required className="rounded-xl border border-slate-200 px-3 py-2" onChange={(event) => setJobProject(event.target.value)}>
              <option value="">Công trình</option>
              {projects.map((project) => <option key={project.id} value={project.code}>{project.code}</option>)}
            </select>
            <select name="crew_id" required className="rounded-xl border border-slate-200 px-3 py-2">
              <option value="">Đội</option>
              {crews.map((crew) => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
            </select>
            <select name="task_id" required className="rounded-xl border border-slate-200 px-3 py-2">
              <option value="">Hạng mục</option>
              {tasks.filter((task) => task.project_code === jobProject).map((task) => <option key={task.id} value={task.id}>{task.code} · {task.subject}</option>)}
            </select>
            <select name="work_package_id" className="rounded-xl border border-slate-200 px-3 py-2">
              <option value="">Gói việc</option>
              {packages.filter((item) => item.project_code === jobProject).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
            <input name="title" required placeholder="Việc giao, ví dụ đổ bê tông móng" className="rounded-xl border border-slate-200 px-3 py-2" />
            <input name="cost" type="number" min="0" step="1000" required placeholder="Chi phí giao cho đội" className="rounded-xl border border-slate-200 px-3 py-2" />
          </div>
          <button disabled={busy} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Giao việc</button>
        </form>
      </div>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Chi phí đã giao</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-500"><tr><th className="py-2">Công trình</th><th>Hạng mục</th><th>Gói</th><th>Đội</th><th>Việc</th><th className="text-right">Chi phí đội</th></tr></thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-100">
                  <td className="py-2">{job.project_code}</td>
                  <td>{job.task_subject || "—"}</td>
                  <td>{job.package_name || "—"}</td>
                  <td>{job.crew_name}</td>
                  <td>{job.title}</td>
                  <td className="text-right">{money(job.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {[...costByProject.entries()].map(([code, total]) => (
            <span key={code} className="rounded-full bg-slate-100 px-3 py-1">{code}: {money(total)} đ</span>
          ))}
        </div>
      </section>
      </div>,

      <div key="people" className="grid gap-3 xl:grid-cols-2">
        <form className="rounded-xl bg-white p-4 ring-1 ring-slate-200" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const form = event.currentTarget;
          void send({ kind: "equipment", code: data.get("code"), name: data.get("name"), equipment_kind: data.get("equipment_kind"), project_code: data.get("project_code"), status: data.get("status") }).then((ok) => { if (ok) form.reset(); });
        }}>
          <h2 className="font-semibold">Thiết bị</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input name="code" required placeholder="Mã" className="rounded-xl border border-slate-200 px-3 py-2" />
            <input name="name" required placeholder="Tên máy" className="rounded-xl border border-slate-200 px-3 py-2" />
            <input name="equipment_kind" placeholder="Loại" className="rounded-xl border border-slate-200 px-3 py-2" />
            <select name="project_code" className="rounded-xl border border-slate-200 px-3 py-2">
              <option value="">Chưa gắn công trình</option>
              {projects.map((project) => <option key={project.id} value={project.code}>{project.code}</option>)}
            </select>
            <select name="status" className="rounded-xl border border-slate-200 px-3 py-2">
              <option>Sẵn sàng</option><option>Đang dùng</option><option>Bảo dưỡng</option>
            </select>
          </div>
          <button disabled={busy} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Thêm thiết bị</button>
          <ul className="mt-3 space-y-1 text-sm">
            {equipment.map((item) => <li key={item.id}>{item.code} · {item.name} · {item.status}{item.project_code ? ` · ${item.project_code}` : ""}</li>)}
          </ul>
        </form>

        <WorkerForm crews={crews} accounts={accounts} workers={workers} busy={busy} onSave={send} />
      </div>,
      <AttendanceForm key="attendance" projects={projects} tasks={tasks} crews={crews} workers={workers} rows={attendance} busy={busy} onSave={send} />,
      ]}
      </DeskTabs>
    </div>
  );
}

function WorkerForm({ crews, accounts, workers, busy, onSave }: { crews: Crew[]; accounts: Account[]; workers: Worker[]; busy: boolean; onSave: (payload: Record<string, unknown>) => Promise<boolean | void> }) {
  const [photo, setPhoto] = useState("");
  return (
    <form className="rounded-2xl bg-white p-4 ring-1 ring-slate-200" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const form = event.currentTarget;
      void onSave({ kind: "worker", full_name: data.get("full_name"), role_title: data.get("role_title"), phone: data.get("phone"), crew_id: data.get("crew_id"), profile_id: data.get("profile_id"), photo_url: photo }).then((ok) => {
        if (ok) { setPhoto(""); form.reset(); }
      });
    }}>
      <h2 className="font-semibold">Nhân sự hiện trường</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input name="full_name" required placeholder="Họ tên" className="rounded-xl border border-slate-200 px-3 py-2" />
        <input name="role_title" placeholder="Việc làm" className="rounded-xl border border-slate-200 px-3 py-2" />
        <input name="phone" placeholder="Điện thoại" className="rounded-xl border border-slate-200 px-3 py-2" />
        <select name="crew_id" className="rounded-xl border border-slate-200 px-3 py-2">
          <option value="">Chưa vào đội</option>
          {crews.map((crew) => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
        </select>
        <select name="profile_id" className="rounded-xl border border-slate-200 px-3 py-2 sm:col-span-2">
          <option value="">Chưa gắn tài khoản đăng nhập</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.full_name || account.email}</option>)}
        </select>
        <input type="file" accept="image/*" className="sm:col-span-2 text-sm" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const { compressImageFile } = await import("@/lib/media/compress");
          const slim = await compressImageFile(file);
          const data = new FormData();
          data.set("file", slim);
          const response = await fetch("/api/photos?folder=cong-nhan", { method: "POST", body: data });
          const body = await response.json();
          if (response.ok) setPhoto(body.file_url);
        }} />
      </div>
      {photo ? <img src={photo} alt="Ảnh nhân sự vừa chọn" className="mt-3 h-16 w-16 rounded-xl object-cover" /> : null}
      <button disabled={busy} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Thêm nhân sự</button>
      <p className="mt-2 text-sm text-slate-500">Ảnh được thu nhỏ trước khi lưu.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {workers.map((worker) => (
          <div key={worker.id} className="rounded-xl bg-slate-50 p-2 text-sm">
            {worker.photo_url ? <img src={worker.photo_url} alt={worker.full_name} className="mb-2 h-20 w-full rounded-lg object-cover" /> : null}
            <b className="block">{worker.full_name}</b>
            <span className="text-slate-600">{worker.role_title || "Nhân sự"}{worker.crew_name ? ` · ${worker.crew_name}` : ""}</span>
          </div>
        ))}
      </div>
    </form>
  );
}

function AttendanceForm({ projects, tasks, crews, workers, rows, busy, onSave }: {
  projects: Project[];
  tasks: Task[];
  crews: Crew[];
  workers: Worker[];
  rows: Presence[];
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean | void>;
}) {
  const [project, setProject] = useState("");
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <h2 className="font-semibold">Có mặt theo ngày và hạng mục</h2>
      <p className="mt-1 text-sm text-slate-600">Cùng một người, một công trình, một ngày thì lần ghi sau cập nhật lần trước.</p>
      <form className="mt-3 grid gap-2 lg:grid-cols-3" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void onSave({
          kind: "attendance",
          project_code: data.get("project_code"),
          task_id: data.get("task_id"),
          crew_id: data.get("crew_id"),
          worker_id: data.get("worker_id"),
          work_date: data.get("work_date"),
          status: data.get("status"),
        });
      }}>
        <select name="project_code" required className="rounded-xl border border-slate-200 px-3 py-2" onChange={(event) => setProject(event.target.value)}>
          <option value="">Công trình</option>
          {projects.map((item) => <option key={item.id} value={item.code}>{item.code}</option>)}
        </select>
        <select name="task_id" className="rounded-xl border border-slate-200 px-3 py-2">
          <option value="">Hạng mục</option>
          {tasks.filter((task) => task.project_code === project).map((task) => <option key={task.id} value={task.id}>{task.subject}</option>)}
        </select>
        <select name="crew_id" className="rounded-xl border border-slate-200 px-3 py-2">
          <option value="">Đội</option>
          {crews.map((crew) => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
        </select>
        <select name="worker_id" required className="rounded-xl border border-slate-200 px-3 py-2">
          <option value="">Nhân sự</option>
          {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.full_name}</option>)}
        </select>
        <input name="work_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-xl border border-slate-200 px-3 py-2" />
        <select name="status" className="rounded-xl border border-slate-200 px-3 py-2">
          <option>Có mặt</option><option>Nửa ngày</option><option>Vắng</option>
        </select>
        <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Ghi có mặt</button>
      </form>
      <ul className="mt-3 space-y-1 text-sm text-slate-700">
        {rows.map((row) => <li key={row.id}>{row.work_date} · {row.project_code} · {row.worker_name} · {row.status}{row.task_subject ? ` · ${row.task_subject}` : ""}</li>)}
      </ul>
    </section>
  );
}
