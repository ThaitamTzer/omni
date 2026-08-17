import { Injectable, Logger } from '@nestjs/common';
import {
  InboundMessage,
  InboundDeliveryEvent,
} from './inbound-message';

/**
 * Raw Messenger webhook payload shape (Facebook-specific). Kept private to
 * this adapter — no other module should import these types.
 */
interface MessengerRecipient {
  id: string;
}

interface MessengerMessage {
  mid: string;
  text?: string;
  attachments?: Array<{ type: string; payload?: Record<string, unknown> }>;
  is_echo?: boolean;
}

interface MessengerEvent {
  sender: MessengerRecipient;
  recipient: MessengerRecipient;
  timestamp?: number;
  message?: MessengerMessage;
  delivery?: { mids?: string[]; watermark?: number };
  read?: { watermark?: number };
}

interface MessengerEntry {
  id: string;
  time?: number;
  messaging?: MessengerEvent[];
}

export interface MessengerWebhookPayload {
  object: string;
  entry: MessengerEntry[];
}

export type InboundEvent = InboundMessage | InboundDeliveryEvent;

/**
 * Adapter at the webhook seam: maps a raw Facebook payload into internal
 * events. Callers only ever see InboundMessage / InboundDeliveryEvent.
 */
@Injectable()
export class WebhookInboundAdapter {
  private readonly logger = new Logger(WebhookInboundAdapter.name);

  toInternal(payload: MessengerWebhookPayload): InboundEvent[] {
    if (payload.object !== 'page') return [];

    const events: InboundEvent[] = [];
    for (const entry of payload.entry ?? []) {
      const pageFbId = entry.id;
      for (const event of entry.messaging ?? []) {
        if (event.message) {
          events.push(this.mapMessage(pageFbId, event));
        }
        if (event.delivery?.mids?.length) {
          events.push({ pageFbId, mids: event.delivery.mids });
        }
      }
    }
    return events;
  }

  private mapMessage(pageFbId: string, event: MessengerEvent): InboundMessage {
    const { sender, recipient, message, timestamp } = event;
    const isEcho = !!message?.is_echo;

    return {
      externalId: message?.mid ?? '',
      sender: isEcho ? 'page' : 'customer',
      // For echoes: sender is the page, recipient is the customer.
      // For customer messages: sender is the customer.
      customerFbId: isEcho ? recipient?.id ?? '' : sender?.id ?? '',
      pageFbId,
      text: message?.text,
      attachments: message?.attachments,
      timestamp,
    };
  }
}
