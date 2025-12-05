import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from '../../schemas/notification.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { SlackService } from './services/slack.service';
import { DiscordService } from './services/discord.service';
import { EmailService } from './services/email.service';
import { TelegramService } from './services/telegram.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private slackService: SlackService,
    private discordService: DiscordService,
    private emailService: EmailService,
    private telegramService: TelegramService,
  ) {}

  async create(
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
    userId?: string,
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel.create({
      type,
      title,
      message,
      data,
      userId: userId ? new Types.ObjectId(userId) : undefined,
    });

    // Send to external services
    await this.sendToExternalServices(notification, userId);

    return notification;
  }

  async sendVulnerabilityAlert(vulnerabilities: any[], target: string): Promise<void> {
    const criticalCount = vulnerabilities.filter((v) => v.info?.severity === 'critical').length;
    const highCount = vulnerabilities.filter((v) => v.info?.severity === 'high').length;
    const mediumCount = vulnerabilities.filter((v) => v.info?.severity === 'medium').length;

    const title = `🔴 New Vulnerabilities Found on ${target}`;
    const message = `Found ${vulnerabilities.length} vulnerabilities:\n` +
      `• Critical: ${criticalCount}\n` +
      `• High: ${highCount}\n` +
      `• Medium: ${mediumCount}`;

    // Create notification
    await this.create(NotificationType.VULNERABILITY, title, message, {
      target,
      vulnerabilities: vulnerabilities.slice(0, 10), // Limit data size
      severity: criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : 'medium',
    });

    // Send alerts
    const severity = criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : 'medium';
    await this.sendAlerts(title, message, severity, vulnerabilities);
  }

  async sendScanCompleteNotification(
    scanId: string,
    target: string,
    results: any,
  ): Promise<void> {
    const title = `✅ Scan Complete: ${target}`;
    const message = `Scan completed successfully.\n` +
      `• Subdomains: ${results.subdomainsFound || 0}\n` +
      `• Alive Hosts: ${results.aliveHosts || 0}\n` +
      `• Vulnerabilities: ${results.vulnerabilitiesFound || 0}`;

    await this.create(NotificationType.SCAN_COMPLETE, title, message, {
      scanId,
      target,
      results,
    });

    await this.sendAlerts(title, message, 'info', null);
  }

  async sendNewSubdomainNotification(
    domain: string,
    newSubdomains: string[],
  ): Promise<void> {
    if (newSubdomains.length === 0) return;

    const title = `🆕 New Subdomains Found: ${domain}`;
    const message = `Found ${newSubdomains.length} new subdomains:\n` +
      newSubdomains.slice(0, 10).map((s) => `• ${s}`).join('\n') +
      (newSubdomains.length > 10 ? `\n... and ${newSubdomains.length - 10} more` : '');

    await this.create(NotificationType.NEW_SUBDOMAIN, title, message, {
      domain,
      subdomains: newSubdomains,
    });

    await this.sendAlerts(title, message, 'info', null);
  }

  async sendErrorNotification(error: string, context?: any): Promise<void> {
    const title = '❌ Error Occurred';

    await this.create(NotificationType.ERROR, title, error, context);
    await this.sendAlerts(title, error, 'error', null);
  }

  async findAll(userId?: string, filters?: {
    type?: string;
    read?: boolean;
    limit?: number;
  }): Promise<NotificationDocument[]> {
    const query: any = {};

    if (userId) {
      query.$or = [{ userId: new Types.ObjectId(userId) }, { userId: null }];
    }
    if (filters?.type) {
      query.type = filters.type;
    }
    if (filters?.read !== undefined) {
      query.read = filters.read;
    }

    let queryBuilder = this.notificationModel.find(query).sort({ createdAt: -1 });

    if (filters?.limit) {
      queryBuilder = queryBuilder.limit(filters.limit);
    }

    return queryBuilder.exec();
  }

  async markAsRead(ids: string[]): Promise<void> {
    await this.notificationModel.updateMany(
      { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
      { $set: { read: true } },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { $set: { read: true } },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      $or: [{ userId: new Types.ObjectId(userId) }, { userId: null }],
      read: false,
    });
  }

  async delete(id: string): Promise<void> {
    const result = await this.notificationModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Notification not found');
    }
  }

  async deleteOld(daysOld: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await this.notificationModel.deleteMany({
      createdAt: { $lt: cutoff },
    });

    return result.deletedCount;
  }

  private async sendToExternalServices(
    notification: NotificationDocument,
    userId?: string,
  ): Promise<void> {
    const user = userId ? await this.userModel.findById(userId) : null;
    const userPrefs = user?.notifications || {};

    // Determine minimum severity to notify
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const minSeverity = userPrefs.minSeverity || 'medium';
    const notifySeverity = notification.data?.severity || 'info';

    const shouldNotify = severityOrder.indexOf(notifySeverity) <= severityOrder.indexOf(minSeverity);

    if (!shouldNotify && notification.type === NotificationType.VULNERABILITY) {
      return;
    }

    const promises: Promise<any>[] = [];

    if (userPrefs.slack !== false) {
      promises.push(
        this.slackService.send(notification.title, notification.message, notification.data),
      );
    }

    if (userPrefs.discord !== false) {
      promises.push(
        this.discordService.send(notification.title, notification.message, notification.data),
      );
    }

    if (userPrefs.email && user?.email) {
      promises.push(
        this.emailService.send(user.email, notification.title, notification.message),
      );
    }

    if (userPrefs.telegram) {
      promises.push(
        this.telegramService.send(notification.title, notification.message),
      );
    }

    await Promise.allSettled(promises);
  }

  private async sendAlerts(
    title: string,
    message: string,
    severity: string,
    data: any,
  ): Promise<void> {
    const promises: Promise<any>[] = [];

    promises.push(this.slackService.send(title, message, { severity, ...data }));
    promises.push(this.discordService.send(title, message, { severity, ...data }));

    await Promise.allSettled(promises);
  }
}

