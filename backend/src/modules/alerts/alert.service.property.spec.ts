import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AlertService, HTTPChangeEvent } from './alert.service';
import {
  AlertRule,
  AlertConditionType,
  AlertConditionOperator,
  AlertSeverity,
  AlertChannel,
} from '../../schemas/alert-rule.schema';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Property-Based Tests for AlertService
 *
 * These tests verify the correctness properties defined in the design document
 * for the advanced-recon-monitoring feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// Track notification calls for multi-channel delivery testing
let notificationCalls: Array<{ title: string; message: string; data: any }>;

// Arbitraries for generating test data
const changeTypeArb = fc.constantFrom(
  'status_code',
  'title',
  'technology',
  'favicon',
  'content',
) as fc.Arbitrary<HTTPChangeEvent['changeType']>;

const statusCodeArb = fc.integer({ min: 100, max: 599 });

const titleArb = fc.string({ minLength: 0, maxLength: 200 });

const technologiesArb = fc.array(
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  { minLength: 0, maxLength: 10 },
);

const urlArb = fc.tuple(
  fc.constantFrom('http', 'https'),
  fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
  fc.constantFrom('.com', '.net', '.org', '.io'),
).map(([protocol, domain, tld]) => `${protocol}://${domain}${tld}`);

const severityArb = fc.constantFrom(
  AlertSeverity.INFO,
  AlertSeverity.WARNING,
  AlertSeverity.CRITICAL,
);

const channelArb = fc.constantFrom(
  AlertChannel.DISCORD,
  AlertChannel.SLACK,
  AlertChannel.TELEGRAM,
  AlertChannel.EMAIL,
);

const channelsArb = fc.array(channelArb, { minLength: 1, maxLength: 4 })
  .map((channels) => [...new Set(channels)]);

const conditionTypeArb = fc.constantFrom(
  AlertConditionType.STATUS_CHANGE,
  AlertConditionType.TITLE_MATCH,
  AlertConditionType.TECH_CHANGE,
  AlertConditionType.FAVICON_CHANGE,
  AlertConditionType.ABUSE_SCORE,
);

const operatorArb = fc.constantFrom(
  AlertConditionOperator.EQUALS,
  AlertConditionOperator.CONTAINS,
  AlertConditionOperator.REGEX,
  AlertConditionOperator.GREATER_THAN,
  AlertConditionOperator.LESS_THAN,
);

// Generate HTTP change events
const httpChangeEventArb: fc.Arbitrary<HTTPChangeEvent> = fc.record({
  url: urlArb,
  changeType: changeTypeArb,
  previousValue: fc.oneof(statusCodeArb, titleArb, technologiesArb),
  currentValue: fc.oneof(statusCodeArb, titleArb, technologiesArb),
  detectedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
});

// Generate alert rules
const alertRuleArb: fc.Arbitrary<AlertRule> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  condition: fc.record({
    type: conditionTypeArb,
    operator: operatorArb,
    value: fc.oneof(
      statusCodeArb,
      titleArb,
      fc.string({ minLength: 1, maxLength: 50 }),
    ),
    previousValue: fc.option(fc.oneof(statusCodeArb, titleArb), { nil: undefined }),
  }),
  severity: severityArb,
  channels: channelsArb,
  enabled: fc.boolean(),
  userId: fc.constant(new Types.ObjectId()),
  programId: fc.option(fc.constant(new Types.ObjectId()), { nil: undefined }),
});

describe('AlertService Property-Based Tests', () => {
  let service: AlertService;
  let mockNotificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    notificationCalls = [];

    mockNotificationsService = {
      create: jest.fn().mockImplementation((type, title, message, data) => {
        notificationCalls.push({ title, message, data });
        return Promise.resolve({ _id: new Types.ObjectId(), title, message, data });
      }),
    } as any;

    const mockAlertRuleModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
        exec: jest.fn().mockResolvedValue([]),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      findOneAndDelete: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        {
          provide: getModelToken(AlertRule.name),
          useValue: mockAlertRuleModel,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
  });

  afterEach(() => {
    notificationCalls = [];
  });


  /**
   * **Feature: advanced-recon-monitoring, Property 21: Alert Rule Condition Evaluation**
   *
   * *For any* alert rule with a condition and any HTTP change event, condition
   * evaluation SHALL return true if and only if the event matches the rule's
   * condition type, operator, and value.
   *
   * **Validates: Requirements 10.1, 10.2**
   */
  describe('Property 21: Alert Rule Condition Evaluation', () => {
    it('should return true for status_code change when condition type matches and operator evaluates correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          statusCodeArb,
          statusCodeArb,
          urlArb,
          async (previousStatus, currentStatus, url) => {
            const event: HTTPChangeEvent = {
              url,
              changeType: 'status_code',
              previousValue: previousStatus,
              currentValue: currentStatus,
              detectedAt: new Date(),
            };

            const rule: AlertRule = {
              name: 'Status Change Alert',
              condition: {
                type: AlertConditionType.STATUS_CHANGE,
                operator: AlertConditionOperator.EQUALS,
                value: currentStatus,
              },
              severity: AlertSeverity.WARNING,
              channels: [AlertChannel.DISCORD],
              enabled: true,
              userId: new Types.ObjectId(),
            };

            const result = service.evaluateCondition(event, rule);
            // Should return true because changeType matches and currentValue equals condition value
            return result === true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return false when condition type does not match event change type', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpChangeEventArb.filter((e) => e.changeType !== 'title'),
          async (event) => {
            const rule: AlertRule = {
              name: 'Title Match Alert',
              condition: {
                type: AlertConditionType.TITLE_MATCH,
                operator: AlertConditionOperator.CONTAINS,
                value: 'test',
              },
              severity: AlertSeverity.INFO,
              channels: [AlertChannel.SLACK],
              enabled: true,
              userId: new Types.ObjectId(),
            };

            const result = service.evaluateCondition(event, rule);
            // Should return false because changeType doesn't match
            return result === false;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly evaluate CONTAINS operator for title changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          titleArb.filter((t) => t.length > 0),
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0),
          urlArb,
          async (title, searchTerm, url) => {
            const event: HTTPChangeEvent = {
              url,
              changeType: 'title',
              previousValue: 'Old Title',
              currentValue: title,
              detectedAt: new Date(),
            };

            const rule: AlertRule = {
              name: 'Title Contains Alert',
              condition: {
                type: AlertConditionType.TITLE_MATCH,
                operator: AlertConditionOperator.CONTAINS,
                value: searchTerm,
              },
              severity: AlertSeverity.INFO,
              channels: [AlertChannel.EMAIL],
              enabled: true,
              userId: new Types.ObjectId(),
            };

            const result = service.evaluateCondition(event, rule);
            const expected = title.toLowerCase().includes(searchTerm.toLowerCase());
            return result === expected;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly evaluate GREATER_THAN operator for numeric values', async () => {
      await fc.assert(
        fc.asyncProperty(
          statusCodeArb,
          statusCodeArb,
          urlArb,
          async (currentValue, threshold, url) => {
            const event: HTTPChangeEvent = {
              url,
              changeType: 'status_code',
              previousValue: 200,
              currentValue,
              detectedAt: new Date(),
            };

            const rule: AlertRule = {
              name: 'Status Greater Than Alert',
              condition: {
                type: AlertConditionType.STATUS_CHANGE,
                operator: AlertConditionOperator.GREATER_THAN,
                value: threshold,
              },
              severity: AlertSeverity.WARNING,
              channels: [AlertChannel.TELEGRAM],
              enabled: true,
              userId: new Types.ObjectId(),
            };

            const result = service.evaluateCondition(event, rule);
            const expected = currentValue > threshold;
            return result === expected;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly evaluate LESS_THAN operator for numeric values', async () => {
      await fc.assert(
        fc.asyncProperty(
          statusCodeArb,
          statusCodeArb,
          urlArb,
          async (currentValue, threshold, url) => {
            const event: HTTPChangeEvent = {
              url,
              changeType: 'status_code',
              previousValue: 500,
              currentValue,
              detectedAt: new Date(),
            };

            const rule: AlertRule = {
              name: 'Status Less Than Alert',
              condition: {
                type: AlertConditionType.STATUS_CHANGE,
                operator: AlertConditionOperator.LESS_THAN,
                value: threshold,
              },
              severity: AlertSeverity.CRITICAL,
              channels: [AlertChannel.DISCORD],
              enabled: true,
              userId: new Types.ObjectId(),
            };

            const result = service.evaluateCondition(event, rule);
            const expected = currentValue < threshold;
            return result === expected;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly evaluate REGEX operator for string values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Welcome', 'Index', 'Login', 'Dashboard', 'Error 404'),
          fc.constantFrom('welcome', 'index', 'login', 'dashboard', 'error'),
          urlArb,
          async (title, pattern, url) => {
            const event: HTTPChangeEvent = {
              url,
              changeType: 'title',
              previousValue: 'Old Title',
              currentValue: title,
              detectedAt: new Date(),
            };

            const rule: AlertRule = {
              name: 'Title Regex Alert',
              condition: {
                type: AlertConditionType.TITLE_MATCH,
                operator: AlertConditionOperator.REGEX,
                value: pattern,
              },
              severity: AlertSeverity.INFO,
              channels: [AlertChannel.SLACK],
              enabled: true,
              userId: new Types.ObjectId(),
            };

            const result = service.evaluateCondition(event, rule);
            const regex = new RegExp(pattern, 'i');
            const expected = regex.test(title);
            return result === expected;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle technology change events with array values', async () => {
      await fc.assert(
        fc.asyncProperty(
          technologiesArb,
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
          urlArb,
          async (technologies, searchTech, url) => {
            const event: HTTPChangeEvent = {
              url,
              changeType: 'technology',
              previousValue: ['OldTech'],
              currentValue: technologies,
              detectedAt: new Date(),
            };

            const rule: AlertRule = {
              name: 'Tech Change Alert',
              condition: {
                type: AlertConditionType.TECH_CHANGE,
                operator: AlertConditionOperator.CONTAINS,
                value: searchTech,
              },
              severity: AlertSeverity.WARNING,
              channels: [AlertChannel.DISCORD],
              enabled: true,
              userId: new Types.ObjectId(),
            };

            const result = service.evaluateCondition(event, rule);
            const expected = technologies.some((t) =>
              t.toLowerCase().includes(searchTech.toLowerCase()),
            );
            return result === expected;
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  /**
   * **Feature: advanced-recon-monitoring, Property 22: Multi-Channel Alert Delivery**
   *
   * *For any* triggered alert with configured channels, the notification service
   * SHALL attempt delivery to all specified channels.
   *
   * **Validates: Requirements 10.3**
   */
  describe('Property 22: Multi-Channel Alert Delivery', () => {
    it('should attempt delivery to all configured channels when alert is triggered', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelsArb,
          urlArb,
          changeTypeArb,
          async (channels, url, changeType) => {
            // Clear previous calls
            notificationCalls = [];

            const event: HTTPChangeEvent = {
              url,
              changeType,
              previousValue: 'old',
              currentValue: 'new',
              detectedAt: new Date(),
            };

            const rule: AlertRule = {
              name: 'Multi-Channel Alert',
              condition: {
                type: AlertConditionType.STATUS_CHANGE,
                operator: AlertConditionOperator.EQUALS,
                value: 'new',
              },
              severity: AlertSeverity.WARNING,
              channels,
              enabled: true,
              userId: new Types.ObjectId(),
            };

            await service.triggerAlert(event, rule);

            // Verify that notification was called for each channel
            if (notificationCalls.length !== channels.length) return false;

            // Verify each channel received a notification
            const notifiedChannels = notificationCalls.map((call) => call.data.channel);
            for (const channel of channels) {
              if (!notifiedChannels.includes(channel)) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include correct event data in all channel notifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelsArb,
          urlArb,
          statusCodeArb,
          statusCodeArb,
          async (channels, url, previousStatus, currentStatus) => {
            // Clear previous calls
            notificationCalls = [];

            const event: HTTPChangeEvent = {
              url,
              changeType: 'status_code',
              previousValue: previousStatus,
              currentValue: currentStatus,
              detectedAt: new Date(),
            };

            const rule: AlertRule = {
              name: 'Status Alert',
              condition: {
                type: AlertConditionType.STATUS_CHANGE,
                operator: AlertConditionOperator.EQUALS,
                value: currentStatus,
              },
              severity: AlertSeverity.CRITICAL,
              channels,
              enabled: true,
              userId: new Types.ObjectId(),
            };

            await service.triggerAlert(event, rule);

            // Verify all notifications contain the event data
            for (const call of notificationCalls) {
              if (call.data.event.url !== url) return false;
              if (call.data.event.changeType !== 'status_code') return false;
              if (call.data.event.previousValue !== previousStatus) return false;
              if (call.data.event.currentValue !== currentStatus) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include rule metadata in all channel notifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelsArb,
          severityArb,
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          urlArb,
          async (channels, severity, ruleName, url) => {
            // Clear previous calls
            notificationCalls = [];

            const event: HTTPChangeEvent = {
              url,
              changeType: 'title',
              previousValue: 'Old',
              currentValue: 'New',
              detectedAt: new Date(),
            };

            const rule: AlertRule = {
              name: ruleName,
              condition: {
                type: AlertConditionType.TITLE_MATCH,
                operator: AlertConditionOperator.CONTAINS,
                value: 'New',
              },
              severity,
              channels,
              enabled: true,
              userId: new Types.ObjectId(),
            };

            await service.triggerAlert(event, rule);

            // Verify all notifications contain rule metadata
            for (const call of notificationCalls) {
              if (call.data.rule.name !== ruleName) return false;
              if (call.data.rule.severity !== severity) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle single channel delivery correctly', async () => {
      await fc.assert(
        fc.asyncProperty(channelArb, urlArb, async (channel, url) => {
          // Clear previous calls
          notificationCalls = [];

          const event: HTTPChangeEvent = {
            url,
            changeType: 'favicon',
            previousValue: 'hash1',
            currentValue: 'hash2',
            detectedAt: new Date(),
          };

          const rule: AlertRule = {
            name: 'Single Channel Alert',
            condition: {
              type: AlertConditionType.FAVICON_CHANGE,
              operator: AlertConditionOperator.EQUALS,
              value: 'hash2',
            },
            severity: AlertSeverity.INFO,
            channels: [channel],
            enabled: true,
            userId: new Types.ObjectId(),
          };

          await service.triggerAlert(event, rule);

          // Verify exactly one notification was sent
          if (notificationCalls.length !== 1) return false;
          if (notificationCalls[0].data.channel !== channel) return false;

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should not duplicate notifications for the same channel', async () => {
      await fc.assert(
        fc.asyncProperty(channelArb, urlArb, async (channel, url) => {
          // Clear previous calls
          notificationCalls = [];

          const event: HTTPChangeEvent = {
            url,
            changeType: 'content',
            previousValue: 'old content',
            currentValue: 'new content',
            detectedAt: new Date(),
          };

          // Create rule with duplicate channels (should be deduplicated by channelsArb)
          const rule: AlertRule = {
            name: 'Dedup Test Alert',
            condition: {
              type: AlertConditionType.STATUS_CHANGE,
              operator: AlertConditionOperator.EQUALS,
              value: 'new content',
            },
            severity: AlertSeverity.WARNING,
            channels: [channel], // Single channel
            enabled: true,
            userId: new Types.ObjectId(),
          };

          await service.triggerAlert(event, rule);

          // Verify no duplicate notifications
          const channelCounts = new Map<string, number>();
          for (const call of notificationCalls) {
            const ch = call.data.channel;
            channelCounts.set(ch, (channelCounts.get(ch) || 0) + 1);
          }

          for (const count of channelCounts.values()) {
            if (count > 1) return false;
          }

          return true;
        }),
        { numRuns: 100 },
      );
    });
  });
});
