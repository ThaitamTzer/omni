import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Lock theo conversation — chống 2 job của cùng hội thoại chạy chồng
 * (tin 2 có thể hoàn thành trước tin 1, làm sai thứ tự/ngữ cảnh).
 * Fail-open: Redis lỗi → cho phép xử lý (không chặn AI).
 */
@Injectable()
export class ConversationLock implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get('REDIS_HOST') ?? 'localhost',
      port: Number(config.get('REDIS_PORT') ?? 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
  }

  async acquire(conversationId: string, ttlMs = 60000): Promise<boolean> {
    try {
      const key = `conv-lock:${conversationId}`;
      const result = await this.redis.set(key, '1', 'EX', ttlMs, 'NX');
      return result === 'OK';
    } catch (e) {
      console.warn(`ConversationLock acquire failed (fail-open): ${(e as Error).message}`);
      return true;
    }
  }

  async release(conversationId: string): Promise<void> {
    await this.redis.del(`conv-lock:${conversationId}`).catch(() => {});
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }
}
