import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ReconService } from './recon.service';
import { SubdomainEnumerator } from './services/subdomain-enumerator.service';
import { DnsResolver } from './services/dns-resolver.service';
import { PortScanner } from './services/port-scanner.service';
import { HttpProber } from './services/http-prober.service';
import { TechnologyDetector } from './services/technology-detector.service';
import { WafDetector } from './services/waf-detector.service';
import { SslAnalyzer } from './services/ssl-analyzer.service';
import { WaybackService } from './services/wayback.service';
import { CTService } from './services/ct.service';
import { WordlistService } from './services/wordlist.service';
import { DNSBruteService } from './services/dns-brute.service';
import { GAUService } from './services/gau.service';
import { ChaosService } from './services/chaos.service';
import { DNSBruteController } from './dns-brute.controller';
import { WordlistController } from './wordlist.controller';
import { GAUController } from './gau.controller';
import { ChaosController } from './chaos.controller';
import { ExternalApisModule } from '../external-apis/external-apis.module';
import { Wordlist, WordlistSchema } from '../../schemas/wordlist.schema';
import { DNSBruteJob, DNSBruteJobSchema } from '../../schemas/dns-brute-job.schema';
import { ChaosSync, ChaosSyncSchema } from '../../schemas/chaos-sync.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Wordlist.name, schema: WordlistSchema },
      { name: DNSBruteJob.name, schema: DNSBruteJobSchema },
      { name: ChaosSync.name, schema: ChaosSyncSchema },
    ]),
    forwardRef(() => ExternalApisModule),
  ],
  controllers: [DNSBruteController, WordlistController, GAUController, ChaosController],
  providers: [
    ReconService,
    SubdomainEnumerator,
    DnsResolver,
    PortScanner,
    HttpProber,
    TechnologyDetector,
    WafDetector,
    SslAnalyzer,
    WaybackService,
    CTService,
    WordlistService,
    DNSBruteService,
    GAUService,
    ChaosService,
  ],
  exports: [ReconService, WaybackService, CTService, HttpProber, WordlistService, DNSBruteService, GAUService, ChaosService],
})
export class ReconModule {}

