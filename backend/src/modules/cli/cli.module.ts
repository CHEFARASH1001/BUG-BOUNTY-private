import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CliController } from './cli.controller';
import { CliService } from './cli.service';
import { SubfinderWorker } from './subfinder.worker';
import { ReconModule } from '../recon/recon.module';
import { DomainsModule } from '../domains/domains.module';
import { SubdomainsModule } from '../subdomains/subdomains.module';
import { QueueModule } from '../queue/queue.module';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { Subdomain, SubdomainSchema } from '../../schemas/subdomain.schema';
import { Live, LiveSchema } from '../../schemas/live.schema';
import { HttpService, HttpServiceSchema } from '../../schemas/http-service.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Domain.name, schema: DomainSchema },
      { name: Subdomain.name, schema: SubdomainSchema },
      { name: Live.name, schema: LiveSchema },
      { name: HttpService.name, schema: HttpServiceSchema },
    ]),
    ReconModule,
    DomainsModule,
    SubdomainsModule,
    QueueModule,
  ],
  controllers: [CliController],
  providers: [CliService, SubfinderWorker],
  exports: [CliService],
})
export class CliModule {}
