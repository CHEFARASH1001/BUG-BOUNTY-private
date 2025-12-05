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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProgramsService } from './programs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProgramDto, UpdateProgramDto } from './dto/program.dto';

@ApiTags('programs')
@Controller('programs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new bug bounty program' })
  create(@Body() createProgramDto: CreateProgramDto, @Request() req: any) {
    return this.programsService.create(createProgramDto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Get all programs' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('status') status?: string,
    @Query('platform') platform?: string,
    @Query('search') search?: string,
  ) {
    return this.programsService.findAll({ status, platform, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get program by ID' })
  findOne(@Param('id') id: string) {
    return this.programsService.findById(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get program statistics' })
  getStats(@Param('id') id: string) {
    return this.programsService.getStats(id);
  }

  @Get(':id/domains')
  @ApiOperation({ summary: 'Get domains for a program' })
  getDomains(@Param('id') id: string) {
    return this.programsService.getDomains(id);
  }

  @Get(':id/vulnerabilities')
  @ApiOperation({ summary: 'Get vulnerabilities for a program' })
  getVulnerabilities(@Param('id') id: string) {
    return this.programsService.getVulnerabilities(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update program' })
  update(@Param('id') id: string, @Body() updateProgramDto: UpdateProgramDto) {
    return this.programsService.update(id, updateProgramDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete program' })
  remove(@Param('id') id: string) {
    return this.programsService.delete(id);
  }
}

