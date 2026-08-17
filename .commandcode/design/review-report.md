# Review Report — Omni Inbox

**Mode:** review | **Project:** Omni Inbox (React + MUI product UI) | **Date:** 2026-08-13
**Score: 30/50**

## TL;DR

**Ấn tượng đầu tiên:** dashboard vận hành có cấu trúc rõ ràng (sidebar + inbox 2 cột + settings), nhưng **không có điểm nhìn riêng** — màu xanh-tím MUI mặc định + gradient header khiến nó trông như bất kỳ SaaS nào. Điều đáng nhớ nhất là... không có gì đáng nhớ.

**Khuyến nghị:** `/design deslop` — thay palette reflex bằng hue có lý do, phá gradient, dùng stat có ý nghĩa. Đây là can thiệp trung bình, không phải redesign toàn bộ.

## Design Lenses

| # | Lens | Score | Finding |
|---|---|---|---|
| 1 | First impression | 4/10 | Không có POV; gradient blue→purple + card grid generic; category (inbox đa Page) không hiện ngay ở hero |
| 2 | Hierarchy | 7/10 | Hội thoại pending dẫn mắt tốt (chip +ng unread badge); stat card bằng nhau làm mờ ưu tiên |
| 3 | Color voice | 4/10 | Blue `#2563eb` + violet `#6d28d9` không có lý do; violet chỉ hợp lý khi giới hạn cho AI role; gradient làm mất mood vận hành |
| 4 | Type voice | 7/10 | System font ổn cho product; scale rõ (24/15/14/13/11); thiếu chút cá tính nhưng không phải lỗi |
| 5 | Interaction feel | 8/10 | States đầy đủ (hover, loading, empty, error, disabled), feedback tốt; ripple + scale nhẹ chuẩn product |

## Smell Lens

**Có smell rõ:** tech gradient (header PagesPage `linear-gradient(135deg, #2563eb, #7c3aed)`), generic tech hue (theme primary/secondary), stat monument (3 card 24px bằng nhau), icon topper (avatar icon mọi card). Chi tiết trong smell-report.

## Top Improvements (theo thứ tự tác động)

1. **Recolor toàn hệ thống** — chọn 1 hue vận hành có lý do (không phải blue-violet), giữ violet `#6d28d9` chỉ cho AI role; bỏ gradient header → `/design deslop` / `recolor`
2. **Phá stat monument** — gộp 3 stat thành 1 dòng summary trong header hoặc chỉ giữ số "Cần hỗ trợ" nổi bật → `relayout`
3. **Icon topper** — bỏ avatar trang trí khỏi stat cards, giữ avatar cho page cards (artifact thật) → `deslop`

## Generated with CommandCode — 2026-08-13
