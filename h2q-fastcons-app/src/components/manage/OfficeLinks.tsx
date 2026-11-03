"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/manage", "Công trình"],
  ["/estimate", "Dự toán"],
  ["/packages", "Gói việc"],
  ["/contracts", "Giao thầu"],
  ["/changes", "Phát sinh"],
  ["/supply", "Vật tư"],
  ["/quotes", "Báo giá"],
  ["/audit", "Kiểm toán"],
] as const;

export function OfficeLinks() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {LINKS.map(([href, label]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium ${
              active ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
