import { AppShell } from "@/components/layout/AppShell";
import { ContractBoard } from "@/components/manage/ContractBoard";

export default function ContractsPage() {
  return (
    <AppShell title="Giao thầu" subtitle="Thầu phụ và hợp đồng giao thầu." wide>
      <ContractBoard />
    </AppShell>
  );
}
