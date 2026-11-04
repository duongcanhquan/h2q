import { AppShell } from "@/components/layout/AppShell";
import { StockBoard } from "@/components/manage/StockBoard";

export default function StockPage() {
  return (
    <AppShell title="Kho" subtitle="Địa điểm, vật liệu và phiếu xuất nhập." wide>
      <StockBoard />
    </AppShell>
  );
}
