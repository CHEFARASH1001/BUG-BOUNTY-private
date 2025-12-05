import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [ConfigModule],
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
  ],
})
export class ExternalApisModule {}

