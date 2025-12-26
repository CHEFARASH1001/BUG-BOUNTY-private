import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HackerOneService } from './services/hackerone.service';
import { BugcrowdService } from './services/bugcrowd.service';
import { ChaosService } from './services/chaos.service';
import { BountyTargetsService } from './services/bounty-targets.service';
import { PlatformSyncService } from './platform-sync.service';
import { PlatformSyncWorker } from './platform-sync.worker';
import { PlatformsController } from './platforms.controller';
import { Program, ProgramSchema } from '../../schemas/program.schema';
import { Scope, ScopeSchema } from '../../schemas/scope.schema';
import { Domain, DomainSchema } from '../../schemas/domain.schema';
import { QueueModule } from '../queue/queue.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Program.name, schema: ProgramSchema },
      { name: Scope.name, schema: ScopeSchema },
      { name: Domain.name, schema: DomainSchema },
    ]),
    QueueModule,
    NotificationsModule,
  ],
  controllers: [PlatformsController],
  providers: [
    HackerOneService,
    BugcrowdService,
    ChaosService,
    BountyTargetsService,
    PlatformSyncService,
    PlatformSyncWorker,
  ],
  exports: [
    HackerOneService,
    BugcrowdService,
    ChaosService,
    BountyTargetsService,
    PlatformSyncService,
  ],
})
export class PlatformsModule {}

