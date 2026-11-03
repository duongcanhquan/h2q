# Spec — Duyệt, gói việc, phát sinh, báo giá

Ngày chốt: 2026-11-03. Bốn chỗ này trước đây hiện sai hoặc cho bấm tắt. Sửa theo đúng thao tác dưới đây.

## 1. Gói việc

Một gói có ngân sách. Cột kế hoạch chỉ tăng khi một đầu việc dự toán được gắn vào gói. Thành tiền kế hoạch = số lượng hợp đồng × đơn giá của các đầu việc đó.

Đầu việc và gói phải cùng một công trình. Gắn nhầm công trình thì từ chối. Bỏ gắn bằng cách chọn lại đầu việc đó sang gói khác. Không có ô gõ kế hoạch.

## 2. Phát sinh

Trạng thái chỉ đi một chiều:

| Đang ở | Nút được bấm | Sang |
|---|---|---|
| Nháp | Trình | Đã trình |
| Đã trình | Duyệt hoặc Từ chối | Đã duyệt hoặc Từ chối |
| Đã duyệt, Từ chối | Không có nút | Giữ nguyên |

Không duyệt thẳng từ nháp. Tiền phát sinh không tự cộng vào dự toán.

## 3. Báo giá

Chọn hoặc loại một báo giá phải kèm điểm từ 1 đến 5 do người bấm chọn. Không gán sẵn 5 khi chọn và 2 khi loại. Điểm nhà cung cấp là trung bình các điểm đã chấm.

## 4. Hàng chờ duyệt

Chỉ người được giao duyệt trên công trình, hoặc admin, mới thấy phiếu của công trình đó. Kỹ sư mở màn này thì được báo là chưa được giao duyệt, không phải là chưa có phiếu.

Khi cài nhiều hơn một cấp, người vừa duyệt cấp trước không được duyệt cấp kế tiếp. Cấp sau phải là một tài khoản khác. Một cấp thì một lần duyệt là xong.

Danh sách lấy 300 phiếu mới nhất. Nếu đủ 300, màn báo còn phiếu cũ hơn. Duyệt hoặc từ chối bớt thì phiếu cũ hiện ra.

## 5. Hiển thị

Thanh dưới trên điện thoại co chữ và cắt bớt nhãn nếu hẹp, không đẩy mục cuối ra ngoài màn. Bảng nhà cung cấp, báo giá và kiểm toán nằm trên thẻ trắng, dòng kẻ xám.
