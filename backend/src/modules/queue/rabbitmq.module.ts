import { Global, Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync(RabbitMQModule, {
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('RABBITMQ_URL', 'amqp://bugbounty:bugbounty2024@localhost:5672/watchtower'),
        exchanges: [
          {
            name: 'watchtower.direct',
            type: 'direct',
          },
          {
            name: 'watchtower.dlx',
            type: 'direct',
          },
        ],
        queues: [
          {
            name: 'watchtower.scans',
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': 'watchtower.dlx',
                'x-dead-letter-routing-key': 'dlq',
              },
            },
          },
          {
            name: 'watchtower.enum',
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': 'watchtower.dlx',
                'x-dead-letter-routing-key': 'dlq',
              },
            },
          },
          {
            name: 'watchtower.dns',
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': 'watchtower.dlx',
                'x-dead-letter-routing-key': 'dlq',
              },
            },
          },
          {
            name: 'watchtower.http',
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': 'watchtower.dlx',
                'x-dead-letter-routing-key': 'dlq',
              },
            },
          },
          {
            name: 'watchtower.nuclei',
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': 'watchtower.dlx',
                'x-dead-letter-routing-key': 'dlq',
              },
            },
          },
          {
            name: 'watchtower.notify',
            options: {
              durable: true,
            },
          },
          {
            name: 'watchtower.subfinder',
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': 'watchtower.dlx',
                'x-dead-letter-routing-key': 'dlq',
              },
            },
          },
          {
            name: 'watchtower.platform-sync',
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': 'watchtower.dlx',
                'x-dead-letter-routing-key': 'dlq',
              },
            },
          },
          {
            name: 'watchtower.dlq',
            options: {
              durable: true,
            },
          },
        ],
        connectionInitOptions: { wait: true, timeout: 30000 },
        enableControllerDiscovery: true,
        // Allow 10 concurrent messages per consumer
        prefetchCount: 10,
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [RabbitMQModule],
})
export class RabbitMQWrapperModule {}

