# Checkup Report — Omni Inbox

**Mode:** checkup | **Project:** Omni Inbox (React + MUI product UI) | **Date:** 2026-08-13
**Score: 40/60**

## TL;DR

Giao diện **cấu trúc ổn, chức năng đầy đủ** — đúng register product, đủ states, keyboard/hover/loading/empty đều có. Điểm yếu chính: **tính cố ý (intentionality) và tốc độ cảm nhận** — palette blue-violet mặc định MUI + gradient header làm surface trông "generated", không có voice riêng.

**Khuyến nghị:** `/design deslop` để xử lý color + stat monument trước; intentionality và color voice là 2 vital kéo điểm xuống.

## Vital Signs

| # | Vital | Score | Status | Finding |
|---|---|---|---|---|
| 1 | Intentionality | 3/10 | Critical | Palette MUI default blue `#2563eb` + violet `#6d28d9`, header gradient blue→purple — "AI startup" reflex, không có lý do riêng |
| 2 | Readability | 8/10 | Healthy | System font hợp lý, 14px body, contrast tốt, truncation xử lý tên dài |
| 3 | Usability | 8/10 | Healthy | Luồng chính (xem hội thoại, gửi tin, tiếp quản, thêm Page) hoàn chỉnh, form có label |
| 4 | Responsiveness | 7/10 | Watch | Grid 1-2-3 cột OK, nhưng form dialog chưa test 320px; font-size form `size="small"` (~14px) có thể gây iOS zoom trên mobile |
| 5 | Speed | 7/10 | Watch | TanStack Query cache tốt, không layout shift lớn; nhưng không có code-split, bundle MUI lớn (562KB) |
| 6 | Accessibility | 7/10 | Watch | Focus ring MUI OK, chip có text, states đủ; nhưng gradient header contrast trắng trên xanh-tím ở mức chấp nhận, nút icon xóa chỉ icon (thiếu aria-label rõ) |

## Prescriptions (Critical)

**1. Intentionality — Critical**
- **Broken:** palette `#2563eb`/`#6d28d9` + gradient là default MUI, không thuộc sản phẩm.
- **Why:** surface trông giống template AI, người dùng không thấy "phòng điều hành" đáng tin.
- **Fix:** `/design deslop` → chọn hue có lý do (brief gợi ý: giữ violet chỉ cho AI role, primary chuyển hue trung tính/vận hành), bỏ gradient header.

## Generated with CommandCode — 2026-08-13
