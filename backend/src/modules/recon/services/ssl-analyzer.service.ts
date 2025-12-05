import { Injectable } from '@nestjs/common';
import * as tls from 'tls';
import * as https from 'https';

export interface SslInfo {
  valid: boolean;
  issuer: string;
  subject: string;
  validFrom: Date;
  validTo: Date;
  daysUntilExpiry: number;
  isExpired: boolean;
  protocol: string;
  cipher: string;
  keyExchange: string;
  serialNumber: string;
  fingerprint: string;
  fingerprint256: string;
  subjectAltNames: string[];
  grade: string;
  issues: string[];
}

@Injectable()
export class SslAnalyzer {
  /**
   * Analyze SSL/TLS configuration of a host
   */
  async analyze(host: string): Promise<SslInfo> {
    const defaultResult: SslInfo = {
      valid: false,
      issuer: '',
      subject: '',
      validFrom: new Date(),
      validTo: new Date(),
      daysUntilExpiry: 0,
      isExpired: true,
      protocol: '',
      cipher: '',
      keyExchange: '',
      serialNumber: '',
      fingerprint: '',
      fingerprint256: '',
      subjectAltNames: [],
      grade: 'F',
      issues: [],
    };

    try {
      const result = await this.getCertificateInfo(host);
      return result;
    } catch (error: any) {
      defaultResult.issues.push(error.message);
      return defaultResult;
    }
  }

  /**
   * Get certificate information
   */
  private getCertificateInfo(host: string): Promise<SslInfo> {
    return new Promise((resolve, reject) => {
      const hostname = host.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      const port = 443;
      const issues: string[] = [];

      const options: https.RequestOptions = {
        hostname,
        port,
        method: 'GET',
        path: '/',
        rejectUnauthorized: false, // Allow self-signed certs
        agent: false,
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        const socket = res.socket as tls.TLSSocket;
        const cert = socket.getPeerCertificate(true);
        const protocol = socket.getProtocol() || '';
        const cipher = socket.getCipher();

        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error('No certificate found'));
          return;
        }

        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.floor(
          (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        const isExpired = daysUntilExpiry < 0;

        // Extract subject alternative names
        const subjectAltNames: string[] = [];
        if (cert.subjectaltname) {
          const names = cert.subjectaltname.split(', ');
          for (const name of names) {
            const match = name.match(/DNS:(.+)/);
            if (match) {
              subjectAltNames.push(match[1]);
            }
          }
        }

        // Determine grade and issues
        let grade = 'A';

        // Check expiry
        if (isExpired) {
          grade = 'F';
          issues.push('Certificate is expired');
        } else if (daysUntilExpiry < 30) {
          grade = 'B';
          issues.push('Certificate expires within 30 days');
        }

        // Check protocol
        if (protocol === 'TLSv1' || protocol === 'TLSv1.1') {
          grade = grade === 'A' ? 'C' : grade;
          issues.push(`Outdated protocol: ${protocol}`);
        } else if (protocol === 'SSLv3') {
          grade = 'F';
          issues.push('Insecure protocol: SSLv3');
        }

        // Check cipher strength
        if (cipher) {
          const cipherName = cipher.name || '';
          if (cipherName.includes('RC4') || cipherName.includes('DES')) {
            grade = 'F';
            issues.push(`Weak cipher: ${cipherName}`);
          } else if (cipherName.includes('CBC')) {
            if (grade === 'A') grade = 'B';
            issues.push('CBC cipher (potential BEAST vulnerability)');
          }
        }

        // Check key size
        if (cert.bits && cert.bits < 2048) {
          if (grade === 'A') grade = 'C';
          issues.push(`Weak key size: ${cert.bits} bits`);
        }

        // Self-signed check
        if (cert.issuer && cert.subject) {
          const issuerCN = cert.issuer.CN || '';
          const subjectCN = cert.subject.CN || '';
          if (issuerCN === subjectCN) {
            if (grade === 'A') grade = 'T'; // T for Trust issues
            issues.push('Self-signed certificate');
          }
        }

        const result: SslInfo = {
          valid: !isExpired && issues.length === 0,
          issuer: this.formatDistinguishedName(cert.issuer),
          subject: this.formatDistinguishedName(cert.subject),
          validFrom,
          validTo,
          daysUntilExpiry,
          isExpired,
          protocol,
          cipher: cipher?.name || '',
          keyExchange: cipher?.standardName || '',
          serialNumber: cert.serialNumber || '',
          fingerprint: cert.fingerprint || '',
          fingerprint256: cert.fingerprint256 || '',
          subjectAltNames,
          grade,
          issues,
        };

        socket.end();
        resolve(result);
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timeout'));
      });

      req.end();
    });
  }

  /**
   * Format distinguished name object to string
   */
  private formatDistinguishedName(dn: any): string {
    if (!dn) return '';

    const parts: string[] = [];
    if (dn.CN) parts.push(`CN=${dn.CN}`);
    if (dn.O) parts.push(`O=${dn.O}`);
    if (dn.OU) parts.push(`OU=${dn.OU}`);
    if (dn.L) parts.push(`L=${dn.L}`);
    if (dn.ST) parts.push(`ST=${dn.ST}`);
    if (dn.C) parts.push(`C=${dn.C}`);

    return parts.join(', ');
  }

  /**
   * Check for common SSL vulnerabilities
   */
  async checkVulnerabilities(host: string): Promise<{
    heartbleed: boolean;
    poodle: boolean;
    beast: boolean;
    crime: boolean;
    freak: boolean;
    logjam: boolean;
  }> {
    // This would require actual vulnerability testing
    // For now, return defaults based on SSL info
    return {
      heartbleed: false,
      poodle: false,
      beast: false,
      crime: false,
      freak: false,
      logjam: false,
    };
  }
}

