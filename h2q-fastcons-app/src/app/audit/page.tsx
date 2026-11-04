import { AppShell } from "@/components/layout/AppShell";
import { AuditBoard } from "@/components/manage/AuditBoard";

export default function AuditPage() {
  return (
    <AppShell title="Kiểm toán" subtitle="Nhật ký thay đổi và đối soát dữ liệu." wide>
      <AuditBoard />
    </AppShell>
  );
}
