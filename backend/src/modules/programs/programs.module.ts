import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgramsService } from './programs.service';
import { ProgramsController } from './programs.controller';
import { Program, ProgramSchema } from '../../schemas/program.schema';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { Vulnerability, VulnerabilitySchema } from '../../schemas/vulnerability.schema';
import { Scope, ScopeSchema } from '../../schemas/scope.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Program.name, schema: ProgramSchema },
      { name: Domain.name, schema: DomainSchema },
      { name: Vulnerability.name, schema: VulnerabilitySchema },
      { name: Scope.name, schema: ScopeSchema },
    ]),
  ],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}

