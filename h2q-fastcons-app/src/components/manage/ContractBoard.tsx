"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type Project = { id: string; code: string; name: string };
type Party = { id: string; name: string; tax_code: string | null; phone: string | null };
type Row = {
  id: string;
  code: string;
  title: string;
  status: string;
  retention_percent: number;
  party_name: string;
  project_code: string;
  contract_value: number;
  retention_amount: number;
  payable: number;
};
const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm";
const money = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n || 0);

export function ContractBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState({ name: "", tax_code: "", phone: "" });
  const [order, setOrder] = useState({ project_code: "", subcontractor_id: "", code: "", title: "", retention_percent: "5", description: "", unit: "", qty: "", rate: "" });

  async function reload() {
    const [res, session] = await Promise.all([
      fetch("/api/registers/contracts", { credentials: "include" }),
      fetch("/api/auth/session", { credentials: "include" }),
    ]);
    const data = (await res.json().catch(() => ({}))) as { message?: string; rows?: Row[]; parties?: Party[]; projects?: Project[] };
    if (!res.ok) throw new ApiError(data.message || "Không tải được giao thầu.", res.status);
    const who = (await session.json().catch(() => ({}))) as { app_role?: string };
    setRows(data.rows || []);
    setParties(data.parties || []);
    setProjects(data.projects || []);
    setAdmin(who.app_role === "admin");
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được giao thầu.")).finally(() => setLoading(false));
  }, []);

  async function post(body: unknown) {
    const res = await fetch("/api/registers/contracts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new ApiError(data.message || "Không lưu được.", res.status);
  }

  async function onParty(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await post({ kind: "party", ...party });
      setParty({ name: "", tax_code: "", phone: "" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được thầu phụ.");
    }
  }

  async function onOrder(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await post(order);
      setOrder({ ...order, code: "", title: "", description: "", qty: "", rate: "" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được hợp đồng.");
    }
  }

  if (loading) return <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" /> Đang tải giao thầu…</p>;

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} /> : null}
      <p className="text-sm text-slate-600">Hợp đồng giao thầu có bảng khối lượng và tỷ lệ giữ lại. Giá trị hợp đồng là tổng dòng. Giữ lại trừ trước khi ra số được thanh toán theo hợp đồng, chưa phải hóa đơn.</p>
      {admin ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <form onSubmit={onParty} className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <h3 className="font-semibold">Thầu phụ</h3>
            <input className={field} placeholder="Tên" required value={party.name} onChange={(e) => setParty({ ...party, name: e.target.value })} />
            <input className={field} placeholder="Mã số thuế" value={party.tax_code} onChange={(e) => setParty({ ...party, tax_code: e.target.value })} />
            <input className={field} placeholder="Điện thoại" value={party.phone} onChange={(e) => setParty({ ...party, phone: e.target.value })} />
            <button className="min-h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white">Thêm thầu phụ</button>
          </form>
          <form onSubmit={onOrder} className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-2">
            <h3 className="font-semibold md:col-span-2">Hợp đồng giao thầu</h3>
            <select className={field} required value={order.project_code} onChange={(e) => setOrder({ ...order, project_code: e.target.value })}>
              <option value="">Công trình</option>
              {projects.map((project) => <option key={project.id} value={project.code}>{project.code}</option>)}
            </select>
            <select className={field} required value={order.subcontractor_id} onChange={(e) => setOrder({ ...order, subcontractor_id: e.target.value })}>
              <option value="">Thầu phụ</option>
              {parties.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            <input className={field} placeholder="Số hợp đồng" required value={order.code} onChange={(e) => setOrder({ ...order, code: e.target.value })} />
            <input className={field} placeholder="Tên hợp đồng" required value={order.title} onChange={(e) => setOrder({ ...order, title: e.target.value })} />
            <input className={field} placeholder="% giữ lại" value={order.retention_percent} onChange={(e) => setOrder({ ...order, retention_percent: e.target.value })} />
            <input className={field} placeholder="Dòng khối lượng" value={order.description} onChange={(e) => setOrder({ ...order, description: e.target.value })} />
            <input className={field} placeholder="ĐVT" value={order.unit} onChange={(e) => setOrder({ ...order, unit: e.target.value })} />
            <input className={field} placeholder="Khối lượng" value={order.qty} onChange={(e) => setOrder({ ...order, qty: e.target.value })} />
            <input className={field} placeholder="Đơn giá" value={order.rate} onChange={(e) => setOrder({ ...order, rate: e.target.value })} />
            <button className="min-h-11 rounded-xl bg-amber-500 text-sm font-semibold text-slate-900 md:col-span-2">Tạo hợp đồng</button>
          </form>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-[860px] w-full text-sm">
          <thead className="border-b text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left">Hợp đồng</th>
              <th className="px-3 py-3 text-left">Thầu phụ</th>
              <th className="px-3 py-3 text-left">Công trình</th>
              <th className="px-3 py-3 text-right">Giá trị</th>
              <th className="px-3 py-3 text-right">Giữ lại</th>
              <th className="px-3 py-3 text-right">Được thanh toán</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-3">{row.code} · {row.title}</td>
                <td className="px-3 py-3">{row.party_name}</td>
                <td className="px-3 py-3">{row.project_code}</td>
                <td className="px-3 py-3 text-right">{money(row.contract_value)}</td>
                <td className="px-3 py-3 text-right">{row.retention_percent}% · {money(row.retention_amount)}</td>
                <td className="px-3 py-3 text-right">{money(row.payable)}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Chưa có hợp đồng giao thầu.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
