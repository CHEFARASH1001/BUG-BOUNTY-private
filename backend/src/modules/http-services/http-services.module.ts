import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpServicesController } from './http-services.controller';
import { TechnologiesController } from './technologies.controller';
import { HttpServicesService } from './http-services.service';
import { HttpService, HttpServiceSchema } from '../../schemas/http-service.schema';
import { Live, LiveSchema } from '../../schemas/live.schema';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HttpService.name, schema: HttpServiceSchema },
      { name: Live.name, schema: LiveSchema },
    ]),
    QueueModule,
  ],
  controllers: [HttpServicesController, TechnologiesController],
  providers: [HttpServicesService],
  exports: [HttpServicesService],
})
export class HttpServicesModule {}

