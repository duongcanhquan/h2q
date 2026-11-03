import { AppShell } from "@/components/layout/AppShell";
import { ChangeBoard } from "@/components/manage/ChangeBoard";
import { OfficeLinks } from "@/components/manage/OfficeLinks";

export default function ChangesPage() {
  return (
    <AppShell title="Phát sinh" wide>
      <h2 className="pb-3 text-xl font-bold text-slate-900">Thay đổi phạm vi</h2>
      <OfficeLinks />
      <ChangeBoard />
    </AppShell>
  );
}
