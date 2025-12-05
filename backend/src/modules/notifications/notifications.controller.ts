import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'read', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('read') read?: boolean,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.findAll(req.user.sub, { type, read, limit });
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(req.user.sub);
  }

  @Post('mark-read')
  @ApiOperation({ summary: 'Mark notifications as read' })
  markAsRead(@Body('ids') ids: string[]) {
    return this.notificationsService.markAsRead(ids);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  remove(@Param('id') id: string) {
    return this.notificationsService.delete(id);
  }

  @Post('test')
  @ApiOperation({ summary: 'Send test notification' })
  async sendTest(@Request() req: any) {
    return this.notificationsService.create(
      'info' as any,
      'Test Notification',
      'This is a test notification to verify your notification settings are working correctly.',
      { test: true },
      req.user.sub,
    );
  }
}

