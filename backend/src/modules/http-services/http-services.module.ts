import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpServicesController } from './http-services.controller';
import { TechnologiesController } from './technologies.controller';
import { HttpServicesService } from './http-services.service';
import { HttpMonitorService } from './http-monitor.service';
import { HttpService, HttpServiceSchema } from '../../schemas/http-service.schema';
import { Live, LiveSchema } from '../../schemas/live.schema';
import { QueueModule } from '../queue/queue.module';
import { ReconModule } from '../recon/recon.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HttpService.name, schema: HttpServiceSchema },
      { name: Live.name, schema: LiveSchema },
    ]),
    QueueModule,
    forwardRef(() => ReconModule),
  ],
  controllers: [HttpServicesController, TechnologiesController],
  providers: [HttpServicesService, HttpMonitorService],
  exports: [HttpServicesService, HttpMonitorService],
})
export class HttpServicesModule {}

