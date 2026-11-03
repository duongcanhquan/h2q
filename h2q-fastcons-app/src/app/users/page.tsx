import { AppShell } from "@/components/layout/AppShell";
import { UserAdmin } from "@/components/admin/UserAdmin";

export default function UsersPage() {
  return (
    <AppShell title="Người dùng" backHref="/dashboard">
      <section className="space-y-1 pb-3">
        <h2 className="text-xl font-bold text-slate-900">Tài khoản hiện trường</h2>
        <p className="text-sm text-slate-600">Tạo, sửa, xóa và phân công người vào công trình.</p>
      </section>
      <UserAdmin />
    </AppShell>
  );
}
