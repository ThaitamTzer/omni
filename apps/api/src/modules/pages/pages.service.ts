import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly prisma: PrismaService) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      this.logger.warn('ENCRYPTION_KEY not set — falling back to plaintext storage (dev only!)');
      this.encryptionKey = createHash('sha256').update('dev-only-insecure-key').digest();
    } else {
      this.encryptionKey = Buffer.from(key, 'hex');
      if (this.encryptionKey.length !== 32) {
        this.logger.warn('ENCRYPTION_KEY must be 32 bytes hex — falling back to dev key');
        this.encryptionKey = createHash('sha256').update('dev-only-insecure-key').digest();
      }
    }
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  }

  private decrypt(stored: string): string {
    const [ver, ivHex, tagHex, dataHex] = stored.split(':');
    if (ver !== 'v1') throw new Error('Unknown encryption format');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  }

  async list() {
    const pages = await this.prisma.page.findMany({ orderBy: { createdAt: 'desc' } });
    return pages.map((p: { id: string; fbPageId: string; name: string; subscribed: boolean; verifyToken: string | null; createdAt: Date }) => ({
      id: p.id,
      fbPageId: p.fbPageId,
      name: p.name,
      subscribed: p.subscribed,
      verifyToken: p.verifyToken,
      createdAt: p.createdAt,
    }));
  }

  async create(data: { fbPageId: string; name: string; accessToken: string; verifyToken?: string }) {
    try {
      const page = await this.prisma.page.create({
        data: {
          fbPageId: data.fbPageId,
          name: data.name,
          accessToken: this.encrypt(data.accessToken),
          // Auto-generate a verify token when none is provided
          verifyToken: data.verifyToken || randomBytes(24).toString('hex'),
        },
      });
      return { id: page.id, fbPageId: page.fbPageId, name: page.name, subscribed: page.subscribed, verifyToken: page.verifyToken };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Facebook Page ID đã tồn tại. Kiểm tra danh sách Page hoặc dùng ID khác.');
      }
      throw e;
    }
  }

  async getDecryptedAccessToken(pageId: string): Promise<string> {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new Error('Page not found');
    if (page.accessToken.startsWith('v1:')) return this.decrypt(page.accessToken);
    return page.accessToken; // plaintext fallback (legacy/dev)
  }

  async setSubscribed(pageId: string, subscribed: boolean) {
    return this.prisma.page.update({ where: { id: pageId }, data: { subscribed } });
  }

  async remove(pageId: string) {
    await this.prisma.page.delete({ where: { id: pageId } });
    return { ok: true };
  }
}
