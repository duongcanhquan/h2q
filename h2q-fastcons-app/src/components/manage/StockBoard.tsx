"use client";

import { FormEvent, useEffect, useState } from "react";
import { DeskTabs } from "@/components/ui/DeskTabs";
import { getJson, invalidate } from "@/lib/api/cache";

type Place = { id: string; code: string; name: string; kind: string };
type Item = { id: string; code: string; name: string; kind: string; unit: string };
type Party = { id: string; name: string };
type Project = { id: string; code: string; name: string };
type Task = { id: string; code: string; subject: string; project_code: string };
type Person = { id: string; full_name: string };
type Balance = { place: string; place_name: string; item: string; item_kind: string; unit: string; qty: number; value: number };
type Slip = {
  id: string;
  code: string;
  kind: string;
  move_date: string;
  item: string;
  unit: string;
  qty: number;
  amount: number;
  place: string;
  destination: string;
  supplier: string;
  project: string;
  task: string;
  receiver: string;
};
type Line = { item_id: string; qty: string; unit_cost: string };

const KINDS = [
  ["nhap", "Nhập hàng"],
  ["xuat", "Xuất bàn giao"],
  ["chuyen", "Chuyển kho"],
] as const;
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(Math.round(value || 0));
const field = "field text-sm";

export function StockBoard() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<Person[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [journal, setJournal] = useState<Slip[]>([]);
  const [receiptMoney, setReceiptMoney] = useState(0);
  const [moveKind, setMoveKind] = useState<"nhap" | "xuat" | "chuyen">("nhap");
  const [projectId, setProjectId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ item_id: "", qty: "", unit_cost: "" }]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(force = false) {
    const entry = await getJson("/api/registers/stock", force);
    const body = entry.body as {
      message?: string;
      locations?: Place[];
      items?: Item[];
      suppliers?: Party[];
      projects?: Project[];
      tasks?: Task[];
      workers?: Person[];
      balances?: Balance[];
      journal?: Slip[];
      receipt_money?: number;
    };
    if (!entry.ok) {
      setMessage(body.message || "Chưa có sổ kho. Chạy SQL kho trong Supabase.");
      return;
    }
    setPlaces(body.locations || []);
    setItems(body.items || []);
    setSuppliers(body.suppliers || []);
    setProjects(body.projects || []);
    setTasks(body.tasks || []);
    setWorkers(body.workers || []);
    setBalances(body.balances || []);
    setJournal(body.journal || []);
    setReceiptMoney(Number(body.receipt_money) || 0);
    setMessage("");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch("/api/registers/stock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(body.message || "Không ghi được.");
      return false;
    }
    invalidate("/api/registers/stock");
    await load(true);
    return true;
  }

  async function onMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const project = projects.find((row) => row.id === String(data.get("project_id") || ""));
    const ok = await send({
      move_kind: moveKind,
      location_id: data.get("location_id"),
      to_location_id: data.get("to_location_id"),
      supplier_id: data.get("supplier_id"),
      project_id: project?.id || "",
      task_id: data.get("task_id"),
      receiver_worker_id: data.get("receiver_worker_id"),
      receiver_name: data.get("receiver_name"),
      move_date: data.get("move_date"),
      note: data.get("note"),
      lines: lines.filter((line) => line.item_id && Number(line.qty) > 0).map((line) => ({
        item_id: line.item_id,
        qty: Number(line.qty),
        unit_cost: Number(line.unit_cost || 0),
      })),
    });
    if (ok) {
      event.currentTarget.reset();
      setLines([{ item_id: "", qty: "", unit_cost: "" }]);
      setProjectId("");
    }
  }

  const projectCode = projects.find((row) => row.id === projectId)?.code || "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Kho không sửa số tồn bằng tay. Nhập hàng mới cộng tiền và số lượng. Xuất phải đủ tồn, ghi công trình và người nhận. Giá chào ở màn Vật tư không làm tăng kho.</p>
      {message ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{message}</p> : null}
      <p className="rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200">Tổng tiền đã nhập hàng: <b>{money(receiptMoney)} đ</b></p>
      <DeskTabs tabs={["Địa điểm và hàng", "Phiếu kho", "Tồn", "Sổ phiếu"]}>
      {[
      <div key="places" className="grid gap-3 xl:grid-cols-2">
        <form className="rounded-2xl bg-white p-4 ring-1 ring-slate-200" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const form = event.currentTarget;
          void send({ kind: "location", code: data.get("code"), name: data.get("name"), place_kind: data.get("place_kind"), note: data.get("note") }).then((ok) => { if (ok) form.reset(); });
        }}>
          <h2 className="font-semibold">Địa điểm hoạt động</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input name="code" required placeholder="Mã, ví dụ KHO-1" className={field} />
            <input name="name" required placeholder="Tên kho hoặc công trường" className={field} />
            <select name="place_kind" className={field}><option value="kho">Kho cơ sở</option><option value="cong_truong">Kho công trường</option></select>
            <input name="note" placeholder="Ghi chú" className={field} />
          </div>
          <button disabled={busy} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Thêm địa điểm</button>
          <ul className="mt-3 space-y-1 text-sm">{places.map((place) => <li key={place.id}>{place.code} · {place.name} · {place.kind === "cong_truong" ? "Công trường" : "Kho cơ sở"}</li>)}</ul>
        </form>

        <form className="rounded-2xl bg-white p-4 ring-1 ring-slate-200" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const form = event.currentTarget;
          void send({ kind: "item", code: data.get("code"), name: data.get("name"), unit: data.get("unit"), item_kind: data.get("item_kind") }).then((ok) => { if (ok) form.reset(); });
        }}>
          <h2 className="font-semibold">Vật liệu và công cụ</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input name="code" required placeholder="Mã hàng" className={field} />
            <input name="name" required placeholder="Tên hàng" className={field} />
            <input name="unit" required placeholder="Đơn vị" className={field} />
            <select name="item_kind" className={field}><option value="vat_lieu">Vật liệu</option><option value="cong_cu">Công cụ</option></select>
          </div>
          <button disabled={busy} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Thêm mặt hàng</button>
          <ul className="mt-3 space-y-1 text-sm">{items.map((item) => <li key={item.id}>{item.code} · {item.name} · {item.unit} · {item.kind === "cong_cu" ? "Công cụ" : "Vật liệu"}</li>)}</ul>
        </form>
      </div>,

      <form key="slip" className="rounded-xl bg-white p-4 ring-1 ring-slate-200" onSubmit={onMove}>
        <h2 className="font-semibold">Phiếu kho</h2>
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          <select className={field} value={moveKind} onChange={(event) => setMoveKind(event.target.value as typeof moveKind)}>
            {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="location_id" required className={field}><option value="">Địa điểm nguồn</option>{places.map((place) => <option key={place.id} value={place.id}>{place.code}</option>)}</select>
          <input name="move_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={field} />
          {moveKind === "nhap" ? <select name="supplier_id" required className={field}><option value="">Nhà cung cấp</option>{suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : null}
          {moveKind === "chuyen" ? <select name="to_location_id" required className={field}><option value="">Kho đích</option>{places.map((place) => <option key={place.id} value={place.id}>{place.code}</option>)}</select> : null}
          {moveKind === "xuat" ? (
            <>
              <select name="project_id" required className={field} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">Công trình nhận</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.code}</option>)}
              </select>
              <select name="task_id" className={field}><option value="">Hạng mục</option>{tasks.filter((task) => task.project_code === projectCode).map((task) => <option key={task.id} value={task.id}>{task.subject}</option>)}</select>
              <select name="receiver_worker_id" className={field}><option value="">Nhân sự nhận</option>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.full_name}</option>)}</select>
              <input name="receiver_name" placeholder="Hoặc họ tên người nhận" className={field} />
            </>
          ) : null}
          <input name="note" placeholder="Ghi chú phiếu" className={field} />
        </div>
        <div className="mt-3 space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-3">
              <select className={field} required value={line.item_id} onChange={(event) => setLines(lines.map((row, at) => at === index ? { ...row, item_id: event.target.value } : row))}>
                <option value="">Mặt hàng</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
              </select>
              <input className={field} required type="number" min="0" step="0.001" placeholder="Số lượng" value={line.qty} onChange={(event) => setLines(lines.map((row, at) => at === index ? { ...row, qty: event.target.value } : row))} />
              {moveKind === "nhap" ? <input className={field} required type="number" min="0" step="1" placeholder="Đơn giá nhập" value={line.unit_cost} onChange={(event) => setLines(lines.map((row, at) => at === index ? { ...row, unit_cost: event.target.value } : row))} /> : <span className="self-center text-sm text-slate-500">Giá vốn lấy theo tồn</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className="rounded-xl bg-white px-4 py-2 text-sm ring-1 ring-slate-200" onClick={() => setLines([...lines, { item_id: "", qty: "", unit_cost: "" }])}>Thêm dòng</button>
          <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Ghi phiếu</button>
        </div>
      </form>,

      <section key="stock" className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Tồn theo địa điểm</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-500"><tr><th className="py-2">Địa điểm</th><th>Hàng</th><th>Loại</th><th className="text-right">Số lượng</th><th className="text-right">Giá trị còn</th></tr></thead>
            <tbody>
              {balances.map((row) => (
                <tr key={`${row.place}-${row.item}`} className="border-t border-slate-100">
                  <td className="py-2">{row.place} · {row.place_name}</td>
                  <td>{row.item}</td>
                  <td>{row.item_kind === "cong_cu" ? "Công cụ" : "Vật liệu"}</td>
                  <td className="text-right">{row.qty} {row.unit}</td>
                  <td className="text-right">{money(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>,

      <section key="journal" className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Phiếu gần đây</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-slate-500"><tr><th className="py-2">Số</th><th>Ngày</th><th>Việc</th><th>Hàng</th><th className="text-right">SL</th><th className="text-right">Tiền</th><th>Từ</th><th>Đến</th><th>Ai nhận</th></tr></thead>
            <tbody>
              {journal.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-2">{row.code}</td>
                  <td>{row.move_date}</td>
                  <td>{KINDS.find(([value]) => value === row.kind)?.[1]}</td>
                  <td>{row.item}</td>
                  <td className="text-right">{row.qty} {row.unit}</td>
                  <td className="text-right">{row.kind === "nhap" ? money(row.amount) : ""}</td>
                  <td>{row.place}{row.supplier ? ` · ${row.supplier}` : ""}</td>
                  <td>{row.destination || row.project}{row.task ? ` · ${row.task}` : ""}</td>
                  <td>{row.receiver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>,
      ]}
      </DeskTabs>
    </div>
  );
}
