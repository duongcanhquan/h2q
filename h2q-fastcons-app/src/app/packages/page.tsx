import { AppShell } from "@/components/layout/AppShell";
import { OfficeLinks } from "@/components/manage/OfficeLinks";
import { PackageBoard } from "@/components/manage/PackageBoard";

export default function PackagesPage() {
  return (
    <AppShell title="Gói việc" wide>
      <h2 className="pb-3 text-xl font-bold text-slate-900">Gói việc và ngân sách</h2>
      <OfficeLinks />
      <PackageBoard />
    </AppShell>
  );
}
