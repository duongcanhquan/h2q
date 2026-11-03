import { AppShell } from "@/components/layout/AppShell";
import { ReportForm } from "@/components/report/ReportForm";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Báo cáo hiện trường — `/project/[project_id]/report`
 * Mã công trình nằm trên tham số `id`.
 */
export default async function ProjectReportPage({ params }: Props) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);

  return (
    <AppShell title="Báo cáo hiện trường" backHref="/dashboard">
      <ReportForm projectId={projectId} />
    </AppShell>
  );
}
