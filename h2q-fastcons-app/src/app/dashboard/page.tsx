import { AppShell } from "@/components/layout/AppShell";
import { ProjectGrid } from "@/components/projects/ProjectGrid";

export default function DashboardPage() {
  return (
    <AppShell title="H2Q FastCons">
      <section className="space-y-1 pb-3">
        <h2 className="text-xl font-bold text-slate-900">Công trình đang thi công</h2>
        <p className="text-sm text-slate-600">
          % hoàn thành lấy từ H2Q Settings (BOQ / Project). Chạm dự án → báo cáo khối lượng.
        </p>
      </section>
      <ProjectGrid />
    </AppShell>
  );
}
