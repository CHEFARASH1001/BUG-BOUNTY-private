import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EndpointsService } from './endpoints.service';
import { EndpointsController } from './endpoints.controller';
import { Endpoint, EndpointSchema } from '../../schemas/endpoint.schema';
import { Subdomain, SubdomainSchema } from '../../schemas/subdomain.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Endpoint.name, schema: EndpointSchema },
      { name: Subdomain.name, schema: SubdomainSchema },
    ]),
  ],
  controllers: [EndpointsController],
  providers: [EndpointsService],
  exports: [EndpointsService],
})
export class EndpointsModule {}

