import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class VirusTotalService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('VIRUSTOTAL_API_KEY') || '';
    this.client = axios.create({
      baseURL: 'https://www.virustotal.com/api/v3',
      timeout: 30000,
      headers: {
        'x-apikey': this.apiKey,
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
      throw new Error('VirusTotal API key not configured');
    }

    const response = await this.client.get(`/domains/${domain}`);
    return response.data;
  }

  /**
   * Get subdomains for a domain
   */
  async getSubdomains(domain: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('VirusTotal API key not configured');
    }

    const response = await this.client.get(`/domains/${domain}/subdomains`);
    return response.data.data?.map((item: any) => item.id) || [];
  }

  /**
   * Get IP information
   */
  async getIpInfo(ip: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('VirusTotal API key not configured');
    }

    const response = await this.client.get(`/ip_addresses/${ip}`);
    return response.data;
  }

  /**
   * Get URL scan results
   */
  async getUrlInfo(url: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('VirusTotal API key not configured');
    }

    // URL ID is base64 encoded without padding
    const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
    const response = await this.client.get(`/urls/${urlId}`);
    return response.data;
  }

  /**
   * Submit URL for scanning
   */
  async scanUrl(url: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('VirusTotal API key not configured');
    }

    const response = await this.client.post('/urls', `url=${encodeURIComponent(url)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  }

  /**
   * Get domain DNS resolutions
   */
  async getDnsResolutions(domain: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('VirusTotal API key not configured');
    }

    const response = await this.client.get(`/domains/${domain}/resolutions`);
    return response.data;
  }

  /**
   * Get domain communicating files
   */
  async getCommunicatingFiles(domain: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('VirusTotal API key not configured');
    }

    const response = await this.client.get(`/domains/${domain}/communicating_files`);
    return response.data;
  }

  /**
   * Get domain referrer files
   */
  async getReferrerFiles(domain: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('VirusTotal API key not configured');
    }

    const response = await this.client.get(`/domains/${domain}/referrer_files`);
    return response.data;
  }

  /**
   * Search for indicators
   */
  async search(query: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('VirusTotal API key not configured');
    }

    const response = await this.client.get('/search', {
      params: { query },
    });
    return response.data;
  }
}

