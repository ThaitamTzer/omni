# Smell Report — Omni Inbox

**Mode:** smell | **Project:** Omni Inbox (React + MUI dashboard) | **Date:** 2026-08-13
**Score:** 6/10 — PRESENT

## TL;DR

Giao diện dashboard (PagesPage, Inbox, theme) đang dùng palette mặc định của MUI với primary `#2563eb` (blue) + secondary `#6d28d9` (purple) và gradient blue→purple trên header — đúng mẫu "AI startup" phổ biến. Các card thống kê và avatar icon tròn lặp lại như template. Không có màu/type/composition nào thuộc riêng sản phẩm này (inbox đa Page + AI agent).

**Khuyến nghị chính:** chạy `/design recolor` để chọn hue có lý do riêng (không phải blue-violet), rồi `/design typeset` + `/design relayout` cho header và stats.

## Heuristic Scores

| # | Heuristic | Score | Key finding |
|---|---|---|---|
| 1 | Tech gradient | 0 | Header PagesPage: `linear-gradient(135deg, #2563eb, #7c3aed)` — blue→purple đúng reflex AI startup |
| 2 | Generic tech hue | 0 | Primary `#2563eb` + secondary `#6d28d9` khắp app (theme.ts, sidebar active, message AI gradient `#2563eb→#4f46e5`) |
| 3 | Feature tile grid | 1 | Page cards grid 3 cột — hợp lý vì page là artifact rời rạc, không phải tile trang trí |
| 4 | Accent rail | 1 | Không có stripe trang trí bên cạnh card |
| 5 | Unearned blur | 1 | Không có frosted glass |
| 6 | Stat monument | 0 | 3 stat card số 24px bằng nhau, không ưu tiên — số to lấn nội dung thật |
| 7 | Icon topper | 0 | Mỗi stat card + mỗi page card đều có avatar icon tròn ở đầu — pattern lặp template |
| 8 | Bounce everywhere | 1 | Chỉ có hover `translateY(-2px)` nhẹ — không toy motion |
| 9 | Default type | 1 | MUI system font hợp lệ cho product UI; chưa có scale riêng nhưng không phải smell mạnh |
| 10 | Center stack | 1 | Layout sidebar + content, không center stack |

**Tổng: 6/10 — PRESENT (4 tells phát hiện)**

## Cognitive Load / Risk

- **PASS** — Cấu trúc monitor/configure rõ: sidebar điều hướng, danh sách Page, form thêm, hướng dẫn. Work pattern đúng thể loại.
- **PASS** — States đầy đủ: loading skeleton, empty state, error Snackbar, hover card.
- **WATCH** — 3 stat card bằng nhau không nói điều gì về ưu tiên; số "Tổng/Đã kết nối/Chưa kết nối" chỉ lặp cùng dữ liệu.
- **FAIL** — Màu không có lý do: blue-purple là reflex "software", không gắn với inbox đa Page + AI agent của Omni.

## Next Modes

`/design recolor` — chọn hue có lý do riêng cho sản phẩm, loại bỏ gradient blue→purple
`/design typeset` — dựng scale + hierarchy có chủ đích thay vì MUI default
`/design relayout` — xử lý stat monument + icon topper, tạo ưu tiên thị giác cho nội dung thật

## What's Working

- **Cấu trúc work pattern** — sidebar + content đúng chuẩn operate/monitor surface, không center stack.
- **States đầy đủ** — loading skeleton, empty state có CTA, error qua Snackbar, hover feedback.
- **Density hợp lý** — table + cards gọn, không thừa padding; text truncation xử lý tên dài.

## Priority Issues

### P0 — Palette không có lý do (generic tech hue + gradient)
**Evidence:** `theme.ts` primary `#2563eb`, secondary `#6d28d9`; PagesPage header `linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)`; Inbox AI message `linear-gradient(135deg, #2563eb, #4f46e5)`. Đây là combo "AI startup" mặc định.
**FIX:** `/design recolor` — chọn 1 hue có lý do (ví dụ: cam/đỏ messenger, xanh lá tin nhắn đã đọc, hoặc hue trung tính + 1 accent); bỏ gradient, dùng 1 màu phẳng có chủ đích; tint neutrals về hue đó.

### P1 — Stat monument không ưu tiên
**Evidence:** 3 card `fontSize: 24` đứng đầu trang, số liệu lặp nhau (tổng = đã kết nối + chưa kết nối), không có hành động nào nổi bật hơn.
**FIX:** `/design relayout` — thay 3 stat bằng 1 dòng summary gọn + đưa hành động chính (Thêm Page) lên vị trí dẫn, hoặc gộp stats vào header.

### P2 — Icon topper lặp template
**Evidence:** mỗi stat card có Avatar icon tròn (`bgcolor #eff6ff` / `#dcfce7` / `#fef3c7`), mỗi page card có avatar màu — pattern lặp ở mọi khối.
**FIX:** giữ avatar cho page card (artifact thật), bỏ avatar trang trí khỏi stat cards, thay bằng typography + số có hierarchy.

## Generated with CommandCode — 2026-08-13
