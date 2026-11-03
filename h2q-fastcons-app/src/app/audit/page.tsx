import { AppShell } from "@/components/layout/AppShell";
import { AuditBoard } from "@/components/manage/AuditBoard";
import { OfficeLinks } from "@/components/manage/OfficeLinks";

export default function AuditPage() {
  return (
    <AppShell title="Kiểm toán" wide>
      <OfficeLinks />
      <AuditBoard />
    </AppShell>
  );
}
