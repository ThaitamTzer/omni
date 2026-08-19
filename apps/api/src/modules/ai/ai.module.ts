import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AiService } from './ai.service';
import { AiProcessor } from './ai.processor';
import { LangGraphWorkflow } from './langgraph/workflow';
import { SettingsModule } from '../settings/settings.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LangChainAgentExecutor } from './agent/langchain-agent.executor';
import { createCheckpointer } from './agent/checkpointer';
import { loadAiConfig } from './ai.config';
import { AgentLogService } from './agent/agent-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ReplyService } from './agent/reply.service';
import { HandoffService } from './agent/handoff.service';
import { ConversationLock } from './agent/conversation-lock';
import { OutputPolicyService } from './agent/output-policy.service';
import { MessengerModule } from '../messenger/messenger.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ai-replies' }),
    SettingsModule,
    KnowledgeModule,
    MessengerModule,
    RealtimeModule,
  ],
  providers: [
    AiService,
    AiProcessor,
    {
      provide: LangGraphWorkflow,
      useFactory: (config: ConfigService) => new LangGraphWorkflow(loadAiConfig(config)),
      inject: [ConfigService],
    },
    AgentLogService,
    ReplyService,
    HandoffService,
    ConversationLock,
    OutputPolicyService,
    {
      provide: LangChainAgentExecutor,
      useFactory: async (
        config: ConfigService,
        prisma: PrismaService,
        knowledge: KnowledgeService,
        logs: AgentLogService,
      ) => {
        const checkpointer = await createCheckpointer();
        return new LangChainAgentExecutor({
          config: loadAiConfig(config),
          checkpointer,
          toolDeps: { prisma, knowledge, logs },
          logs,
        });
      },
      inject: [ConfigService, PrismaService, KnowledgeService, AgentLogService],
    },
  ],
  exports: [AiService, LangChainAgentExecutor],
})
export class AiModule {}
