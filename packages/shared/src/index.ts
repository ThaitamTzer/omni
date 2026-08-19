// Shared types used by both the API and the web dashboard.

export type SenderType = 'CUSTOMER' | 'AGENT' | 'STAFF' | 'SYSTEM';

export type ConversationStatus = 'open' | 'pending' | 'closed';

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'location';
  url?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  payload?: Record<string, unknown>;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderId: string | null;
  fbMessageId: string | null;
  text: string | null;
  attachments: Attachment[];
  isSent: boolean;
  deliveredAt: Date | null;
  createdAt: Date;
}

export interface ConversationDto {
  id: string;
  pageId: string;
  pageName: string;
  fbConversationId: string;
  customerName: string;
  customerFbId: string | null;
  customerAvatar: string | null;
  status: ConversationStatus;
  aiEnabled: boolean;
  assignedStaffId: string | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  deletedAt: Date | null;
  updatedAt: Date;
}

export interface PageDto {
  id: string;
  fbPageId: string;
  name: string;
  subscribed: boolean;
  verifyToken: string | null;
  createdAt: Date;
}

export interface AiRuleDto {
  id: string;
  name: string;
  keywords: string[];
  responseTemplate: string | null;
  enabled: boolean;
  priority: number;
}

export interface FaqDto {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type KnowledgeKind = 'text' | 'pdf' | 'docx' | 'xlsx' | 'image';

export interface KnowledgeFileDto {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: KnowledgeKind;
  status: 'processing' | 'ready' | 'failed';
  error: string | null;
  createdAt: Date;
}
