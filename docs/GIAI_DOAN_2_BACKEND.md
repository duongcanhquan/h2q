# Giai đoạn 2 — Backend & DB (`h2q_core`)

**Trạng thái:** CODE ĐÃ VIẾT — chờ bạn chạy trên site Frappe và test API.  
**Quyết định áp dụng (mặc định §5 Giai đoạn 1):** Form chính = Measurement Book; vượt BOQ = warn; Telegram `485567058`; HĐ CĐT/RA = hoãn.

---

## 1. Files đã thêm / sửa

| File | Việc |
|---|---|
| `h2q_core/setup_custom_fields.py` | Custom fields `custom_h2q_*` trên MB / Entry / TPE / Project |
| `h2q_core/setup_workflow.py` | Workflow **H2Q Measurement Book Approval** trên field `custom_h2q_approval_status` |
| `h2q_core/setup_phase2.py` | One-shot `run()` + `after_migrate` |
| `h2q_core/api.py` | BOQ %, defaults, submit GPS/ảnh, request/approve/reject, pending queue |
| `h2q_core/telegram_bot.py` | Notify khi **Pending Approval** + khi **Certified** |
| `h2q_core/hooks.py` | `after_migrate` → setup_phase2 |

**Không** sửa source BuildSuite / ERPNext.

---

## 2. Custom fields (tóm tắt)

**Measurement Book:** `custom_h2q_approval_status`, `custom_h2q_task`, `custom_h2q_boq_item`, GPS lat/lng/accuracy, `custom_h2q_photo_urls`, `custom_h2q_boq_over_limit`, `custom_h2q_telegram_notified`, `custom_h2q_reject_reason`, `custom_h2q_submitted_by_user` (+ Employee nếu có HR).

**Entry:** boq_item, photo_url, rate, amount.

**Task Progress Entry / Project:** GPS/ảnh/ATSC; contract_no + geofence (P1 sẵn sàng).

---

## 3. Workflow

```
custom_h2q_approval_status:
  Draft → Pending Approval → Approved  ⇒ gọi buildsuite_core.api.subcontract.certify_measurement_book
                       ↘ Rejected      ⇒ giữ BuildSuite status=Draft
```

BuildSuite `status` (Draft/Certified) **không** bị workflow ghi đè.

---

## 4. API (sau khi login / API key)

| Method | Mục đích |
|---|---|
| `h2q_core.api.get_active_projects` | + `boq_progress_percent` |
| `h2q_core.api.get_project_wbs` | + `remaining_qty` / `over_limit` trên BOQ Item |
| `h2q_core.api.get_boq_item_defaults` | Autofill định mức |
| `h2q_core.api.submit_measurement` | Draft MB + GPS/ảnh; `auto_request_approval=1` optional |
| `h2q_core.api.request_measurement_approval` | → Pending + Telegram |
| `h2q_core.api.approve_measurement` | → Approved + **certify_measurement_book** |
| `h2q_core.api.reject_measurement` | → Rejected + reason |
| `h2q_core.api.get_pending_approvals` | Hàng đợi duyệt |

---

## 5. Lệnh bạn cần chạy trên bench

```bash
# Trong frappe-bench (site đã cài buildsuite_core + h2q_core)
bench --site <site> migrate
bench --site <site> execute h2q_core.setup_phase2.run
bench --site <site> clear-cache
```

### Smoke test gợi ý

```bash
# 1) Projects + BOQ %
bench --site <site> execute h2q_core.api.get_active_projects

# 2) WBS (thay PROJECT)
bench --site <site> execute h2q_core.api.get_project_wbs --kwargs '{"project":"PROJ-0001"}'

# 3) Defaults (thay BOQ Item)
bench --site <site> execute h2q_core.api.get_boq_item_defaults --kwargs '{"boq_item":"..."}'

# 4) Submit Draft (cần work_order + task thật trên site)
bench --site <site> execute h2q_core.api.submit_measurement --kwargs '{
  "project":"PROJ-0001",
  "task":"TASK-...",
  "work_order":"SWO-...",
  "quantity":1.5,
  "gps_lat":10.77,
  "gps_lng":106.70,
  "gps_accuracy":12,
  "image_urls":["https://example.com/photo.jpg"],
  "auto_request_approval":1
}'

# 5) Duyệt
bench --site <site> execute h2q_core.api.approve_measurement --kwargs '{"measurement_book":"MB-..."}'
```

Site config Telegram (nếu chưa có):

```json
{
  "telegram_bot_token": "<BotFather>",
  "telegram_chat_id": "485567058"
}
```

---

## 6. Ranh giới dừng

- ✅ Custom fields + workflow + API + Telegram Pending  
- ❌ Chưa Giai đoạn 3 (Supabase) / Giai đoạn 4 (UI polish mới)

Khi migrate + smoke test OK, gõ: **`Tiếp tục Giai đoạn 3`**.
