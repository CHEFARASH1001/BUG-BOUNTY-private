import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { DomainsModule } from './modules/domains/domains.module';
import { SubdomainsModule } from './modules/subdomains/subdomains.module';
import { ScansModule } from './modules/scans/scans.module';
import { VulnerabilitiesModule } from './modules/vulnerabilities/vulnerabilities.module';
import { EndpointsModule } from './modules/endpoints/endpoints.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { AlertModule } from './modules/alerts/alert.module';

// Service Modules
import { ReconModule } from './modules/recon/recon.module';
import { ExternalApisModule } from './modules/external-apis/external-apis.module';
import { ScannerModule } from './modules/scanner/scanner.module';
import { RabbitMQWrapperModule } from './modules/queue/rabbitmq.module';
import { QueueModule } from './modules/queue/queue.module';
import { PlatformsModule } from './modules/platforms/platforms.module';
import { LivesModule } from './modules/lives/lives.module';
import { ScoresModule } from './modules/scores/scores.module';
import { CronModule } from './modules/cron/cron.module';
import { DocumentationModule } from './modules/documentation/documentation.module';
import { CliModule } from './modules/cli/cli.module';
import { ToolsModule } from './modules/tools/tools.module';
import { HexStrikeModule } from './modules/hexstrike-ai/hexstrike.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),

    // MongoDB Connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        retryWrites: true,
        w: 'majority',
      }),
      inject: [ConfigService],
    }),

    // RabbitMQ Message Queue (Global wrapper)
    RabbitMQWrapperModule,

    // Queue Module (must be after RabbitMQWrapperModule)
    QueueModule,

    // Scheduler
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Feature Modules
    AuthModule,
    UsersModule,
    ProgramsModule,
    DomainsModule,
    SubdomainsModule,
    ScansModule,
    VulnerabilitiesModule,
    EndpointsModule,
    ReportsModule,
    NotificationsModule,
    WebsocketModule,
    AlertModule,

    // Service Modules
    ReconModule,
    ExternalApisModule,
    ScannerModule,
    PlatformsModule,
    LivesModule,
    ScoresModule,
    CronModule,
    DocumentationModule,
    CliModule,
    ToolsModule,
    HexStrikeModule,
  ],
})
export class AppModule {}
