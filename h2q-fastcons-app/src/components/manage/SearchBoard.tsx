"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

type Hit = {
  projects: { code: string; name: string }[];
  materials: { id: string; name: string; unit: string | null; price: number }[];
  suppliers: { id: string; name: string; trade: string | null }[];
  workers: { id: string; full_name: string; role_title: string | null; photo_url: string | null }[];
  equipment: { id: string; code: string; name: string; status: string }[];
  documents: { id: string; title: string; kind: string; file_url: string; taken_on: string }[];
  stock: { id: string; code: string; name: string; unit: string; kind: string }[];
};

const EMPTY: Hit = { projects: [], materials: [], suppliers: [], workers: [], equipment: [], documents: [], stock: [] };

export function SearchBoard() {
  const [q, setQ] = useState("");
  const [hit, setHit] = useState<Hit>(EMPTY);
  const [message, setMessage] = useState("");

  async function search(value: string) {
    setQ(value);
    if (value.trim().length < 2) { setHit(EMPTY); setMessage(""); return; }
    const response = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
    const body = await response.json();
    if (!response.ok) { setMessage(body.message || "Chưa tra được. Chạy SQL sổ vật tư và điều hành."); return; }
    setMessage("");
    setHit(body);
  }

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(event) => void search(event.target.value)}
        placeholder="Tìm công trình, vật tư, nhà cung cấp, thiết bị, nhân sự, hồ sơ"
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
      />
      {message ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{message}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {(hit.projects || []).length ? <Group title="Công trình">{(hit.projects || []).map((row) => <Link key={row.code} href={`/manage/${row.code}`} className="block rounded-xl bg-slate-50 px-3 py-2">{row.code} · {row.name}</Link>)}</Group> : null}
        {(hit.materials || []).length ? <Group title="Vật tư">{(hit.materials || []).map((row) => <p key={row.id} className="rounded-xl bg-slate-50 px-3 py-2">{row.name} · {new Intl.NumberFormat("vi-VN").format(row.price || 0)} / {row.unit || "đv"}</p>)}</Group> : null}
        {(hit.suppliers || []).length ? <Group title="Nhà cung cấp">{(hit.suppliers || []).map((row) => <p key={row.id} className="rounded-xl bg-slate-50 px-3 py-2">{row.name}{row.trade ? ` · ${row.trade}` : ""}</p>)}</Group> : null}
        {(hit.equipment || []).length ? <Group title="Thiết bị">{(hit.equipment || []).map((row) => <p key={row.id} className="rounded-xl bg-slate-50 px-3 py-2">{row.code} · {row.name} · {row.status}</p>)}</Group> : null}
        {(hit.workers || []).length ? <Group title="Nhân sự">{(hit.workers || []).map((row) => <p key={row.id} className="rounded-xl bg-slate-50 px-3 py-2">{row.full_name}{row.role_title ? ` · ${row.role_title}` : ""}</p>)}</Group> : null}
        {(hit.documents || []).length ? <Group title="Hồ sơ">{(hit.documents || []).map((row) => <a key={row.id} href={row.file_url} target="_blank" rel="noreferrer" className="block rounded-xl bg-slate-50 px-3 py-2">{row.taken_on} · {row.title}</a>)}</Group> : null}
        {hit.stock?.length ? <Group title="Kho">{hit.stock.map((row) => <p key={row.id} className="rounded-xl bg-slate-50 px-3 py-2">{row.code} · {row.name} · {row.unit} · {row.kind === "cong_cu" ? "Công cụ" : "Vật liệu"}</p>)}</Group> : null}
      </div>
      {q.trim().length >= 2 && !message && Object.values(hit).every((rows) => !rows?.length) ? <p className="text-sm text-slate-600">Không thấy kết quả.</p> : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm">{children}</div>
    </section>
  );
}
