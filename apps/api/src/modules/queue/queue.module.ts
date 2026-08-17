import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST') ?? 'localhost',
          port: Number(config.get('REDIS_PORT') ?? 6379),
        },
      }),
    }),
    BullModule.registerQueue({ name: 'webhook-events' }),
    BullModule.registerQueue({ name: 'ai-replies' }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
