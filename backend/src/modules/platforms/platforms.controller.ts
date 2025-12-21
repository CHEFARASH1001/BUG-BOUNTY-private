import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformSyncService, SyncResult } from './platform-sync.service';
import { HackerOneService } from './services/hackerone.service';
import { BugcrowdService } from './services/bugcrowd.service';

@ApiTags('Platforms')
@Controller('platforms')
export class PlatformsController {
  constructor(
    private platformSyncService: PlatformSyncService,
    private hackerOneService: HackerOneService,
    private bugcrowdService: BugcrowdService,
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
}

