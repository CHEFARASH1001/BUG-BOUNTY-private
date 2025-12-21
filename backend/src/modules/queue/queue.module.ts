import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueConstants } from './queue.constants';

@Global()
@Module({
  providers: [QueueService, QueueConstants],
  exports: [QueueService, QueueConstants],
})
export class QueueModule {}
