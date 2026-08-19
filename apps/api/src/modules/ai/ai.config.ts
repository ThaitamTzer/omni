import { ConfigService } from '@nestjs/config';

export interface AiModelConfig {
  /** Model chat chính cho agent trả lời. Env AI_CHAT_MODEL. */
  chatModel: string;
  /** Model nhỏ cho hybrid classifier. Env AI_CLASSIFY_MODEL. */
  classifyModel: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
}

export function loadAiConfig(config: ConfigService): AiModelConfig {
  return {
    chatModel: config.get('AI_CHAT_MODEL') ?? 'gpt-4o-mini',
    classifyModel: config.get('AI_CLASSIFY_MODEL') ?? 'gpt-4o-mini',
    temperature: Number(config.get('AI_TEMPERATURE') ?? 0.2),
    timeoutMs: Number(config.get('AI_TIMEOUT_MS') ?? 20000),
    maxRetries: Number(config.get('AI_MAX_RETRIES') ?? 2),
  };
}
