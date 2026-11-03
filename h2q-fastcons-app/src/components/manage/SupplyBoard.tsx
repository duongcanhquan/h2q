"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
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
  variance_qty: number;
  variance_amount: number;
};
type Project = { code: string; name: string };
const field = "min-h-11 w-full rounded-xl border border-stone-300/80 bg-white/80 px-3 shadow-none";
const money = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n || 0);

export function SupplyBoard() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState({ name: "", tax_code: "", phone: "", trade: "" });
  const [price, setPrice] = useState({ supplier_id: "", name: "", unit: "", price: "", effective_on: "" });
  const [use, setUse] = useState({ project_code: "", material_price_id: "", planned_qty: "", used_qty: "" });

  async function reload() {
    const [res, session] = await Promise.all([
      fetch("/api/registers/supply", { credentials: "include" }),
      fetch("/api/auth/session", { credentials: "include" }),
    ]);
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      suppliers?: Supplier[];
      prices?: Price[];
      controls?: Control[];
      projects?: Project[];
    };
    if (!res.ok) throw new ApiError(data.message || "Không tải được vật tư.", res.status);
    const who = (await session.json().catch(() => ({}))) as { app_role?: string };
    setSuppliers(data.suppliers || []);
    setPrices(data.prices || []);
    setControls(data.controls || []);
    setProjects(data.projects || []);
    setAdmin(who.app_role === "admin");
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được vật tư.")).finally(() => setLoading(false));
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
    await reload();
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
    try { await post(use); setUse({ ...use, planned_qty: "", used_qty: "" }); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Không lưu được kiểm soát."); }
  }

  if (loading) return <p className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Đang tải vật tư…</p>;

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} /> : null}
      {admin ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <form onSubmit={onSupplier} className="grid gap-3 rounded-2xl p-4">
            <h2>Nhà cung cấp</h2>
            <input className={field} required placeholder="Tên" value={supplier.name} onChange={(e) => setSupplier({ ...supplier, name: e.target.value })} />
            <input className={field} placeholder="Ngành hàng" value={supplier.trade} onChange={(e) => setSupplier({ ...supplier, trade: e.target.value })} />
            <input className={field} placeholder="Mã số thuế" value={supplier.tax_code} onChange={(e) => setSupplier({ ...supplier, tax_code: e.target.value })} />
            <input className={field} placeholder="Điện thoại" value={supplier.phone} onChange={(e) => setSupplier({ ...supplier, phone: e.target.value })} />
            <button className="min-h-11 rounded-xl bg-stone-900 font-medium text-white shadow-none">Thêm nhà cung cấp</button>
          </form>
          <form onSubmit={onPrice} className="grid gap-3 rounded-2xl p-4">
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
          <form onSubmit={onUse} className="grid gap-3 rounded-2xl p-4">
            <h2>Kiểm soát dùng vật tư</h2>
            <select className={field} required value={use.project_code} onChange={(e) => setUse({ ...use, project_code: e.target.value })}>
              <option value="">Công trình</option>
              {projects.map((row) => <option key={row.code} value={row.code}>{row.code} · {row.name}</option>)}
            </select>
            <select className={field} required value={use.material_price_id} onChange={(e) => setUse({ ...use, material_price_id: e.target.value })}>
              <option value="">Nguyên liệu</option>
              {prices.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            <input className={field} placeholder="Định mức" value={use.planned_qty} onChange={(e) => setUse({ ...use, planned_qty: e.target.value })} />
            <input className={field} placeholder="Đã dùng" value={use.used_qty} onChange={(e) => setUse({ ...use, used_qty: e.target.value })} />
            <button className="min-h-11 rounded-xl bg-stone-900 font-medium text-white shadow-none">Ghi kiểm soát</button>
          </form>
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <Table title="Bảng giá" headers={["Nguyên liệu", "Nhà cung cấp", "Đơn giá", "Hiệu lực"]}>
          {prices.map((row) => (
            <tr key={row.id} className="border-b border-white/50">
              <td className="px-3 py-3">{row.name} {row.unit ? `· ${row.unit}` : ""}</td>
              <td className="px-3 py-3">{row.supplier_name || "—"}</td>
              <td className="px-3 py-3 text-right">{money(Number(row.price))}</td>
              <td className="px-3 py-3">{String(row.effective_on).slice(0, 10)}</td>
            </tr>
          ))}
        </Table>
        <Table title="Lệch định mức" headers={["Công trình", "Vật tư", "Định mức", "Đã dùng", "Lệch tiền"]}>
          {controls.map((row) => (
            <tr key={row.id} className="border-b border-white/50">
              <td className="px-3 py-3">{row.project_code}</td>
              <td className="px-3 py-3">{row.material}</td>
              <td className="px-3 py-3 text-right">{row.planned_qty}</td>
              <td className="px-3 py-3 text-right">{row.used_qty}</td>
              <td className="px-3 py-3 text-right">{money(row.variance_amount)}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

function Table({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl">
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
