import { AppShell } from "@/components/layout/AppShell";
import { PendingApprovalsList } from "@/components/approvals/PendingApprovalsList";

export default function ApprovalsPage() {
  return (
    <AppShell title="Chờ duyệt" backHref="/dashboard">
      <section className="space-y-1 pb-3">
        <h2 className="text-xl font-bold text-slate-900">Nghiệm thu chờ duyệt</h2>
        <p className="text-sm text-slate-600">
          Duyệt gọi <code className="text-xs">approve_measurement</code> → BuildSuite{" "}
          <code className="text-xs">certify_measurement_book</code>.
        </p>
      </section>
      <PendingApprovalsList />
    </AppShell>
  );
}
