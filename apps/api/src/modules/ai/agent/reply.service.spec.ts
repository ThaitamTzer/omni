import { describe, it, expect, vi } from 'vitest';
import { ReplyService } from './reply.service';

function makeService() {
  const prismaMock = {
    message: { create: vi.fn().mockResolvedValue({ id: 'msg-1' }) },
    conversation: { update: vi.fn().mockResolvedValue({}) },
  };
  const realtimeMock = { emitNewMessage: vi.fn() };
  const messengerMock = { sendText: vi.fn().mockResolvedValue('fb-mid-1') };
  const service = new ReplyService(
    prismaMock as never,
    realtimeMock as never,
    messengerMock as never,
  );
  return { service, prismaMock, realtimeMock, messengerMock };
}

describe('ReplyService.sendReplyAndStore', () => {
  it('gửi Messenger + lưu Message AGENT + cập nhật conversation + realtime', async () => {
    const { service, prismaMock, realtimeMock, messengerMock } = makeService();
    await service.sendReplyAndStore('page-1', { id: 'conv-1', customerFbId: 'fb-1' }, 'Dạ chào anh!');

    expect(messengerMock.sendText).toHaveBeenCalledWith('page-1', 'fb-1', 'Dạ chào anh!');
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        senderType: 'AGENT',
        senderId: 'page-1',
        fbMessageId: 'fb-mid-1',
        text: 'Dạ chào anh!',
        isSent: true,
      },
    });
    expect(prismaMock.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { lastMessageAt: expect.any(Date), lastMessagePreview: 'Dạ chào anh!' },
    });
    expect(realtimeMock.emitNewMessage).toHaveBeenCalledWith('conv-1', { id: 'msg-1' });
  });

  it('không có customerFbId → không gửi, không lưu', async () => {
    const { service, prismaMock, messengerMock } = makeService();
    await service.sendReplyAndStore('page-1', { id: 'conv-1', customerFbId: null }, 'text');

    expect(messengerMock.sendText).not.toHaveBeenCalled();
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });
});
