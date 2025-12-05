import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ScansService } from './scans.service';
import { ScansController } from './scans.controller';
import { ScanProcessor } from './processors/scan.processor';
import { Scan, ScanSchema } from '../../schemas/scan.schema';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { Subdomain, SubdomainSchema } from '../../schemas/subdomain.schema';
import { Vulnerability, VulnerabilitySchema } from '../../schemas/vulnerability.schema';
import { Endpoint, EndpointSchema } from '../../schemas/endpoint.schema';
import { ReconModule } from '../recon/recon.module';
import { ScannerModule } from '../scanner/scanner.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Scan.name, schema: ScanSchema },
      { name: Domain.name, schema: DomainSchema },
      { name: Subdomain.name, schema: SubdomainSchema },
      { name: Vulnerability.name, schema: VulnerabilitySchema },
      { name: Endpoint.name, schema: EndpointSchema },
    ]),
    BullModule.registerQueue({
      name: 'scans',
    }),
    forwardRef(() => ReconModule),
    forwardRef(() => ScannerModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => WebsocketModule),
  ],
  controllers: [ScansController],
  providers: [ScansService, ScanProcessor],
  exports: [ScansService],
})
export class ScansModule {}

