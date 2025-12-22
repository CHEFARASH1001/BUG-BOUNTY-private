import { Injectable, Inject, forwardRef } from '@nestjs/common';
import axios from 'axios';

export interface CTCertificate {
  issuer: string;
  notBefore: Date;
  notAfter: Date;
  serialNumber: string;
  subjectAlternativeNames: string[];
}

export interface CTResult {
  domain: string;
  subdomains: string[];
  certificates: CTCertificate[];
  timestamp: Date;
}

export interface SubdomainRecord {
  subdomain: string;
  domainId: string;
  source: string;
  firstSeen: Date;
  lastSeen: Date;
}

@Injectable()
export class CTService {
  private crtshBaseUrl = 'https://crt.sh';
  private watchedDomains: Set<string> = new Set();

  /**
   * Query Certificate Transparency logs for a domain
   * Fetches certificates from crt.sh and extracts subdomains from SANs
   */
  async queryDomain(domain: string): Promise<CTResult> {
    const certificates = await this.fetchCertificates(domain);
    const subdomains = this.extractSubdomainsFromCertificates(certificates, domain);

    return {
      domain,
      subdomains,
      certificates,
      timestamp: new Date(),
    };
  }

  /**
   * Fetch certificates from crt.sh for a domain
   */
  private async fetchCertificates(domain: string): Promise<CTCertificate[]> {
    try {
      const response = await axios.get(`${this.crtshBaseUrl}/`, {
        params: {
          q: `%.${domain}`,
          output: 'json',
        },
        timeout: 60000, // crt.sh can be slow
      });

      const rawCerts = response.data || [];
      return this.parseCertificates(rawCerts, domain);
    } catch (error) {
      console.error('CT logs fetch error:', error);
      return [];
    }
  }

  /**
   * Parse raw certificate data from crt.sh into CTCertificate objects
   */
  private parseCertificates(rawCerts: any[], domain: string): CTCertificate[] {
    const certMap = new Map<string, CTCertificate>();

    for (const cert of rawCerts) {
      const serialNumber = cert.serial_number || cert.id?.toString() || '';
      
      // Skip if we've already processed this certificate
      if (certMap.has(serialNumber)) {
        continue;
      }

      const sans = this.extractSANsFromCert(cert, domain);
      
      certMap.set(serialNumber, {
        issuer: cert.issuer_name || cert.issuer_ca_id?.toString() || 'Unknown',
        notBefore: cert.not_before ? new Date(cert.not_before) : new Date(),
        notAfter: cert.not_after ? new Date(cert.not_after) : new Date(),
        serialNumber,
        subjectAlternativeNames: sans,
      });
    }

    return Array.from(certMap.values());
  }

  /**
   * Extract Subject Alternative Names from a certificate
   * Returns all valid subdomains from the SAN field
   */
  extractSANsFromCert(cert: any, baseDomain: string): string[] {
    const sans = new Set<string>();

    // Extract from name_value field (contains SANs in crt.sh response)
    if (cert.name_value) {
      const names = cert.name_value.split('\n');
      for (const name of names) {
        const cleaned = this.cleanDomainName(name);
        if (cleaned && this.isValidSubdomain(cleaned, baseDomain)) {
          sans.add(cleaned);
        }
      }
    }

    // Extract from common_name field
    if (cert.common_name) {
      const cleaned = this.cleanDomainName(cert.common_name);
      if (cleaned && this.isValidSubdomain(cleaned, baseDomain)) {
        sans.add(cleaned);
      }
    }

    return Array.from(sans);
  }

  /**
   * Extract unique subdomains from all certificates
   */
  private extractSubdomainsFromCertificates(certificates: CTCertificate[], baseDomain: string): string[] {
    const subdomains = new Set<string>();

    for (const cert of certificates) {
      for (const san of cert.subjectAlternativeNames) {
        subdomains.add(san);
      }
    }

    return Array.from(subdomains).sort();
  }

  /**
   * Clean domain name by removing wildcards and whitespace
   */
  private cleanDomainName(name: string): string {
    return name
      .replace(/^\*\./, '') // Remove wildcard prefix
      .trim()
      .toLowerCase();
  }

  /**
   * Validate that a domain is a valid subdomain of the base domain
   */
  private isValidSubdomain(subdomain: string, baseDomain: string): boolean {
    if (!subdomain || subdomain.length === 0 || subdomain.length > 253) {
      return false;
    }

    // Must end with the base domain
    if (!subdomain.endsWith(baseDomain)) {
      return false;
    }

    // Check for valid domain characters
    const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
    return validPattern.test(subdomain);
  }

  /**
   * Create subdomain records with cert_trans source attribution
   * Returns records ready to be stored in the database
   */
  createSubdomainRecords(subdomains: string[], domainId: string): SubdomainRecord[] {
    const now = new Date();
    return subdomains.map((subdomain) => ({
      subdomain,
      domainId,
      source: 'cert_trans',
      firstSeen: now,
      lastSeen: now,
    }));
  }

  /**
   * Start watching a domain for new certificates
   */
  watchDomain(domain: string): void {
    this.watchedDomains.add(domain.toLowerCase());
  }

  /**
   * Stop watching a domain
   */
  stopWatching(domain: string): void {
    this.watchedDomains.delete(domain.toLowerCase());
  }

  /**
   * Get list of currently watched domains
   */
  getWatchedDomains(): string[] {
    return Array.from(this.watchedDomains);
  }

  /**
   * Check if a domain is being watched
   */
  isWatching(domain: string): boolean {
    return this.watchedDomains.has(domain.toLowerCase());
  }
}
