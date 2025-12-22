import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CliService, WatchResult, CLIQueryOptions, SingleTargetResult, HTTPQueryResult, LivesQueryResult } from './cli.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('cli')
@Controller('cli')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CliController {
  constructor(private readonly cliService: CliService) {}

  // ==================== Single Domain Commands ====================

  /**
   * POST /cli/watch/subfinder/:domain
   * Run subfinder for a specific domain
   * Equivalent to: watch_subfinder <domain>
   */
  @Post('watch/subfinder/:domain')
  @ApiOperation({ summary: 'Run subfinder for a domain (watch_subfinder)' })
  @ApiParam({ name: 'domain', description: 'Target domain to enumerate' })
  async watchSubfinder(@Param('domain') domain: string): Promise<WatchResult> {
    return this.cliService.watchSubfinder(domain);
  }

  /**
   * POST /cli/watch/crtsh/:domain
   * Run crt.sh lookup for a domain
   * Equivalent to: watch_crtsh <domain>
   */
  @Post('watch/crtsh/:domain')
  @ApiOperation({ summary: 'Run crt.sh lookup for a domain (watch_crtsh)' })
  @ApiParam({ name: 'domain', description: 'Target domain to lookup' })
  async watchCrtsh(@Param('domain') domain: string): Promise<WatchResult> {
    return this.cliService.watchCrtsh(domain);
  }

  /**
   * POST /cli/watch/ns/:domain
   * Run DNS resolution for a domain's subdomains
   * Equivalent to: watch_ns <domain>
   */
  @Post('watch/ns/:domain')
  @ApiOperation({ summary: 'Run DNS resolution for a domain (watch_ns)' })
  @ApiParam({ name: 'domain', description: 'Target domain to resolve' })
  async watchNs(@Param('domain') domain: string): Promise<WatchResult> {
    return this.cliService.watchNs(domain);
  }

  /**
   * POST /cli/watch/http/:domain
   * Run HTTP probing for a domain
   * Equivalent to: watch_http <domain>
   */
  @Post('watch/http/:domain')
  @ApiOperation({ summary: 'Run HTTP probing for a domain (watch_http)' })
  @ApiParam({ name: 'domain', description: 'Target domain to probe' })
  async watchHttp(@Param('domain') domain: string): Promise<WatchResult> {
    return this.cliService.watchHttp(domain);
  }

  // ==================== Bulk Commands ====================

  /**
   * POST /cli/watch/ns-all
   * Run DNS resolution for all subdomains
   * Equivalent to: watch_ns_all
   */
  @Post('watch/ns-all')
  @ApiOperation({ summary: 'Run DNS resolution for all subdomains (watch_ns_all)' })
  async watchNsAll(): Promise<WatchResult> {
    return this.cliService.watchNsAll();
  }

  /**
   * POST /cli/watch/live/:domain
   * Run live subdomain detection using dnsx
   * Equivalent to: watch_live <domain>
   */
  @Post('watch/live/:domain')
  @ApiOperation({ summary: 'Run live detection with dnsx (watch_live)' })
  @ApiParam({ name: 'domain', description: 'Target domain to detect live subdomains' })
  async watchLive(@Param('domain') domain: string): Promise<WatchResult> {
    return this.cliService.watchLive(domain);
  }

  /**
   * POST /cli/watch/live-all
   * Run live subdomain detection for all domains
   * Equivalent to: watch_live_all
   */
  @Post('watch/live-all')
  @ApiOperation({ summary: 'Run live detection for all domains (watch_live_all)' })
  async watchLiveAll(): Promise<WatchResult> {
    return this.cliService.watchLiveAll();
  }

  /**
   * POST /cli/repair/subdomain-links
   * Repair orphaned subdomains by linking them to their parent domains
   */
  @Post('repair/subdomain-links')
  @ApiOperation({ summary: 'Repair orphaned subdomain links' })
  async repairSubdomainLinks(): Promise<WatchResult> {
    return this.cliService.repairSubdomainLinks();
  }

  /**
   * POST /cli/watch/http-all
   * Run HTTP probing for all alive hosts
   * Equivalent to: watch_http_all
   */
  @Post('watch/http-all')
  @ApiOperation({ summary: 'Run HTTP probing for all alive hosts (watch_http_all)' })
  async watchHttpAll(): Promise<WatchResult> {
    return this.cliService.watchHttpAll();
  }

  // ==================== Quick Actions ====================

  /**
   * POST /cli/quick-recon/:domain
   * Run quick reconnaissance (subfinder + dns + http)
   */
  @Post('quick-recon/:domain')
  @ApiOperation({ summary: 'Run quick recon: subfinder → DNS → HTTP' })
  @ApiParam({ name: 'domain', description: 'Target domain' })
  async quickRecon(@Param('domain') domain: string): Promise<{
    subfinder: WatchResult;
    dns: WatchResult;
    http: WatchResult;
    totalDuration: number;
  }> {
    const startTime = Date.now();
    
    // Step 1: Enumerate subdomains
    const subfinder = await this.cliService.watchSubfinder(domain);
    
    // Step 2: Resolve DNS
    const dns = await this.cliService.watchNs(domain);
    
    // Step 3: Probe HTTP
    const http = await this.cliService.watchHttp(domain);
    
    return {
      subfinder,
      dns,
      http,
      totalDuration: Date.now() - startTime,
    };
  }

  // ==================== Status Endpoints ====================

  /**
   * GET /cli/debug/domain-subdomains
   * Debug domain-subdomain relationships
   */
  @Get('debug/domain-subdomains')
  @Public()
  @ApiOperation({ summary: 'Debug domain-subdomain relationships' })
  async debugDomainSubdomains(): Promise<any> {
    return this.cliService.debugDomainSubdomains();
  }

  /**
   * GET /cli/debug/test-live/:domain
   * Test live detection for a single domain with detailed logging
   */
  @Get('debug/test-live/:domain')
  @Public()
  @ApiOperation({ summary: 'Test live detection for a domain' })
  async testLive(@Param('domain') domain: string): Promise<any> {
    return this.cliService.testLiveDetection(domain);
  }

  /**
   * GET /cli/commands
   * List all available CLI commands
   */
  @Get('commands')
  @Public()
  @ApiOperation({ summary: 'List all available CLI commands' })
  getCommands(): { commands: any[] } {
    return {
      commands: [
        {
          name: 'watch_subfinder',
          endpoint: 'POST /cli/watch/subfinder/:domain',
          description: 'Run subfinder for a specific domain',
          example: 'curl -X POST http://localhost:4000/api/v1/cli/watch/subfinder/example.com',
        },
        {
          name: 'watch_crtsh',
          endpoint: 'POST /cli/watch/crtsh/:domain',
          description: 'Run crt.sh certificate transparency lookup',
          example: 'curl -X POST http://localhost:4000/api/v1/cli/watch/crtsh/example.com',
        },
        {
          name: 'watch_ns',
          endpoint: 'POST /cli/watch/ns/:domain',
          description: 'Run DNS resolution for a domain\'s subdomains',
          example: 'curl -X POST http://localhost:4000/api/v1/cli/watch/ns/example.com',
        },
        {
          name: 'watch_http',
          endpoint: 'POST /cli/watch/http/:domain',
          description: 'Run HTTP probing for a domain',
          example: 'curl -X POST http://localhost:4000/api/v1/cli/watch/http/example.com',
        },
        {
          name: 'watch_ns_all',
          endpoint: 'POST /cli/watch/ns-all',
          description: 'Run DNS resolution for all subdomains',
          example: 'curl -X POST http://localhost:4000/api/v1/cli/watch/ns-all',
        },
        {
          name: 'watch_live',
          endpoint: 'POST /cli/watch/live/:domain',
          description: 'Run live detection with dnsx (IPs, CDN, CNAME)',
          example: 'curl -X POST http://localhost:4000/api/v1/cli/watch/live/example.com',
        },
        {
          name: 'watch_live_all',
          endpoint: 'POST /cli/watch/live-all',
          description: 'Run live detection for all domains',
          example: 'curl -X POST http://localhost:4000/api/v1/cli/watch/live-all',
        },
        {
          name: 'watch_http_all',
          endpoint: 'POST /cli/watch/http-all',
          description: 'Run HTTP probing for all alive hosts',
          example: 'curl -X POST http://localhost:4000/api/v1/cli/watch/http-all',
        },
        {
          name: 'quick_recon',
          endpoint: 'POST /cli/quick-recon/:domain',
          description: 'Run quick recon pipeline: subfinder → DNS → HTTP',
          example: 'curl -X POST http://localhost:4000/api/v1/cli/quick-recon/example.com',
        },
        {
          name: 'get_single_target',
          endpoint: 'GET /cli/target/:program',
          description: 'Get single target info for a program',
          example: 'curl http://localhost:4000/api/v1/cli/target/hackerone',
        },
        {
          name: 'get_http_all',
          endpoint: 'GET /cli/http',
          description: 'Get all HTTP services with optional filters',
          example: 'curl http://localhost:4000/api/v1/cli/http?compare=true',
        },
        {
          name: 'get_lives_scope',
          endpoint: 'GET /cli/lives/:program',
          description: 'Get live subdomains by scope for a program',
          example: 'curl http://localhost:4000/api/v1/cli/lives/hackerone?compare=true',
        },
      ],
    };
  }

  // ==================== Watchtower CLI Endpoints ====================

  /**
   * GET /cli/target/:program
   * Get single target info for a program
   * Equivalent to: watchtower get single target <program>
   * Requirements: 15.1
   */
  @Get('target/:program')
  @ApiOperation({ summary: 'Get single target info for a program (watchtower get single target)' })
  @ApiParam({ name: 'program', description: 'Program name or handle' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'table'], description: 'Output format' })
  async getSingleTarget(
    @Param('program') program: string,
    @Query('format') format: 'json' | 'table' = 'json',
  ): Promise<SingleTargetResult | string> {
    const options: CLIQueryOptions = { format };
    const result = await this.cliService.getSingleTarget(program, options);
    
    if (format === 'table') {
      return this.cliService.formatOutput(result, 'table');
    }
    return result;
  }

  /**
   * GET /cli/http
   * Get all HTTP services with optional filters
   * Equivalent to: watchtower get http all [--compare list]
   * Requirements: 16.1
   */
  @Get('http')
  @ApiOperation({ summary: 'Get all HTTP services with filters (watchtower get http all)' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'table'], description: 'Output format' })
  @ApiQuery({ name: 'compare', required: false, type: Boolean, description: 'Enable change comparison' })
  @ApiQuery({ name: 'statusCode', required: false, type: Number, description: 'Filter by status code' })
  @ApiQuery({ name: 'technology', required: false, type: String, description: 'Filter by technology' })
  @ApiQuery({ name: 'statusChanged', required: false, type: Boolean, description: 'Filter by status changed' })
  @ApiQuery({ name: 'titleChanged', required: false, type: Boolean, description: 'Filter by title changed' })
  @ApiQuery({ name: 'techChanged', required: false, type: Boolean, description: 'Filter by tech changed' })
  async getHTTPAll(
    @Query('format') format: 'json' | 'table' = 'json',
    @Query('compare') compare?: string,
    @Query('statusCode') statusCode?: string,
    @Query('technology') technology?: string,
    @Query('statusChanged') statusChanged?: string,
    @Query('titleChanged') titleChanged?: string,
    @Query('techChanged') techChanged?: string,
  ): Promise<HTTPQueryResult[] | string> {
    const filter: Record<string, any> = {};
    if (statusCode) filter.statusCode = statusCode;
    if (technology) filter.technology = technology;
    if (statusChanged !== undefined) filter.statusChanged = statusChanged === 'true';
    if (titleChanged !== undefined) filter.titleChanged = titleChanged === 'true';
    if (techChanged !== undefined) filter.techChanged = techChanged === 'true';

    const options: CLIQueryOptions = {
      format,
      compare: compare === 'true',
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    };

    const result = await this.cliService.getHTTPAll(options);
    
    if (format === 'table') {
      return this.cliService.formatOutput(result, 'table');
    }
    return result;
  }

  /**
   * GET /cli/http/:program
   * Get HTTP services for a specific program
   * Requirements: 16.1
   */
  @Get('http/:program')
  @ApiOperation({ summary: 'Get HTTP services for a program' })
  @ApiParam({ name: 'program', description: 'Program name or handle' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'table'], description: 'Output format' })
  @ApiQuery({ name: 'compare', required: false, type: Boolean, description: 'Enable change comparison' })
  @ApiQuery({ name: 'statusCode', required: false, type: Number, description: 'Filter by status code' })
  @ApiQuery({ name: 'technology', required: false, type: String, description: 'Filter by technology' })
  async getHTTPByProgram(
    @Param('program') program: string,
    @Query('format') format: 'json' | 'table' = 'json',
    @Query('compare') compare?: string,
    @Query('statusCode') statusCode?: string,
    @Query('technology') technology?: string,
  ): Promise<HTTPQueryResult[] | string> {
    const filter: Record<string, any> = {};
    if (statusCode) filter.statusCode = statusCode;
    if (technology) filter.technology = technology;

    const options: CLIQueryOptions = {
      format,
      compare: compare === 'true',
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    };

    const result = await this.cliService.getHTTPByProgram(program, options);
    
    if (format === 'table') {
      return this.cliService.formatOutput(result, 'table');
    }
    return result;
  }

  /**
   * GET /cli/lives/:program
   * Get live subdomains by scope for a program
   * Equivalent to: watchtower get lives scope <program> [--compare list]
   * Requirements: 17.1
   */
  @Get('lives/:program')
  @ApiOperation({ summary: 'Get live subdomains by scope (watchtower get lives scope)' })
  @ApiParam({ name: 'program', description: 'Program name or handle' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'table'], description: 'Output format' })
  @ApiQuery({ name: 'compare', required: false, type: Boolean, description: 'Enable change comparison' })
  @ApiQuery({ name: 'statusCode', required: false, type: Number, description: 'Filter by status code' })
  @ApiQuery({ name: 'technology', required: false, type: String, description: 'Filter by technology' })
  async getLivesScope(
    @Param('program') program: string,
    @Query('format') format: 'json' | 'table' = 'json',
    @Query('compare') compare?: string,
    @Query('statusCode') statusCode?: string,
    @Query('technology') technology?: string,
  ): Promise<LivesQueryResult[] | string> {
    const filter: Record<string, any> = {};
    if (statusCode) filter.statusCode = statusCode;
    if (technology) filter.technology = technology;

    const options: CLIQueryOptions = {
      format,
      compare: compare === 'true',
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    };

    const result = await this.cliService.getLivesScope(program, options);
    
    if (format === 'table') {
      return this.cliService.formatOutput(result, 'table');
    }
    return result;
  }
}
