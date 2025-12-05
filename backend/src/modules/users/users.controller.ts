import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateUserDto, UpdatePasswordDto, UpdateApiKeysDto, UpdateNotificationsDto } from './dto/user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users (admin only)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req: any) {
    return this.usersService.findById(req.user.sub);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get current user stats' })
  getStats(@Request() req: any) {
    return this.usersService.getStats(req.user.sub);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@Request() req: any, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.sub, updateUserDto);
  }

  @Put('me/password')
  @ApiOperation({ summary: 'Update current user password' })
  updatePassword(@Request() req: any, @Body() updatePasswordDto: UpdatePasswordDto) {
    return this.usersService.updatePassword(
      req.user.sub,
      updatePasswordDto.currentPassword,
      updatePasswordDto.newPassword,
    );
  }

  @Put('me/api-keys')
  @ApiOperation({ summary: 'Update API keys for external services' })
  updateApiKeys(@Request() req: any, @Body() apiKeysDto: UpdateApiKeysDto) {
    return this.usersService.updateApiKeys(req.user.sub, apiKeysDto);
  }

  @Put('me/notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  updateNotifications(@Request() req: any, @Body() notificationsDto: UpdateNotificationsDto) {
    return this.usersService.updateNotifications(req.user.sub, notificationsDto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete user (admin only)' })
  remove(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}

