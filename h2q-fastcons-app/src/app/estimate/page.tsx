import { AppShell } from "@/components/layout/AppShell";
import { EstimateBoard } from "@/components/manage/EstimateBoard";
import { OfficeLinks } from "@/components/manage/OfficeLinks";

export default function EstimatePage() {
  return (
    <AppShell title="Dự toán" wide>
      <h2 className="pb-3 text-xl font-bold text-slate-900">Dự toán nhận thầu</h2>
      <OfficeLinks />
      <EstimateBoard />
    </AppShell>
  );
}
