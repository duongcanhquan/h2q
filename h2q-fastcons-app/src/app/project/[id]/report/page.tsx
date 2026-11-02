import { AppShell } from "@/components/layout/AppShell";
import { ReportForm } from "@/components/report/ReportForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectReportPage({ params }: Props) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);

  return (
    <AppShell title="Nhật ký hiện trường" backHref="/">
      <ReportForm projectId={projectId} />
    </AppShell>
  );
}
