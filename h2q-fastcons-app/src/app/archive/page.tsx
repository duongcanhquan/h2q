import { AppShell } from "@/components/layout/AppShell";
import { OfficeLinks } from "@/components/manage/OfficeLinks";
import { ArchiveBoard } from "@/components/manage/ArchiveBoard";

export default function ArchivePage() {
  return (
    <AppShell title="Hồ sơ hiện trường" wide>
      <OfficeLinks />
      <ArchiveBoard />
    </AppShell>
  );
}
