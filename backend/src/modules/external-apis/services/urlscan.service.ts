import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class UrlScanService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('URLSCAN_API_KEY') || '';
    this.client = axios.create({
      baseURL: 'https://urlscan.io/api/v1',
      timeout: 30000,
      headers: this.apiKey ? { 'API-Key': this.apiKey } : {},
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Submit URL for scanning
   */
  async scan(url: string, visibility: 'public' | 'unlisted' | 'private' = 'public'): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('URLScan.io API key not configured');
    }

    const response = await this.client.post('/scan/', {
      url,
      visibility,
    });
    return response.data;
  }

  /**
   * Get scan result
   */
  async getResult(uuid: string): Promise<any> {
    const response = await this.client.get(`/result/${uuid}/`);
    return response.data;
  }

  /**
   * Search scans
   */
  async search(query: string, size = 100): Promise<any> {
    const response = await this.client.get('/search/', {
      params: { q: query, size },
    });
    return response.data;
  }

  /**
   * Get DOM content from scan
   */
  async getDom(uuid: string): Promise<any> {
    const response = await axios.get(`https://urlscan.io/dom/${uuid}/`, {
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * Get screenshot from scan
   */
  getScreenshotUrl(uuid: string): string {
    return `https://urlscan.io/screenshots/${uuid}.png`;
  }

  /**
   * Search by domain
   */
  async searchByDomain(domain: string): Promise<any> {
    return this.search(`domain:${domain}`);
  }

  /**
   * Search by IP
   */
  async searchByIp(ip: string): Promise<any> {
    return this.search(`ip:${ip}`);
  }

  /**
   * Search by ASN
   */
  async searchByAsn(asn: string): Promise<any> {
    return this.search(`asn:${asn}`);
  }

  /**
   * Get similar scans (phishing detection)
   */
  async getSimilar(uuid: string): Promise<any> {
    const response = await this.client.get(`/result/${uuid}/similar/`);
    return response.data;
  }
}

