"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, HardHat, LogOut } from "lucide-react";
import { logout } from "@/lib/frappe/client";
import { useState } from "react";

export function AppShell({
  title,
  children,
  backHref,
}: {
  title: string;
  children: React.ReactNode;
  backHref?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f7f4ef]/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"
            >
              ←
            </Link>
          ) : (
            <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <HardHat className="size-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-amber-700">
              H2Q FastCons
            </p>
            <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>
          </div>
          <Link
            href="/approvals"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"
            aria-label="Chờ duyệt"
          >
            <ClipboardCheck className="size-5" />
          </Link>
          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-50"
            aria-label="Đăng xuất"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>
      <main className="flex-1 px-4 py-4 pb-10">{children}</main>
    </div>
  );
}
