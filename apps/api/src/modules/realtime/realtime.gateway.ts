import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      const allowed = (process.env.WEB_URL ?? 'http://localhost:5173')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!origin || allowed.includes(origin)) callback(null, true);
      else callback(null, false);
    },
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server) {
    // Reject handshake before connection is established when JWT is missing/invalid
    server.use((socket, next) => {
      const token = (socket.handshake.auth?.token as string) ?? '';
      try {
        this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') ?? 'dev-secret' });
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  handleConnection(client: Socket) {
    console.log(`[socket] client connected: ${client.id}`);
  }

  emitConversationUpdate(conversationId: string, payload: unknown) {
    this.server?.emit('conversation:update', { conversationId, ...(payload as object) });
  }

  emitNewMessage(conversationId: string, message: unknown) {
    this.server?.emit('message:new', { conversationId, message });
  }

  emitTyping(conversationId: string, typing: boolean) {
    this.server?.emit('conversation:typing', { conversationId, typing });
  }
}
