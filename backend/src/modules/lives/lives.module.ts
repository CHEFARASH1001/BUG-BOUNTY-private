import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LivesController } from './lives.controller';
import { LivesService } from './lives.service';
import { Live, LiveSchema } from '../../schemas/live.schema';
import { Subdomain, SubdomainSchema } from '../../schemas/subdomain.schema';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Live.name, schema: LiveSchema },
      { name: Subdomain.name, schema: SubdomainSchema },
    ]),
    QueueModule,
  ],
  controllers: [LivesController],
  providers: [LivesService],
  exports: [LivesService],
})
export class LivesModule {}

