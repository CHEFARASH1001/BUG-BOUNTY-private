/**
 * Standalone Platform Sync Worker Entry Point
 * 
 * This file creates a minimal NestJS application that only runs
 * the PlatformSyncWorker for processing queue messages.
 * 
 * Usage: npm run start:platform-sync-worker
 * Scale: docker-compose up --scale platform-sync-worker=5
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { PlatformSyncWorkerModule } from './platform-sync-worker.module';

async function bootstrap() {
  const logger = new Logger('PlatformSyncWorker');
  
  const app = await NestFactory.createApplicationContext(PlatformSyncWorkerModule, {
    logger: ['error', 'warn', 'log'],
  });

  const workerId = process.env.WORKER_ID || `platform-sync-worker-${process.pid}`;
  logger.log(`🚀 Platform Sync Worker started: ${workerId}`);
  logger.log(`📡 Connected to RabbitMQ, waiting for jobs...`);

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.log('Shutting down worker...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap();
