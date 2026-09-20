import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';
import { JobExecution, JobExecutionSchema } from './schemas/job-execution.schema';
import { CronConfig, CronConfigSchema } from './schemas/cron-config.schema';
import { QueueModule } from '../queue/queue.module';
import { PlatformsModule } from '../platforms/platforms.module';
import { LivesModule } from '../lives/lives.module';
import { ScoresModule } from '../scores/scores.module';
import { DomainsModule } from '../domains/domains.module';
import { SubdomainsModule } from '../subdomains/subdomains.module';
import { ReconModule } from '../recon/recon.module';
import { CliModule } from '../cli/cli.module';
import { ExternalApisModule } from '../external-apis/external-apis.module';
import { AlertModule } from '../alerts/alert.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { ScannerModule } from '../scanner/scanner.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: JobExecution.name, schema: JobExecutionSchema },
      { name: CronConfig.name, schema: CronConfigSchema },
    ]),
    QueueModule,
    forwardRef(() => PlatformsModule),
    forwardRef(() => LivesModule),
    forwardRef(() => ScoresModule),
    forwardRef(() => DomainsModule),
    forwardRef(() => SubdomainsModule),
    forwardRef(() => ReconModule),
    forwardRef(() => CliModule),
    forwardRef(() => ExternalApisModule),
    forwardRef(() => AlertModule),
    forwardRef(() => EndpointsModule),
    forwardRef(() => ScannerModule),
    forwardRef(() => ToolsModule),
  ],
  controllers: [CronController],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
