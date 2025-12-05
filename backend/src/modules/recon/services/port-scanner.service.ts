import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export interface PortInfo {
  port: number;
  protocol: string;
  service: string;
  version?: string;
  banner?: string;
}

export interface PortResult {
  host: string;
  ports: PortInfo[];
}

@Injectable()
export class PortScanner {
  private resultsDir = '/app/results';

  // Common ports for quick scanning
  private readonly topPorts = [
    21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995,
    1723, 3306, 3389, 5432, 5900, 8080, 8443, 8888, 27017,
  ];

  // Extended port list for thorough scanning
  private readonly extendedPorts = [
    ...this.topPorts,
    81, 82, 83, 84, 85, 88, 89, 90, 311, 389, 444, 464, 500, 554, 587,
    591, 631, 636, 873, 902, 989, 990, 1080, 1194, 1311, 1433, 1521,
    1701, 1883, 2049, 2082, 2083, 2087, 2181, 2222, 2375, 2376, 2379,
    3000, 3001, 3128, 3268, 3333, 4000, 4001, 4443, 4444, 4567, 4711,
    4848, 4993, 5000, 5001, 5003, 5004, 5005, 5006, 5007, 5050, 5060,
    5061, 5104, 5222, 5223, 5269, 5280, 5357, 5672, 5701, 5800, 5984,
    5985, 5986, 6000, 6001, 6379, 6443, 6666, 6667, 7000, 7001, 7002,
    7070, 7071, 7199, 7443, 7474, 7777, 7778, 8000, 8001, 8002, 8008,
    8009, 8010, 8020, 8025, 8030, 8042, 8081, 8082, 8083, 8084, 8085,
    8086, 8087, 8088, 8089, 8090, 8098, 8099, 8100, 8111, 8112, 8118,
    8123, 8139, 8161, 8180, 8181, 8182, 8200, 8222, 8280, 8300, 8333,
    8383, 8400, 8440, 8500, 8530, 8531, 8545, 8600, 8686, 8765, 8800,
    8834, 8880, 8881, 8883, 8887, 8889, 8899, 8983, 8999, 9000, 9001,
    9002, 9003, 9009, 9010, 9042, 9043, 9060, 9080, 9090, 9091, 9092,
    9093, 9100, 9101, 9102, 9103, 9160, 9191, 9200, 9300, 9418, 9443,
    9500, 9501, 9530, 9595, 9600, 9800, 9869, 9876, 9943, 9944, 9981,
    9990, 9998, 9999, 10000, 10001, 10080, 10443, 11211, 12345, 15672,
    16080, 16443, 18080, 18081, 19999, 20000, 27018, 28017, 30000,
  ];

  /**
   * Scan ports on given hosts
   */
  async scan(hosts: string[], ports?: string): Promise<PortResult[]> {
    if (hosts.length === 0) {
      return [];
    }

    const portsToScan = ports || this.topPorts.join(',');
    const results: PortResult[] = [];

    try {
      // Use naabu for fast port scanning
      const inputFile = path.join(this.resultsDir, `hosts-${uuidv4()}.txt`);
      const outputFile = path.join(this.resultsDir, `ports-${uuidv4()}.json`);

      // Write hosts to file
      await fs.writeFile(inputFile, hosts.join('\n'));

      // Run naabu
      await execAsync(
        `docker exec bb-naabu naabu -l /results/${path.basename(inputFile)} ` +
        `-p ${portsToScan} -json -o /results/${path.basename(outputFile)} -silent`,
        { timeout: 600000 }, // 10 minute timeout
      );

      // Parse results
      const content = await fs.readFile(outputFile, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      const hostPorts = new Map<string, PortInfo[]>();

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const host = data.host || data.ip;
          const port = data.port;

          if (!hostPorts.has(host)) {
            hostPorts.set(host, []);
          }

          hostPorts.get(host)!.push({
            port,
            protocol: 'tcp',
            service: this.guessService(port),
          });
        } catch {
          continue;
        }
      }

      // Convert to results array
      for (const [host, ports] of hostPorts) {
        results.push({ host, ports });
      }

      // Cleanup
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
    } catch (error) {
      console.error('Port scan error:', error);

      // Fallback to Node.js-based scanning
      return this.scanWithNode(hosts, this.topPorts);
    }

    return results;
  }

  /**
   * Quick scan with common ports
   */
  async quickScan(host: string): Promise<PortInfo[]> {
    const results = await this.scan([host], this.topPorts.join(','));
    return results[0]?.ports || [];
  }

  /**
   * Extended scan with more ports
   */
  async extendedScan(host: string): Promise<PortInfo[]> {
    const results = await this.scan([host], this.extendedPorts.join(','));
    return results[0]?.ports || [];
  }

  /**
   * Fallback Node.js-based port scanner
   */
  private async scanWithNode(hosts: string[], ports: number[]): Promise<PortResult[]> {
    const net = require('net');
    const results: PortResult[] = [];

    for (const host of hosts) {
      const openPorts: PortInfo[] = [];

      const portChecks = ports.map((port) => {
        return new Promise<void>((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(2000);

          socket.on('connect', () => {
            openPorts.push({
              port,
              protocol: 'tcp',
              service: this.guessService(port),
            });
            socket.destroy();
            resolve();
          });

          socket.on('timeout', () => {
            socket.destroy();
            resolve();
          });

          socket.on('error', () => {
            socket.destroy();
            resolve();
          });

          socket.connect(port, host);
        });
      });

      await Promise.all(portChecks);

      if (openPorts.length > 0) {
        results.push({ host, ports: openPorts });
      }
    }

    return results;
  }

  /**
   * Guess service based on port number
   */
  private guessService(port: number): string {
    const services: Record<number, string> = {
      21: 'ftp',
      22: 'ssh',
      23: 'telnet',
      25: 'smtp',
      53: 'dns',
      80: 'http',
      110: 'pop3',
      111: 'rpcbind',
      135: 'msrpc',
      139: 'netbios-ssn',
      143: 'imap',
      443: 'https',
      445: 'microsoft-ds',
      993: 'imaps',
      995: 'pop3s',
      1433: 'mssql',
      1521: 'oracle',
      1723: 'pptp',
      3306: 'mysql',
      3389: 'rdp',
      5432: 'postgresql',
      5900: 'vnc',
      6379: 'redis',
      8080: 'http-proxy',
      8443: 'https-alt',
      27017: 'mongodb',
    };

    return services[port] || 'unknown';
  }
}

