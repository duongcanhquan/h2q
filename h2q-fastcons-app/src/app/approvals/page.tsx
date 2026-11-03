import { AppShell } from "@/components/layout/AppShell";
import { PendingApprovalsList } from "@/components/approvals/PendingApprovalsList";

export default function ApprovalsPage() {
  return (
    <AppShell title="Chờ duyệt" backHref="/dashboard">
      <section className="space-y-1 pb-3">
        <h2 className="text-xl font-bold text-slate-900">Phiếu chờ duyệt</h2>
        <p className="text-sm text-slate-600">
          Đọc dòng dưới mỗi phiếu trước khi bấm. Nghiệm thu mới được chứng nhận. Thực hiện chỉ ghi sản lượng.
        </p>
      </section>
      <PendingApprovalsList />
    </AppShell>
  );
}
