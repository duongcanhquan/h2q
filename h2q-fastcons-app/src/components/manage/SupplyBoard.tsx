"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/errors";
import { getJson, invalidate } from "@/lib/api/cache";
import { DeskTabs } from "@/components/ui/DeskTabs";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type Supplier = { id: string; name: string; tax_code: string | null; phone: string | null; trade: string | null };
type Price = { id: string; name: string; unit: string | null; price: number; effective_on: string; supplier_name: string };
type Control = {
  id: string;
  material: string;
  unit: string;
  project_code: string;
  supplier_name: string;
  planned_qty: number;
  used_qty: number;
  task_subject?: string;
  variance_qty: number;
  variance_amount: number;
};
type Project = { code: string; name: string };
type Task = { id: string; code: string; subject: string; project_code: string };
const field = "field text-sm";
const money = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n || 0);

export function SupplyBoard() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [supplier, setSupplier] = useState({ name: "", tax_code: "", phone: "", trade: "" });
  const [price, setPrice] = useState({ supplier_id: "", name: "", unit: "", price: "", effective_on: "" });
  const [use, setUse] = useState({ project_code: "", task_id: "", material_price_id: "", planned_qty: "", used_qty: "" });

  async function reload(force = false) {
    const [supply, session] = await Promise.all([
      getJson("/api/registers/supply", force),
      getJson("/api/auth/session", force),
    ]);
    const data = (supply.body || {}) as {
      message?: string;
      suppliers?: Supplier[];
      prices?: Price[];
      controls?: Control[];
      projects?: Project[];
      tasks?: Task[];
    };
    if (!supply.ok) throw new ApiError(data.message || "Không tải được vật tư.", supply.status);
    const who = (session.body || {}) as { app_role?: string };
    setSuppliers(data.suppliers || []);
    setPrices(data.prices || []);
    setControls(data.controls || []);
    setProjects(data.projects || []);
    setTasks(data.tasks || []);
    setAdmin(who.app_role === "admin");
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được vật tư."));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  async function post(body: unknown) {
    const res = await fetch("/api/registers/supply", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new ApiError(data.message || "Không lưu được.", res.status);
    invalidate("/api/registers/supply");
    await reload(true);
  }

  async function onSupplier(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await post({ kind: "supplier", ...supplier }); setSupplier({ name: "", tax_code: "", phone: "", trade: "" }); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Không lưu được nhà cung cấp."); }
  }
  async function onPrice(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await post({ kind: "price", ...price }); setPrice({ ...price, name: "", price: "" }); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Không lưu được giá."); }
  }
  async function onUse(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await post({ kind: "use", ...use }); setUse({ ...use, planned_qty: "", used_qty: "" }); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Không lưu được kiểm soát."); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">Sổ này chỉ có nhà cung cấp và giá chào. Giá không cộng tồn. Số lượng và tiền hàng thật nằm ở Kho.</p>
      {error ? <ErrorBanner message={error} /> : null}
      <DeskTabs tabs={["Nhập", "Bảng số"]}>
      {[
      admin ? (
        <div key="forms" className="grid gap-3 xl:grid-cols-3">
          <form onSubmit={onSupplier} className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <h2>Nhà cung cấp</h2>
            <input className={field} required placeholder="Tên" value={supplier.name} onChange={(e) => setSupplier({ ...supplier, name: e.target.value })} />
            <input className={field} placeholder="Ngành hàng" value={supplier.trade} onChange={(e) => setSupplier({ ...supplier, trade: e.target.value })} />
            <input className={field} placeholder="Mã số thuế" value={supplier.tax_code} onChange={(e) => setSupplier({ ...supplier, tax_code: e.target.value })} />
            <input className={field} placeholder="Điện thoại" value={supplier.phone} onChange={(e) => setSupplier({ ...supplier, phone: e.target.value })} />
            <button className="min-h-11 rounded-xl bg-stone-900 font-medium text-white shadow-none">Thêm nhà cung cấp</button>
          </form>
          <form onSubmit={onPrice} className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <h2>Giá nguyên liệu</h2>
            <select className={field} value={price.supplier_id} onChange={(e) => setPrice({ ...price, supplier_id: e.target.value })}>
              <option value="">Nhà cung cấp</option>
              {suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            <input className={field} required placeholder="Tên nguyên liệu" value={price.name} onChange={(e) => setPrice({ ...price, name: e.target.value })} />
            <input className={field} placeholder="Đơn vị" value={price.unit} onChange={(e) => setPrice({ ...price, unit: e.target.value })} />
            <input className={field} required placeholder="Đơn giá" value={price.price} onChange={(e) => setPrice({ ...price, price: e.target.value })} />
            <input className={field} type="date" value={price.effective_on} onChange={(e) => setPrice({ ...price, effective_on: e.target.value })} />
            <button className="min-h-11 rounded-xl bg-amber-500 font-medium text-stone-900 shadow-none">Nhập giá</button>
          </form>
          <form onSubmit={onUse} className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <h2>Định mức cho phép</h2>
            <select className={field} required value={use.project_code} onChange={(e) => setUse({ ...use, project_code: e.target.value, task_id: "" })}>
              <option value="">Công trình</option>
              {projects.map((row) => <option key={row.code} value={row.code}>{row.code} · {row.name}</option>)}
            </select>
            <select className={field} value={use.task_id} onChange={(e) => setUse({ ...use, task_id: e.target.value })}>
              <option value="">Hạng mục</option>
              {tasks.filter((task) => task.project_code === use.project_code).map((task) => <option key={task.id} value={task.id}>{task.code} · {task.subject}</option>)}
            </select>
            <select className={field} required value={use.material_price_id} onChange={(e) => setUse({ ...use, material_price_id: e.target.value })}>
              <option value="">Nguyên liệu</option>
              {prices.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            <input className={field} placeholder="Số lượng được phép" value={use.planned_qty} onChange={(e) => setUse({ ...use, planned_qty: e.target.value })} />
            <button className="min-h-11 rounded-xl bg-stone-900 font-medium text-white shadow-none">Ghi định mức</button>
          </form>
        </div>
      ) : <p key="wait" className="rounded-xl bg-white p-4 text-sm ring-1 ring-slate-200">Chỉ người quản trị nhập nhà cung cấp và giá. Bảng số ở tab bên cạnh.</p>,
      <div key="tables" className="grid gap-3 xl:grid-cols-2">
        <Table title="Bảng giá" headers={["Nguyên liệu", "Nhà cung cấp", "Đơn giá", "Hiệu lực"]}>
          {prices.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-3 py-3">{row.name} {row.unit ? `· ${row.unit}` : ""}</td>
              <td className="px-3 py-3">{row.supplier_name || "—"}</td>
              <td className="px-3 py-3 text-right">{money(Number(row.price))}</td>
              <td className="px-3 py-3">{String(row.effective_on).slice(0, 10)}</td>
            </tr>
          ))}
        </Table>
        <Table title="Định mức theo hạng mục" headers={["Công trình", "Hạng mục", "Vật tư", "Được phép", "Ước lượng cũ"]}>
          {controls.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-3 py-3">{row.project_code}</td>
              <td className="px-3 py-3">{row.task_subject || "—"}</td>
              <td className="px-3 py-3">{row.material}</td>
              <td className="px-3 py-3 text-right">{row.planned_qty}</td>
              <td className="px-3 py-3 text-right">{row.used_qty || "—"}</td>
            </tr>
          ))}
        </Table>
      </div>,
      ]}
      </DeskTabs>
    </div>
  );
}

function Table({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
      <h2 className="px-3 pt-3">{title}</h2>
      <table className="min-w-full">
        <thead>
          <tr>{headers.map((header) => <th key={header} className="px-3 py-3 text-left font-medium text-stone-600">{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
