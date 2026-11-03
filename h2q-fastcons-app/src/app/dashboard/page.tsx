import { AppShell } from "@/components/layout/AppShell";
import { ProjectGrid } from "@/components/projects/ProjectGrid";

export default function DashboardPage() {
  return (
    <AppShell title="Hiện trường" wide>
      <section className="space-y-1 pb-3">
        <h2 className="text-xl font-bold text-slate-900">Công trình đang thi công</h2>
        <p className="text-sm text-slate-600">
          Nhật ký và phiếu khối lượng ở đây. Tạo công trình, hạng mục và tính khối lượng nằm ở mục Quản lý.
        </p>
      </section>
      <ProjectGrid />
    </AppShell>
  );
}
