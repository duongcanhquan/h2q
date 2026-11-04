import { AppShell } from "@/components/layout/AppShell";
import { ChangeBoard } from "@/components/manage/ChangeBoard";

export default function ChangesPage() {
  return (
    <AppShell title="Phát sinh" subtitle="Theo dõi thay đổi phạm vi và phát sinh." wide>
      <ChangeBoard />
    </AppShell>
  );
}
