import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainsService } from './domains.service';
import { DomainsController } from './domains.controller';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { Program, ProgramSchema } from '../../schemas/program.schema';
import { Subdomain, SubdomainSchema } from '../../schemas/subdomain.schema';
import { Scan, ScanSchema } from '../../schemas/scan.schema';
import { ScansModule } from '../scans/scans.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Domain.name, schema: DomainSchema },
      { name: Program.name, schema: ProgramSchema },
      { name: Subdomain.name, schema: SubdomainSchema },
      { name: Scan.name, schema: ScanSchema },
    ]),
    QueueModule,
    forwardRef(() => ScansModule),
  ],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
