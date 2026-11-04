import { AppShell } from "@/components/layout/AppShell";
import { ProjectOffice } from "@/components/manage/ProjectOffice";

export default function ManagePage() {
  return (
    <AppShell title="Quản lý công trình" subtitle="Danh mục, hạng mục và tính khối lượng." wide>
      <ProjectOffice />
    </AppShell>
  );
}
