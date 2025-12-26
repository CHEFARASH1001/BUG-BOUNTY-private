/**
 * Minimal module for running standalone platform sync workers
 * Only includes what's needed for queue processing
 * 
 * Usage: npm run start:platform-sync-worker
 * Scale: docker-compose up --scale platform-sync-worker=5
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Program, ProgramSchema } from './schemas/program.schema';
import { Scope, ScopeSchema } from './schemas/scope.schema';
import { Domain, DomainSchema } from './schemas/domain.schema';
import { PlatformSyncWorker } from './modules/platforms/platform-sync.worker';
import { QueueConstants } from './modules/queue/queue.constants';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27017/bugbounty'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Program.name, schema: ProgramSchema },
      { name: Scope.name, schema: ScopeSchema },
      { name: Domain.name, schema: DomainSchema },
    ]),
    RabbitMQModule.forRootAsync(RabbitMQModule, {
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>(
          'RABBITMQ_URL',
          'amqp://bugbounty:bugbounty2024@localhost:5672/watchtower',
        ),
        exchanges: [
          { name: QueueConstants.EXCHANGE_DIRECT, type: 'direct' },
          { name: QueueConstants.EXCHANGE_DLX, type: 'direct' },
        ],
        queues: [
          {
            name: QueueConstants.QUEUE_PLATFORM_SYNC,
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': QueueConstants.EXCHANGE_DLX,
                'x-dead-letter-routing-key': QueueConstants.ROUTING_DLQ,
              },
            },
          },
        ],
        connectionInitOptions: { wait: true, timeout: 30000 },
        enableControllerDiscovery: true,
        // Process multiple messages concurrently per worker
        prefetchCount: 10,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [PlatformSyncWorker],
})
export class PlatformSyncWorkerModule {}
