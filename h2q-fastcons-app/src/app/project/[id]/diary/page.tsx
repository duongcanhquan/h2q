import { AppShell } from "@/components/layout/AppShell";
import { DiaryForm } from "@/components/report/DiaryForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDiaryPage({ params }: Props) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);

  return (
    <AppShell title="Nhật ký thi công" backHref="/dashboard">
      <DiaryForm projectId={projectId} />
    </AppShell>
  );
}
