import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // Serve uploaded knowledgebase files (images) — public read access.
  app.use('/uploads', express.static(resolve(__dirname, '../../../uploads')));
  const webOrigins = (config.get('WEB_URL') ?? 'http://localhost:5173')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (curl, server-to-server) or from a listed origin
      if (!origin || webOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = config.get('PORT') ?? 3000;
  await app.listen(port);
  console.log(`Omni API listening on http://localhost:${port}`);
}
bootstrap();
