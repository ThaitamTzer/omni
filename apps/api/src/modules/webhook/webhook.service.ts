import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhook-events') private readonly webhookQueue: Queue,
  ) {}

  /**
   * A valid verify token is either the global WEBHOOK_VERIFY_TOKEN
   * or one configured per Page.
   */
  async isValidVerifyToken(token: string): Promise<boolean> {
    const global = process.env.WEBHOOK_VERIFY_TOKEN;
    if (global && token === global) return true;
    const page = await this.prisma.page.findFirst({
      where: { verifyToken: token },
    });
    return !!page;
  }

  /**
   * Verify X-Hub-Signature-256 header using META_APP_SECRET.
   */
  verifySignature(appSecret: string, signature: string, rawBody: string): boolean {
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Push a raw webhook payload into the queue for async processing.
   */
  async enqueueEvent(payload: unknown): Promise<void> {
    await this.webhookQueue.add('webhook-event', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
