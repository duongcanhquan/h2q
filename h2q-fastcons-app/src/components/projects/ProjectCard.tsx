import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ProjectRow } from "@/lib/domain/types";
import type { ProjectProgressRow } from "@/lib/supabase/database.types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function progressLabel(source?: string) {
  if (source === "BOQ Amount") return "theo giá trị";
  if (source === "Project Percent Complete") return "theo dự án";
  return "theo khối lượng";
}

function statusTone(status?: string) {
  const s = (status || "Open").toLowerCase();
  if (s.includes("complet")) return "bg-emerald-100 text-emerald-800";
  if (s.includes("cancel") || s.includes("hold")) return "bg-slate-200 text-slate-700";
  if (s.includes("overdue")) return "bg-red-100 text-red-800";
  return "bg-blue-100 text-blue-800";
}

export function ProjectCard({
  project,
  live,
}: {
  project: ProjectRow;
  live?: ProjectProgressRow;
}) {
  const pct = Math.round(
    Number(
      project.percent_complete_display ??
        project.boq_progress_percent ??
        project.percent_complete ??
        0,
    ),
  );
  const href = `/project/${encodeURIComponent(project.name)}/report`;
  const source = progressLabel(project.progress_source);

  return (
    <Card className="glass-card overflow-hidden transition hover:border-blue-300/60">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-lg text-slate-900 sm:text-xl">
            {project.project_name || project.name}
          </CardTitle>
          <CardDescription className="mt-1 truncate">{project.name}</CardDescription>
        </div>
        <span className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-semibold ${statusTone(project.status)}`}>
          {project.status || "Open"}
        </span>
      </CardHeader>

      <CardContent className="space-y-3">
        <Progress value={pct} label={`Tiến độ (${source})`} />

        {live ? (
          <p className="rounded-xl bg-blue-50/80 px-3 py-2 text-xs text-slate-600">
            Đã duyệt {live.synced_count} · chờ {live.pending_count} · từ chối {live.failed_count}
            {live.last_quantity != null ? (
              <>
                {" "}
                · KL <strong>{live.last_quantity}</strong>
              </>
            ) : null}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Link href={`/project/${encodeURIComponent(project.name)}/diary`} className="btn btn-primary text-sm">
            Nhật ký
          </Link>
          <Link href={href} className="btn btn-secondary text-sm">
            <span>Khối lượng</span>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
