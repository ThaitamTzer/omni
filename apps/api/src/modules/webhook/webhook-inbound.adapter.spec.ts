import { describe, it, expect } from 'vitest';
import { WebhookInboundAdapter, MessengerWebhookPayload } from './webhook-inbound.adapter';

const PAGE = '123456789';
const CUSTOMER = '987654321';

function payload(messaging: unknown[]): MessengerWebhookPayload {
  return { object: 'page', entry: [{ id: PAGE, time: 1, messaging: messaging as never }] };
}

describe('WebhookInboundAdapter', () => {
  const adapter = new WebhookInboundAdapter();

  it('maps a customer message to an InboundMessage', () => {
    const events = adapter.toInternal(
      payload([
        {
          sender: { id: CUSTOMER },
          recipient: { id: PAGE },
          timestamp: 100,
          message: { mid: 'mid.1', text: 'Xin chào' },
        },
      ]),
    );

    expect(events).toHaveLength(1);
    const msg = events[0] as { sender: string; customerFbId: string; pageFbId: string; text: string };
    expect(msg.sender).toBe('customer');
    expect(msg.customerFbId).toBe(CUSTOMER);
    expect(msg.pageFbId).toBe(PAGE);
    expect(msg.text).toBe('Xin chào');
  });

  it('maps an echo (page reply) with customer as recipient', () => {
    const events = adapter.toInternal(
      payload([
        {
          sender: { id: PAGE },
          recipient: { id: CUSTOMER },
          timestamp: 200,
          message: { mid: 'mid.2', text: 'Dạ còn ạ', is_echo: true },
        },
      ]),
    );

    const msg = events[0] as { sender: string; customerFbId: string };
    expect(msg.sender).toBe('page');
    expect(msg.customerFbId).toBe(CUSTOMER);
  });

  it('maps a delivery event to mids', () => {
    const events = adapter.toInternal(
      payload([
        {
          sender: { id: PAGE },
          recipient: { id: CUSTOMER },
          delivery: { mids: ['mid.1', 'mid.2'], watermark: 300 },
        },
      ]),
    );

    expect(events).toHaveLength(1);
    const delivery = events[0] as { mids: string[]; pageFbId: string };
    expect(delivery.mids).toEqual(['mid.1', 'mid.2']);
    expect(delivery.pageFbId).toBe(PAGE);
  });

  it('ignores non-page objects', () => {
    const events = adapter.toInternal({ object: 'user', entry: [] });
    expect(events).toHaveLength(0);
  });

  it('handles messages with attachments', () => {
    const events = adapter.toInternal(
      payload([
        {
          sender: { id: CUSTOMER },
          recipient: { id: PAGE },
          message: {
            mid: 'mid.3',
            attachments: [{ type: 'image', payload: { url: 'https://x/y.jpg' } }],
          },
        },
      ]),
    );

    const msg = events[0] as { text?: string; attachments: unknown[] };
    expect(msg.text).toBeUndefined();
    expect(msg.attachments).toHaveLength(1);
  });
});
