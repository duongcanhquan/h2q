import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ProjectRow } from "@/lib/frappe/types";
import type { ProjectProgressRow } from "@/lib/supabase/database.types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function statusTone(status?: string) {
  const s = (status || "Open").toLowerCase();
  if (s.includes("complet")) return "bg-emerald-100 text-emerald-800";
  if (s.includes("cancel") || s.includes("hold")) return "bg-slate-200 text-slate-700";
  if (s.includes("overdue")) return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-900";
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
  const source = project.progress_source || "BOQ";

  return (
    <Link href={href} className="block transition active:scale-[0.99]">
      <Card className="overflow-hidden ring-1 ring-transparent transition hover:ring-amber-300/70">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-lg text-slate-900 sm:text-xl">
              {project.project_name || project.name}
            </CardTitle>
            <CardDescription className="mt-1 truncate">{project.name}</CardDescription>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(project.status)}`}
          >
            {project.status || "Open"}
          </span>
        </CardHeader>

        <CardContent className="space-y-3">
          <Progress value={pct} label={`Tiến độ (${source})`} />

          {live ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Sync: {live.synced_count} OK · {live.pending_count} chờ · {live.failed_count} lỗi
              {live.last_quantity != null ? (
                <>
                  {" "}
                  · KL <strong>{live.last_quantity}</strong>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="flex min-h-12 items-center justify-between rounded-2xl bg-amber-50 px-4 text-base font-bold text-amber-950">
            <span>Báo cáo khối lượng</span>
            <ChevronRight className="size-6 text-amber-700" aria-hidden />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
