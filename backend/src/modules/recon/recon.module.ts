import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { ExternalApisModule } from '../external-apis/external-apis.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ExternalApisModule),
  ],
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
  ],
  exports: [ReconService, WaybackService, CTService, HttpProber],
})
export class ReconModule {}

