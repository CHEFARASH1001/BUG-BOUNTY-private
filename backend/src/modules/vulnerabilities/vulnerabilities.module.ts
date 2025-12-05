import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VulnerabilitiesService } from './vulnerabilities.service';
import { VulnerabilitiesController } from './vulnerabilities.controller';
import { Vulnerability, VulnerabilitySchema } from '../../schemas/vulnerability.schema';
import { Program, ProgramSchema } from '../../schemas/program.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vulnerability.name, schema: VulnerabilitySchema },
      { name: Program.name, schema: ProgramSchema },
    ]),
  ],
  controllers: [VulnerabilitiesController],
  providers: [VulnerabilitiesService],
  exports: [VulnerabilitiesService],
})
export class VulnerabilitiesModule {}

