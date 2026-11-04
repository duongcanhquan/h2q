"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderKanban, Radio, RefreshCw } from "lucide-react";
import { getActiveProjects } from "@/lib/api/client";
import type { ProjectRow } from "@/lib/domain/types";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiError } from "@/lib/api/errors";
import { peek } from "@/lib/api/cache";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { ProjectProgressRow } from "@/lib/supabase/database.types";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectGridSkeleton } from "@/components/projects/ProjectCardSkeleton";

function cachedProjects(): ProjectRow[] {
  const hit = peek("/api/projects");
  if (!hit || hit.status < 200 || hit.status >= 300) return [];
  const body = hit.body as { projects?: ProjectRow[] };
  return body.projects || [];
}

export function ProjectGrid() {
  const [projects, setProjects] = useState<ProjectRow[]>(() => cachedProjects());
  const [progressById, setProgressById] = useState<Record<string, ProjectProgressRow>>({});
  const [realtimeOn, setRealtimeOn] = useState(false);
  const [loading, setLoading] = useState(() => cachedProjects().length === 0);
  const [error, setError] = useState("");

  async function load(forceSpinner = false) {
    if (forceSpinner || projects.length === 0) setLoading(true);
    setError("");
    try {
      const data = await getActiveProjects();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Lỗi tải dự án");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const t = window.setTimeout(() => setRealtimeOn(false), 0);
      return () => window.clearTimeout(t);
    }

    let cancelled = false;

    async function hydrateProgress() {
      const { data } = await supabase!.from("project_progress").select("*").limit(200);
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
    return Object.values(progressById).reduce((n, p) => n + (p.pending_count || 0), 0);
  }, [progressById]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-slate-600">
            {loading ? "Đang tải…" : `${projects.length} dự án đang giao`}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Radio className={`size-3.5 ${realtimeOn ? "text-emerald-600" : "text-slate-400"}`} />
            {realtimeOn
              ? `Đang nối · ${liveHint} phiếu chờ duyệt`
              : "Chưa nối kênh cập nhật"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? <ProjectGridSkeleton count={4} /> : null}

      {!loading && !error && projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-10 text-slate-400" />}
          title="Chưa có dự án"
          description="Tài khoản của bạn chưa được phân công dự án đang thi công."
        />
      ) : null}

      {!loading && projects.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <li key={p.name}>
              <ProjectCard project={p} live={progressById[p.name]} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
