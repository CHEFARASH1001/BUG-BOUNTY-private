import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
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

// Service Modules
import { ReconModule } from './modules/recon/recon.module';
import { ExternalApisModule } from './modules/external-apis/external-apis.module';
import { ScannerModule } from './modules/scanner/scanner.module';

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

    // Redis/Bull Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),

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

    // Service Modules
    ReconModule,
    ExternalApisModule,
    ScannerModule,
  ],
})
export class AppModule {}

