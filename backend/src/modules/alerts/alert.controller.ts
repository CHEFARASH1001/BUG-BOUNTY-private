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
import { AlertService } from './alert.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CreateAlertRuleDto, UpdateAlertRuleDto } from './dto/alert.dto';

@ApiTags('alerts')
@Controller('alerts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post('rules')
  @Public() // Allow public access for dev mode
  @ApiOperation({ summary: 'Create a new alert rule' })
  create(@Body() createDto: CreateAlertRuleDto, @Request() req: any) {
    const userId = req.user?.sub || 'default-user';
    return this.alertService.create(createDto, userId);
  }

  @Get('rules')
  @Public() // Allow public access for dev mode
  @ApiOperation({ summary: 'Get all alert rules for the current user' })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'enabled', required: false, type: Boolean })
  findAll(
    @Request() req: any,
    @Query('programId') programId?: string,
    @Query('enabled') enabled?: string,
  ) {
    const userId = req.user?.sub || 'default-user';
    const filters: { programId?: string; enabled?: boolean } = {};
    
    if (programId) {
      filters.programId = programId;
    }
    if (enabled !== undefined) {
      filters.enabled = enabled === 'true';
    }

    return this.alertService.findAll(userId, filters);
  }

  @Get('rules/:id')
  @Public() // Allow public access for dev mode
  @ApiOperation({ summary: 'Get alert rule by ID' })
  findOne(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || 'default-user';
    return this.alertService.findById(id, userId);
  }

  @Put('rules/:id')
  @Public() // Allow public access for dev mode
  @ApiOperation({ summary: 'Update alert rule' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAlertRuleDto,
    @Request() req: any,
  ) {
    const userId = req.user?.sub || 'default-user';
    return this.alertService.update(id, updateDto, userId);
  }

  @Delete('rules/:id')
  @Public() // Allow public access for dev mode
  @ApiOperation({ summary: 'Delete alert rule' })
  remove(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || 'default-user';
    return this.alertService.delete(id, userId);
  }
}
