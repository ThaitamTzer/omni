import type { MessageDto } from '@omni/shared';

/** Payload các sự kiện realtime từ backend (socket.io) — khớp realtime.gateway. */
export interface ConversationUpdateEvent {
  conversationId: string;
}

export interface ConversationDeletedEvent {
  conversationId: string;
}

export interface ConversationRestoredEvent {
  conversationId: string;
}

export interface MessageNewEvent {
  conversationId: string;
  message: MessageDto;
}

export interface ConversationTypingEvent {
  conversationId: string;
  typing: boolean;
}
