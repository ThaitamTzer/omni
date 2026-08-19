import { z } from 'zod';

/**
 * Structured output mà agent (LangChain) phải trả về.
 * Backend (OutputPolicyService) quyết định cuối dựa trên schema này —
 * không tin LLM tự khai confidence.
 *
 * Lưu ý OpenAI strict mode: MỌI field trong object phải có trong `required`
 * (không được `.optional()` ở top-level). Dùng `reply` required (có thể "") —
 * policy sẽ HANDOFF nếu reply rỗng.
 */
export const AgentDecisionSchema = z.object({
  action: z.enum(['REPLY', 'HANDOFF', 'NO_REPLY']),
  reply: z.string(),
  reasonCode: z.enum([
    'ANSWERED',
    'INSUFFICIENT_KNOWLEDGE',
    'TOOL_FAILED',
    'SENSITIVE_REQUEST',
    'CUSTOMER_REQUESTED_HUMAN',
    'UNSUPPORTED_ACTION',
  ]),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;
