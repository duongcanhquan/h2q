# Spec P0 — Sổ hiện trường

**Trạng thái:** đã có trong repo. Chạy sau `bench migrate` và migration Supabase `20261103120000_measurements_entry_kind.sql`.  
**Ngoài phạm vi:** thanh toán chủ đầu tư, kho vật tư, bốn đồng hồ tài chính, RFI, máy, chấm công. Những phần đó đứng sau khi sổ này chạy trên site thật.

Sổ chính vẫn là Frappe. PWA không giữ số liệu kế toán.

## 1. Nhật ký thi công

Một phiếu cho một ngày, một dự án, một hạng mục. Gửi lại cùng khóa thì cập nhật phiếu cũ.

| Việc người dùng làm | Hệ thống |
|---|---|
| Mở Nhật ký trên thẻ dự án | `/project/[id]/diary` |
| Chọn thời tiết, hiện trường, an toàn, việc, nhân công, máy, ảnh, GPS | `h2q_core.api.submit_site_diary` |
| Mất mạng | IndexedDB `h2q-fastcons-diary`, gửi lại khi mở lại trang |

Cờ `enable_site_diary` mặc định tắt. Bật trên H2Q Settings rồi mới gửi được.

Phiếu ghi vào **Task Progress Entry**. Khối lượng trên nhật ký là ước lượng ngày, không vào sổ nghiệm thu. Ảnh đi R2. GPS và cờ ngoài vùng nằm trên custom field `custom_h2q_*`.

## 2. Vùng công trường

Project.`custom_h2q_site_geofence_json` nhận một trong ba dạng:

```json
[[10.76, 106.66], [10.76, 106.70], [10.80, 106.70], [10.80, 106.66]]
```

```json
{"ring": [{"lat": 10.76, "lng": 106.66}, {"lat": 10.76, "lng": 106.70}, {"lat": 10.80, "lng": 106.70}]}
```

```json
{"type": "Polygon", "coordinates": [[[106.66, 10.76], [106.70, 10.76], [106.70, 10.80], [106.66, 10.80], [106.66, 10.76]]]}
```

GeoJSON dùng thứ tự kinh độ, vĩ độ. Hai dạng kia dùng vĩ độ, kinh độ.

| `geofence_enforcement` | Khi điểm nằm ngoài vùng, hoặc chưa có GPS mà đã có polygon |
|---|---|
| Off | Bỏ qua |
| Warn | Ghi `custom_h2q_geofence_outside = 1`, vẫn tạo phiếu |
| Block | Từ chối phiếu |

Dự án chưa khai polygon thì mọi policy đều cho qua. Điểm nằm trên cạnh vùng tính là trong vùng.

`get_project_wbs` trả `site_geofence.ring` để PWA báo trước. Server vẫn quyết định lúc ghi.

## 3. Bốn cột khối lượng

FastCons không dùng một số cho mọi việc. Trên cùng một hạng mục có bốn lớp. H2Q giữ đúng lớp đó:

| Cột | Nguồn | Khi nào tăng |
|---|---|---|
| Hợp đồng | BOQ Item `planned_qty` | Khi lập dự toán / phụ lục |
| Thực hiện | Measurement Book loại Thực hiện, đã duyệt | Chỉ huy duyệt xong. BuildSuite vẫn để Draft, không chứng nhận |
| Nghiệm thu | Measurement Book loại Nghiệm thu, đã chứng nhận | Cấp duyệt cuối gọi `certify_measurement_book` |
| Thanh toán | Chưa mở | Không lấy số nghiệm thu để điền vào cột này |

Phiếu thực hiện không được chứng nhận. Chứng nhận là cửa sang thanh toán thầu phụ.

Nghiệm thu lũy kế không vượt thực hiện đã duyệt. Chưa có thực hiện đã duyệt thì nghiệm thu so với khối lượng hợp đồng, để sổ cũ vẫn gửi được. Thực hiện lũy kế không vượt hợp đồng. Vượt mức theo policy Warn, Block, hoặc Warn Require Note đang có trong H2Q Settings. Kiểm tra dùng tổng các phiếu, không chỉ khối lượng của phiếu đang gửi.

Nhật ký chỉ ghi ước lượng trong ngày vào `custom_h2q_diary_qty`. Số đó không cộng vào BOQ và không thay sổ thực hiện.

PWA hiện Hợp đồng, Thực hiện, Nghiệm thu, Còn nghiệm thu ngay trên form.

## 4. Duyệt nhiều cấp

Mặc định không đổi: mọi dòng `approval_level = 0` thì một lần Duyệt là certify, như hiện tại.

Khi cần chuỗi, trên H2Q Settings → Approval Roles đặt:

| Role | Can Approve | Approval Level |
|---|---|---|
| Chỉ huy | 1 | 1 |
| QS | 1 | 2 |

Cấp 1 bấm Duyệt: phiếu vẫn Pending, `custom_h2q_approval_level` thành 1, Telegram gửi lại cho cấp sau.  
Cấp 2 bấm Duyệt: trạng thái Approved. Phiếu Nghiệm thu thì gọi `certify_measurement_book`. Phiếu Thực hiện dừng ở Approved, BuildSuite giữ Draft.  
Sai cấp: API từ chối và nêu vai trò đang cần.  
System Manager duyệt được cấp hiện tại.  
Từ chối đưa level về 0, giữ Draft của BuildSuite.

Hai vai cùng một số level thì vai nào cũng xong cấp đó.

Workflow Desk vẫn một trạng thái Pending. Chặn nhảy cóc sang Approved nằm ở `measurement_book_events.validate`.

## 5. Kiểm thử không cần site

```bash
cd h2q_core
python -m unittest h2q_core.tests.test_field_rules
```

Ba module `geo`, `approval_chain`, `field_rules` không import Frappe. Nhật ký và certify cần site BuildSuite.

## 6. Việc chạy trên site

```bash
bench --site <site> migrate
bench --site <site> execute h2q_core.setup_phase2.run
```

Supabase: chạy `h2q-fastcons-app/supabase/migrations/20261103120000_measurements_entry_kind.sql`.

Desk:

1. Bật Enable Site Diary.
2. Dán polygon vào Project → Site Geofence JSON. Chọn Warn hoặc Block.
3. Nếu muốn hai cấp, điền Approval Level 1 và 2. Để 0 nếu giữ một cấp.
4. Save H2Q Settings.

Thử: gửi nhật ký, gửi khối lượng Thực hiện trong vùng, gửi một điểm ngoài vùng, duyệt đủ cấp thì phiếu Certified.
