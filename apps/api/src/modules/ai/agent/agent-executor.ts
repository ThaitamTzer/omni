import { AgentDecision } from './agent-decision';
import { AgentRuntimeContext } from './runtime-context';

export interface AgentInput {
  /** Tin khách mới nhất. */
  customerMessage: string;
  /** Lịch sử hội thoại (cho ngữ cảnh). */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Seam trung gian cho agent engine — hiện tại LangChainAgentExecutor,
 * phase sau có thể DeepAgentExecutor mà không sửa AiService.
 */
export interface AgentExecutor {
  invoke(input: AgentInput, ctx: AgentRuntimeContext): Promise<AgentDecision>;
}
