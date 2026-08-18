import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from './message.service';
import { InboundMessage } from '../webhook/inbound-message';

const PAGE = { id: 'page-1', fbPageId: 'fb-page-1', name: 'Test Page' };
const CONV = (overrides: Record<string, unknown> = {}) => ({
  id: 'conv-1',
  pageId: PAGE.id,
  fbConversationId: 'fb-customer-1',
  customerFbId: 'fb-customer-1',
  customerName: 'Lê Trần Thái Tâm',
  status: 'open',
  aiEnabled: true,
  deletedAt: null as Date | null,
  lastMessageAt: new Date(),
  ...overrides,
});

function makeMsg(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    externalId: 'mid.1',
    sender: 'customer',
    customerFbId: 'fb-customer-1',
    pageFbId: PAGE.fbPageId,
    text: 'Xin chào',
    attachments: [],
    timestamp: 100,
    ...overrides,
  };
}

describe('MessageService.processInbound', () => {
  let service: MessageService;
  const aiQueueAdd = vi.fn();
  const emitRestored = vi.fn();
  const emitNewMessage = vi.fn();
  const emitConversationUpdate = vi.fn();

  const prismaMock = {
    page: { findUnique: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    message: { create: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.page.findUnique.mockResolvedValue(PAGE);
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1', senderType: 'CUSTOMER', text: 'Xin chào' });
    prismaMock.conversation.update.mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
      Promise.resolve(CONV({ id: args.where.id, ...args.data })),
    );
    prismaMock.conversation.create.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve(CONV(args.data)),
    );

    service = new MessageService(
      prismaMock as never,
      { emitNewMessage, emitConversationUpdate, emitConversationRestored: emitRestored } as never,
      { fetchCustomerProfile: vi.fn().mockResolvedValue({ name: null, avatar: null }) } as never,
      { add: aiQueueAdd } as never,
    );
  });

  it('TH#1: new conversation → creates with aiEnabled + enqueues AI', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(null);
    prismaMock.conversation.create.mockResolvedValue(CONV());

    await service.processInbound(makeMsg());

    const created = prismaMock.conversation.create.mock.calls[0][0].data;
    expect(created.aiEnabled).toBe(true);
    expect(created.status).toBe('open');
    expect(aiQueueAdd).toHaveBeenCalledTimes(1);
    expect(aiQueueAdd.mock.calls[0][0]).toBe('process-conversation');
  });

  it('TH#2: open conversation → enqueues AI', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV());

    await service.processInbound(makeMsg());

    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
    expect(aiQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('TH#3: closed conversation → reopens to open + enqueues AI', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV({ status: 'closed' }));

    await service.processInbound(makeMsg());

    const updateData = prismaMock.conversation.update.mock.calls[0][0].data;
    expect(updateData.status).toBe('open');
    expect(aiQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('TH#4: pending conversation → status stays pending + still enqueues AI', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV({ status: 'pending' }));

    await service.processInbound(makeMsg());

    const updateData = prismaMock.conversation.update.mock.calls[0][0].data;
    expect(updateData.status).toBe('pending');
    expect(aiQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('TH#5: soft-deleted conversation → restores to inbox + emits restored + enqueues AI', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV({ deletedAt: new Date() }));

    await service.processInbound(makeMsg());

    const restoreData = prismaMock.conversation.update.mock.calls[0][0].data;
    expect(restoreData.deletedAt).toBeNull();
    expect(emitRestored).toHaveBeenCalledWith('conv-1');
    expect(aiQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('TH#6: aiEnabled=false (staff takeover) → does NOT enqueue AI', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV({ aiEnabled: false }));

    await service.processInbound(makeMsg());

    expect(aiQueueAdd).not.toHaveBeenCalled();
  });

  it('TH#7: echo (page sender) → saves as AGENT + does NOT enqueue AI', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV());
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1', senderType: 'AGENT', text: 'Trả lời' });

    await service.processInbound(makeMsg({ sender: 'page', text: 'Trả lời' }));

    const saved = prismaMock.message.create.mock.calls[0][0].data;
    expect(saved.senderType).toBe('AGENT');
    expect(saved.isSent).toBe(true);
    expect(aiQueueAdd).not.toHaveBeenCalled();
  });

  it('TH#8: attachment-only message (no text) → does NOT enqueue AI', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV());

    await service.processInbound(makeMsg({ text: undefined, attachments: [{ type: 'image' }] }));

    expect(aiQueueAdd).not.toHaveBeenCalled();
  });

  it('TH#8b: message with text + attachment → enqueues AI', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(CONV());

    await service.processInbound(makeMsg({ text: 'Ảnh sản phẩm đây', attachments: [{ type: 'image' }] }));

    expect(aiQueueAdd).toHaveBeenCalledTimes(1);
  });
});
