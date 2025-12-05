import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { DomainsService } from './domains.service';
import { DomainsController } from './domains.controller';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { Program, ProgramSchema } from '../../schemas/program.schema';
import { Subdomain, SubdomainSchema } from '../../schemas/subdomain.schema';
import { Scan, ScanSchema } from '../../schemas/scan.schema';
import { ScansModule } from '../scans/scans.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Domain.name, schema: DomainSchema },
      { name: Program.name, schema: ProgramSchema },
      { name: Subdomain.name, schema: SubdomainSchema },
      { name: Scan.name, schema: ScanSchema },
    ]),
    BullModule.registerQueue({
      name: 'scans',
    }),
    forwardRef(() => ScansModule),
  ],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}

