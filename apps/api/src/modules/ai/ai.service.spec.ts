import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiService } from './ai.service';

const CONV = (overrides: Record<string, unknown> = {}) => ({
  id: 'conv-1',
  pageId: 'page-1',
  page: { id: 'page-1', fbPageId: 'fb-page-1' },
  customerFbId: 'fb-customer-1',
  customerName: 'Lê Trần Thái Tâm',
  status: 'open',
  aiEnabled: true,
  deletedAt: null as Date | null,
  aiReplyCount: 0,
  aiReplyWindowStart: new Date(),
  ...overrides,
});

const SETTINGS = { ai_max_replies_per_hour: '10', ai_max_replies_per_conversation: '10' };

describe('AiService.processConversation', () => {
  let service: AiService;

  const prismaMock = {
    conversation: { findUnique: vi.fn(), update: vi.fn() },
    agentLog: { count: vi.fn(), create: vi.fn() },
    message: { findMany: vi.fn() },
  };
  const settingsMock = { getAll: vi.fn(), getAiRules: vi.fn() };
  const workflowMock = { run: vi.fn() };
  const executorMock = { invoke: vi.fn() };
  const replyMock = { sendReplyAndStore: vi.fn() };
  const handoffMock = { handoff: vi.fn() };
  const logsMock = { log: vi.fn(), logToolCall: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.conversation.findUnique.mockResolvedValue(CONV());
    prismaMock.agentLog.count.mockResolvedValue(0);
    prismaMock.agentLog.create.mockResolvedValue({ id: 'log-1' });
    prismaMock.message.findMany.mockResolvedValue([
      { senderType: 'CUSTOMER', text: 'Xin chào' },
      { senderType: 'AGENT', text: 'Chào bạn' },
    ]);
    prismaMock.conversation.update.mockResolvedValue(CONV());
    settingsMock.getAll.mockResolvedValue(SETTINGS);
    settingsMock.getAiRules.mockResolvedValue([]);
    workflowMock.run.mockResolvedValue({ action: 'RUN_AGENT', reasonCode: 'greeting', intent: 'greeting', confidenceBand: 'high' });
    executorMock.invoke.mockResolvedValue({ action: 'REPLY', reply: 'Xin chào bạn', reasonCode: 'ANSWERED' });
    replyMock.sendReplyAndStore.mockResolvedValue(undefined);
    handoffMock.handoff.mockResolvedValue(undefined);
    logsMock.log.mockResolvedValue(undefined);

    service = new AiService(
      prismaMock as never,
      settingsMock as never,
      workflowMock as never,
      executorMock as never,
      replyMock as never,
      handoffMock as never,
      logsMock as never,
    );
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('TH#19: conversation không tồn tại → return im lặng', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(null);

    await service.processConversation('conv-x', 'page-1');

    expect(workflowMock.run).not.toHaveBeenCalled();
    expect(replyMock.sendReplyAndStore).not.toHaveBeenCalled();
    expect(handoffMock.handoff).not.toHaveBeenCalled();
  });

  it('TH#19: conversation soft-deleted → return im lặng', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV({ deletedAt: new Date() }));

    await service.processConversation('conv-1', 'page-1');

    expect(workflowMock.run).not.toHaveBeenCalled();
  });

  it('TH#19: aiEnabled=false → return im lặng', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV({ aiEnabled: false }));

    await service.processConversation('conv-1', 'page-1');

    expect(workflowMock.run).not.toHaveBeenCalled();
  });

  it('TH#9: global hourly rate limit → rate_limited + handoff, no workflow', async () => {
    prismaMock.agentLog.count.mockResolvedValue(10);

    await service.processConversation('conv-1', 'page-1');

    expect(logsMock.log).toHaveBeenCalledWith('conv-1', 'rate_limited', expect.objectContaining({ reason: 'global_hourly_cap' }));
    expect(handoffMock.handoff).toHaveBeenCalledWith('conv-1', 'rate_limited_global');
    expect(workflowMock.run).not.toHaveBeenCalled();
  });

  it('TH#10: per-conversation rate limit → rate_limited + handoff, no executor', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV({ aiReplyCount: 10 }));

    await service.processConversation('conv-1', 'page-1');

    expect(logsMock.log).toHaveBeenCalledWith('conv-1', 'rate_limited', expect.objectContaining({ reason: 'conversation_cap' }));
    expect(handoffMock.handoff).toHaveBeenCalledWith('conv-1', 'rate_limited_conversation');
    expect(executorMock.invoke).not.toHaveBeenCalled();
  });

  it('decision IGNORE → return, không gọi gì thêm', async () => {
    workflowMock.run.mockResolvedValue({ action: 'IGNORE', reasonCode: 'ignore', intent: 'unknown' });

    await service.processConversation('conv-1', 'page-1');

    expect(logsMock.log).toHaveBeenCalledWith('conv-1', 'decision', expect.anything());
    expect(executorMock.invoke).not.toHaveBeenCalled();
    expect(replyMock.sendReplyAndStore).not.toHaveBeenCalled();
    expect(handoffMock.handoff).not.toHaveBeenCalled();
  });

  it('decision RETRY_LATER → log retry_later, không handoff', async () => {
    workflowMock.run.mockResolvedValue({ action: 'RETRY_LATER', reasonCode: 'busy' });

    await service.processConversation('conv-1', 'page-1');

    expect(logsMock.log).toHaveBeenCalledWith('conv-1', 'retry_later', { reasonCode: 'busy' });
    expect(handoffMock.handoff).not.toHaveBeenCalled();
  });

  it('decision HANDOFF → handoffService.handoff với reasonCode', async () => {
    workflowMock.run.mockResolvedValue({ action: 'HANDOFF', reasonCode: 'escalate_keyword', intent: 'escalate' });

    await service.processConversation('conv-1', 'page-1');

    expect(handoffMock.handoff).toHaveBeenCalledWith('conv-1', 'escalate_keyword', expect.anything());
    expect(executorMock.invoke).not.toHaveBeenCalled();
  });

  it('decision RULE_REPLY → gửi template trực tiếp, không executor, count reply', async () => {
    workflowMock.run.mockResolvedValue({
      action: 'RULE_REPLY',
      reasonCode: 'rule_match',
      reply: 'Dạ, giá sản phẩm là 1.500.000đ ạ.',
      matchedRuleId: 'rule-1',
    });

    await service.processConversation('conv-1', 'page-1');

    expect(replyMock.sendReplyAndStore).toHaveBeenCalledWith('page-1', expect.anything(), 'Dạ, giá sản phẩm là 1.500.000đ ạ.');
    expect(executorMock.invoke).not.toHaveBeenCalled();
    expect(logsMock.log).toHaveBeenCalledWith('conv-1', 'reply_sent', { text: 'Dạ, giá sản phẩm là 1.500.000đ ạ.', source: 'ai_rule' });
    const updateCall = prismaMock.conversation.update.mock.calls.find((c) => c[0].data.aiReplyCount !== undefined)!;
    expect(updateCall[0].data.aiReplyCount).toBe(1);
  });

  it('RULE_REPLY không có reply → không gửi gì', async () => {
    workflowMock.run.mockResolvedValue({ action: 'RULE_REPLY', reasonCode: 'rule_match' });

    await service.processConversation('conv-1', 'page-1');

    expect(replyMock.sendReplyAndStore).not.toHaveBeenCalled();
  });

  it('TH#15: RUN_AGENT thiếu OPENAI_API_KEY → escalated_no_api_key + handoff', async () => {
    delete process.env.OPENAI_API_KEY;
    workflowMock.run.mockResolvedValue({ action: 'RUN_AGENT', reasonCode: 'price', intent: 'price' });

    await service.processConversation('conv-1', 'page-1');

    expect(logsMock.log).toHaveBeenCalledWith('conv-1', 'escalated_no_api_key', { reason: 'missing OPENAI_API_KEY' });
    expect(handoffMock.handoff).toHaveBeenCalledWith('conv-1', 'escalated_no_api_key');
    expect(executorMock.invoke).not.toHaveBeenCalled();
  });

  it('TH#14: RUN_AGENT + executor REPLY → gửi reply + log reply_sent source agent + count', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    workflowMock.run.mockResolvedValue({ action: 'RUN_AGENT', reasonCode: 'price', intent: 'price' });
    executorMock.invoke.mockResolvedValue({ action: 'REPLY', reply: 'Áo thun cotton giá 299.000đ ạ.', reasonCode: 'ANSWERED' });

    await service.processConversation('conv-1', 'page-1');

    expect(executorMock.invoke).toHaveBeenCalledTimes(1);
    expect(executorMock.invoke.mock.calls[0][1]).toMatchObject({ pageId: 'page-1', conversationId: 'conv-1', customerFbId: 'fb-customer-1' });
    expect(replyMock.sendReplyAndStore).toHaveBeenCalledWith('page-1', expect.anything(), 'Áo thun cotton giá 299.000đ ạ.');
    expect(logsMock.log).toHaveBeenCalledWith('conv-1', 'reply_sent', { text: 'Áo thun cotton giá 299.000đ ạ.', source: 'agent' });
    const updateCall = prismaMock.conversation.update.mock.calls.find((c) => c[0].data.aiReplyCount !== undefined)!;
    expect(updateCall[0].data.aiReplyCount).toBe(1);
  });

  it('TH#18: executor HANDOFF → handoffService.handoff với reasonCode, không gửi', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    workflowMock.run.mockResolvedValue({ action: 'RUN_AGENT', reasonCode: 'unknown', intent: 'unknown' });
    executorMock.invoke.mockResolvedValue({ action: 'HANDOFF', reasonCode: 'INSUFFICIENT_KNOWLEDGE' });

    await service.processConversation('conv-1', 'page-1');

    expect(handoffMock.handoff).toHaveBeenCalledWith('conv-1', 'INSUFFICIENT_KNOWLEDGE', expect.anything());
    expect(replyMock.sendReplyAndStore).not.toHaveBeenCalled();
  });

  it('executor trả HANDOFF → handoffService.handoff, không gửi (policy đã xử lý REPLY rỗng)', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    executorMock.invoke.mockResolvedValue({ action: 'HANDOFF', reasonCode: 'INSUFFICIENT_KNOWLEDGE' });

    await service.processConversation('conv-1', 'page-1');

    expect(handoffMock.handoff).toHaveBeenCalled();
    expect(replyMock.sendReplyAndStore).not.toHaveBeenCalled();
  });
});
