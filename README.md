# Omni — Hệ thống quản lý tin nhắn Facebook + AI Agentic

Hệ thống **single-tenant** quản lý tin nhắn từ **nhiều Facebook Page** qua **Messenger Platform API**, với **AI agent tự động trả lời** (LangGraph điều phối + Strands Agents sinh câu trả lời) và **web dashboard** cho nhân viên giám sát/tiếp quản.

## Kiến trúc

```
Facebook Page(s) ──webhook──> [GET verify + POST events]  (ack 200 trong 5s)
                                    │
                                    ▼
                              [BullMQ Queue (Redis)]
                                    │
                                    ▼
                         [MessageService: lưu DB + realtime]
                                    │
                                    ▼
                     [LangGraph: classify intent → decide]
                          │                    │
                     reply ✓                  escalate (pending)
                          ▼
               [Strands Agent: sinh câu trả lời]
                (tools: sản phẩm, đơn hàng, FAQ)
                          │
                          ▼
               [Messenger Send API → khách hàng]
                          │
                          ▼
              [Socket.io → Dashboard realtime]
```

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Backend | Node.js 24 + TypeScript, NestJS 11 |
| Frontend | React 18 + Vite 6 |
| Database | PostgreSQL 16 (Prisma ORM) |
| Queue | BullMQ + Redis 7 |
| AI | LangGraph JS (`@langchain/langgraph`) + Strands Agents TS SDK (`@strands-agents/sdk`) |
| LLM | OpenAI (`gpt-4o-mini` mặc định) |
| Realtime | Socket.io |

## Cài đặt & chạy

### 1. Khởi động infrastructure

```bash
docker compose up -d postgres redis   # PostgreSQL + Redis
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
# Điền: OPENAI_API_KEY, META_APP_SECRET, WEBHOOK_VERIFY_TOKEN, ENCRYPTION_KEY
```

Tạo `ENCRYPTION_KEY` (32 bytes hex) dùng để mã hóa Page access token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Database

```bash
npm install
npx prisma migrate dev   # tạo bảng
npm run prisma:seed      # admin mặc định: admin@omni.local / admin123
```

### 4. Chạy

```bash
npm run dev:api   # API trên :3000
npm run dev:web   # Dashboard trên :5173
```

> **Lưu ý npm 11 (Windows):** nếu `npm install` không cài devDependencies của workspace con
> (bug npm 11.13), chạy `npx prisma generate` và kiểm tra các gói trong
> `apps/api/node_modules` / `apps/web/node_modules`. Các package runtime đã được khai báo
> trong `dependencies` để tránh bug này.

## Cấu hình Facebook (Meta)

### Tạo App + Page

1. Vào [developers.facebook.com](https://developers.facebook.com) → tạo **App** (type: Business).
2. Thêm sản phẩm **Messenger**.
3. Trong Messenger settings → **Page Access Token**: chọn Page, lấy token.
4. **App Secret** từ App settings → Basic.

### Webhook

- **Callback URL**: `https://YOUR_DOMAIN/api/webhook/messenger`
  - Dev: dùng ngrok → `ngrok http 3000`
- **Verify Token**: giá trị `WEBHOOK_VERIFY_TOKEN` (hoặc verify token riêng từng Page)
- **Subscribe to events**: `messages`, `messaging_deliveries`, `messaging_postbacks`

### Thêm Page vào hệ thống (qua giao diện)

Dashboard → **Cài đặt** → **Thêm Page mới** (kết nối thủ công):

- Điền **Tên Page**, **Facebook Page ID**, **Page Access Token**, **Verify Token** (tùy chọn) → **Thêm Page**.
- Token được mã hóa **AES-256-GCM** trước khi lưu.
- Có thể thêm **nhiều Page** — mỗi Page có access token riêng, nhận webhook riêng.
- Verify token nhập trên giao diện dùng cho handshake webhook (mỗi Page hoặc dùng chung).

> **Production**: cần Meta **Business Verification** + App Review để gửi tin ngoài admin/testers.

## AI Pipeline

### LangGraph (`apps/api/src/modules/ai/langgraph/`)
- **State**: `{ conversationId, history, intent, confidence, action }`
- **Nodes**: `classify` (rule-based keywords, tiếng Việt) → `decide` (reply/escalate)
- Escalate khi: khiếu nại/phàn nàn, yêu cầu nhạy cảm, intent không rõ (confidence < 0.7)

### Strands Agent (`apps/api/src/modules/ai/strands/`)
- `OpenAIModel` + tools: `lookup_product`, `lookup_order`, `lookup_faq`
- Mỗi conversation giữ agent riêng (ngữ cảnh nhiều lượt), giới hạn 500 agent
- System prompt tiếng Việt, tone lấy từ Settings (`ai_tone`)

### Safety
- Mọi quyết định AI ghi vào `AgentLog` (audit)
- `ai_max_replies_per_hour` giới hạn tốc độ trả lời
- Nhân viên có thể **tắt AI** hoặc **tiếp quản** từng hội thoại
- Không OPENAI_API_KEY → tự động escalate (an toàn mặc định)

## API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/webhook/messenger` | Verify webhook (hub.challenge) |
| POST | `/api/webhook/messenger` | Nhận event từ Meta |
| POST | `/api/auth/login` | Đăng nhập nhân viên |
| GET | `/api/conversations` | Danh sách hội thoại |
| GET | `/api/conversations/:id/messages` | Tin nhắn của hội thoại |
| POST | `/api/conversations/:id/messages` | Gửi tin (nhân viên) |
| PATCH | `/api/conversations/:id/ai` | Bật/tắt AI |
| PATCH | `/api/conversations/:id/takeover` | Nhân viên tiếp quản |
| GET/POST | `/api/pages` | Quản lý Facebook Page |
| GET/POST | `/api/settings/ai-rules` | AI rules (từ khóa + mẫu trả lời) |

## Test

```bash
npm test
# hoặc: node node_modules/vitest/vitest.mjs run
```

- `webhook-signature.spec.ts` — xác thực X-Hub-Signature-256
- `workflow.spec.ts` — phân loại intent LangGraph (giá, đơn hàng, khiếu nại, chào hỏi, giao hàng)

## Cấu trúc thư mục

```
apps/
  api/    # NestJS backend (modules: webhook, messages, conversations, pages, staff, settings, ai, messenger, realtime, queue)
  web/    # React dashboard (login, inbox realtime, settings)
packages/
  shared/ # Types dùng chung (MessageDto, ConversationDto, ...)
prisma/   # Schema + seed
```

## Bảo mật

- Page access token mã hóa AES-256-GCM (cần `ENCRYPTION_KEY`)
- Webhook xác thực `X-Hub-Signature-256` (HMAC-SHA256, constant-time compare)
- JWT cho API, bcrypt cho mật khẩu nhân viên
- HTTPS bắt buộc khi gọi Meta API và webhook callback
