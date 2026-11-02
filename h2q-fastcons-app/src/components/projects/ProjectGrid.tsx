"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList, FolderKanban, RefreshCw } from "lucide-react";
import { getActiveProjects } from "@/lib/frappe/client";
import type { ProjectRow } from "@/lib/frappe/types";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { FrappeApiError } from "@/lib/frappe/errors";

export function ProjectGrid() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getActiveProjects();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof FrappeApiError || err instanceof Error ? err.message : "Lỗi tải dự án");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-slate-600">
        <Spinner />
        <span>Đang tải dự án…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{projects.length} dự án đang giao</p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
        >
          <RefreshCw className="size-4" />
          Làm mới
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {!error && projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-10 text-slate-400" />}
          title="Chưa có dự án"
          description="Tài khoản của bạn chưa được phân công dự án đang thi công."
        />
      ) : null}

      <ul className="space-y-3">
        {projects.map((p) => (
          <li key={p.name}>
            <Link
              href={`/project/${encodeURIComponent(p.name)}/report`}
              className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-slate-900">
                    {p.project_name || p.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{p.name}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  {p.status || "Open"}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>{Math.round(p.percent_complete || 0)}% hoàn thành</span>
                <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                  <ClipboardList className="size-4" />
                  Báo cáo
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
