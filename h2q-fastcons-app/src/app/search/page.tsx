import { AppShell } from "@/components/layout/AppShell";
import { OfficeLinks } from "@/components/manage/OfficeLinks";
import { SearchBoard } from "@/components/manage/SearchBoard";

export default function SearchPage() {
  return (
    <AppShell title="Tra soát" wide>
      <OfficeLinks />
      <SearchBoard />
    </AppShell>
  );
}
