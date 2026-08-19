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
  const strandsMock = { generateReply: vi.fn(), sendReplyAndStore: vi.fn() };
  const workflowMock = { run: vi.fn() };

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
    strandsMock.generateReply.mockResolvedValue('Xin chào bạn');
    strandsMock.sendReplyAndStore.mockResolvedValue(undefined);
    workflowMock.run.mockResolvedValue({ action: 'reply', intent: 'greeting', confidence: 0.9 });

    service = new AiService(
      prismaMock as never,
      settingsMock as never,
      strandsMock as never,
      workflowMock as never,
    );
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('TH#19: conversation does not exist → returns silently', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(null);

    await service.processConversation('conv-x', 'page-1');

    expect(prismaMock.agentLog.create).not.toHaveBeenCalled();
    expect(prismaMock.conversation.update).not.toHaveBeenCalled();
    expect(workflowMock.run).not.toHaveBeenCalled();
  });

  it('TH#19: conversation soft-deleted → returns silently', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV({ deletedAt: new Date() }));

    await service.processConversation('conv-1', 'page-1');

    expect(workflowMock.run).not.toHaveBeenCalled();
    expect(prismaMock.conversation.update).not.toHaveBeenCalled();
  });

  it('TH#19: aiEnabled=false → returns silently', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV({ aiEnabled: false }));

    await service.processConversation('conv-1', 'page-1');

    expect(workflowMock.run).not.toHaveBeenCalled();
  });

  it('TH#9: global hourly rate limit exceeded → rate_limited + pending, no workflow', async () => {
    prismaMock.agentLog.count.mockResolvedValue(10);

    await service.processConversation('conv-1', 'page-1');

    const logCall = prismaMock.agentLog.create.mock.calls[0][0].data;
    expect(logCall.event).toBe('rate_limited');
    expect(logCall.payload.reason).toBe('global_hourly_cap');
    const updateData = prismaMock.conversation.update.mock.calls[0][0].data;
    expect(updateData.status).toBe('pending');
    expect(workflowMock.run).not.toHaveBeenCalled();
  });

  it('TH#10: per-conversation rate limit exceeded → rate_limited + pending, no strands', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV({ aiReplyCount: 10 }));

    await service.processConversation('conv-1', 'page-1');

    const logCall = prismaMock.agentLog.create.mock.calls[0][0].data;
    expect(logCall.event).toBe('rate_limited');
    expect(logCall.payload.reason).toBe('conversation_cap');
    const updateData = prismaMock.conversation.update.mock.calls[0][0].data;
    expect(updateData.status).toBe('pending');
    expect(strandsMock.generateReply).not.toHaveBeenCalled();
  });

  it('TH#12: decision skip → returns, no strands', async () => {
    workflowMock.run.mockResolvedValue({ action: 'skip', intent: 'unknown', confidence: 0.3 });

    await service.processConversation('conv-1', 'page-1');

    expect(prismaMock.agentLog.create).toHaveBeenCalled(); // decision log
    expect(strandsMock.generateReply).not.toHaveBeenCalled();
    expect(strandsMock.sendReplyAndStore).not.toHaveBeenCalled();
    expect(prismaMock.conversation.update).not.toHaveBeenCalled();
  });

  it('TH#11: decision escalate → sets pending, no strands', async () => {
    workflowMock.run.mockResolvedValue({ action: 'escalate', intent: 'escalate', confidence: 0.95 });

    await service.processConversation('conv-1', 'page-1');

    const updateData = prismaMock.conversation.update.mock.calls[0][0].data;
    expect(updateData.status).toBe('pending');
    expect(strandsMock.generateReply).not.toHaveBeenCalled();
  });

  it('TH#13: AiRule replyText → sends template directly, no LLM, counts reply', async () => {
    workflowMock.run.mockResolvedValue({
      action: 'reply',
      intent: 'Hỏi giá sản phẩm',
      confidence: 1,
      replyText: 'Dạ, giá sản phẩm là 1.500.000đ ạ.',
    });
    process.env.OPENAI_API_KEY = 'test-key';

    await service.processConversation('conv-1', 'page-1');

    expect(strandsMock.sendReplyAndStore).toHaveBeenCalledWith('page-1', expect.anything(), 'Dạ, giá sản phẩm là 1.500.000đ ạ.');
    expect(strandsMock.generateReply).not.toHaveBeenCalled();
    const sentLog = prismaMock.agentLog.create.mock.calls.find((c) => c[0].data.event === 'reply_sent')!;
    expect(sentLog[0].data.payload.source).toBe('ai_rule');
    const updateCall = prismaMock.conversation.update.mock.calls.find((c) => c[0].data.aiReplyCount !== undefined)!;
    expect(updateCall[0].data.aiReplyCount).toBe(1);
  });

  it('TH#15: no OPENAI_API_KEY on LLM branch → escalated_no_api_key + pending, no generateReply', async () => {
    delete process.env.OPENAI_API_KEY;
    workflowMock.run.mockResolvedValue({ action: 'reply', intent: 'price', confidence: 0.9 });

    await service.processConversation('conv-1', 'page-1');

    const logCall = prismaMock.agentLog.create.mock.calls.find((c) => c[0].data.event === 'escalated_no_api_key');
    expect(logCall).toBeDefined();
    const updateData = prismaMock.conversation.update.mock.calls.find((c) => c[0].data.status === 'pending');
    expect(updateData).toBeDefined();
    expect(strandsMock.generateReply).not.toHaveBeenCalled();
    expect(strandsMock.sendReplyAndStore).not.toHaveBeenCalled();
  });

  it('TH#14+17: LLM reply success → sends + logs reply_sent + counts', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    strandsMock.generateReply.mockResolvedValue('Áo thun cotton giá 299.000đ ạ.');

    await service.processConversation('conv-1', 'page-1');

    expect(strandsMock.generateReply).toHaveBeenCalledTimes(1);
    expect(strandsMock.sendReplyAndStore).toHaveBeenCalledWith('page-1', expect.anything(), 'Áo thun cotton giá 299.000đ ạ.');
    const sentLog = prismaMock.agentLog.create.mock.calls.find((c) => c[0].data.event === 'reply_sent')!;
    expect(sentLog[0].data.payload.text).toBe('Áo thun cotton giá 299.000đ ạ.');
    const updateCall = prismaMock.conversation.update.mock.calls.find((c) => c[0].data.aiReplyCount !== undefined)!;
    expect(updateCall[0].data.aiReplyCount).toBe(1);
  });

  it('RAG: decision.knowledge → generateReply nhận knowledgeContext', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    strandsMock.generateReply.mockResolvedValue('Dạ, bảo hành 12 tháng ạ.');
    workflowMock.run.mockResolvedValue({
      action: 'reply',
      intent: 'unknown',
      confidence: 0.3,
      knowledge: [{ content: 'Chính sách bảo hành 12 tháng.', similarity: 0.85 }],
    });

    await service.processConversation('conv-1', 'page-1');

    const args = strandsMock.generateReply.mock.calls[0][0];
    expect(args.knowledgeContext).toContain('Chính sách bảo hành 12 tháng.');
  });

  it('RAG: không có knowledge → knowledgeContext undefined', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    strandsMock.generateReply.mockResolvedValue('Xin chào ạ.');
    workflowMock.run.mockResolvedValue({ action: 'reply', intent: 'greeting', confidence: 0.9, knowledge: [] });

    await service.processConversation('conv-1', 'page-1');

    const args = strandsMock.generateReply.mock.calls[0][0];
    expect(args.knowledgeContext).toBeUndefined();
  });

  it('TH#18: generateReply returns null → pending, no send', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    strandsMock.generateReply.mockResolvedValue(null);

    await service.processConversation('conv-1', 'page-1');

    const updateData = prismaMock.conversation.update.mock.calls.find((c) => c[0].data.status === 'pending');
    expect(updateData).toBeDefined();
    expect(strandsMock.sendReplyAndStore).not.toHaveBeenCalled();
  });
});
