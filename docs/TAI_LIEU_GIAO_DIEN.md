# Tài liệu giao diện H2Q FastCons

Tài liệu này mô tả đúng phần đang có trên PWA `h2q-fastcons-app`. Dùng để dựng hoặc kiểm màn hình. Quy tắc số liệu nằm ở [`SPEC_P0_HIEN_TRUONG.md`](SPEC_P0_HIEN_TRUONG.md).

Phạm vi màn hình hiện tại: đăng nhập, danh sách công trình, nhật ký ngày, báo cáo khối lượng, hàng chờ duyệt. Chưa có màn kho, thanh toán, hóa đơn, Gantt, RFI, máy, chấm công.

## 1. Khung dùng chung

Ứng dụng là một cột, rộng tối đa `32rem` (`max-w-lg`), căn giữa. Nền trang `#f7f4ef`. Chữ chính `#0f172a` (slate-900). Chữ phụ slate-600. Font Geist, dự phòng Segoe UI.

Mọi nút, ô nhập và liên kết cao tối thiểu 44px. Ô nhập trên form hiện trường cao 56–64px, chữ 16–18px, bo góc 16px, để bấm khi đeo găng.

| Vai trò | Nền | Chữ | Viền / bóng | Dùng khi |
|---|---|---|---|---|
| Hành động chính của trang | amber-500 `#f59e0b` | slate-950, đậm | bóng amber nhạt | Gửi nhật ký, gửi khối lượng |
| Hành động chắc, phụ | slate-900 | trắng | không | Đăng nhập, Lấy GPS, Chụp ảnh, Nhật ký, Từ chối |
| Lối đi phụ, nổi trên nền kem | amber-50 | amber-950, chữ đậm, mũi tên amber-700 | không | Nút Khối lượng trên thẻ dự án |
| Nút thường | trắng | slate-700 | viền slate-200 | Làm mới, Tải ảnh, nút chưa chọn |
| Nút đang chọn | slate-900 | trắng | không | Thực hiện / Nghiệm thu, thời tiết, an toàn |
| Thành công | emerald-50, viền emerald-200 | emerald-900 | không | Đã gửi xong |
| Cảnh báo | amber-50, viền amber-300 | amber-950 | không | Vượt định mức, ngoài vùng GPS |
| Lỗi | red-50, viền red-200 | red-800, icon tam giác | không | Sai mật khẩu, thiếu dữ liệu, server từ chối |
| Đang bận | cùng nút, mờ 60%, icon xoay | giữ màu chữ | không | Đang đăng nhập, đang gửi, đang tải |

Thanh trên cùng dính khi cuộn. Nền `#f7f4ef` trong 95%, gạch dưới slate-200.

- Trái: nếu có trang trước thì nút `←` nền trắng, viền slate-200, cao 44px. Ở dashboard thì ô vuông amber-500, icon mũ bảo hộ trắng.
- Giữa: dòng nhỏ `H2Q FASTCONS` màu amber-700, chữ hoa, giãn chữ. Dưới là tên màn, 18px, đậm, cắt bằng dấu ba chấm nếu dài.
- Phải: icon clipboard, nền trắng, mở `/approvals`. Kế bên icon cửa ra, gọi đăng xuất rồi về `/login`.

Chưa đăng nhập: mọi trang trừ `/login` chuyển về `/login?next=<đường vừa mở>`.

## 2. Sơ đồ màn

```text
/login
  └─ Đăng nhập thành công → /dashboard
/dashboard
  ├─ Nhật ký     → /project/{mã}/diary
  ├─ Khối lượng  → /project/{mã}/report
  └─ icon duyệt  → /approvals
/approvals
  └─ ←            → /dashboard
```

`/` chuyển thẳng `/dashboard`.

## 3. Đăng nhập — `/login`

Căn giữa theo chiều dọc.

Phía trên form: ô vuông 64px, bo 16px, nền amber-500, icon mũ trắng. Tiêu đề `H2Q FastCons`, 30px, đậm. Dòng phụ xám: `Đăng nhập để ghi nhật ký hiện trường`.

Form nền trắng, bo 24px, viền slate-200, bóng nhẹ.

| Ô / nút | Thể hiện | Tác dụng |
|---|---|---|
| Tài khoản Frappe | Ô cao 56px, nền slate-50, viền slate-300. Placeholder `user@h2q.com.vn`. Khi focus viền amber-500 | Bắt buộc. Gửi email hoặc username Frappe |
| Mật khẩu | Cùng kiểu ô, ký tự che | Bắt buộc |
| Đăng nhập | Full rộng, cao 56px, nền slate-900, chữ trắng | Gọi đăng nhập. Khi đang chạy đổi thành `Đang đăng nhập…` và khóa nút |

Đúng: vào đường trong `next`, nếu không có thì `/dashboard`.  
Sai mật khẩu: banner đỏ `Sai tài khoản hoặc mật khẩu.` Mất kết nối: banner đỏ `Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.` Ô không bị xóa.

## 4. Danh sách công trình — `/dashboard`

Tiêu đề thanh: `H2Q FastCons`.

Trong trang:

- `Công trình đang thi công`, 20px, đậm.
- Dòng phụ: `Mỗi công trình có nhật ký ngày và phiếu khối lượng. Phần trăm theo cách công ty đang tính.`

Hàng trạng thái:

- Trái: `n dự án đang giao` hoặc `Đang tải…`. Dòng nhỏ hơn có icon radio. Radio emerald-600 và chữ `Đang nối · n phiếu chờ chuyển` khi Supabase đã nối. Radio slate-400 và `Chưa nối máy đồng bộ` khi chưa nối.
- Phải: nút `Làm mới`, nền trắng, viền slate-200, icon mũi tên xoay. Bấm thì tải lại danh sách. Khi đang tải, icon xoay và nút mờ.

Đang tải: bốn khung xám thay thẻ.

Không có dự án và không lỗi: khung nét đứt slate-300, nền slate-50, icon folder xám, tiêu đề `Chưa có dự án`, mô tả `Tài khoản của bạn chưa được phân công dự án đang thi công.`

Lỗi tải: banner đỏ, không hiện thẻ.

### Thẻ một công trình

Nền trắng. Khi trỏ, viền amber-300 nhạt.

- Tên công trình, 18–20px, đậm, một dòng.
- Mã dự án, chữ nhỏ xám, một dòng.
- Huy hiệu trạng thái, viên thuốc, chữ 12px đậm:
  - có `complet` trong trạng thái: nền emerald-100, chữ emerald-800
  - có `cancel` hoặc `hold`: nền slate-200, chữ slate-700
  - có `overdue`: nền red-100, chữ red-800
  - còn lại, kể cả Open: nền amber-100, chữ amber-900
- Thanh tiến độ cao 10px, nền slate-100, phần đã đạt amber-500. Nhãn `Tiến độ (theo khối lượng)`, `Tiến độ (theo giá trị)` hoặc `Tiến độ (theo dự án)`. `%` đậm bên phải. Số kẹp trong 0–100 khi vẽ thanh.
- Nếu có dòng đồng bộ: hộp slate-50, chữ 12px: `Đã chuyển n · chờ n · lỗi n · KL {số}`.
- Hai nút cùng hàng, mỗi nút cao 48px:
  - `Nhật ký`: nền slate-900, chữ trắng. Mở `/project/{mã}/diary`.
  - `Khối lượng`: nền amber-50, chữ amber-950, icon mũi tên amber-700. Mở `/project/{mã}/report`.

Tên thẻ không phải nút. Chỉ hai nút dưới mở trang.

## 5. Nhật ký thi công — `/project/{mã}/diary`

Thanh tiêu đề `Nhật ký thi công`. Nút `←` về dashboard.

### Đầu trang

Nhãn nhỏ amber-700: `NHẬT KÝ THI CÔNG`. Tên công trình 24px. Mã dự án xám. Liên kết chữ amber-800: `Sang báo cáo khối lượng`.

Nếu danh mục lấy từ máy vì mất mạng: dòng `Danh mục từ cache` kèm icon mất sóng.

Nếu H2Q Settings tắt nhật ký: banner đỏ `H2Q Settings đang tắt nhật ký. Bật Enable Site Diary, lưu, rồi gửi lại.` Nút gửi bị khóa.

Cảnh báo vùng GPS: Warn là hộp amber, vẫn gửi. Block là banner đỏ, không gửi.

### Các ô

| Nhãn | Kiểu | Giá trị | Ghi vào sổ |
|---|---|---|---|
| Ngày | ô date, bắt buộc | mặc định hôm nay | ngày phiếu |
| Thời tiết | bốn nút, lưới 2 cột: Nắng, Mưa, Mưa nhỏ, Âm u | nút chọn nền slate-900, nút còn lại slate-100 | thời tiết nhật ký |
| Hiện trường | Tốt, Trung bình, Kém | cùng cách chọn | tình trạng mặt bằng |
| An toàn | Tốt, Trung bình, Kém | cùng cách chọn | an toàn trong ngày |
| Công việc trong ngày | ô nhiều dòng, placeholder `Hạng mục đang làm, vị trí, vướng mắc` | chữ tự do | nội dung công việc |
| Hạng mục | danh sách task không phải nhóm | mặc định `— Cả công trường —` | task, nếu chọn |
| Khối lượng ước tính trong ngày | số, một hàng riêng | dòng phụ luôn hiện: chỉ để đọc nhật ký; muốn vào sổ thì sang Khối lượng, chọn Thực hiện | `custom_h2q_diary_qty`. Không cộng BOQ, không thành phiếu nghiệm thu |
| Nhân công | số nguyên | số người | số nhân công trên phiếu |
| Máy thi công | một dòng | placeholder `Máy, số ca` | ghi chú máy |
| GPS | nút `Lấy GPS` nền slate-900 | hiện `vĩ độ, kinh độ` hoặc `Chưa có toạ độ` | lat, lng, độ chính xác |
| Ảnh | khối dùng chung ở mục 7 | | URL R2 |

`Gửi nhật ký`: full rộng, cao 64px, nền amber-500, chữ slate-950, icon máy bay giấy. Khi gửi: `Đang gửi…` và khóa nút. Số ảnh tối thiểu của phiếu khối lượng không áp vào nhật ký. Ảnh lỗi thì không gửi.

Sau khi gửi được:

- Máy chủ nhận: hộp xanh `Đã ghi nhật ký {mã phiếu}. Cùng ngày, cùng hạng mục sẽ được cập nhật.`
- Mất mạng hoặc lỗi máy chủ: hộp xanh `Mất mạng — nhật ký nằm trên máy, sẽ gửi khi có mạng.` Lỗi kiểm tra (thiếu GPS, tắt cờ, ngoài vùng khi policy Block) là banner đỏ, không xếp hàng.

Xóa ô việc, khối lượng, nhân công, máy và ảnh sau khi gửi. Ngày và các nút chọn giữ nguyên.

Mở lại trang này sẽ đẩy các nhật ký đang nằm trên máy.

## 6. Báo cáo khối lượng — `/project/{mã}/report`

Thanh tiêu đề `Báo cáo hiện trường`. `←` về dashboard.

Nhãn nhỏ đổi theo loại phiếu: `BÁO SẢN LƯỢNG` hoặc `NGHIỆM THU KHỐI LƯỢNG`. Tên và mã công trình. Liên kết `Nhật ký thi công hôm nay`. Nếu WBS lấy từ cache: viên `WBS từ cache offline`. Chưa có task: khung `Chưa có hạng mục`, không hiện form gửi.

### Chọn loại phiếu

Hai nút cao 56px, chia đôi hàng.

| Nút | Khi chọn | Nghĩa với người dùng | Việc hệ thống làm sau khi duyệt xong |
|---|---|---|---|
| Thực hiện | nền slate-900 | `Thực hiện vào sổ sản lượng. Phiếu này không được chứng nhận để thanh toán.` | Approved, BuildSuite vẫn Draft. Cộng cột Thực hiện |
| Nghiệm thu | nền slate-900 | `Nghiệm thu không vượt thực hiện đã duyệt. Chỉ phiếu này mới được chứng nhận.` | Approved rồi chứng nhận. Cộng cột Nghiệm thu |

Nút không chọn: nền trắng, viền slate-200.

Mặc định là Thực hiện.

### Ô nghiệp vụ

1. `Hạng mục WBS`, danh sách bắt buộc. Chỉ task không phải nhóm.
2. `Dòng BOQ / định mức`, chỉ hiện khi hạng mục có hơn một dòng BOQ.
3. Hộp slate-100 `Định mức tự điền`, sau khi chọn hạng mục:
   - `Hợp đồng {planned}`
   - `Thực hiện {đã duyệt}`
   - `Nghiệm thu {đã chứng nhận}`
   - `Còn nghiệm thu {phần còn}` và đơn vị
4. `Khối lượng`, số, bắt buộc, khác 0. Có đơn vị bên nhãn nếu BOQ có.
5. `Lệnh thi công`, không bắt buộc. Placeholder `Để trống nếu công trình chỉ có một lệnh`. Để trống thì server chọn work order của dự án nếu chỉ có một.
6. `Ghi chú`, nhiều dòng. Placeholder `Vị trí, điều kiện hiện trường…`. Bắt buộc khi vượt mức và policy là Warn Require Note.
7. `GPS hiện trường`. Nút `Lấy GPS`. Dòng xanh nếu đã có toạ độ: `lat, lng (±mét)`. Dòng xám nếu chưa có: `Bắt buộc trước khi gửi.` hoặc `Khuyến nghị gắn vị trí.` tùy Settings.
8. Khối ảnh, mục 7.
9. Nút gửi, full rộng, chữ 20px, đậm, nền amber-500. Chữ nút là `Gửi sản lượng` hoặc `Gửi nghiệm thu`. Khi đang gửi hiện `Đang lưu…` và khóa nút. Sổ khối lượng đang tắt thì nút khóa và có banner đỏ.

Dòng nhỏ dưới nút: `Phiếu lưu trên máy trước, rồi chuyển lên sổ.` Nếu Settings bật tự gửi duyệt, thêm `Sau đó phiếu vào hàng chờ duyệt.`

### Khi bấm Gửi sản lượng hoặc Gửi nghiệm thu

Không gửi, hiện banner đỏ, nếu:

- Measurement Book đang tắt trong Settings
- chưa chọn hạng mục
- khối lượng không phải số hoặc bằng 0
- Settings bắt GPS mà chưa có toạ độ
- ảnh đang upload hoặc ảnh lỗi
- số ảnh ít hơn `min_photos_on_submit`
- vượt mức và policy Block
- vượt mức, policy Warn Require Note, mà ghi chú trống
- vùng GPS policy Block và điểm ngoài vùng hoặc thiếu GPS khi đã có polygon

Vượt mức mà policy Warn: vẫn gửi, hộp amber hiện trước đó.

Gửi được:

- đã vào hàng đợi: hộp xanh `Đã lưu phiếu sản lượng` hoặc `Đã lưu phiếu nghiệm thu`, và nói phiếu sẽ vào hàng chờ duyệt nếu Settings bật tự gửi duyệt
- chỉ kịp lưu máy: hộp xanh nói mất mạng hoặc chưa nối máy đồng bộ. Không viết như thể sổ đã nhận

Cảnh báo vượt mức dùng lũy kế của đúng cột, không dùng số còn lại của sổ chứng nhận cũ. Thực hiện cộng cả phiếu đang chờ duyệt. Nghiệm thu so với thực hiện đã duyệt; chưa có thực hiện thì so với hợp đồng. Block là banner đỏ. Warn là hộp amber và nói vẫn gửi được. Warn Require Note mà thiếu ghi chú là banner đỏ, nhãn ghi chú thêm `bắt buộc vì vượt mức`.

Ngoài vùng: Block là banner đỏ `Không gửi được`. Warn là hộp amber và nói phiếu sẽ gắn cờ ngoài vùng.

Xóa hạng mục, khối lượng, ghi chú, work order và ảnh. Loại phiếu giữ nguyên.

### Số trên hộp định mức

| Chữ trên màn | Lấy từ đâu | Chưa có phiếu thì hiện |
|---|---|---|
| Hợp đồng | `planned_qty` của BOQ Item | `—` |
| Thực hiện | tổng phiếu Thực hiện đã Approved | `0` |
| Nghiệm thu | tổng phiếu Nghiệm thu đã chứng nhận, cộng sổ cũ chưa có loại phiếu nhưng đã Certified | `0` |
| Còn được ghi, khi đang chọn Thực hiện | hợp đồng trừ thực hiện đã duyệt, trừ cả phiếu thực hiện đang chờ | `—` nếu không có hợp đồng |
| Còn nghiệm thu, khi đang chọn Nghiệm thu | thực hiện đã duyệt trừ nghiệm thu; nếu chưa có thực hiện thì hợp đồng trừ nghiệm thu | `—` nếu không tính được |

Ô thứ tư có viền vàng. Ba ô kia nền trắng. Nếu có phiếu đang chờ, ô Thực hiện hoặc Nghiệm thu có dòng nhỏ `chờ {số}`.

Thanh toán không hiện trên màn này. Chưa có sổ thanh toán nên không điền số giả.

## 7. Khối ảnh dùng chung

Tiêu đề `Chụp ảnh / Tải ảnh lên`. Dòng phụ xám: ảnh được lưu ngay khi chọn. Nút xóa chỉ gỡ ảnh khỏi phiếu.

| Nút | Màu | Tác dụng |
|---|---|---|
| Chụp ảnh | slate-900, icon máy ảnh, cao 64px | Mở camera sau của điện thoại, một ảnh |
| Tải ảnh lên | trắng, viền slate-300, icon ảnh | Mở thư viện. Ảnh, pdf, dwg, dxf. Chọn nhiều |

Chưa có file: ô nét đứt, cao 112px, icon mây mờ. Trên nhật ký chữ `Chưa có ảnh nhật ký`. Trên phiếu khối lượng chữ `Chưa có ảnh phiếu`.

Mỗi ảnh là ô vuông:

- Đang tải: phủ đen 45%, vòng xoay trắng, chữ `Đang lưu…`
- Xong: nhãn xanh lá `Đã lưu` góc dưới trái
- Lỗi: dải đỏ dưới ảnh, chữ lỗi
- Nút xóa: tròn, nền đen 65%, icon thùng rác, góc trên phải, 44px. Gỡ ảnh khỏi phiếu sắp gửi. Không xóa file đã nằm trên R2

Không cho gửi khi còn ảnh đang tải hoặc ảnh lỗi.

## 8. Chờ duyệt — `/approvals`

Thanh `Chờ duyệt`. `←` về dashboard.

Tiêu đề `Phiếu chờ duyệt`. Dòng phụ: đọc dòng dưới mỗi phiếu trước khi bấm. Nghiệm thu mới được chứng nhận. Thực hiện chỉ ghi sản lượng.

Hàng trên: `n phiếu chờ duyệt` hoặc `Đang tải…`. Nút `Làm mới` giống dashboard.

Không có phiếu: khung nét đứt, `Không có phiếu chờ`, mô tả `Khi hiện trường gửi phiếu và bật chuyển duyệt, phiếu sẽ hiện ở đây.`

Mỗi phiếu là thẻ trắng:

- Mã phiếu, đậm. Huy hiệu bên phải: `Thực hiện` nền slate-200, `Nghiệm thu` nền emerald-100, `Sổ cũ` nền emerald-100 khi phiếu chưa có loại. Sổ cũ khi duyệt cấp cuối vẫn chứng nhận.
- Tên công trình và `KL {measured_total}`
- Dòng nhỏ: `Cấp i/n` hoặc `Một cấp duyệt`, vai trò đang cần, hạng mục, lệnh, `vượt mức` nếu có, `ngoài vùng` nếu có
- Một câu nói trước việc sẽ xảy ra: chuyển cấp, chứng nhận, hoặc chỉ ghi sản lượng
- `Duyệt`: nửa trái, nền emerald-600, chữ trắng, cao 56px, icon dấu kiểm. Bấm lần một, nút đổi thành `Xác nhận`. Bấm lần hai mới gọi duyệt
- `Từ chối`: nửa phải, nền slate-900, chữ trắng, icon X. Bấm thì mở ô lý do ngay trên thẻ, không mở hộp thoại trình duyệt

`Xác nhận`: gọi duyệt phiếu đó rồi tải lại danh sách. Hộp xanh nói kết quả. Nếu còn cấp sau, phiếu vẫn nằm trong hàng chờ. Nếu là Nghiệm thu ở cấp cuối, phiếu biến mất khỏi hàng chờ vì đã chứng nhận. Nếu là Thực hiện ở cấp cuối, phiếu cũng rời hàng chờ vì hết Pending, nhưng không chứng nhận.

`Gửi từ chối`: cần có chữ trong ô lý do. Ô trống thì nút mờ, không gửi. `Huỷ` đóng ô và không đổi phiếu. Có lý do thì phiếu về Rejected, BuildSuite vẫn Draft, cấp duyệt về 0. Phiếu rời hàng chờ.

Sai vai trò: banner đỏ, nội dung server, thường là `Cấp duyệt này cần vai trò: …`.

Khi một phiếu đang xử lý, cả hai nút của phiếu đó mờ.

## 9. Quy trình thao tác

### 9.1 Vào ca

1. Mở app. Chưa có phiên thì đứng ở đăng nhập.
2. Đăng nhập. Vào dashboard.
3. Thấy công trình mình được giao. Không thấy công trình của người khác.

### 9.2 Cuối ngày, chỉ huy hiện trường

1. Bấm `Nhật ký`.
2. Chọn thời tiết, mặt bằng, an toàn.
3. Viết việc đã làm. Chọn hạng mục nếu việc gắn một task.
4. Nhân công và máy là ghi nhận ngày, không phải bảng chấm công và không phải ca máy.
5. Khối lượng ước tính chỉ để đọc nhật ký. Muốn vào sổ sản lượng thì sang `Khối lượng`, loại Thực hiện.
6. Lấy GPS, chụp ảnh, `Gửi nhật ký`.
7. Gửi lại cùng ngày, cùng hạng mục thì sửa phiếu cũ, không tạo phiếu thứ hai.

### 9.3 Báo sản lượng đã làm

1. Bấm `Khối lượng`.
2. Giữ nút `Thực hiện`.
3. Chọn hạng mục. Đọc bốn số trên hộp định mức.
4. Nhập khối lượng mới. Nhìn hộp amber nếu lũy kế sắp vượt hợp đồng.
5. Ảnh và GPS theo Settings.
6. `Gửi sản lượng`.
7. Người có quyền duyệt mở icon clipboard, bấm `Duyệt` rồi `Xác nhận`.
8. Hết cấp thì cột Thực hiện trên form tăng. Cột Nghiệm thu không tăng. Không sinh chứng từ thanh toán.

### 9.4 QS nghiệm thu

1. Mở `Khối lượng`, bấm `Nghiệm thu`.
2. Hộp định mức phải đang có Thực hiện đã duyệt, trừ khi công trình cũ chưa từng tách loại phiếu.
3. Nhập khối lượng đợt này, không lớn hơn `Còn nghiệm thu`, trừ khi Settings đang để Warn và người gửi chấp nhận cảnh báo.
4. Gửi. Duyệt đủ cấp.
5. Cột Nghiệm thu tăng. Phiếu được chứng nhận trong BuildSuite và mới đủ điều kiện đi tiếp sang thanh toán ở giai đoạn sau.

### 9.5 Ngoài vùng công trường

Chỉ chạy khi dự án đã có polygon và Settings không phải Off.

- Warn: hộp amber, vẫn gửi, phiếu ghi cờ ngoài vùng.
- Block: banner đỏ, không gửi.

Chưa khai polygon thì không chặn.

## 10. Cái màn hình chưa được phép tự thêm

Khi dựng tiếp, chưa vẽ các màn này như thể chúng đã có số liệu:

- Đợt thanh toán, đề nghị thanh toán, công nợ
- Kho, nhập, xuất, định mức vật tư
- Bốn đồng hồ tiền trên dashboard
- Gantt, chấm công, ca máy, RFI, công văn

Dashboard chỉ có một thanh % khối lượng hoặc % dự án. Không vẽ thêm đồng hồ chi phí nếu chưa có API tiền.

## 11. Cách kiểm một màn vừa dựng

1. Vào bằng tài khoản không có dự án: thấy khung `Chưa có dự án`, không thấy thẻ rỗng.
2. Vào bằng tài khoản có dự án: hai nút Nhật ký và Khối lượng tách nhau, bấm đúng đường.
3. Tắt `enable_site_diary`: vào nhật ký vẫn đọc được form, nút gửi khóa, có banner đỏ.
4. Gửi Thực hiện rồi duyệt: hộp định mức tăng Thực hiện, Nghiệm thu đứng yên.
5. Gửi Nghiệm thu lớn hơn phần còn, policy Block: không tạo phiếu, banner đỏ nói lũy kế vượt thực hiện đã duyệt.
6. Mất mạng lúc gửi khối lượng: hộp xanh nói đã lưu máy, không hiện như thể Frappe đã nhận.
