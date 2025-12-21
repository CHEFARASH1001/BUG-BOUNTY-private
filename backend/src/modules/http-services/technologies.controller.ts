import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { HttpServicesService } from './http-services.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Technologies')
@Controller('api/technologies')
export class TechnologiesController {
  constructor(private httpServicesService: HttpServicesService) {}

  @Get('list')
  @Public()
  @ApiOperation({ summary: 'Get all detected technologies' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of technologies with counts' })
  async listTechnologies(
    @Query('domain') domain?: string,
    @Query('programId') programId?: string,
    @Query('limit') limit?: string,
  ) {
    const technologies = await this.httpServicesService.getTechnologies({
      domain,
      programId,
    });

    if (limit) {
      return technologies.slice(0, parseInt(limit, 10));
    }

    return technologies;
  }
}

