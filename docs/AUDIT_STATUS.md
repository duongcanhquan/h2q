# Audit trạng thái H2Q (2026-11-02)

## Verdict

**Code monorepo: đủ để ship Vercel + cấu hình Frappe/Supabase.**  
**Runtime E2E end-to-end: chưa xác minh trên site Frappe thật trong môi trường agent** (không có bench/MariaDB chạy). Cần bạn chạy `docs/INSTALL.md` §1–4.

## Checklist tính năng

| Tính năng | Code | Cần hạ tầng | Ghi chú |
|---|---|---|---|
| H2Q Settings (Desk + API) | ✅ | migrate | Admin đổi policy |
| Custom fields MB GPS/ảnh/duyệt | ✅ | migrate + setup_phase2 | |
| Workflow Pending→Approved→certify | ✅ | setup_phase2 | 1 cấp |
| API projects/WBS/submit/approve | ✅ | Frappe + BuildSuite | |
| Telegram Pending/Certified | ✅ | bot token | |
| Frappe→Supabase push | ✅ | supabase_* site_config | |
| Supabase buffer + Realtime | ✅ | migrations + env | |
| PWA login/BFF cookie | ✅ | FRAPPE_URL CORS/cookie | |
| Dashboard % BOQ | ✅ | data BOQ trên site | |
| Form GPS + R2 + offline | ✅ | R2 + Supabase | |
| `/api/sync` webhook public (proxy) | ✅ đã vá | SYNC_WEBHOOK_SECRET | |
| Geofence enforce | ⚠️ setting only | — | Chưa tính polygon |
| Multi-level approval | ⚠️ | — | Mở rộng matrix |
| Site diary TPE UI | ⚠️ flag off | — | |
| Client RA | ❌ flag off | — | |

## Sửa trong đợt audit này

- Proxy mở `/api/sync` + `/api/health` (webhook không bị redirect login)
- Lint setState-in-effect (ReportForm / ProjectGrid / useProjectWbs)
- `vercel.json`, `docs/INSTALL.md`, health route
