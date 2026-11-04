import { AppShell } from "@/components/layout/AppShell";
import { ControlBoard } from "@/components/manage/ControlBoard";

export default function ControlPage() {
  return (
    <AppShell title="Điều hành" subtitle="Vai trò, đội thi công, thiết bị và nhân sự." wide>
      <ControlBoard />
    </AppShell>
  );
}
