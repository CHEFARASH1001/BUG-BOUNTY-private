import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ExternalApisService } from './external-apis.service';
import { ShodanService } from './services/shodan.service';
import { SecurityTrailsService } from './services/securitytrails.service';
import { VirusTotalService } from './services/virustotal.service';
import { CensysService } from './services/censys.service';
import { HunterService } from './services/hunter.service';
import { AlienVaultService } from './services/alienvault.service';
import { HackerTargetService } from './services/hackertarget.service';
import { CrtShService } from './services/crtsh.service';
import { UrlScanService } from './services/urlscan.service';
import { AbuseIPDBService } from './services/abuseipdb.service';
import {
  AbuseIPDBResult,
  AbuseIPDBResultSchema,
} from '../../schemas/abuseipdb-result.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: AbuseIPDBResult.name, schema: AbuseIPDBResultSchema },
    ]),
  ],
  providers: [
    ExternalApisService,
    ShodanService,
    SecurityTrailsService,
    VirusTotalService,
    CensysService,
    HunterService,
    AlienVaultService,
    HackerTargetService,
    CrtShService,
    UrlScanService,
    AbuseIPDBService,
  ],
  exports: [
    ExternalApisService,
    ShodanService,
    SecurityTrailsService,
    VirusTotalService,
    CensysService,
    HunterService,
    AlienVaultService,
    HackerTargetService,
    CrtShService,
    UrlScanService,
    AbuseIPDBService,
  ],
})
export class ExternalApisModule {}

