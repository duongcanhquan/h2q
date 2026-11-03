import { AppShell } from "@/components/layout/AppShell";
import { OfficeLinks } from "@/components/manage/OfficeLinks";
import { ControlBoard } from "@/components/manage/ControlBoard";

export default function ControlPage() {
  return (
    <AppShell title="Điều hành" wide>
      <OfficeLinks />
      <ControlBoard />
    </AppShell>
  );
}
