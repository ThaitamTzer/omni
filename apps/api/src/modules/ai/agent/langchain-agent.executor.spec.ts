import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { LangChainAgentExecutor } from './langchain-agent.executor';
import type { AiModelConfig } from '../ai.config';
import { OutputPolicyService } from './output-policy.service';

const config: AiModelConfig = {
  chatModel: 'gpt-4o-mini',
  classifyModel: 'gpt-4o-mini',
  temperature: 0.2,
  timeoutMs: 20000,
  maxRetries: 2,
};

function mockAgentFactory(overrides: { structuredResponse?: unknown } = {}) {
  const structuredResponse = 'structuredResponse' in overrides
    ? overrides.structuredResponse
    : { action: 'REPLY', reply: 'Dạ chào anh!', reasonCode: 'ANSWERED' };
  return vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({ structuredResponse }),
  });
}

const ctx = {
  pageId: 'p1',
  conversationId: 'c1',
  customerFbId: 'fb1',
  customerName: 'A',
  settings: {},
};

describe('LangChainAgentExecutor', () => {
  it('gọi agent.invoke với thread_id hash(facebook:page:conv)', async () => {
    const factory = mockAgentFactory();
    const exec = new LangChainAgentExecutor({
      config,
      checkpointer: {} as never,
      agentFactory: factory as never,
    });
    await exec.invoke({ customerMessage: 'alo', history: [] }, ctx);
    const agent = factory.mock.results[0].value;
    const [msgs, cfg] = agent.invoke.mock.calls[0];
    expect(msgs.messages[0].content).toBe('alo');
    expect(cfg.configurable.thread_id).toBe(
      createHash('sha256').update('facebook:p1:c1').digest('hex'),
    );
  });

  it('trả AgentDecision REPLY từ structuredResponse', async () => {
    const factory = mockAgentFactory();
    const exec = new LangChainAgentExecutor({
      config,
      checkpointer: {} as never,
      agentFactory: factory as never,
    });
    const d = await exec.invoke({ customerMessage: 'alo', history: [] }, ctx);
    expect(d).toEqual({ action: 'REPLY', reply: 'Dạ chào anh!', reasonCode: 'ANSWERED' });
  });

  it('structuredResponse undefined → HANDOFF UNSUPPORTED_ACTION (không bịa reply)', async () => {
    const factory = mockAgentFactory({ structuredResponse: undefined });
    const exec = new LangChainAgentExecutor({
      config,
      checkpointer: {} as never,
      agentFactory: factory as never,
    });
    const d = await exec.invoke({ customerMessage: 'alo', history: [] }, ctx);
    expect(d).toEqual({ action: 'HANDOFF', reply: '', reasonCode: 'UNSUPPORTED_ACTION' });
  });

  it('policy HANDOFF → executor trả HANDOFF với reasonCode của decision', async () => {
    const factory = mockAgentFactory({
      structuredResponse: { action: 'HANDOFF', reply: '', reasonCode: 'INSUFFICIENT_KNOWLEDGE' },
    });
    const policy = new OutputPolicyService();
    const exec = new LangChainAgentExecutor({
      config,
      checkpointer: {} as never,
      policy,
      agentFactory: factory as never,
    });
    const d = await exec.invoke({ customerMessage: 'alo', history: [] }, ctx);
    expect(d).toEqual({ action: 'HANDOFF', reply: '', reasonCode: 'INSUFFICIENT_KNOWLEDGE' });
  });

  it('policy REPLY nhưng không có reply → HANDOFF', async () => {
    const factory = mockAgentFactory({
      structuredResponse: { action: 'REPLY', reply: '   ', reasonCode: 'ANSWERED' },
    });
    const exec = new LangChainAgentExecutor({
      config,
      checkpointer: {} as never,
      agentFactory: factory as never,
    });
    const d = await exec.invoke({ customerMessage: 'alo', history: [] }, ctx);
    expect(d).toEqual({ action: 'HANDOFF', reply: '   ', reasonCode: 'ANSWERED' });
  });
});
