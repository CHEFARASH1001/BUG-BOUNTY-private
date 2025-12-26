import { Injectable } from '@nestjs/common';

@Injectable()
export class QueueConstants {
  // Exchange names
  static readonly EXCHANGE_DIRECT = 'watchtower.direct';
  static readonly EXCHANGE_DLX = 'watchtower.dlx';

  // Queue names
  static readonly QUEUE_SCANS = 'watchtower.scans';
  static readonly QUEUE_ENUM = 'watchtower.enum';
  static readonly QUEUE_DNS = 'watchtower.dns';
  static readonly QUEUE_HTTP = 'watchtower.http';
  static readonly QUEUE_NUCLEI = 'watchtower.nuclei';
  static readonly QUEUE_NOTIFY = 'watchtower.notify';
  static readonly QUEUE_SUBFINDER = 'watchtower.subfinder';
  static readonly QUEUE_PLATFORM_SYNC = 'watchtower.platform-sync';
  static readonly QUEUE_DLQ = 'watchtower.dlq';

  // Routing keys
  static readonly ROUTING_FULL_SCAN = 'scan.full';
  static readonly ROUTING_SUBDOMAIN_SCAN = 'scan.subdomain';
  static readonly ROUTING_DNS_SCAN = 'scan.dns';
  static readonly ROUTING_HTTP_SCAN = 'scan.http';
  static readonly ROUTING_NUCLEI_SCAN = 'scan.nuclei';
  static readonly ROUTING_PORT_SCAN = 'scan.port';
  static readonly ROUTING_ENUM = 'enum.subdomain';
  static readonly ROUTING_DNS = 'dns.resolve';
  static readonly ROUTING_HTTP = 'http.probe';
  static readonly ROUTING_NUCLEI = 'nuclei.scan';
  static readonly ROUTING_SUBFINDER = 'subfinder.scan';
  static readonly ROUTING_PLATFORM_SYNC = 'platform.sync';
  static readonly ROUTING_NOTIFY = 'notify';
  static readonly ROUTING_DLQ = 'dlq';
}

export const QUEUE_EXCHANGES = {
  DIRECT: QueueConstants.EXCHANGE_DIRECT,
  DLX: QueueConstants.EXCHANGE_DLX,
};

export const QUEUE_NAMES = {
  SCANS: QueueConstants.QUEUE_SCANS,
  ENUM: QueueConstants.QUEUE_ENUM,
  DNS: QueueConstants.QUEUE_DNS,
  HTTP: QueueConstants.QUEUE_HTTP,
  NUCLEI: QueueConstants.QUEUE_NUCLEI,
  NOTIFY: QueueConstants.QUEUE_NOTIFY,
  DLQ: QueueConstants.QUEUE_DLQ,
};

export const ROUTING_KEYS = {
  FULL_SCAN: QueueConstants.ROUTING_FULL_SCAN,
  SUBDOMAIN_SCAN: QueueConstants.ROUTING_SUBDOMAIN_SCAN,
  DNS_SCAN: QueueConstants.ROUTING_DNS_SCAN,
  HTTP_SCAN: QueueConstants.ROUTING_HTTP_SCAN,
  NUCLEI_SCAN: QueueConstants.ROUTING_NUCLEI_SCAN,
  PORT_SCAN: QueueConstants.ROUTING_PORT_SCAN,
  ENUM: QueueConstants.ROUTING_ENUM,
  DNS: QueueConstants.ROUTING_DNS,
  HTTP: QueueConstants.ROUTING_HTTP,
  NUCLEI: QueueConstants.ROUTING_NUCLEI,
  NOTIFY: QueueConstants.ROUTING_NOTIFY,
  DLQ: QueueConstants.ROUTING_DLQ,
};

