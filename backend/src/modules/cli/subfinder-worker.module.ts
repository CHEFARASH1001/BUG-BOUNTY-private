import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { Subdomain, SubdomainSchema } from '../../schemas/subdomain.schema';
import { SubfinderWorker } from './subfinder.worker';

/**
 * Standalone module for SubfinderWorker
 * Can be used to run dedicated worker instances
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Domain.name, schema: DomainSchema },
      { name: Subdomain.name, schema: SubdomainSchema },
    ]),
  ],
  providers: [SubfinderWorker],
  exports: [SubfinderWorker],
})
export class SubfinderWorkerModule {}
