import { AppShell } from "@/components/layout/AppShell";
import { ContractBoard } from "@/components/manage/ContractBoard";
import { OfficeLinks } from "@/components/manage/OfficeLinks";

export default function ContractsPage() {
  return (
    <AppShell title="Giao thầu" wide>
      <h2 className="pb-3 text-xl font-bold text-slate-900">Thầu phụ và hợp đồng giao thầu</h2>
      <p className="pb-3 text-sm text-slate-600">Nhà thầu nhỏ nhận việc thi công. Họ không phải nhà cung cấp và không giữ tồn kho. Hàng đưa vào công trình phải có phiếu nhập hoặc phiếu xuất.</p>
      <OfficeLinks />
      <ContractBoard />
    </AppShell>
  );
}
