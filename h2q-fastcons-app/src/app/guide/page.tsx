import { AppShell } from "@/components/layout/AppShell";

const STEPS = [
  ["1. Vào việc", "Đăng nhập bằng email và mật khẩu được cấp. Sau khi vào, mở đúng mục trên menu bên trái. Điện thoại dùng hàng nút dưới cùng."],
  ["2. Tạo công trình", "Mở Công trình. Bấm thêm. Điền mã, tên, ngày bắt đầu và ngày kết thúc. Lưu. Công trình mới nằm trong danh sách."],
  ["3. Chia hạng mục", "Bấm vào công trình vừa tạo. Tab Hạng mục: thêm mã và tên, ví dụ HM-01 Móng. Lưu từng dòng."],
  ["4. Nhập khối lượng", "Cùng trang, tab Khối lượng. Chọn hạng mục, điền mã việc, đơn vị, số lượng kế hoạch và đơn giá. Đây là số hợp đồng, chưa phải số đã làm."],
  ["5. Ghi ở hiện trường", "Mục Hiện trường. Mở công trình. Nhật ký ghi việc trong ngày. Phiếu khối lượng ghi số đã làm hoặc số nghiệm thu. Chụp ảnh nếu có."],
  ["6. Duyệt", "Người được giao duyệt mở mục Duyệt. Xem ngày, người gửi và ảnh. Duyệt thì phiếu thành số chính thức. Trả lại thì người hiện trường sửa và gửi lại."],
  ["7. Giao cho đội", "Mục Điều hành, tab Đội và việc. Tạo đội trước. Khi giao việc phải chọn đúng công trình và đúng hạng mục. Tiền giao cho đội đứng riêng, không đổi kho và không đổi khối lượng hợp đồng."],
  ["8. Nhà cung cấp", "Ghi tên nhà cung cấp và giá chào. Giá này chỉ để so. Giá chào không làm hàng trong kho tăng lên."],
  ["9. Kho", "Thêm địa điểm và tên hàng trước. Nhập hàng: chọn nhà cung cấp, số lượng và đơn giá. Xuất hàng: chọn công trình và người nhận. Không gõ số tồn bằng tay."],
  ["10. Ảnh và tệp", "Mục Hồ sơ. Chọn công trình, hạng mục, loại ảnh, ngày, rồi chọn file. Ảnh được thu nhỏ trước khi lưu."],
];

export default function GuidePage() {
  return (
    <AppShell title="Hướng dẫn" wide>
      <p className="mb-3 max-w-3xl text-sm text-slate-700">
        Làm lần lượt từ trên xuống. Mỗi mục menu là một sổ riêng. Không thấy một mục nghĩa là tài khoản chưa được giao quyền đó.
      </p>
      <ol className="grid gap-3 lg:grid-cols-2">
        {STEPS.map(([title, body]) => (
          <li key={title} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <h2 className="font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">{body}</p>
          </li>
        ))}
      </ol>
    </AppShell>
  );
}
