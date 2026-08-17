# Omni Inbox — Design Brief

## Register

**Product** — công cụ vận hành cho nhân viên (operate/configure), không phải surface marketing. Mọi quyết định thiết kế phục vụ tốc độ xử lý hội thoại, không phục vụ cảm xúc thương hiệu.

## Sản phẩm & mục đích

Omni Inbox: hộp thư hợp nhất tin nhắn Facebook của **nhiều Page** (single-tenant), AI agent (LangGraph + Strands) trả lời tự động, nhân viên giám sát và tiếp quản qua web dashboard **realtime** (Socket.io). Bảo mật là nền tảng: token Page mã hóa AES-256-GCM, webhook xác thực X-Hub-Signature, JWT.

## Người dùng & bối cảnh

- Nhân viên / quản trị viên ngồi trước màn hình nhiều giờ, theo dõi nhiều Page cùng lúc.
- Áp lực: khách hàng đang chờ — phải nhìn thấy hội thoại "cần hỗ trợ" trong vài giây và trả lời không chậm trễ.
- Giao diện tiếng Việt (vi-VN), đã đặt trong `index.html` và toàn bộ nhãn.
- Hai vai: `ADMIN` (Quản trị viên) và nhân viên (Nhân viên).

## Job chính (composition lanes)

- **Hộp thư (Inbox) — Operate**: danh sách hội thoại (monitor lane) + khung chat (operate lane) + trạng thái AI (bật/tắt/đang trả lời). Màn hình chính, chiếm phần lớn thời gian dùng.
- **Cài đặt (Settings) — Configure**: nhóm form + bảng + vùng commit rõ ràng. **Luồng thêm Page thủ công (nhập Tên, Page ID, Access Token) là luồng chính**, không phải auto-discovery. Hỗ trợ nhiều Page.
- **Đăng nhập — Decide**: một hành động duy nhất, không phân tâm.

## Artifact (vật thể trung tâm)

Hội thoại (conversation) giữa khách hàng và Page — mang trạng thái `open` / `pending` / `closed`, cờ AI on/off, người phụ trách, số tin chưa đọc. Mọi layout phải phục vụ đọc và trả lời hội thoại nhanh hơn; bất kỳ màn hình nào không làm được điều đó là thừa.

## Voice

- Điềm tĩnh, vận hành, đáng tin — "phòng điều hành", không phải trang bán hàng.
- Tiếng Việt trực tiếp, một động từ rõ nghĩa: "Gửi", "Tiếp quản", "Đóng hội thoại", "Thêm Page", "Thêm rule".
- AI là **trạng thái công việc** (bật / tắt / đang trả lời / tiếp quản), không phải lời quảng cáo. Không dùng dấu chấm than, không in hoa toàn bộ, không "Loading..." vô nghĩa — nói rõ việc đang làm ("AI đang trả lời").
- Empty state phải dạy không gian: nói cái gì thuộc về đây và hành động nào lấp đầy nó ("Chưa có Page nào. Điền form ở trên để thêm Page đầu tiên.").

## Anti-references (tránh)

- Gradient tím-xanh kiểu "AI magic" trang trí khắp nơi; sparkle/glow không phục vụ chức năng.
- Dark theme hacker/terminal, mono font cho toàn UI.
- Hero trung tâm, card grid lặp lại, pill button — chỉ dùng khi content thực sự card-shaped.
- Sai lệch họa sắc generic tech: CTA xanh-tím mặc định mà không có lý do.
- Một card nằm trong card khác; wrapper vô nghĩa tạo dead margin.

## Design principles

1. **Hội thoại là vật thể trung tâm** — unread + pending dẫn mắt trước tiên (badge đếm, chip "Cần hỗ trợ").
2. **AI hiện diện nhưng lặng lẽ**: màu tím `#6d28d9` chỉ báo trạng thái AI (chip, nút bật/tắt), không trang trí. Khi AI tắt hoặc bị tiếp quản, tím biến mất — người dùng thấy ngay ai đang phụ trách.
3. **Mật độ cho tốc độ**: danh sách scan nhanh, dòng text 1-line + ellipsis, không giãn cách rỗng; spacing theo nhịp 4/16/36.
4. **Realtime không gây hỗn loạn**: tin mới đến cập nhật danh sách + khung chat mà layout không nhảy; typing indicator nhẹ (3 chấm nảy).
5. **Mọi hành động có phản hồi**: Snackbar cho thêm/xóa Page & rule, chip trạng thái, trạng thái loading trên nút.
6. **Bảo mật hiển thị được**: trạng thái kết nối Page (subscribed/not), token nhập bằng ô password, tin nhắn lỗi nói rõ nguyên nhân.
7. **Phát triển UI với mock data trước**, đồng bộ layout/design system trước rồi mới đổ dữ liệu thật.

## Accessibility expectations

- Label luôn hiển thị; placeholder chỉ là ví dụ/format ("VD: EAAG...").
- Focus ring rõ (MUI default), contrast ≥ 3:1 cho text nhỏ; không bao giờ `outline: none` thiếu thay thế.
- Touch target ≥ 44px; trạng thái truyền đạt bằng nhãn + màu (chip có text), không chỉ màu.
- Đầy đủ trạng thái: idle / hover / active / focused / loading / empty / error / disabled / overflow — đặc biệt: empty hội thoại, lỗi gửi tin (giữ lại draft), AI đang trả lời, danh sách quá dài (scroll + sticky header).
- Motion tối giản (register product), tôn trọng `prefers-reduced-motion`.
- Font-size form ≥ 16px trên mobile để tránh iOS zoom; dùng logical properties.

## Visual foundation (hiện trạng repo — tôn trọng, không phá vỡ)

- Light mode duy nhất; hệ font system: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial`.
- Tokens (đã có trong `styles.css` + `theme.ts`): primary `#2563eb`, bg `#f1f3f5`, surface `#fff`, surface-2 `#f8f9fb`, border `#e5e8ee`, text `#182230`, muted `#667085`, danger `#dc2626`, success `#16a34a`, warning `#d97706`.
- **AI role color**: violet `#6d28d9` (hover `#5b21b6`) — dùng cho chip AI, nút "AI Bật", tin nhắn của AI (primary.main cho agent bubble).
- Bubble chat: khách = white, nhân viên = dark `#111827`, AI = primary `#2563eb`; đuôi bubble lệch theo bên gửi.
- Radius 8–12px; **flat**: elevation=0, MUI Paper luôn có border 1px `#e5e8ee`; shadow dành riêng cho lớp nổi (dropdown, snackbar).
- Nút: không hoa text, radius 8, contained primary; Chip: `open`=info, `pending`=warning, `closed`=default, AI=violet.
- Sidebar 240px + AppBar 56px + main scroll; layout chính hộp thư 3 cột: danh sách 340px + chat pane.

## Component rules

- MUI v6 + emotion, `theme.ts` là nguồn token duy nhất (đồng bộ với `styles.css`).
- Chip AI tím `#6d28d9` cho mọi trạng thái AI; badge unread tròn, primary, ≥18px.
- Trạng thái hội thoại: chip màu + nhãn tiếng Việt ("Đang mở", "Cần hỗ trợ", "Đã đóng").
- Form trong Settings: label luôn hiển thị; nhóm form thêm Page là block nổi bật đầu tiên (surface-2 + border), kèm hướng dẫn "lấy token ở đâu" (dashed box xanh nhạt).
- Bảng: `size="small"`, hover row, hành động nguy hiểm (Xóa) màu error, có xác nhận/undo khi phù hợp.
- Phân biệt nguồn tin nhắn: CUSTOMER trái / STAFF-AGENT phải; kèm nhãn "AI" hoặc "NV" + giờ.

## Ưu tiên đã biết (từ taste & roadmap)

- Hoàn thiện nền tảng bảo mật/xác thực (refresh token) trước các hạng mục tính năng khác.
- UI phát triển bằng mock data trước khi nối dịch vụ thật.
- Kết nối Facebook Page qua giao diện thủ công là luồng chính (đã đúng trong `SettingsPage`), hỗ trợ quản lý nhiều Page.
