import { AppShell } from "@/components/layout/AppShell";
import { OfficeLinks } from "@/components/manage/OfficeLinks";
import { SupplyBoard } from "@/components/manage/SupplyBoard";

export default function SupplyPage() {
  return (
    <AppShell title="Vật tư" wide>
      <OfficeLinks />
      <SupplyBoard />
    </AppShell>
  );
}
