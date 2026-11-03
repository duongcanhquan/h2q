# UAT hiện trường — PWA H2Q

Kịch bản bấm trên điện thoại hoặc trình duyệt. Thay tài khoản và công trình bằng dữ liệu thật trên site. Không có màn kho, thanh toán, Gantt.

## Chuẩn bị

1. Site đã `bench migrate` và `bench --site <site> execute h2q_core.setup_phase2.run`.
2. H2Q Settings: bật Measurement Book, bật Enable Site Diary, bật Auto Request Approval, bật Telegram và điền bot token trong `site_config`.
3. `min_photos_on_submit = 0` cho vòng đầu. GPS Required để tắt nếu đang test trong nhà.
4. Một Project đang mở, có Task không phải nhóm, có Work Order, tài khoản hiện trường được giao dự án, tài khoản QS được duyệt.
5. Điện thoại cho phép camera và vị trí với trang app.

Kỳ vọng Telegram:

- Phiếu vừa sang `Pending Approval`: tin `Chờ duyệt nghiệm thu`, có mã phiếu và tên dự án.
- Duyệt phiếu **Nghiệm thu** ở cấp cuối: tin chứng nhận, BuildSuite `status = Certified`.
- Duyệt phiếu **Thực hiện** ở cấp cuối: không có tin chứng nhận. Sổ vẫn Draft.

## 1. Đăng nhập

1. Mở app. Chưa có phiên thì đứng ở `/login`.
2. Bỏ trống, bấm `Đăng nhập`. Trình duyệt báo ô bắt buộc. Không vào dashboard.
3. Nhập sai mật khẩu, bấm `Đăng nhập`. Nút đổi `Đang đăng nhập…` rồi trả lại. Banner đỏ. Ô tài khoản còn chữ vừa gõ.
4. Nhập tài khoản hiện trường đúng, bấm `Đăng nhập`. Vào `/dashboard`.

## 2. Chọn công trình

1. Thấy tiêu đề `Công trình đang thi công`.
2. Thẻ có tên, mã, huy hiệu trạng thái, thanh `%`.
3. Bấm tên thẻ. Không mở trang nào. Chỉ hai nút dưới thẻ là liên kết.
4. Nếu tài khoản không được giao dự án nào: khung `Chưa có dự án`. Không thấy thẻ rỗng.

## 3. Nhật ký

1. Trên thẻ, bấm `Nhật ký` (nền xám đậm).
2. Thanh trên có `←`. Bấm `←` về dashboard, rồi vào lại nhật ký.
3. Chọn `Mưa`. Nút đó nền xám đậm, ba nút kia nền xám nhạt.
4. Viết một câu vào `Công việc trong ngày`.
5. Khối lượng ước tính ghi `1`. Đọc dòng phụ: số này không vào sổ sản lượng.
6. Bấm `Lấy GPS`. Có dòng vĩ độ, kinh độ. Từ chối quyền thì dòng đỏ, chưa gửi.
7. Bấm `Chụp ảnh`. Chụp một tấm. Ô vuông hiện preview, chữ `Đang lưu…`, rồi nhãn `Đã lưu`. Không có banner mất mạng.
8. Bấm `Gửi nhật ký`. Hộp xanh có mã phiếu. Ô việc, khối lượng, ảnh bị xóa. Ngày và thời tiết giữ nguyên.

## 4. Gửi sản lượng

1. Từ thẻ, bấm `Khối lượng` (nền kem).
2. Nút `Thực hiện` đang chọn, nền xám đậm. Đọc câu: sau duyệt vào cột Thực hiện, không chứng nhận.
3. Chọn hạng mục. Hộp bốn số hiện ra. Ô viền vàng là `Còn được ghi`.
4. Nhập khối lượng nhỏ hơn ô vàng, ví dụ `1`.
5. Bấm `Chụp ảnh` hoặc `Tải ảnh lên`. Preview hiện, rồi `Đã lưu`. Bấm thùng rác: ảnh biến khỏi phiếu.
6. Chụp lại một ảnh và đợi `Đã lưu`.
7. Bấm `Gửi sản lượng`. Hộp xanh nói phiếu sẽ vào hàng chờ duyệt.
8. Mở Telegram của chat pending. Có tin mã phiếu vừa tạo. Đây là tin chờ duyệt, chưa phải tin chứng nhận.

## 5. Duyệt sản lượng

1. Bấm icon clipboard trên thanh. Nút đó nền xám đậm vì đang ở `/approvals`.
2. Thẻ phiếu có huy hiệu `Thực hiện` và câu `không chứng nhận`.
3. Bấm `Duyệt` một lần. Nút đổi thành `Xác nhận`. Phiếu chưa biến mất.
4. Bấm `Xác nhận`. Hộp xanh: ghi sản lượng, không chứng nhận.
5. Vào lại Khối lượng, chọn cùng hạng mục. Cột Thực hiện tăng. Cột Nghiệm thu đứng yên.
6. Telegram không có tin chứng nhận cho phiếu này.

## 6. Gửi và duyệt nghiệm thu

1. Trên form khối lượng, bấm `Nghiệm thu`.
2. Ô viền vàng đổi thành `Còn nghiệm thu`. Nhập số nhỏ hơn ô đó.
3. Chụp ảnh, đợi `Đã lưu`, bấm `Gửi nghiệm thu`.
4. Telegram có thêm một tin chờ duyệt.
5. Vào `/approvals` bằng tài khoản QS. Huy hiệu `Nghiệm thu`, câu nói sẽ chứng nhận.
6. `Duyệt` rồi `Xác nhận`.
7. Hộp xanh nói đã chứng nhận. Phiếu rời hàng chờ.
8. Telegram có tin chứng nhận. Trên Desk, Measurement Book đó `status = Certified`.
9. Mở lại form. Cột Nghiệm thu tăng. Cột Thực hiện không tăng thêm ở bước này.

## 7. Từ chối

1. Gửi thêm một phiếu Thực hiện.
2. Trên hàng chờ, bấm `Từ chối`. Ô lý do mở ngay trên thẻ, không có hộp thoại của trình duyệt.
3. Để trống, nút `Gửi từ chối` mờ.
4. Gõ `Sai hạng mục`, bấm `Gửi từ chối`. Phiếu biến. Hộp xanh nói không chứng nhận.
5. Desk: phiếu `Rejected`, BuildSuite vẫn Draft.

## 8. Việc không được xảy ra

- Gửi nghiệm thu lớn hơn phần còn, policy Block: banner đỏ, không có phiếu mới, không có Telegram.
- Đứng ngoài vùng khi policy Block: banner đỏ `Không gửi được`.
- Tắt Enable Site Diary: vào nhật ký vẫn thấy form, nút gửi mờ, banner đỏ.
- Duyệt Thực hiện xong mà sổ nhảy Certified: dừng, đây là lỗi.
