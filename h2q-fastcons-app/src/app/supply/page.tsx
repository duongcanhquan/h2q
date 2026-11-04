import { AppShell } from "@/components/layout/AppShell";
import { SupplyBoard } from "@/components/manage/SupplyBoard";

export default function SupplyPage() {
  return (
    <AppShell title="Nhà cung cấp" subtitle="NCC, giá nguyên liệu và định mức." wide>
      <SupplyBoard />
    </AppShell>
  );
}
