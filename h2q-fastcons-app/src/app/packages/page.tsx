import { AppShell } from "@/components/layout/AppShell";
import { PackageBoard } from "@/components/manage/PackageBoard";

export default function PackagesPage() {
  return (
    <AppShell title="Gói việc" subtitle="Ngân sách và lệch kế hoạch theo gói." wide>
      <PackageBoard />
    </AppShell>
  );
}
