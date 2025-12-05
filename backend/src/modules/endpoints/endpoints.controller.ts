import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EndpointsService } from './endpoints.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('endpoints')
@Controller('endpoints')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EndpointsController {
  constructor(private readonly endpointsService: EndpointsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all endpoints' })
  @ApiQuery({ name: 'subdomainId', required: false })
  @ApiQuery({ name: 'domainId', required: false })
  @ApiQuery({ name: 'isInteresting', required: false, type: Boolean })
  @ApiQuery({ name: 'hasParams', required: false, type: Boolean })
  @ApiQuery({ name: 'method', required: false })
  @ApiQuery({ name: 'statusCode', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('subdomainId') subdomainId?: string,
    @Query('domainId') domainId?: string,
    @Query('isInteresting') isInteresting?: boolean,
    @Query('hasParams') hasParams?: boolean,
    @Query('method') method?: string,
    @Query('statusCode') statusCode?: number,
    @Query('search') search?: string,
  ) {
    return this.endpointsService.findAll({
      subdomainId,
      domainId,
      isInteresting,
      hasParams,
      method,
      statusCode,
      search,
    });
  }

  @Get('interesting')
  @ApiOperation({ summary: 'Get interesting endpoints' })
  @ApiQuery({ name: 'subdomainId', required: false })
  getInteresting(@Query('subdomainId') subdomainId?: string) {
    return this.endpointsService.getInteresting(subdomainId);
  }

  @Get('with-params')
  @ApiOperation({ summary: 'Get endpoints with parameters' })
  @ApiQuery({ name: 'subdomainId', required: false })
  getWithParams(@Query('subdomainId') subdomainId?: string) {
    return this.endpointsService.getWithParams(subdomainId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get endpoint statistics' })
  @ApiQuery({ name: 'subdomainId', required: false })
  getStats(@Query('subdomainId') subdomainId?: string) {
    return this.endpointsService.getStats(subdomainId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get endpoint by ID' })
  findOne(@Param('id') id: string) {
    return this.endpointsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update endpoint' })
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.endpointsService.update(id, updateData);
  }

  @Post(':id/mark-interesting')
  @ApiOperation({ summary: 'Mark endpoint as interesting' })
  markAsInteresting(@Param('id') id: string, @Body('patterns') patterns: string[]) {
    return this.endpointsService.markAsInteresting(id, patterns);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete endpoint' })
  remove(@Param('id') id: string) {
    return this.endpointsService.delete(id);
  }
}

