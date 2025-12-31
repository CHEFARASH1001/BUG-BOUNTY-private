import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScannerService } from './scanner.service';
import { NucleiService } from './services/nuclei.service';
import { VulnerabilityCheckerService } from './services/vulnerability-checker.service';
import { EndpointDiscoveryService } from './services/endpoint-discovery.service';
import { ScreenshotService } from './services/screenshot.service';
import { FuzzService } from './services/fuzz.service';
import { XssService } from './services/xss.service';
import { FuzzController } from './fuzz.controller';
import { XssController } from './xss.controller';
import { Vulnerability, VulnerabilitySchema } from '../../schemas/vulnerability.schema';
import { Endpoint, EndpointSchema } from '../../schemas/endpoint.schema';
import { FuzzJob, FuzzJobSchema } from '../../schemas/fuzz-job.schema';
import { XssScan, XssScanSchema } from '../../schemas/xss-scan.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Vulnerability.name, schema: VulnerabilitySchema },
      { name: Endpoint.name, schema: EndpointSchema },
      { name: FuzzJob.name, schema: FuzzJobSchema },
      { name: XssScan.name, schema: XssScanSchema },
    ]),
  ],
  controllers: [FuzzController, XssController],
  providers: [
    ScannerService,
    NucleiService,
    VulnerabilityCheckerService,
    EndpointDiscoveryService,
    ScreenshotService,
    FuzzService,
    XssService,
  ],
  exports: [ScannerService, NucleiService, VulnerabilityCheckerService, EndpointDiscoveryService, ScreenshotService, FuzzService, XssService],
})
export class ScannerModule {}

