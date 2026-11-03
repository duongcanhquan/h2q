# Supabase cho H2Q FastCons

Supabase là nơi giữ tài khoản, công trình, phiếu khối lượng, nhật ký và ảnh. App Next.js trên Vercel chỉ là giao diện.

## 1. Project mới

1. Tạo project trên [supabase.com](https://supabase.com).
2. **Authentication → Providers → Email**: bật Email.
3. Tắt **Confirm email** nếu đội hiện trường không mở hộp thư để bấm link xác nhận.
4. **Project Settings → API**: copy Project URL và `anon` key vào `.env.local` / Vercel.

## 2. Chạy SQL

Với project mới, mở **SQL Editor** và chạy đúng một file:

`migrations/20261103180000_standalone_app.sql`

File này tạo bảng, quyền theo dòng (RLS), bucket ảnh `site-photos`, và trigger: user đầu tiên là `admin`.

Các file migration cũ (`measurements_sync`) là hàng đợi đẩy sang Frappe. App hiện không dùng chúng.

## 3. Dữ liệu tối thiểu

Sau khi tạo user bằng Authentication → Users → Add user (hoặc đăng ký), chạy trong SQL Editor. Đổi email cho đúng.

```sql
insert into public.projects (code, name, status)
values ('CT-01', 'Công trình mẫu', 'Open');

insert into public.project_members (project_id, user_id, member_role)
select p.id, pr.id, 'admin'
from public.projects p
join public.profiles pr on pr.email = 'duongcanhquan@gmail.com'
where p.code = 'CT-01';

insert into public.tasks (project_id, code, subject)
select id, 'HM-01', 'Móng' from public.projects where code = 'CT-01';

insert into public.boq_items (project_id, task_id, code, description, unit, planned_qty, rate)
select p.id, t.id, 'BT-01', 'Bê tông móng', 'm3', 100, 1500000
from public.projects p
join public.tasks t on t.project_id = p.id and t.code = 'HM-01'
where p.code = 'CT-01';
```

Admin đăng nhập rồi vào biểu tượng người dùng để tạo, sửa, xóa tài khoản và phân công công trình. Nếu đã chạy file SQL lớn trước khi có màn này, chạy thêm `migrations/20261103220000_admin_user_management.sql`.

Nếu tài khoản `duongcanhquan@gmail.com` được tạo trước khi chạy SQL, gán lại quyền admin:

```sql
insert into public.profiles (id, email, full_name, app_role)
select id, email, 'Admin', 'admin'
from auth.users
where email = 'duongcanhquan@gmail.com'
on conflict (id) do update set app_role = 'admin', email = excluded.email;
```

Vùng GPS của công trình, nếu cần, là JSON `{"ring":[[vĩ độ, kinh độ], ...]}` với ít nhất 3 điểm, ghi vào `projects.geofence`.

## 4. Biến trên Vercel

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

Khóa publishable được phép có mặt trên trình duyệt. `SUPABASE_SECRET_KEY` chỉ để trên Vercel, không thêm tiền tố `NEXT_PUBLIC_`. Đó là Secret key trong Supabase → Project Settings → API Keys. Admin cần khóa này để tạo và xóa tài khoản.

Telegram tuỳ chọn, chỉ trên server: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Bật gửi tin bằng `update public.app_settings set telegram_enabled = 1 where id = 1`.
