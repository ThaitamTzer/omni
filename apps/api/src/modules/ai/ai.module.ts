import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiService } from './ai.service';
import { AiProcessor } from './ai.processor';
import { LangGraphWorkflow } from './langgraph/workflow';
import { StrandsAgentService } from './strands/strands-agent.service';
import { SettingsModule } from '../settings/settings.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'ai-replies' }), SettingsModule, KnowledgeModule],
  providers: [AiService, AiProcessor, LangGraphWorkflow, StrandsAgentService],
  exports: [AiService, StrandsAgentService],
})
export class AiModule {}
