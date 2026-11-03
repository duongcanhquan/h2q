# Spec — Bốn sổ tách nhau, cùng một hệ thống tổng

Ngày chốt: 2026-11-03. Áp cho ứng dụng `h2q-fastcons-app`. Nguồn nghiệp vụ: cụm BuildSuite (nhà thầu phụ, work order, vật tư mua theo cost code) và cách FastCons theo dõi theo công trình, hạng mục, ngày. Không gộp các sổ vào một ô nhập.

## 1. Bốn sổ không được lẫn

| Sổ | Hỏi gì | Không được dùng để |
|---|---|---|
| Thi công | Ai làm, hạng mục nào, chi phí giao đội, khối lượng thực hiện và nghiệm thu | Ghi tồn kho hoặc tiền mua hàng |
| Nhà thầu nhỏ | Ai nhận gói việc bên ngoài, hợp đồng giao thầu, giữ lại bảo hành | Đóng vai nhà cung cấp, hoặc nhận một phiếu xuất kho như thể họ là kho |
| Nhà cung cấp | Ai bán hàng, giá chào, mã số thuế | Nhận giao thầu thi công |
| Kho | Hàng đang nằm ở đâu, nhập bao nhiêu tiền, xuất cho ai | Sửa khối lượng hợp đồng trên dự toán |

Hệ thống tổng là công trình và hạng mục. Cả bốn sổ chỉ được trỏ tới công trình hoặc hạng mục khi việc đó thật sự thuộc về công trình. Một kho cơ sở phục vụ nhiều công trình thì tồn nằm ở địa điểm, không nằm trên dự toán.

## 2. Thi công

Đường đi: công trình → hạng mục → gói việc → giao đội (một chi phí) → nhật ký và ảnh trong ngày → phiếu khối lượng → duyệt.

- Vai trò công trình là tổng thầu hoặc thầu vận hành chính.
- Chi phí giao đội không cộng vào tồn kho và không trừ dự toán.
- Khối lượng có bốn lớp: hợp đồng, thực hiện, nghiệm thu, thanh toán. Thanh toán chưa mở. Nhật ký không cộng vào khối lượng.

## 3. Nhà thầu nhỏ

Một nhà thầu nhỏ là một bản ghi thầu phụ, rồi một hợp đồng giao thầu gắn một công trình. Dòng hợp đồng gắn dòng dự toán khi có.

Nhà thầu nhỏ không có phiếu nhập kho. Nếu họ đưa vật tư vào công trình, hàng vẫn phải nhập kho từ một nhà cung cấp, hoặc xuất từ một địa điểm kho.

## 4. Nhà cung cấp

Nhà cung cấp chỉ bán hàng. Giá nguyên liệu là giá chào theo ngày, gắn nhà cung cấp. Giá chào không làm tăng tồn.

Định mức trên công trình là số được phép dùng cho một hạng mục. Đó là hạn mức, không phải số đang nằm trong kho và không phải số đã mua.

## 5. Kho nhiều địa điểm

### 5.1 Danh mục

- Địa điểm: kho cơ sở hoặc kho công trường. Một địa điểm phục vụ nhiều công trình.
- Mặt hàng: `vat_lieu` hoặc `cong_cu`. Mỗi mặt hàng một mã, một đơn vị. Có thể trỏ tới một dòng giá chào để đối chiếu, không bắt buộc.

Máy móc trên sổ thiết bị là tài sản điều hành, không phải dòng tồn kho. Công cụ tiêu hao hoặc cầm tay đi qua kho.

### 5.2 Ba phiếu, không có lối tắt

Tồn của một mặt hàng tại một địa điểm chỉ đổi bằng phiếu. Không có ô sửa tồn.

| Phiếu | Bắt buộc | Tồn | Tiền |
|---|---|---|---|
| Nhập | Địa điểm, nhà cung cấp, ngày, từng dòng: mặt hàng, số lượng > 0, đơn giá ≥ 0 | Cộng tại địa điểm | Tiền nhập = số lượng × đơn giá. Cộng dồn theo phiếu, không sửa khi xuất |
| Xuất bàn giao | Địa điểm nguồn, công trình, người nhận (nhân sự hoặc họ tên), ngày | Trừ tại địa điểm. Cấm nếu trừ xong bị âm | Không phát sinh tiền mua. Ghi giá vốn bình quân lúc xuất để biết giá trị đã giao |
| Chuyển | Kho nguồn khác kho đích | Trừ nguồn, cộng đích cùng một số lượng | Không có nhà cung cấp, không gắn công trình |

Một phiếu nhiều dòng. Cùng một mặt hàng xuất hai lần trong một phiếu thì lần sau thấy tồn đã trừ lần trước. Hai người ghi cùng lúc thì phiếu sau chờ phiếu trước, để không xuất trùng.

Giá vốn bình quân tại một địa điểm = giá trị còn lại / số lượng còn lại. Phiếu xuất và chuyển đóng dấu giá này. Phiếu nhập dùng đơn giá hóa đơn, không lấy giá chào.

### 5.3 Bàn giao

Phiếu xuất trả lời đủ: hàng gì, bao nhiêu, từ kho nào, về công trình nào, hạng mục nào nếu có, giao cho ai, ngày nào. Không xuất nếu thiếu công trình hoặc thiếu người nhận.

### 5.4 Cái sổ tổng được đọc

- Dự toán không đổi khi nhập hoặc xuất.
- Định mức vẫn là số cho phép.
- Số đã rời kho cho một công trình là tổng số lượng trên phiếu xuất của công trình đó. Không gõ số này ở màn giá.
- Tiền nhập hàng là tổng tiền các phiếu nhập. Không lấy từ giá chào và không lấy từ chi phí giao đội.

## 6. Việc cố ý chưa mở

Lương, chứng chỉ thanh toán chủ đầu tư, bút toán kế toán kép, nhập từ Excel. Hóa đơn tệp ảnh vẫn để ở Hồ sơ, loại hóa đơn, và không tự tạo phiếu nhập.
