"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardCheck, FolderKanban, HardHat, LayoutDashboard, LogOut, Users } from "lucide-react";
import { logout } from "@/lib/api/client";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Hiện trường", icon: LayoutDashboard },
  { href: "/manage", label: "Quản lý", icon: FolderKanban },
  { href: "/approvals", label: "Duyệt", icon: ClipboardCheck },
] as const;

export function AppShell({
  title,
  children,
  backHref,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  backHref?: string;
  wide?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { app_role?: string } | null) => {
        if (active) setAdmin(data?.app_role === "admin");
      })
      .catch(() => {
        if (active) setAdmin(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function onLogout() {
    setBusy(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }

  const items = admin ? [...NAV, { href: "/users", label: "Người dùng", icon: Users }] : [...NAV];

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:min-h-full lg:flex-col">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-amber-500 text-white">
            <HardHat className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">H2Q</p>
            <p className="font-semibold text-slate-900">FastCons</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                  active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={onLogout}
          disabled={busy}
          className="m-3 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <LogOut className="size-4" />
          Đăng xuất
        </button>
      </aside>

      <div className="flex min-h-full flex-col bg-[var(--background)]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f7f4ef]/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"
              >
                ←
              </Link>
            ) : (
              <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm lg:hidden">
                <HardHat className="size-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-amber-700">H2Q FastCons</p>
              <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>
            </div>
            <button
              type="button"
              onClick={onLogout}
              disabled={busy}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-50 lg:hidden"
              aria-label="Đăng xuất"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </header>
        <main className={`flex-1 px-4 py-4 pb-24 lg:px-8 lg:py-6 lg:pb-10 ${wide ? "" : "lg:mx-auto lg:w-full lg:max-w-3xl"}`}>
          {children}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white lg:hidden">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-amber-700" : "text-slate-500"
                }`}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
