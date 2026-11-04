import { AppShell } from "@/components/layout/AppShell";
import { QuoteBoard } from "@/components/manage/QuoteBoard";

export default function QuotesPage() {
  return (
    <AppShell title="Báo giá" subtitle="So sánh và theo dõi báo giá NCC." wide>
      <QuoteBoard />
    </AppShell>
  );
}
