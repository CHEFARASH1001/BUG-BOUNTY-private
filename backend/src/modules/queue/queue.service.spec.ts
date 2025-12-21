import { Test, TestingModule } from '@nestjs/testing';
import { QueueService, ScanJobData, NotifyJobData } from './queue.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { QueueConstants } from './queue.constants';

describe('QueueService', () => {
  let service: QueueService;
  let mockAmqpConnection: jest.Mocked<AmqpConnection>;

  beforeEach(async () => {
    mockAmqpConnection = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: AmqpConnection,
          useValue: mockAmqpConnection,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishFullScan', () => {
    it('should publish a full scan job', async () => {
      const jobData: ScanJobData = {
        scanId: 'scan123',
        targetId: 'target123',
        target: 'example.com',
        type: 'full',
      };

      await service.publishFullScan(jobData);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_FULL_SCAN,
        jobData,
        expect.objectContaining({
          persistent: true,
          contentType: 'application/json',
        }),
      );
    });
  });

  describe('publishSubdomainScan', () => {
    it('should publish a subdomain scan job', async () => {
      const jobData: ScanJobData = {
        scanId: 'scan456',
        targetId: 'target456',
        target: 'example.com',
        type: 'subdomain',
      };

      await service.publishSubdomainScan(jobData);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_SUBDOMAIN_SCAN,
        jobData,
        expect.objectContaining({
          persistent: true,
        }),
      );
    });
  });

  describe('publishNucleiScan', () => {
    it('should publish a nuclei scan job with config', async () => {
      const jobData: ScanJobData = {
        scanId: 'scan789',
        targetId: 'target789',
        target: 'https://example.com',
        type: 'nuclei',
        config: {
          templates: ['cves', 'misconfigurations'],
        },
      };

      await service.publishNucleiScan(jobData);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_NUCLEI_SCAN,
        jobData,
        expect.any(Object),
      );
    });
  });

  describe('publishNotification', () => {
    it('should publish a notification job', async () => {
      const notifyData: NotifyJobData = {
        type: 'new_subdomain',
        data: {
          subdomain: 'api.example.com',
          domain: 'example.com',
        },
        channels: ['discord', 'telegram'],
      };

      await service.publishNotification(notifyData);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_NOTIFY,
        notifyData,
        expect.objectContaining({
          persistent: true,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw error when publish fails', async () => {
      mockAmqpConnection.publish.mockRejectedValue(new Error('Connection failed'));

      const jobData: ScanJobData = {
        scanId: 'scan123',
        targetId: 'target123',
        target: 'example.com',
        type: 'full',
      };

      await expect(service.publishFullScan(jobData)).rejects.toThrow('Connection failed');
    });
  });
});

