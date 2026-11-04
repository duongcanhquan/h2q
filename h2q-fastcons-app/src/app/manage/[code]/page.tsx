import { AppShell } from "@/components/layout/AppShell";
import { ProjectDesk } from "@/components/manage/ProjectDesk";

type Props = { params: Promise<{ code: string }> };

export default async function ManageProjectPage({ params }: Props) {
  const { code } = await params;
  const projectCode = decodeURIComponent(code);
  return (
    <AppShell title="Sổ công trình" subtitle={projectCode} backHref="/manage" wide>
      <ProjectDesk code={projectCode} />
    </AppShell>
  );
}
