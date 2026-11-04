import { AppShell } from "@/components/layout/AppShell";
import { ArchiveBoard } from "@/components/manage/ArchiveBoard";

export default function ArchivePage() {
  return (
    <AppShell title="Hồ sơ hiện trường" subtitle="Ảnh và tệp theo hạng mục / ngày." wide>
      <ArchiveBoard />
    </AppShell>
  );
}
