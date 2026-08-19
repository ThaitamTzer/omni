import { describe, it, expect } from 'vitest';
import { OutputPolicyService } from './output-policy.service';
import type { AgentDecision } from './agent-decision';
import type { AgentRuntimeContext } from './runtime-context';

const ctx: AgentRuntimeContext = {
  pageId: 'p1',
  conversationId: 'c1',
  customerFbId: 'fb1',
  customerName: 'A',
  settings: {},
};

const service = new OutputPolicyService();

function decision(overrides: Partial<AgentDecision>): AgentDecision {
  return { action: 'REPLY', reasonCode: 'ANSWERED', ...overrides } as AgentDecision;
}

describe('OutputPolicyService', () => {
  it('REPLY có nội dung, steps hợp lệ → REPLY', () => {
    expect(
      service.evaluate({ decision: decision({ reply: 'Dạ giá 299k' }), ctx, steps: 1 }),
    ).toBe('REPLY');
  });

  it('action HANDOFF → HANDOFF', () => {
    expect(
      service.evaluate({
        decision: decision({ action: 'HANDOFF', reasonCode: 'INSUFFICIENT_KNOWLEDGE' }),
        ctx,
        steps: 1,
      }),
    ).toBe('HANDOFF');
  });

  it('action NO_REPLY → HANDOFF', () => {
    expect(
      service.evaluate({ decision: decision({ action: 'NO_REPLY' }), ctx, steps: 1 }),
    ).toBe('HANDOFF');
  });

  it('reasonCode SENSITIVE_REQUEST → HANDOFF (kể cả action REPLY)', () => {
    expect(
      service.evaluate({
        decision: decision({ reply: 'tôi hiểu', reasonCode: 'SENSITIVE_REQUEST' }),
        ctx,
        steps: 1,
      }),
    ).toBe('HANDOFF');
  });

  it('reasonCode CUSTOMER_REQUESTED_HUMAN → HANDOFF', () => {
    expect(
      service.evaluate({
        decision: decision({ reasonCode: 'CUSTOMER_REQUESTED_HUMAN' }),
        ctx,
        steps: 1,
      }),
    ).toBe('HANDOFF');
  });

  it('TOOL_FAILED + có toolErrors → HANDOFF', () => {
    expect(
      service.evaluate({
        decision: decision({ reply: 'x', reasonCode: 'TOOL_FAILED' }),
        ctx,
        steps: 1,
        toolErrors: ['search_products timeout'],
      }),
    ).toBe('HANDOFF');
  });

  it('steps vượt MAX (7) → HANDOFF', () => {
    expect(
      service.evaluate({ decision: decision({ reply: 'x' }), ctx, steps: 7 }),
    ).toBe('HANDOFF');
  });

  it('REPLY chỉ whitespace → HANDOFF', () => {
    expect(
      service.evaluate({ decision: decision({ reply: '   \n ' }), ctx, steps: 1 }),
    ).toBe('HANDOFF');
  });
});
