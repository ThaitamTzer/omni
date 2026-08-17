import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PagesService } from '../pages/pages.service';

@Injectable()
export class MessengerService {
  private readonly logger = new Logger(MessengerService.name);
  private readonly graphApi = 'https://graph.facebook.com/v21.0';

  constructor(
    private readonly pages: PagesService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Send a text message via Messenger Send API for a given local Page.
   */
  async sendText(pageId: string, recipientFbId: string, text: string): Promise<string | null> {
    const accessToken = await this.pages.getDecryptedAccessToken(pageId);

    const url = `${this.graphApi}/me/messages?access_token=${encodeURIComponent(accessToken)}`;
    const body = {
      recipient: { id: recipientFbId },
      message: { text },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = (await resp.json().catch(() => ({}))) as { message_id?: string; error?: unknown };
    if (!resp.ok || json.error) {
      this.logger.error(`Send API error: ${JSON.stringify(json.error ?? json)}`);
      throw new Error(`Messenger send failed: ${JSON.stringify(json.error ?? json)}`);
    }
    return json.message_id ?? null;
  }

  /**
   * Signal typing indicator (sender action) to the customer.
   */
  async sendTypingIndicator(pageId: string, recipientFbId: string, typing: boolean): Promise<void> {
    const accessToken = await this.pages.getDecryptedAccessToken(pageId).catch(() => null);
    if (!accessToken) return;
    const url = `${this.graphApi}/me/messages?access_token=${encodeURIComponent(accessToken)}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientFbId },
        sender_action: typing ? 'typing_on' : 'typing_off',
      }),
    }).catch((e) => this.logger.warn(`Typing indicator failed: ${e.message}`));
  }
}
