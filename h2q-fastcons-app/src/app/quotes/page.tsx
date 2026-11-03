import { AppShell } from "@/components/layout/AppShell";
import { OfficeLinks } from "@/components/manage/OfficeLinks";
import { QuoteBoard } from "@/components/manage/QuoteBoard";

export default function QuotesPage() {
  return (
    <AppShell title="Báo giá" wide>
      <OfficeLinks />
      <QuoteBoard />
    </AppShell>
  );
}
