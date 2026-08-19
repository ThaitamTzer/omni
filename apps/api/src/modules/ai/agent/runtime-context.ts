/**
 * Runtime context do backend inject vào agent — model KHÔNG được truyền
 * các giá trị scope này (pageId/customerFbId). Mọi tool query phải
 * filter theo scope tại runtime.
 */
export interface AgentRuntimeContext {
  /** Scope bắt buộc — Page đang xử lý. */
  pageId: string;
  conversationId: string;
  customerFbId: string;
  customerName: string;
  settings: Record<string, string>;
}
