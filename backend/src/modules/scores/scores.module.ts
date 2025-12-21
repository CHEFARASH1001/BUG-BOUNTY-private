import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScoresController } from './scores.controller';
import { ScoresService } from './scores.service';
import { Score, ScoreSchema } from '../../schemas/score.schema';
import { Program, ProgramSchema } from '../../schemas/program.schema';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { Subdomain, SubdomainSchema } from '../../schemas/subdomain.schema';
import { Live, LiveSchema } from '../../schemas/live.schema';
import { HttpService, HttpServiceSchema } from '../../schemas/http-service.schema';
import { Vulnerability, VulnerabilitySchema } from '../../schemas/vulnerability.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Score.name, schema: ScoreSchema },
      { name: Program.name, schema: ProgramSchema },
      { name: Domain.name, schema: DomainSchema },
      { name: Subdomain.name, schema: SubdomainSchema },
      { name: Live.name, schema: LiveSchema },
      { name: HttpService.name, schema: HttpServiceSchema },
      { name: Vulnerability.name, schema: VulnerabilitySchema },
    ]),
  ],
  controllers: [ScoresController],
  providers: [ScoresService],
  exports: [ScoresService],
})
export class ScoresModule {}

