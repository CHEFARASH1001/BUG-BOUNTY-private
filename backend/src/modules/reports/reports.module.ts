import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Vulnerability, VulnerabilitySchema } from '../../schemas/vulnerability.schema';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { Subdomain, SubdomainSchema } from '../../schemas/subdomain.schema';
import { Program, ProgramSchema } from '../../schemas/program.schema';
import { Scan, ScanSchema } from '../../schemas/scan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vulnerability.name, schema: VulnerabilitySchema },
      { name: Domain.name, schema: DomainSchema },
      { name: Subdomain.name, schema: SubdomainSchema },
      { name: Program.name, schema: ProgramSchema },
      { name: Scan.name, schema: ScanSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

