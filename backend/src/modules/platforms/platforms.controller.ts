import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformSyncService, SyncResult } from './platform-sync.service';
import { HackerOneService } from './services/hackerone.service';
import { BugcrowdService } from './services/bugcrowd.service';
import { GitHubProgramsService } from './services/github-programs.service';

@ApiTags('Platforms')
@Controller('api/platforms')
export class PlatformsController {
  constructor(
    private platformSyncService: PlatformSyncService,
    private hackerOneService: HackerOneService,
    private bugcrowdService: BugcrowdService,
    private githubProgramsService: GitHubProgramsService,
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

  @Post('sync/github')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync GitHub program lists' })
  async syncGitHub(): Promise<SyncResult> {
    return this.platformSyncService.syncGitHubPrograms();
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

  @Get('github/domains')
  @ApiOperation({ summary: 'Get all domains from GitHub lists' })
  async getGitHubDomains() {
    return this.githubProgramsService.fetchAllDomains();
  }

  @Get('github/wildcards')
  @ApiOperation({ summary: 'Get wildcards from GitHub lists' })
  async getGitHubWildcards() {
    return this.githubProgramsService.fetchWildcards();
  }

  @Get('github/chaos')
  @ApiOperation({ summary: 'Get Chaos program list' })
  async getChaosPrograms() {
    return this.githubProgramsService.fetchChaosPrograms();
  }
}

