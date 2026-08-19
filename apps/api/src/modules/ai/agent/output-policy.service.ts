import { Injectable } from '@nestjs/common';
import { AgentDecision } from './agent-decision';
import { AgentRuntimeContext } from './runtime-context';

export const MAX_AGENT_STEPS = 6;

export interface PolicyInput {
  decision: AgentDecision;
  ctx: AgentRuntimeContext;
  /** Lỗi tool trong run (nếu có). */
  toolErrors?: string[];
  /** Số vòng model/tool đã chạy. */
  steps: number;
  /** Điểm KB cao nhất (nếu agent gọi search_knowledge). */
  knowledgeBestScore?: number;
}

export type PolicyVerdict = 'REPLY' | 'HANDOFF';

/**
 * Output Policy — backend quyết định cuối (REPLY/HANDOFF) từ structured output
 * + policy rules. KHÔNG dùng LLM confidence làm policy.
 */
@Injectable()
export class OutputPolicyService {
  evaluate(input: PolicyInput): PolicyVerdict {
    const { decision, toolErrors, steps } = input;

    // 1. Agent yêu cầu bàn giao
    if (decision.action === 'HANDOFF' || decision.action === 'NO_REPLY') return 'HANDOFF';

    // 2. Lý do nhạy cảm — luôn bàn giao
    if (
      decision.reasonCode === 'SENSITIVE_REQUEST' ||
      decision.reasonCode === 'CUSTOMER_REQUESTED_HUMAN'
    ) {
      return 'HANDOFF';
    }

    // 3. Tool lỗi nghiêm trọng — không trả lời mù
    if (decision.reasonCode === 'TOOL_FAILED' && toolErrors && toolErrors.length > 0) {
      return 'HANDOFF';
    }

    // 4. Vượt giới hạn steps
    if (steps > MAX_AGENT_STEPS) return 'HANDOFF';

    // 5. REPLY nhưng không có nội dung
    if (decision.action === 'REPLY' && !decision.reply?.trim()) return 'HANDOFF';

    // 6. Còn lại — REPLY
    return 'REPLY';
  }
}
