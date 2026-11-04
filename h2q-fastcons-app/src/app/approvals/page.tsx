import { AppShell } from "@/components/layout/AppShell";
import { PendingApprovalsList } from "@/components/approvals/PendingApprovalsList";

export default function ApprovalsPage() {
  return (
    <AppShell
      title="Chờ duyệt"
      subtitle="Đọc dòng dưới mỗi phiếu trước khi bấm. Nghiệm thu mới chứng nhận; thực hiện chỉ ghi sản lượng."
      backHref="/dashboard"
      wide
    >
      <PendingApprovalsList />
    </AppShell>
  );
}
