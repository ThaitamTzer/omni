# AGENTS.md — Omni

Hệ thống single-tenant quản lý tin nhắn nhiều Facebook Page (Messenger Platform) + AI agentic, với web dashboard cho nhân viên.

## Tech Stack

- **Monorepo npm workspaces**: `apps/api` (NestJS 11), `apps/web` (React 18 + Vite), `packages/shared` (DTO types)
- **DB**: PostgreSQL + Prisma 6 (schema ở root `prisma/`)
- **Queue**: BullMQ + Redis (`webhook-events`, `ai-replies`)
- **Realtime**: Socket.IO (`realtime.gateway`)
- **AI**: LangGraph JS (classify/decide) + Strands Agents SDK (`@strands-agents/sdk`) + OpenAI (`gpt-4o-mini`), Zod
- **Frontend**: MUI 6 (Material UI), TanStack Query (data fetching), Recoil (auth state), i18next (tiếng Việt)
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
- TanStack Query cho server state; Recoil cho auth; không tự viết wrapper
- Tất cả text UI qua i18n, hiện chỉ tiếng Việt
- Tool callback AI: async, trả string tiếng Việt, lỗi → fallback thân thiện (không throw)
- Mọi thao tác xóa quan trọng bắt buộc dialog xác nhận; xóa mềm → thùng rác riêng, xóa vĩnh viễn qua confirm dialog

## Boundaries

- **Always**: chạy build + test trước commit; verify trên browser thực tế (playwright) khi đổi UI; cập nhật README
- **Ask first**: đổi schema Prisma, thêm dependency, đổi port docker-compose
- **Never**: commit secret/credential thật (`**/.env.example` phải placeholder, đã có trong .gitignore); xóa dữ liệu không qua xác nhận; sửa service hệ thống bằng sudo

## Tests

```bash
npm test                    # Vitest toàn bộ (43 test, 5 files)
npx vitest run apps/api/src/modules/messages/message.service.spec.ts   # test riêng 1 file
```

- Test file nằm cạnh source: `message.service.spec.ts`, `ai.service.spec.ts`, `langgraph/workflow.spec.ts`, `webhook/webhook-inbound.adapter.spec.ts`, `webhook/webhook-signature.spec.ts`
- `message.service.spec` bao phủ các trường hợp inbound (hội thoại mới/open/closed/pending/soft-delete/aiEnabled=false/echo/attachment-only)
- `ai.service.spec` bao phủ pipeline (rate limit, escalate, AiRule template, thiếu API key, LLM reply/null, guard xóa)
- `workflow.spec` bao phủ classify + AiRule (khớp/disabled/priority, escalate keywords, intent rõ)
- NestJS build biên dịch cả `*.spec.ts` nên test phải sạch TS (dùng `!` non-null assertion khi truy cập mock calls)

## Workflow bắt buộc (đã chốt với người dùng — chất lượng trên tốc độ)

Khi triển khai tính năng (không phải bug nhỏ), luồng chuẩn 5 giai đoạn:

### 1. SPEC
- Viết spec đầy đủ (objective, commands, structure, style, testing, boundaries, success criteria)
- Tự verify spec → tự review spec → bổ sung nếu thiếu (không có "placeholder", "TBD")
- Mọi giả định phải nêu tường minh ("ASSUMPTIONS I'M MAKING") trước khi viết

### 2. DESIGN + PLAN
- Design lặp lại verify/review/bổ sung tương tự spec
- Plan phải **bite-sized** (mỗi task 2-5 phút), **No Placeholders** (không "thêm validation", "xử lý edge case" — phải ghi cụ thể code/thao tác)
- Mỗi task: acceptance criteria + verification + dependency + file cụ thể
- Cắt theo **vertical slice** (schema+API+UI cho 1 luồng, không cắt theo layer)
- Task > 5 files → tách nhỏ; checkpoint sau mỗi 2-3 task

### 3. TODO
- Todo hoàn chỉnh, đầy đủ, không thiếu sót MỚI bắt đầu code

### 4. CODE
- TDD: viết test fail trước → chạy xác nhận đỏ → implement → xanh
- Mỗi quyết định non-trivial (branching, cross-module, invariant) → **doubt-driven**: spawn sub-agent fresh-context review (adversarial "find issues", KHÔNG truyền kết luận của mình) → reconcile → tối đa 3 vòng
- Sau implement: **de-sloppify pass** (bỏ test thừa kiểm framework, defensive check thừa, console.log, code comment)

### 5. VERIFY + SHIP
- Chạy verification-loop đầy đủ: build → type check → lint → test → security scan → diff review
- **Bằng chứng trước tuyên bố** (verification-before-completion): không nói "xong" nếu chưa chạy lệnh verify trong chính message này
- Verify thực tế: browser khi đổi UI (playwright, screenshot), API khi đổi backend (curl/webhook thật)
- Commit + push (commit message kèm `Co-authored-by: CommandCodeBot <noreply@commandcode.ai>`)

### Khi gặp BUG (không phải feature)
Theo `diagnosing-bugs`: xây **feedback loop đỏ** (test/curl chạy được 1 lệnh duy nhất tái hiện đúng triệu chứng) → reproduce + minimize → 3-5 hypotheses (falsifiable, trình user) → instrument từng biến → fix + regression test → cleanup. KHÔNG đoán mò trước khi có loop đỏ.

## AI Pipeline (tóm tắt)

Webhook → BullMQ `webhook-events` → `MessageService.processInbound` (persist + find-or-create conversation) → BullMQ `ai-replies` → `AiService.processConversation`:
1. Rate limit (global/h per conversation) → escalate nếu quá
2. `LangGraphWorkflow.run` — node `ruleMatch` (AiRule keyword→template, ưu tiên, không tốn LLM) → `classify` (regex) → `decide`
3. `decision.replyText` (rule) → gửi thẳng; ngược lại nếu thiếu `OPENAI_API_KEY` → escalate; còn lại `Strands.generateReply` (LLM + tools: `lookup_product`/`lookup_order`/`lookup_faq` tra cứu DB thật)
4. Gửi qua Messenger, lưu Message, log AgentLog (`decision`, `reply_sent`, `rate_limited`, `escalated_no_api_key`, `tool_lookup`)
