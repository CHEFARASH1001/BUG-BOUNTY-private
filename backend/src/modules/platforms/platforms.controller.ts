import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformSyncService, SyncResult } from './platform-sync.service';
import { HackerOneService } from './services/hackerone.service';
import { BugcrowdService } from './services/bugcrowd.service';
import { ChaosService } from './services/chaos.service';
import { BountyTargetsService } from './services/bounty-targets.service';

@ApiTags('Platforms')
@Controller('platforms')
export class PlatformsController {
  constructor(
    private platformSyncService: PlatformSyncService,
    private hackerOneService: HackerOneService,
    private bugcrowdService: BugcrowdService,
    private chaosService: ChaosService,
    private bountyTargetsService: BountyTargetsService,
  ) {}

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger platform sync' })
  @ApiResponse({ status: 200, description: 'Sync started' })
  async triggerSync(): Promise<{ message: string; results: SyncResult[] }> {
    const results = await this.platformSyncService.syncAllPlatforms();
    return {
      message: 'Platform sync completed',
      results,
    };
  }

  @Post('sync/hackerone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync HackerOne programs' })
  async syncHackerOne(): Promise<SyncResult> {
    return this.platformSyncService.syncHackerOne();
  }

  @Post('sync/bugcrowd')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync Bugcrowd programs' })
  async syncBugcrowd(): Promise<SyncResult> {
    return this.platformSyncService.syncBugcrowd();
  }

  /**
   * Trigger sync for ProjectDiscovery Chaos data
   * Requirements: 5.1 - POST endpoint /platforms/sync/chaos
   * Requirements: 5.5 - Require JWT authentication
   */
  @Post('sync/chaos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync Chaos programs from ProjectDiscovery' })
  @ApiResponse({ status: 200, description: 'Chaos sync completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async syncChaos(): Promise<SyncResult> {
    return this.platformSyncService.syncChaos();
  }

  /**
   * Trigger sync for bounty-targets-data
   * Requirements: 5.2 - POST endpoint /platforms/sync/bounty-targets
   * Requirements: 5.5 - Require JWT authentication
   */
  @Post('sync/bounty-targets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync programs from bounty-targets-data' })
  @ApiResponse({ status: 200, description: 'Bounty-targets sync completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async syncBountyTargets(
    @Query('optimized') optimized?: string,
    @Query('concurrency') concurrency?: string,
    @Query('useWorkers') useWorkers?: string,
  ): Promise<SyncResult> {
    // Use optimized sync if requested
    if (optimized === 'true' || optimized === '1') {
      return this.platformSyncService.syncBountyTargetsOptimized(undefined, {
        concurrency: concurrency ? parseInt(concurrency, 10) : 10,
        useWorkers: useWorkers === 'true' || useWorkers === '1',
      });
    }
    return this.platformSyncService.syncBountyTargets();
  }

  /**
   * Optimized sync for bounty-targets-data with concurrent processing
   * Uses parallel processing and bulk database operations for faster sync
   */
  @Post('sync/bounty-targets/optimized')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Optimized sync for bounty-targets-data',
    description: 'Uses concurrent processing and bulk operations for faster sync. ' +
      'Set useWorkers=true to distribute work across queue workers.',
  })
  @ApiResponse({ status: 200, description: 'Bounty-targets optimized sync completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async syncBountyTargetsOptimized(
    @Query('concurrency') concurrency?: string,
    @Query('useWorkers') useWorkers?: string,
    @Query('batchSize') batchSize?: string,
  ): Promise<SyncResult> {
    return this.platformSyncService.syncBountyTargetsOptimized(undefined, {
      concurrency: concurrency ? parseInt(concurrency, 10) : 10,
      useWorkers: useWorkers === 'true' || useWorkers === '1',
      batchSize: batchSize ? parseInt(batchSize, 10) : 100,
    });
  }

  @Get('hackerone/programs')
  @ApiOperation({ summary: 'Get HackerOne programs (live fetch)' })
  async getHackerOnePrograms() {
    return this.hackerOneService.getPublicPrograms();
  }

  @Get('hackerone/programs/:handle')
  @ApiOperation({ summary: 'Get HackerOne program details' })
  async getHackerOneProgram(@Param('handle') handle: string) {
    return this.hackerOneService.getProgramDetails(handle);
  }

  @Get('bugcrowd/programs')
  @ApiOperation({ summary: 'Get Bugcrowd programs (live fetch)' })
  async getBugcrowdPrograms() {
    return this.bugcrowdService.fetchPublicPrograms();
  }

  @Get('bugcrowd/programs/:code')
  @ApiOperation({ summary: 'Get Bugcrowd program details' })
  async getBugcrowdProgram(@Param('code') code: string) {
    return this.bugcrowdService.getProgramDetails(code);
  }

  /**
   * Fetch live Chaos program data
   * Requirements: 5.3 - GET endpoint /platforms/chaos/programs
   */
  @Get('chaos/programs')
  @ApiOperation({ summary: 'Get Chaos programs (live fetch from ProjectDiscovery)' })
  @ApiResponse({ status: 200, description: 'List of Chaos programs' })
  async getChaosPrograms() {
    return this.chaosService.getPrograms();
  }

  /**
   * Fetch live bounty-targets program data
   * Requirements: 5.4 - GET endpoint /platforms/bounty-targets/programs
   */
  @Get('bounty-targets/programs')
  @ApiOperation({ summary: 'Get bounty-targets programs (live fetch from GitHub)' })
  @ApiResponse({ status: 200, description: 'List of bounty-targets programs' })
  async getBountyTargetsPrograms() {
    return this.bountyTargetsService.getAllPrograms();
  }
}

