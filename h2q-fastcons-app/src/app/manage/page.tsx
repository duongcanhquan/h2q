import { AppShell } from "@/components/layout/AppShell";
import { OfficeLinks } from "@/components/manage/OfficeLinks";
import { ProjectOffice } from "@/components/manage/ProjectOffice";

export default function ManagePage() {
  return (
    <AppShell title="Quản lý công trình" wide>
      <section className="space-y-1 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Danh mục và khối lượng</h2>
        <p className="text-sm text-slate-600">
          Tạo công trình, hạng mục và công việc. Khối lượng kế hoạch nhân đơn giá ra thành tiền. Số đã làm lấy từ phiếu đã duyệt.
        </p>
      </section>
      <OfficeLinks />
      <ProjectOffice />
    </AppShell>
  );
}
