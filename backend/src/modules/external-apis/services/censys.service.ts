import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class CensysService {
  private client: AxiosInstance;
  private apiId: string;
  private apiSecret: string;

  constructor(private configService: ConfigService) {
    this.apiId = this.configService.get<string>('CENSYS_API_ID') || '';
    this.apiSecret = this.configService.get<string>('CENSYS_API_SECRET') || '';

    const auth = Buffer.from(`${this.apiId}:${this.apiSecret}`).toString('base64');

    this.client = axios.create({
      baseURL: 'https://search.censys.io/api/v2',
      timeout: 30000,
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
  }

  isConfigured(): boolean {
    return !!(this.apiId && this.apiSecret);
  }

  /**
   * Search for hosts
   */
  async searchHosts(query: string, perPage = 25, cursor?: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Censys API credentials not configured');
    }

    const response = await this.client.get('/hosts/search', {
      params: { q: query, per_page: perPage, cursor },
    });
    return response.data;
  }

  /**
   * Get host by IP
   */
  async getHost(ip: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Censys API credentials not configured');
    }

    const response = await this.client.get(`/hosts/${ip}`);
    return response.data;
  }

  /**
   * Get host history
   */
  async getHostHistory(ip: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Censys API credentials not configured');
    }

    const response = await this.client.get(`/hosts/${ip}/diff`);
    return response.data;
  }

  /**
   * Search for certificates
   */
  async searchCertificates(query: string, perPage = 25, cursor?: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Censys API credentials not configured');
    }

    const response = await this.client.get('/certificates/search', {
      params: { q: query, per_page: perPage, cursor },
    });
    return response.data;
  }

  /**
   * Get certificate by fingerprint
   */
  async getCertificate(fingerprint: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Censys API credentials not configured');
    }

    const response = await this.client.get(`/certificates/${fingerprint}`);
    return response.data;
  }

  /**
   * Aggregate hosts
   */
  async aggregateHosts(query: string, field: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Censys API credentials not configured');
    }

    const response = await this.client.get('/hosts/aggregate', {
      params: { q: query, field },
    });
    return response.data;
  }

  /**
   * Get account info
   */
  async getAccountInfo(): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Censys API credentials not configured');
    }

    const response = await this.client.get('/account');
    return response.data;
  }
}

