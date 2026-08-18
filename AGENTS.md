# AGENTS.md — Omni

Hệ thống single-tenant quản lý tin nhắn nhiều Facebook Page (Messenger Platform) + AI agentic, với web dashboard cho nhân viên.

## Tech Stack

- **Monorepo npm workspaces**: `apps/api` (NestJS 11), `apps/web` (React 18 + Vite), `packages/shared` (DTO types)
- **DB**: PostgreSQL + Prisma 6 (schema ở root `prisma/`)
- **Queue**: BullMQ + Redis (`webhook-events`, `ai-replies`)
- **Realtime**: Socket.IO (`realtime.gateway`)
- **AI**: LangGraph JS (classify/decide) + Strands Agents SDK (`@strands-agents/sdk`) + OpenAI (`gpt-4o-mini`), Zod
- **Frontend**: MUI 6 (Material UI), TanStack Query (data fetching), Zustand (auth state), i18next (tiếng Việt)
- **Auth**: JWT (access) + refresh token (cookie), bcryptjs hash

## Commands

```bash
npm run dev:api          # API (NestJS watch) — cổng 3000
npm run dev:web          # Web (Vite) — cổng 5173
npm run build            # Build tất cả workspaces
npm run test             # Vitest (root)
npm run prisma:migrate   # prisma migrate dev
npm run prisma:seed      # seed: admin + FAQ + sản phẩm + đơn hàng + settings
npm run db:up            # docker compose up -d postgres redis
```

Postgres container map cổng **5433** (5432 bị PostgreSQL hệ thống chiếm). `DATABASE_URL` trỏ `localhost:5433` (hoặc Aiven cloud theo `.env`).

## Cấu trúc

```
apps/api/src/modules/
  webhook/        # Messenger webhook + inbound adapter + HMAC verify
  messages/       # processInbound (find-or-create conversation, emit realtime)
  conversations/  # CRUD + xóa mềm (deletedAt) + xóa vĩnh viễn + bulk
  pages/          # Facebook Pages (token mã hóa AES-256-GCM)
  staff/          # auth (login/refresh/logout)
  settings/       # settings + AiRule + FAQ CRUD
  ai/             # ai.service (pipeline) + langgraph/workflow + strands/
  agent-logs/     # GET /api/agent-logs (audit đọc được)
  messenger/      # Graph API call (sendText, getCustomerProfile)
  realtime/       # Socket.IO gateway (emit new message/typing/events)
  queue/          # BullMQ global module
```

## Conventions

- NestJS: service inject PrismaService qua constructor; controller `@Controller('x')`; module exports service
- Prisma models PascalCase; migration qua `npx prisma migrate dev --name <tên>`
- Frontend: functional components + hooks, MUI `sx`, i18n keys trong `vi.json` (KHÔNG hardcode chữ)
- i18next: biến phải dùng `{{var}}` (2 cặp ngoặc), không bao giờ `{var}`
- TanStack Query cho server state; Zustand cho auth; không tự viết wrapper
- Tất cả text UI qua i18n, hiện chỉ tiếng Việt
- Tool callback AI: async, trả string tiếng Việt, lỗi → fallback thân thiện (không throw)
- Mọi thao tác xóa quan trọng bắt buộc dialog xác nhận; xóa mềm → thùng rác riêng, xóa vĩnh viễn qua confirm dialog

## Boundaries

- **Always**: chạy build + test trước commit; verify trên browser thực tế (playwright) khi đổi UI; cập nhật README
- **Ask first**: đổi schema Prisma, thêm dependency, đổi port docker-compose
- **Never**: commit secret/credential thật (`**/.env.example` phải placeholder, đã có trong .gitignore); xóa dữ liệu không qua xác nhận; sửa service hệ thống bằng sudo

## Workflow bắt buộc (đã chốt với người dùng)

Khi triển khai tính năng (không phải bug nhỏ):
1. Viết spec đầy đủ (objective, commands, structure, style, testing, boundaries, success criteria)
2. Tự verify spec → tự review spec → bổ sung nếu thiếu
3. Spec hoàn chỉnh mới chuyển design, lặp lại verify/review/bổ sung
4. Có todo hoàn chỉnh, đầy đủ, không thiếu sót mới bắt đầu code
5. Sau khi code: verify thực tế (browser khi đổi UI, API khi đổi backend) trước khi kết luận
6. Commit + push (commit message kèm `Co-authored-by: CommandCodeBot <noreply@commandcode.ai>`)

## AI Pipeline (tóm tắt)

Webhook → BullMQ `webhook-events` → `MessageService.processInbound` (persist + find-or-create conversation) → BullMQ `ai-replies` → `AiService.processConversation`:
1. Rate limit (global/h per conversation) → escalate nếu quá
2. `LangGraphWorkflow.run` — node `ruleMatch` (AiRule keyword→template, ưu tiên, không tốn LLM) → `classify` (regex) → `decide`
3. `decision.replyText` (rule) → gửi thẳng; ngược lại nếu thiếu `OPENAI_API_KEY` → escalate; còn lại `Strands.generateReply` (LLM + tools: `lookup_product`/`lookup_order`/`lookup_faq` tra cứu DB thật)
4. Gửi qua Messenger, lưu Message, log AgentLog (`decision`, `reply_sent`, `rate_limited`, `escalated_no_api_key`, `tool_lookup`)
