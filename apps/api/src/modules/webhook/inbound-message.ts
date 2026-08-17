/**
 * Internal message model — the single canonical shape for a message
 * entering the system. Facebook/Messenger specifics are mapped away
 * by WebhookInboundAdapter; no other module should ever see a
 * Messenger payload type.
 */

export type InboundSender = 'customer' | 'page';

export interface InboundAttachment {
  type: string;
  payload?: Record<string, unknown>;
}

export interface InboundMessage {
  /** Facebook message id (mid) — used for dedupe/echo tracking. */
  externalId: string;
  /** Who sent the message: the customer, or the page itself (echo). */
  sender: InboundSender;
  /** Facebook id of the customer (conversation key). */
  customerFbId: string;
  /** Facebook id of the page that received/sent it. */
  pageFbId: string;
  text?: string;
  attachments?: InboundAttachment[];
  timestamp?: number;
}

export interface InboundDeliveryEvent {
  pageFbId: string;
  mids: string[];
}
