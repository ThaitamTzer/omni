/**
 * Catalog các loại node có sẵn cho visual workflow builder (phase sau).
 * `retrieveKB` KHÔNG nằm trong default graph nhưng giữ trong catalog —
 * hỗ trợ agentic RAG (tool) và deterministic RAG (bắt buộc trước LLM).
 */
export const NODE_CATALOG = {
  ruleMatch: {
    name: 'Rule Match',
    type: 'deterministic',
    description: 'Khớp AiRule (keyword → template) trước, không tốn LLM',
  },
  classify: {
    name: 'Hybrid Classify',
    type: 'hybrid',
    description: 'Regex/heuristic chắc chắn chạy trước; chỉ gọi LLM khi mơ hồ',
  },
  decide: {
    name: 'Decide',
    type: 'deterministic',
    description: 'Chốt action (RULE_REPLY/RUN_AGENT/HANDOFF/IGNORE/RETRY_LATER) theo intent',
  },
  retrieveKB: {
    name: 'Knowledge Retrieval',
    type: 'rag',
    modes: ['agentic', 'deterministic'],
    description:
      'Tra cứu knowledgebase — agentic (agent tự gọi tool) hoặc deterministic (bắt buộc trước LLM cho intent nhạy cảm)',
  },
  agent: {
    name: 'Agent',
    type: 'agent',
    description: 'Agent loop (createAgent) với tools + structured output',
  },
} as const;
