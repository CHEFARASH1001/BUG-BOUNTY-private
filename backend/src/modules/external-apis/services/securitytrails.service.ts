import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class SecurityTrailsService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SECURITYTRAILS_API_KEY') || '';
    this.client = axios.create({
      baseURL: 'https://api.securitytrails.com/v1',
      timeout: 30000,
      headers: {
        APIKEY: this.apiKey,
      },
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get domain information
   */
  async getDomainInfo(domain: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SecurityTrails API key not configured');
    }

    const response = await this.client.get(`/domain/${domain}`);
    return response.data;
  }

  /**
   * Get subdomains
   */
  async getSubdomains(domain: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SecurityTrails API key not configured');
    }

    const response = await this.client.get(`/domain/${domain}/subdomains`);
    return response.data;
  }

  /**
   * Get domain DNS history
   */
  async getDnsHistory(domain: string, recordType = 'a'): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SecurityTrails API key not configured');
    }

    const response = await this.client.get(`/history/${domain}/dns/${recordType}`);
    return response.data;
  }

  /**
   * Get WHOIS history
   */
  async getWhoisHistory(domain: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SecurityTrails API key not configured');
    }

    const response = await this.client.get(`/history/${domain}/whois`);
    return response.data;
  }

  /**
   * Get associated domains (same IP, nameserver, etc)
   */
  async getAssociatedDomains(domain: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SecurityTrails API key not configured');
    }

    const response = await this.client.get(`/domain/${domain}/associated`);
    return response.data;
  }

  /**
   * Get IP information
   */
  async getIpInfo(ip: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SecurityTrails API key not configured');
    }

    const response = await this.client.get(`/ips/nearby/${ip}`);
    return response.data;
  }

  /**
   * Search domains by keyword
   */
  async searchDomains(query: any): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SecurityTrails API key not configured');
    }

    const response = await this.client.post('/domains/list', query);
    return response.data;
  }

  /**
   * Get usage/quota info
   */
  async getUsage(): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SecurityTrails API key not configured');
    }

    const response = await this.client.get('/account/usage');
    return response.data;
  }
}

