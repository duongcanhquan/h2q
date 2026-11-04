import { AppShell } from "@/components/layout/AppShell";
import { UserAdmin } from "@/components/admin/UserAdmin";

export default function UsersPage() {
  return (
    <AppShell
      title="Người dùng"
      subtitle="Tạo, sửa, xóa và phân công người vào công trình."
      wide
    >
      <UserAdmin />
    </AppShell>
  );
}
