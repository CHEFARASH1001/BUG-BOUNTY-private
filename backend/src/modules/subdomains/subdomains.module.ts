import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubdomainsService } from './subdomains.service';
import { SubdomainsController } from './subdomains.controller';
import { Subdomain, SubdomainSchema } from '../../schemas/subdomain.schema';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { Endpoint, EndpointSchema } from '../../schemas/endpoint.schema';
import { Vulnerability, VulnerabilitySchema } from '../../schemas/vulnerability.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subdomain.name, schema: SubdomainSchema },
      { name: Domain.name, schema: DomainSchema },
      { name: Endpoint.name, schema: EndpointSchema },
      { name: Vulnerability.name, schema: VulnerabilitySchema },
    ]),
  ],
  controllers: [SubdomainsController],
  providers: [SubdomainsService],
  exports: [SubdomainsService],
})
export class SubdomainsModule {}

