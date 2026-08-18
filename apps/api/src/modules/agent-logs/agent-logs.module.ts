import { Module } from '@nestjs/common';
import { AgentLogsController } from './agent-logs.controller';
import { AgentLogsService } from './agent-logs.service';

@Module({
  controllers: [AgentLogsController],
  providers: [AgentLogsService],
  exports: [AgentLogsService],
})
export class AgentLogsModule {}
