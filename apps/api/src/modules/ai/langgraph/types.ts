/**
 * Routing actions của Decision Graph (tầng 1).
 * AiService switch theo action này để quyết định nhánh xử lý.
 */
export type DecisionAction = 'RULE_REPLY' | 'RUN_AGENT' | 'HANDOFF' | 'IGNORE' | 'RETRY_LATER';

export interface DecisionResult {
  action: DecisionAction;
  /** Lý do ra quyết định: 'rule_match' | 'greeting' | 'price' | 'escalate_keyword' | 'unknown' | ... */
  reasonCode: string;
  /** Nội dung reply khi RULE_REPLY (template từ AiRule). */
  reply?: string;
  matchedRuleId?: string;
  intent?: string;
  confidenceBand?: 'high' | 'medium' | 'low';
}
