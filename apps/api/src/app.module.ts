import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { PagesModule } from './modules/pages/pages.module';
import { StaffModule } from './modules/staff/staff.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AgentLogsModule } from './modules/agent-logs/agent-logs.module';
import { AiModule } from './modules/ai/ai.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { QueueModule } from './modules/queue/queue.module';
import { MessengerModule } from './modules/messenger/messenger.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    RealtimeModule,
    MessengerModule,
    WebhookModule,
    MessagesModule,
    ConversationsModule,
    PagesModule,
    StaffModule,
    SettingsModule,
    AgentLogsModule,
    AiModule,
    KnowledgeModule,
  ],
  providers: [
    // Protect every endpoint by default; opt out with @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
