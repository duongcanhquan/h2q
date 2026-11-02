# Giai đoạn 1 — Rà soát BuildSuite ↔ Fastwork (FastCons) → H2Q

**Trạng thái:** CHỜ DUYỆT — chưa triển khai Giai đoạn 2–4.  
**Phạm vi nguồn trong monorepo H2Q:**

| Path người dùng nêu | Thực tế trong repo |
|---|---|
| `apps/buildsuite/.../construction_management` | **Không tồn tại.** BuildSuite = `buildsuite_src/buildsuite_core` (app `buildsuite_core`, module **BuildSuite Core**). |
| `apps/erpnext` | **Không có source ERPNext.** Chỉ có `h2q_erp/` (frappe_docker). Project/Task lấy từ ERPNext runtime; BuildSuite gắn Custom Field qua `custom_property_list/custom_field.py`. |

---

## 1. Inventory DocType BuildSuite Core

Quét `buildsuite_src/buildsuite_core/buildsuite_core/doctype/` → **~68 DocType** (không có thư mục `construction_management`). Phân cụm theo domain:

### 1.1 Estimation / BOQ
| DocType | Vai trò lõi |
|---|---|
| **BOQ** | Dự toán theo project/customer; revision; status Draft→Submitted→Approved→Superseded |
| **BOQ Group** | Nhóm hạng mục (WBS-cost) |
| **BOQ Item** | Dòng định mức: `planned_qty`, `rate`, `actual_qty`, link `task` / `work_package` |
| **BOQ Sub Item** | Thành phần con |
| **BOQ WP Summary** | Tổng hợp theo Work Package |
| **Assembly** / Component / Category | Tổ hợp định mức (explode) |
| **Estimate Template** (+ Group / Row) | Mẫu dự toán |
| **Construction Rate Master** / History / Trade | Thư viện đơn giá |
| **BuildSuite Tenders** (+ Section / Items) | Gói thầu / tender |

### 1.2 Site execution / PM / WBS
| DocType | Vai trò lõi |
|---|---|
| **Work Package** | Gói công việc cấp project; `progress`, schedule, budget |
| **Stage Planning** (+ Task / Dependency) | Kế hoạch giai đoạn + phụ thuộc (Gantt engine) |
| **Schedule Snapshot** | Baseline tiến độ |
| **Task Progress Entry** (+ Details) | Nhật ký % tiến độ theo ERPNext **Task** (labour, weather, blocker) |
| **Scope Change Order** (+ Activity) | Phát sinh / thay đổi phạm vi |
| **Project Category / Settings / Team / Assigned / Tab Visibility** | Cấu hình & đội dự án |
| **Stage Delay Reason** | Lý do chậm giai đoạn |

### 1.3 Subcontract / Measurement / Billing
| DocType | Vai trò lõi |
|---|---|
| **Subcontractor** (Supplier type) | Thầu phụ |
| **Subcontractor Work Order** (+ Line) | Hợp đồng giao thầu + Schedule of Values (submittable) |
| **Measurement Book** (+ Entry) | Nghiệm thu khối lượng đo thực tế; status **Draft → Certified** (không submittable) |
| **Subcontractor Bill** (+ Line / Tax) | Hóa đơn thầu phụ → Purchase Invoice |
| **Subcontract Delivery Type** | Loại giao nhận |

### 1.4 Workforce / Equipment
Field Attendance, Crew, Labour/Overtime Registers, Labour Trade, Machinery (+ Usage / Type).  
(BuildSuite **HR-free core** — không bắt buộc ERPNext HRMS.)

### 1.5 Finance / Platform
Petty Cash, Expense Entry; Persona/Workspace; Core Settings; Payment Term/Milestone templates.

### 1.6 ERPNext spine (không thuộc BuildSuite nhưng bắt buộc)
| DocType | Vai trò với H2Q |
|---|---|
| **Project** | Dự án (+ custom: PM, parent project, team, category…) |
| **Task** | WBS thực thi (+ custom progress details, task id…) |
| Material Request / PO / Purchase Receipt / Stock Entry | Mua sắm & vật tư (BuildSuite gắn cost code) |

---

## 2. Mapping 1–1: BuildSuite ↔ Fastwork FastCons

| Fastwork (FastCons) | BuildSuite / ERPNext tương ứng | Độ khớp | Ghi chú H2Q |
|---|---|---|---|
| **Quản lý Dự án** (danh sách, % tiến độ, cảnh báo sức khỏe) | ERPNext **Project** + BuildSuite **Project Dashboard API**, Work Package, Stage Planning | Cao (dữ liệu) / Thấp (UX mobile) | `h2q_core.api.get_active_projects` đã bọc Project |
| **WBS / Kế hoạch (Gantt, phụ thuộc)** | ERPNext **Task** + **Stage Planning** + schedule engine | Cao | `get_project_wbs` đọc Task + BOQ Item theo task |
| **Dự toán / BOQ / định mức** | **BOQ**, Group, Item, Rate Master, Assembly | Cao | Chọn hạng mục → autofill qty/rate từ BOQ Item |
| **Nhật ký thi công** (ngày, hạng mục, NC/VT/máy, thời tiết, ảnh) | **Task Progress Entry** (progress %, labour, weather) — **không** có ảnh/GPS/vật tư dòng | Trung bình | Cần mở rộng +/hoặc DocType nhật ký H2Q |
| **Nghiệm thu / nhật ký khối lượng** | **Measurement Book** + Entry (L×B×D, deduction, cost code) | Cao (tính KL) / Thấp (duyệt & media) | `submit_measurement` tạo MB Draft |
| **Khối lượng nhận thầu (CĐT)** | **BOQ** (contract estimate) | Trung bình | FastCons gắn HĐ CĐT; BuildSuite BOQ ± Quotation/Sales |
| **Khối lượng giao thầu (thầu phụ)** | **Subcontractor Work Order** (SOV lines) | Cao | MB **bắt buộc** `work_order` |
| **Đợt nghiệm thu / thanh toán** | MB Certified → **Subcontractor Bill** → PI; thiếu “đợt NT với CĐT” rõ ràng | Trung bình | Client RA billing = “Not in this release” (README BuildSuite) |
| **Hợp đồng thầu phụ** | SWO + Terms + Retention % | Cao | Thiếu UI hợp đồng VN (số HĐ, phụ lục, điều khoản pháp lý VN) |
| **Hợp đồng nhận thầu / CĐT** | Customer + Project + BOQ (+ ERPNext Sales Order/Quotation) | Trung bình | Chưa có DocType “Hợp đồng CĐT” riêng |
| **Quản lý vật tư định mức & vượt định mức** | Procurement + BOQ actuals / cost code; Material Consumption | Trung bình | Cảnh báo vượt BOQ trên mobile chưa có |
| **Chấm công công trường** | Field Attendance / Muster | Cao (desk) | Chưa vào FastCons PWA |
| **Ảnh hiện trường + thư mục ảnh** | File (Frappe) / R2 hook H2Q | Thấp trên MB gốc | MB Entry **không** có field ảnh |
| **GPS realtime** | Không có trên MB / TPE | Thiếu | Cần custom field |
| **Báo cáo Zalo / Telegram nhanh** | Không native; H2Q đã có `telegram_bot` / notifier | Một phần | Chưa gắn workflow duyệt MB |
| **Duyệt khối lượng nhiều cấp** | MB chỉ Draft↔Certified (1 bước certify); Workflow shipped: SCO / Stage / MR — **không** có workflow MB | Thiếu | Cần Workflow Nháp→Chờ duyệt→Đã duyệt |

---

## 3. Gap analysis — BuildSuite thiếu gì so với trải nghiệm Fastwork

### 3.1 UX / Field (ưu tiên P0 cho h2q.com.vn)
1. **Mobile tối giản “mũ cối / găng tay”** — BuildSuite SPA là desk Vue dày; FastCons tối ưu form ngắn, nút lớn, offline.
2. **Chụp ảnh liền tay + lưu chứng từ nghiệm thu** — MB Entry không có Attach/Image; TPE cũng không.
3. **GPS / geofence** — không có lat/lng/accuracy trên phiếu hiện trường.
4. **Offline-first sync** — BuildSuite online Frappe; FastCons kiểu queue → sync (H2Q đã phác Supabase `measurements_sync`).
5. **Thông báo tức thì Telegram/Zalo** khi gửi duyệt / vượt định mức — chưa gắn event MB.

### 3.2 Nghiệp vụ khối lượng & duyệt (P0–P1)
6. **Luồng duyệt nhiều cấp** (KS hiện trường → Chỉ huy → PMB/QS) — MB chỉ 2 trạng thái Draft/Certified, không Pending.
7. **Liên kết nhật ký ngày ↔ nghiệm thu ↔ BOQ nhận thầu** một chiều tự động kiểu FastCons — hiện tách TPE (% progress) vs MB (qty đo); `actual_qty` BOQ Item cập nhật từ actuals khác, chưa từ field photo-log.
8. **Cảnh báo vượt planned_qty / định mức** ngay lúc nhập — API field chưa enforce soft/hard warn.
9. **Đợt nghiệm thu với Chủ đầu tư (RA / client billing)** — BuildSuite ghi rõ chưa ship; FastCons có đợt NT + thanh toán CĐT.
10. **Hợp đồng nhận thầu** (số HĐ, giá trị, phụ lục BOQ) — phải ghép ERPNext Sales + BOQ; chưa chuẩn hóa VN.

### 3.3 Nguồn lực & báo cáo (P1–P2)
11. **Nhật ký đủ “mẫu Nhật ký thi công VN”** (thời tiết, an toàn, máy, vật tư tiêu hao theo hạng mục trong cùng 1 phiếu).
12. **Import BOQ từ Excel / phần mềm dự toán VN** — BuildSuite có import/template; chưa pipeline “dự toán VN → BOQ” trong `h2q_core`.
13. **Lịch nhật ký theo ngày** (calendar view) — desk có list; PWA chưa có.

### 3.4 Những gì BuildSuite đã mạnh hơn Fastwork (giữ nguyên, wrap — không viết lại)
- Cost code accounting (committed vs actual), Subcontractor Bill → Purchase Invoice idempotent.
- Schedule engine + Stage Planning dependencies.
- Assembly explosion, rate history.
- Persona / DocPerm matrix sâu.

**Nguyên tắc H2Q:** SoR = Frappe/BuildSuite; **không fork** DocType gốc; bù gap bằng Custom Field + `h2q_core` API + Workflow + PWA.

---

## 4. Đề xuất Adaptation (chốt trước Giai đoạn 2)

### 4.1 Custom Fields (script `setup_custom_fields.py` — Giai đoạn 2)

#### A. `Measurement Book` (parent)
| Fieldname | Type | Mục đích |
|---|---|---|
| `custom_h2q_approval_status` | Select: `Draft / Pending Approval / Approved / Rejected` | Map UX FastCons; song song `status` Draft/Certified |
| `custom_h2q_task` | Link → Task | WBS hiện trường (MB gốc không có task) |
| `custom_h2q_boq_item` | Link → BOQ Item | Định mức đã chọn |
| `custom_h2q_gps_lat` / `custom_h2q_gps_lng` / `custom_h2q_gps_accuracy` | Float | GPS lúc gửi |
| `custom_h2q_photo_urls` | Long Text (JSON array URL R2) | Chứng từ ảnh |
| `custom_h2q_telegram_notified` | Check | Idempotent notify |
| `custom_h2q_submitted_by_employee` | Link → Employee | Liên kết HR (`setup_hr`) |
| `custom_h2q_reject_reason` | Small Text | Khi Rejected |

#### B. `Measurement Book Entry` (child)
| Fieldname | Type | Mục đích |
|---|---|---|
| `custom_h2q_boq_item` | Data/Link | Trace dòng BOQ |
| `custom_h2q_photo_url` | Data | Ảnh theo dòng (optional) |
| `custom_h2q_rate` / `custom_h2q_amount` | Currency | Hiển thị giá trị tạm tính trên PWA |

#### C. `Task Progress Entry` (nhật ký ngày — bổ sung)
| Fieldname | Type | Mục đích |
|---|---|---|
| `custom_h2q_gps_*` | Float | GPS |
| `custom_h2q_photo_urls` | Long Text | Ảnh nhật ký |
| `custom_h2q_safety_note` | Small Text | ATSC |
| `custom_h2q_equipment_note` | Small Text | Máy móc trong ngày |

#### D. `Project` (optional P1)
| Fieldname | Type | Mục đích |
|---|---|---|
| `custom_h2q_contract_no` | Data | Số HĐ nhận thầu |
| `custom_h2q_site_geofence_json` | Long Text | Vùng GPS công trường |

> Giữ nguyên field BuildSuite; prefix `custom_h2q_` tránh đụng migrate BuildSuite.

### 4.2 API mới / mở rộng trong `h2q_core.api` (Giai đoạn 2)

| Method | Việc | Wrap logic gốc |
|---|---|---|
| `get_active_projects` | **Đã có** — bổ sung `% từ BOQ` (Σ actual_qty/planned_qty hoặc amount) | Project + BOQ Item |
| `get_project_wbs` | **Đã có** — bổ sung soft remaining qty, cảnh báo vượt | Task + BOQ |
| `submit_measurement` | **Đã có** — ghi GPS/ảnh vào custom fields; set Pending Approval | `MeasurementBook.validate` `_compute_quantities` |
| `get_boq_item_defaults` | **Mới** — khi chọn hạng mục: unit, planned_qty, rate, remaining | BOQ Item |
| `request_measurement_approval` | **Mới** — Draft→Pending; enqueue Telegram | Workflow / set custom status |
| `approve_measurement` / `reject_measurement` | **Mới** — Pending→Approved rồi gọi **`buildsuite_core.api.subcontract.certify_measurement_book`** (logic gốc; không tự `db_set`); Reject → `custom_h2q_reject_reason` | MB Certified → bill readiness |
| `get_pending_approvals` | **Mới** — hàng đợi duyệt cho Chỉ huy/PMB | MB filter |
| `submit_site_diary` | **Mới (P1)** — tạo Task Progress Entry + media | TPE |

**Bắt buộc:** mọi API `frappe.has_permission(..., throw=True)`; không mock; lỗi `frappe.log_error`.

### 4.3 Workflow + Hook (Giai đoạn 2)

```
Measurement Book (H2Q):
  Draft → (Gửi duyệt) → Pending Approval
       → (Duyệt)     → Approved  ⇒ đồng bộ BuildSuite status = Certified
       → (Từ chối)   → Rejected  ⇒ giữ Draft hoặc Rejected + lý do
```

- Script seed Workflow/States/Transitions trong `h2q_core` (không sửa fixture BuildSuite).
- `hooks.py`: `on_update` Measurement Book → nếu chuyển Pending → `telegram_notifier.notify_pending_measurement`.

### 4.4 Mapping kỹ thuật SoR (nhắc Giai đoạn 3–4, chưa làm)

| Lớp | Vai trò |
|---|---|
| Frappe/MariaDB + BuildSuite | System of record |
| Supabase `measurements_sync` / `project_progress` | Offline queue + Realtime (đã có skeleton) |
| Cloudflare R2 | Ảnh hiện trường |
| Next.js PWA FastCons | UI field |

---

## 5. Quyết định cần bạn chốt trước Giai đoạn 2

1. **Nhật ký thi công vs Nghiệm thu khối lượng:**  
   - **Đề xuất mặc định:** PWA form chính → **Measurement Book** (KL + ảnh + GPS + duyệt). Nhật ký ngày (TPE) = phase P1 riêng.  
2. **Độ cứng vượt BOQ:** warn only / block submit khi `qty > remaining`?  
   - **Đề xuất:** warn + cho gửi; QS từ chối trên Pending.  
3. **Telegram chat id** đã có `485567058` — xác nhận dùng cho mọi Pending MB.  
4. **Client RA / HĐ CĐT:** để Giai đoạn sau (P2) hay bắt buộc ngay trong Giai đoạn 2?  
   - **Đề xuất:** **không** vào Giai đoạn 2 (trùng “Not in this release” BuildSuite); chỉ SWO + MB.

---

## 6. Ranh giới dừng

- ✅ Inventory DocType + mapping FastCons + gap + adaptation  
- ❌ Chưa viết `setup_custom_fields.py`, chưa đổi Workflow/hooks, chưa đụng Giai đoạn 3–4  

**Bước tiếp theo:** Bạn duyệt báo cáo (và 4 quyết định §5). Khi đồng ý, gõ đúng:  
`Tiếp tục Giai đoạn 2`
