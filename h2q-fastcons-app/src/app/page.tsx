import { AppShell } from "@/components/layout/AppShell";
import { ProjectGrid } from "@/components/projects/ProjectGrid";

export default function DashboardPage() {
  return (
    <AppShell title="Dự án của tôi">
      <ProjectGrid />
    </AppShell>
  );
}
