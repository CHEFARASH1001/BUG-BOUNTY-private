import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification, NotificationSchema } from '../../schemas/notification.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { SlackService } from './services/slack.service';
import { DiscordService } from './services/discord.service';
import { EmailService } from './services/email.service';
import { TelegramService } from './services/telegram.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    SlackService,
    DiscordService,
    EmailService,
    TelegramService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

