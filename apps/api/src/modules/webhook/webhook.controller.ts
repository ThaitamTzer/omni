import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  HttpException,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/public.decorator';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly config: ConfigService,
  ) {}

  // GET /api/webhook/messenger?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
  @Public()
  @Get('messenger')
  async verify(@Query() query: Record<string, string>, @Res() res: Response) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token && (await this.webhookService.isValidVerifyToken(token))) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification failed');
  }

  // POST /api/webhook/messenger — real events from Meta
  @Public()
  @Post('messenger')
  async handleEvent(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const signature = req.headers['x-hub-signature-256'] as string;
    const appSecret = this.config.get('META_APP_SECRET');
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);

    if (appSecret && signature && !this.webhookService.verifySignature(appSecret, signature, rawBody)) {
      throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
    }

    // Ack immediately, process asynchronously via queue
    await this.webhookService.enqueueEvent(req.body);
    return res.status(200).send('EVENT_RECEIVED');
  }
}
