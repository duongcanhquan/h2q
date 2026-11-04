import { AppShell } from "@/components/layout/AppShell";
import { SearchBoard } from "@/components/manage/SearchBoard";

export default function SearchPage() {
  return (
    <AppShell title="Tra soát" subtitle="Tìm nhanh hạng mục, phiếu và hồ sơ." wide>
      <SearchBoard />
    </AppShell>
  );
}
