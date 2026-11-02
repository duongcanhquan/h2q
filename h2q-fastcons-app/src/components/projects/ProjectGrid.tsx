"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FolderKanban, Radio, RefreshCw } from "lucide-react";
import { getActiveProjects } from "@/lib/frappe/client";
import type { ProjectRow } from "@/lib/frappe/types";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { FrappeApiError } from "@/lib/frappe/errors";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { ProjectProgressRow } from "@/lib/supabase/database.types";

export function ProjectGrid() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [progressById, setProgressById] = useState<Record<string, ProjectProgressRow>>({});
  const [realtimeOn, setRealtimeOn] = useState(false);
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

  // Supabase Realtime: live progress buffer for site reports
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setRealtimeOn(false);
      return;
    }

    let cancelled = false;

    async function hydrateProgress() {
      const { data } = await supabase!
        .from("project_progress")
        .select("*")
        .limit(200);
      if (cancelled || !data) return;
      const map: Record<string, ProjectProgressRow> = {};
      for (const row of data as ProjectProgressRow[]) {
        map[row.project_id] = row;
      }
      setProgressById(map);
    }

    void hydrateProgress();

    const channel = supabase
      .channel("h2q-project-progress")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_progress" },
        (payload) => {
          const row = (payload.new || payload.old) as ProjectProgressRow | undefined;
          if (!row?.project_id) return;
          if (payload.eventType === "DELETE") {
            setProgressById((prev) => {
              const next = { ...prev };
              delete next[row.project_id];
              return next;
            });
            return;
          }
          setProgressById((prev) => ({ ...prev, [row.project_id]: row }));
        },
      )
      .subscribe((status) => {
        setRealtimeOn(status === "SUBSCRIBED");
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  const liveHint = useMemo(() => {
    const pending = Object.values(progressById).reduce((n, p) => n + (p.pending_count || 0), 0);
    return pending;
  }, [progressById]);

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
        <div className="space-y-1">
          <p className="text-sm text-slate-600">{projects.length} dự án đang giao</p>
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Radio className={`size-3.5 ${realtimeOn ? "text-emerald-600" : "text-slate-400"}`} />
            {realtimeOn
              ? `Realtime ON · ${liveHint} phiếu đang chờ sync`
              : "Realtime OFF (thiếu Supabase env)"}
          </p>
        </div>
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
        {projects.map((p) => {
          const progress = progressById[p.name];
          return (
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
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>{Math.round(p.percent_complete || 0)}% hoàn thành (ERP)</span>
                    <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                      <ClipboardList className="size-4" />
                      Báo cáo
                    </span>
                  </div>
                  {progress ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100">
                      <span className="font-semibold text-slate-800">Live sync: </span>
                      {progress.synced_count} OK · {progress.pending_count} chờ ·{" "}
                      {progress.failed_count} lỗi
                      {progress.last_quantity != null ? (
                        <>
                          {" "}
                          · KL gần nhất <strong>{progress.last_quantity}</strong>
                        </>
                      ) : null}
                      {progress.last_measurement_book ? (
                        <> · MB {progress.last_measurement_book}</>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
