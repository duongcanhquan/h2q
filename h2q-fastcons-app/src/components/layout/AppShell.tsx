"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Building2,
  Calculator,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  FileSearch,
  HardHat,
  Home,
  LayoutDashboard,
  LogOut,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { logout } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { warm, warmShell } from "@/lib/api/cache";

const PREFETCH: Record<string, string[]> = {
  "/dashboard": ["/api/projects"],
  "/approvals": ["/api/approvals"],
  "/manage": ["/api/projects?all=1", "/api/auth/session"],
  "/packages": ["/api/registers/packages", "/api/auth/session"],
  "/estimate": ["/api/registers/boq", "/api/auth/session"],
  "/contracts": ["/api/registers/contracts", "/api/auth/session"],
  "/changes": ["/api/registers/changes", "/api/auth/session"],
  "/control": ["/api/registers/control"],
  "/supply": ["/api/registers/supply"],
  "/stock": ["/api/registers/stock"],
  "/quotes": ["/api/registers/quotes"],
  "/audit": ["/api/registers/audit"],
  "/archive": ["/api/projects?all=1&lite=1"],
  "/users": ["/api/admin/users", "/api/auth/session"],
};

function prefetchRoute(href: string) {
  for (const url of PREFETCH[href] || []) warm(url);
}

type NavItem = { href: string; label: string; icon: typeof Home };

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Hiện trường",
    items: [
      { href: "/dashboard", label: "Công trình", icon: Home },
      { href: "/approvals", label: "Duyệt", icon: CheckSquare },
    ],
  },
  {
    label: "Văn phòng",
    items: [
      { href: "/manage", label: "Quản lý CT", icon: LayoutDashboard },
      { href: "/estimate", label: "Dự toán", icon: Calculator },
      { href: "/control", label: "Điều hành", icon: Settings2 },
      { href: "/packages", label: "Gói việc", icon: Package },
      { href: "/contracts", label: "Giao thầu", icon: ClipboardList },
      { href: "/changes", label: "Phát sinh", icon: FileSearch },
      { href: "/supply", label: "NCC", icon: Truck },
      { href: "/stock", label: "Kho", icon: Warehouse },
      { href: "/archive", label: "Hồ sơ", icon: Archive },
      { href: "/search", label: "Tìm", icon: Search },
      { href: "/quotes", label: "Báo giá", icon: Building2 },
      { href: "/audit", label: "Kiểm toán", icon: ShieldCheck },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { href: "/users", label: "Người dùng", icon: Users },
      { href: "/guide", label: "Hướng dẫn", icon: BookOpen },
    ],
  },
];

const MOBILE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Hiện trường", icon: Home },
  { href: "/manage", label: "Quản lý", icon: LayoutDashboard },
  { href: "/packages", label: "Gói việc", icon: Package },
  { href: "/approvals", label: "Duyệt", icon: CheckSquare },
  { href: "/users", label: "User", icon: Users },
];

function pathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupHasActive(pathname: string, items: NavItem[]) {
  return items.some((item) => pathActive(pathname, item.href));
}

export function AppShell({
  title,
  subtitle,
  backHref,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = window.setTimeout(() => {
      setOpenGroups((prev) => {
        const next = { ...prev };
        for (const g of GROUPS) {
          if (groupHasActive(pathname, g.items)) next[g.label] = true;
          else if (next[g.label] === undefined) next[g.label] = g.label === "Hiện trường";
        }
        return next;
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => warmShell());
    } else {
      timeoutHandle = window.setTimeout(() => warmShell(), 400);
    }
    return () => {
      if (idleHandle != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) window.clearTimeout(timeoutHandle);
    };
  }, []);

  const activeLabel = useMemo(() => {
    for (const g of GROUPS) {
      const hit = g.items.find((item) => pathActive(pathname, item.href));
      if (hit) return hit.label;
    }
    return title;
  }, [pathname, title]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  async function onLogout(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không đăng xuất được.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200/70 bg-white/70 px-3 py-4 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-500/30">
            <HardHat className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">H2Q FastCons</p>
            <p className="text-[11px] text-slate-500">Thi công · Điều hành</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {GROUPS.map((group) => {
            const open = openGroups[group.label] ?? false;
            const active = groupHasActive(pathname, group.items);
            return (
              <div key={group.label} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide ${
                    active ? "text-blue-700" : "text-slate-500"
                  }`}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`size-3.5 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
                  />
                </button>
                {open ? (
                  <div className="mt-0.5 space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const on = pathActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onMouseEnter={() => prefetchRoute(item.href)}
                          onFocus={() => prefetchRoute(item.href)}
                          onTouchStart={() => prefetchRoute(item.href)}
                          className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors ${
                            on
                              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/20"
                              : "text-slate-700 hover:bg-blue-50/80"
                          }`}
                        >
                          <Icon className="size-4 shrink-0 opacity-90" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <form onSubmit={onLogout} className="mt-3 border-t border-slate-200/70 pt-3">
          <button
            type="submit"
            disabled={busy}
            className="btn btn-ghost w-full justify-start gap-2 px-2.5 text-sm font-medium text-slate-600"
          >
            <LogOut className="size-4" />
            {busy ? "Đang thoát…" : "Đăng xuất"}
          </button>
        </form>
      </aside>

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        {/* Mobile top bar only — desktop uses sidebar, no duplicate horizontal menu */}
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-500/25">
                <HardHat className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{activeLabel}</p>
                <p className="truncate text-[11px] text-slate-500">H2Q FastCons</p>
              </div>
            </div>
            <form onSubmit={onLogout}>
              <button
                type="submit"
                disabled={busy}
                className="btn btn-ghost size-10 !min-h-0 !p-0 text-slate-600"
                aria-label="Đăng xuất"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </header>

        <main
          className={`mx-auto w-full flex-1 px-4 py-5 pb-28 lg:px-8 lg:pb-8 ${
            wide ? "max-w-7xl" : "max-w-3xl"
          }`}
        >
          {error ? (
            <div className="mb-4">
              <ErrorBanner message={error} />
            </div>
          ) : null}

          {(title || subtitle || backHref) && (
            <header className="page-head">
              {backHref ? (
                <Link
                  href={backHref}
                  className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                  <ArrowLeft className="size-3.5" />
                  Quay lại
                </Link>
              ) : null}
              {title ? <h1 className="page-head__title">{title}</h1> : null}
              {subtitle ? <p className="page-head__desc">{subtitle}</p> : null}
            </header>
          )}

          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-white/80 px-2 py-2 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
            {MOBILE_NAV.map((item) => {
              const Icon = item.icon;
              const active = pathActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onTouchStart={() => prefetchRoute(item.href)}
                  className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold ${
                    active ? "bg-blue-600 text-white shadow-md shadow-blue-500/25" : "text-slate-500"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
