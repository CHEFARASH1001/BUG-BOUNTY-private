import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AlertRule,
  AlertRuleDocument,
  AlertConditionType,
  AlertConditionOperator,
  AlertChannel,
} from '../../schemas/alert-rule.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAlertRuleDto, UpdateAlertRuleDto } from './dto/alert.dto';

export interface HTTPChangeEvent {
  url: string;
  changeType: 'status_code' | 'title' | 'technology' | 'favicon' | 'content';
  previousValue: any;
  currentValue: any;
  detectedAt: Date;
}

export interface AbuseScoreEvent {
  ipAddress: string;
  abuseConfidenceScore: number;
  domain?: string;
  detectedAt: Date;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @InjectModel(AlertRule.name) private alertRuleModel: Model<AlertRuleDocument>,
    private notificationsService: NotificationsService,
  ) {}

  async create(createDto: CreateAlertRuleDto, userId?: string): Promise<AlertRuleDocument> {
    const ruleData: any = { ...createDto };
    
    // Only set userId if valid ObjectId
    if (userId && Types.ObjectId.isValid(userId)) {
      ruleData.userId = new Types.ObjectId(userId);
    }
    
    // Only set programId if valid ObjectId
    if (createDto.programId && Types.ObjectId.isValid(createDto.programId)) {
      ruleData.programId = new Types.ObjectId(createDto.programId);
    }

    const rule = await this.alertRuleModel.create(ruleData);
    return rule;
  }

  async findAll(userId?: string, filters?: { programId?: string; enabled?: boolean }): Promise<AlertRuleDocument[]> {
    const query: any = {};

    // Only filter by userId if provided and valid
    if (userId && Types.ObjectId.isValid(userId)) {
      query.userId = new Types.ObjectId(userId);
    }

    if (filters?.programId && Types.ObjectId.isValid(filters.programId)) {
      query.programId = new Types.ObjectId(filters.programId);
    }
    if (filters?.enabled !== undefined) {
      query.enabled = filters.enabled;
    }

    return this.alertRuleModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findById(id: string, userId?: string): Promise<AlertRuleDocument> {
    const query: any = { _id: new Types.ObjectId(id) };
    
    // Only filter by userId if valid
    if (userId && Types.ObjectId.isValid(userId)) {
      query.userId = new Types.ObjectId(userId);
    }

    const rule = await this.alertRuleModel.findOne(query).exec();

    if (!rule) {
      throw new NotFoundException('Alert rule not found');
    }
    return rule;
  }

  async update(id: string, updateDto: UpdateAlertRuleDto, userId?: string): Promise<AlertRuleDocument> {
    const updateData: any = { ...updateDto };
    if (updateDto.programId && Types.ObjectId.isValid(updateDto.programId)) {
      updateData.programId = new Types.ObjectId(updateDto.programId);
    }

    const query: any = { _id: new Types.ObjectId(id) };
    if (userId && Types.ObjectId.isValid(userId)) {
      query.userId = new Types.ObjectId(userId);
    }

    const rule = await this.alertRuleModel.findOneAndUpdate(
      query,
      updateData,
      { new: true },
    ).exec();

    if (!rule) {
      throw new NotFoundException('Alert rule not found');
    }
    return rule;
  }

  async delete(id: string, userId?: string): Promise<void> {
    const query: any = { _id: new Types.ObjectId(id) };
    if (userId && Types.ObjectId.isValid(userId)) {
      query.userId = new Types.ObjectId(userId);
    }

    const result = await this.alertRuleModel.findOneAndDelete(query).exec();

    if (!result) {
      throw new NotFoundException('Alert rule not found');
    }
  }


  /**
   * Evaluates if an HTTP change event matches an alert rule condition.
   * Returns true if the event matches the rule's condition.
   */
  evaluateCondition(event: HTTPChangeEvent, rule: AlertRule): boolean {
    const { condition } = rule;

    // Check if the condition type matches the event change type
    const typeMapping: Record<string, string> = {
      [AlertConditionType.STATUS_CHANGE]: 'status_code',
      [AlertConditionType.TITLE_MATCH]: 'title',
      [AlertConditionType.TECH_CHANGE]: 'technology',
      [AlertConditionType.FAVICON_CHANGE]: 'favicon',
    };

    const expectedChangeType = typeMapping[condition.type];
    if (expectedChangeType && event.changeType !== expectedChangeType) {
      return false;
    }

    // Evaluate based on operator
    return this.evaluateOperator(condition.operator, event.currentValue, condition.value, event.previousValue);
  }

  /**
   * Evaluates if an abuse score event matches an alert rule condition.
   */
  evaluateAbuseScoreCondition(event: AbuseScoreEvent, rule: AlertRule): boolean {
    const { condition } = rule;

    if (condition.type !== AlertConditionType.ABUSE_SCORE) {
      return false;
    }

    return this.evaluateOperator(condition.operator, event.abuseConfidenceScore, condition.value);
  }

  private evaluateOperator(
    operator: string,
    currentValue: any,
    conditionValue: any,
    previousValue?: any,
  ): boolean {
    switch (operator) {
      case AlertConditionOperator.EQUALS:
        return currentValue === conditionValue;

      case AlertConditionOperator.CONTAINS:
        if (typeof currentValue === 'string') {
          return currentValue.toLowerCase().includes(String(conditionValue).toLowerCase());
        }
        if (Array.isArray(currentValue)) {
          return currentValue.some(v => 
            String(v).toLowerCase().includes(String(conditionValue).toLowerCase())
          );
        }
        return false;

      case AlertConditionOperator.REGEX:
        try {
          const regex = new RegExp(String(conditionValue), 'i');
          if (typeof currentValue === 'string') {
            return regex.test(currentValue);
          }
          if (Array.isArray(currentValue)) {
            return currentValue.some(v => regex.test(String(v)));
          }
          return false;
        } catch {
          return false;
        }

      case AlertConditionOperator.GREATER_THAN:
        return Number(currentValue) > Number(conditionValue);

      case AlertConditionOperator.LESS_THAN:
        return Number(currentValue) < Number(conditionValue);

      default:
        return false;
    }
  }

  /**
   * Triggers an alert by sending notifications to all configured channels.
   */
  async triggerAlert(event: HTTPChangeEvent, rule: AlertRule): Promise<void> {
    const title = this.buildAlertTitle(event, rule);
    const message = this.buildAlertMessage(event, rule);

    this.logger.log(`Triggering alert: ${title}`);

    // Send to all configured channels
    const deliveryPromises = rule.channels.map(channel => 
      this.sendToChannel(channel as AlertChannel, title, message, event, rule)
    );

    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Triggers an alert for abuse score events.
   */
  async triggerAbuseScoreAlert(event: AbuseScoreEvent, rule: AlertRule): Promise<void> {
    const title = `🚨 High Abuse Score Detected: ${event.ipAddress}`;
    const message = `IP ${event.ipAddress} has an abuse confidence score of ${event.abuseConfidenceScore}%` +
      (event.domain ? ` (associated with ${event.domain})` : '');

    this.logger.log(`Triggering abuse score alert: ${title}`);

    const deliveryPromises = rule.channels.map(channel =>
      this.sendToChannel(channel as AlertChannel, title, message, event as any, rule)
    );

    await Promise.allSettled(deliveryPromises);
  }

  private buildAlertTitle(event: HTTPChangeEvent, rule: AlertRule): string {
    const severityEmoji: Record<string, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
    };

    const emoji = severityEmoji[rule.severity] || 'ℹ️';
    return `${emoji} Alert: ${rule.name} - ${event.url}`;
  }

  private buildAlertMessage(event: HTTPChangeEvent, rule: AlertRule): string {
    const changeTypeLabels: Record<string, string> = {
      status_code: 'Status Code',
      title: 'Page Title',
      technology: 'Technologies',
      favicon: 'Favicon',
      content: 'Content',
    };

    const changeLabel = changeTypeLabels[event.changeType] || event.changeType;
    
    return `${changeLabel} changed on ${event.url}\n` +
      `Previous: ${this.formatValue(event.previousValue)}\n` +
      `Current: ${this.formatValue(event.currentValue)}\n` +
      `Detected at: ${event.detectedAt.toISOString()}`;
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (Array.isArray(value)) {
      return value.join(', ') || 'None';
    }
    return String(value);
  }

  private async sendToChannel(
    channel: AlertChannel,
    title: string,
    message: string,
    event: HTTPChangeEvent,
    rule: AlertRule,
  ): Promise<void> {
    try {
      // Use the notifications service to send alerts
      // The notifications service handles the actual delivery to each channel
      await this.notificationsService.create(
        'alert' as any,
        title,
        message,
        {
          event,
          rule: {
            id: (rule as any)._id,
            name: rule.name,
            severity: rule.severity,
          },
          channel,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to send alert to ${channel}: ${error.message}`);
    }
  }

  /**
   * Finds all enabled rules that match a given event and triggers alerts.
   */
  async processHTTPChangeEvent(event: HTTPChangeEvent, programId?: string): Promise<void> {
    const query: any = { enabled: true };
    if (programId) {
      query.$or = [
        { programId: new Types.ObjectId(programId) },
        { programId: { $exists: false } },
      ];
    }

    const rules = await this.alertRuleModel.find(query).exec();

    for (const rule of rules) {
      if (this.evaluateCondition(event, rule)) {
        await this.triggerAlert(event, rule);
      }
    }
  }

  /**
   * Finds all enabled rules that match an abuse score event and triggers alerts.
   */
  async processAbuseScoreEvent(event: AbuseScoreEvent): Promise<void> {
    const rules = await this.alertRuleModel.find({
      enabled: true,
      'condition.type': AlertConditionType.ABUSE_SCORE,
    }).exec();

    for (const rule of rules) {
      if (this.evaluateAbuseScoreCondition(event, rule)) {
        await this.triggerAbuseScoreAlert(event, rule);
      }
    }
  }
}
