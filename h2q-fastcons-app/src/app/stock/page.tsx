import { AppShell } from "@/components/layout/AppShell";
import { OfficeLinks } from "@/components/manage/OfficeLinks";
import { StockBoard } from "@/components/manage/StockBoard";

export default function StockPage() {
  return (
    <AppShell title="Kho" wide>
      <OfficeLinks />
      <StockBoard />
    </AppShell>
  );
}
