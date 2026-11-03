"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Camera, ClipboardCheck, FileSpreadsheet, FolderKanban, GitPullRequest, HardHat, LayoutDashboard, LogOut, Package, ScrollText, Search, ShieldCheck, Truck, Users, Warehouse, Wrench } from "lucide-react";
import { logout } from "@/lib/api/client";
import { warm } from "@/lib/api/cache";
import { useEffect, useState } from "react";

const GROUPS = [
  {
    label: "Hiện trường",
    items: [
      { href: "/dashboard", label: "Hiện trường", icon: LayoutDashboard, mobile: true, warm: "/api/projects" },
      { href: "/approvals", label: "Duyệt", icon: ClipboardCheck, mobile: true, warm: "/api/approvals" },
      { href: "/search", label: "Tìm", icon: Search, mobile: true, warm: "" },
    ],
  },
  {
    label: "Công trình",
    items: [
      { href: "/manage", label: "Công trình", icon: FolderKanban, mobile: true, warm: "/api/projects?all=1" },
      { href: "/estimate", label: "Dự toán", icon: FileSpreadsheet, mobile: false, warm: "/api/registers/boq" },
      { href: "/packages", label: "Gói việc", icon: Package, mobile: false, warm: "/api/registers/packages" },
      { href: "/contracts", label: "Giao thầu", icon: GitPullRequest, mobile: false, warm: "/api/registers/contracts" },
      { href: "/changes", label: "Phát sinh", icon: GitPullRequest, mobile: false, warm: "/api/registers/changes" },
    ],
  },
  {
    label: "Vật tư",
    items: [
      { href: "/supply", label: "Nhà cung cấp", icon: Truck, mobile: false, warm: "/api/registers/supply" },
      { href: "/stock", label: "Kho", icon: Warehouse, mobile: false, warm: "/api/registers/stock" },
      { href: "/archive", label: "Hồ sơ", icon: Camera, mobile: false, warm: "/api/projects?all=1" },
    ],
  },
  {
    label: "Điều hành",
    items: [
      { href: "/control", label: "Điều hành", icon: Wrench, mobile: false, warm: "/api/registers/control" },
      { href: "/quotes", label: "Báo giá", icon: ScrollText, mobile: false, warm: "/api/registers/quotes" },
      { href: "/audit", label: "Kiểm toán", icon: ShieldCheck, mobile: false, warm: "/api/registers/audit" },
    ],
  },
] as const;

let adminCache: boolean | null = null;

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
  const [admin, setAdmin] = useState(adminCache === true);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    setMoving(false);
  }, [pathname]);

  useEffect(() => {
    if (adminCache !== null) return;
    let active = true;
    fetch("/api/auth/session", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { app_role?: string } | null) => {
        adminCache = data?.app_role === "admin";
        if (active) setAdmin(adminCache);
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
    adminCache = null;
    try {
      await logout();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }

  const groups = admin
    ? GROUPS.map((group) =>
        group.label === "Điều hành"
          ? { ...group, items: [...group.items, { href: "/users", label: "Người dùng", icon: Users, mobile: true, warm: "/api/admin/users" }] }
          : group,
      )
    : GROUPS;
  const mobileItems = groups.flatMap((group) => group.items).filter((item) => item.mobile);

  return (
    <div className="min-h-full lg:grid lg:h-full lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden bg-[#141b24] text-stone-100 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className="inline-flex size-10 items-center justify-center bg-[#c2410c] text-white">
            <HardHat className="size-5" />
          </span>
          <div>
            <p className="font-semibold leading-tight">H2Q FastCons</p>
            <p className="text-xs text-stone-400">Sổ thi công</p>
          </div>
        </div>
        <Link
          href="/guide"
          onMouseEnter={() => router.prefetch("/guide")}
          className={`mx-3 mt-3 flex min-h-11 items-center gap-3 px-3 font-semibold ${
            pathname === "/guide" ? "bg-[#c2410c] text-white" : "bg-[#f5b301] text-[#1a1206]"
          }`}
        >
          <BookOpen className="size-4" />
          Hướng dẫn
        </Link>
        <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">{group.label}</p>
              <div className="flex flex-col">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onMouseEnter={() => item.warm && warm(item.warm)}
                      onFocus={() => item.warm && warm(item.warm)}
                      onClick={() => setMoving(true)}
                      className={`flex min-h-11 items-center gap-3 border-l-4 px-3 font-medium ${
                        active ? "border-[#f5b301] bg-white/10 text-white" : "border-transparent text-stone-300 hover:bg-white/5 hover:text-white"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <button
          type="button"
          onClick={onLogout}
          disabled={busy}
          className="m-3 flex min-h-11 items-center gap-3 px-3 font-medium text-stone-200 hover:bg-white/10 disabled:opacity-50"
        >
          <LogOut className="size-4" />
          Đăng xuất
        </button>
      </aside>

      <div className="flex min-h-full min-w-0 flex-col">
        <div className={`h-1 bg-[#c2410c] transition-opacity ${moving ? "opacity-100" : "opacity-0"}`} />
        <header className="sticky top-0 z-20 border-b border-[#c9c0b2] bg-[#fffdf8]">
          <div className="flex items-center gap-3 px-4 py-2 lg:px-5">
            {backHref ? (
              <Link href={backHref} className="inline-flex min-h-11 min-w-11 items-center justify-center bg-white text-slate-800 ring-1 ring-[#c9c0b2]">
                ←
              </Link>
            ) : (
              <span className="inline-flex min-h-11 min-w-11 items-center justify-center bg-[#c2410c] text-white lg:hidden">
                <HardHat className="size-5" aria-hidden />
              </span>
            )}
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-[#14181d]">{title}</h1>
            <Link href="/guide" className="inline-flex min-h-11 items-center bg-[#f5b301] px-3 text-sm font-semibold text-[#1a1206]">
              Hướng dẫn
            </Link>
            <button
              type="button"
              onClick={onLogout}
              disabled={busy}
              className="inline-flex min-h-11 min-w-11 items-center justify-center bg-white text-slate-800 ring-1 ring-[#c9c0b2] disabled:opacity-50 lg:hidden"
              aria-label="Đăng xuất"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </header>
        <main data-wide={wide ? "yes" : "no"} className="w-full flex-1 px-3 py-3 pb-24 lg:px-5 lg:pb-6">
          {children}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[#c9c0b2] bg-[#141b24] lg:hidden">
          {mobileItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoving(true)}
                className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium leading-tight ${
                  active ? "text-[#f5b301]" : "text-stone-300"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
