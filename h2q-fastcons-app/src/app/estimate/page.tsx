import { AppShell } from "@/components/layout/AppShell";
import { EstimateBoard } from "@/components/manage/EstimateBoard";

export default function EstimatePage() {
  return (
    <AppShell title="Dự toán" subtitle="Dự toán nhận thầu theo công trình." wide>
      <EstimateBoard />
    </AppShell>
  );
}
