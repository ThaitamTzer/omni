import { Controller, Get, Query } from '@nestjs/common';
import { AgentLogsService } from './agent-logs.service';

@Controller('agent-logs')
export class AgentLogsController {
  constructor(private readonly agentLogs: AgentLogsService) {}

  @Get()
  list(@Query('conversationId') conversationId?: string, @Query('take') take?: string) {
    return this.agentLogs.list(conversationId, take ? Number(take) : 100);
  }
}
