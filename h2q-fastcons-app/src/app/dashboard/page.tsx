import { AppShell } from "@/components/layout/AppShell";
import { ProjectGrid } from "@/components/projects/ProjectGrid";

export default function DashboardPage() {
  return (
    <AppShell
      title="Hiện trường"
      subtitle="Nhật ký và phiếu khối lượng. Tạo công trình / hạng mục nằm ở Quản lý."
      wide
    >
      <ProjectGrid />
    </AppShell>
  );
}
