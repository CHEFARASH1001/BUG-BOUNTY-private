import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HexStrikeService } from './hexstrike.service';
import { HexStrikeController } from './hexstrike.controller';
import { VulnerabilityMappingService } from './services/vulnerability-mapping.service';
import { VulnerabilityStorageService } from './services/vulnerability-storage.service';
import { HexStrikeConfigService } from './services/hexstrike-config.service';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { Program, ProgramSchema } from '../../schemas/program.schema';
import { Vulnerability, VulnerabilitySchema } from '../../schemas/vulnerability.schema';
import { HexStrikeConfig, HexStrikeConfigSchema } from './schemas/hexstrike-config.schema';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 300000, // 5 minutes default timeout for long-running operations
      maxRedirects: 5,
    }),
    MongooseModule.forFeature([
      { name: Domain.name, schema: DomainSchema },
      { name: Program.name, schema: ProgramSchema },
      { name: Vulnerability.name, schema: VulnerabilitySchema },
      { name: HexStrikeConfig.name, schema: HexStrikeConfigSchema },
    ]),
  ],
  controllers: [HexStrikeController],
  providers: [HexStrikeService, VulnerabilityMappingService, VulnerabilityStorageService, HexStrikeConfigService],
  exports: [HexStrikeService, VulnerabilityMappingService, VulnerabilityStorageService, HexStrikeConfigService],
})
export class HexStrikeModule {}
