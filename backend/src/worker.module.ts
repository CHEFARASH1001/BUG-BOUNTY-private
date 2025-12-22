import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Domain, DomainSchema } from './schemas/domain.schema';
import { Subdomain, SubdomainSchema } from './schemas/subdomain.schema';
import { SubfinderWorker } from './modules/cli/subfinder.worker';
import { QueueConstants } from './modules/queue/queue.constants';

/**
 * Minimal module for running standalone subfinder workers
 * Only includes what's needed for queue processing
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>(
          'MONGODB_URI',
          'mongodb://admin:bugbounty2024@localhost:27017/bugbounty?authSource=admin',
        ),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Domain.name, schema: DomainSchema },
      { name: Subdomain.name, schema: SubdomainSchema },
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
            name: QueueConstants.QUEUE_SUBFINDER,
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
        prefetchCount: 5,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [SubfinderWorker],
})
export class WorkerModule {}
