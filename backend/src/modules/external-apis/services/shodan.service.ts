import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class ShodanService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SHODAN_API_KEY') || '';
    this.client = axios.create({
      baseURL: 'https://api.shodan.io',
      timeout: 30000,
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get host information by IP
   */
  async hostLookup(ip: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Shodan API key not configured');
    }

    const response = await this.client.get(`/shodan/host/${ip}`, {
      params: { key: this.apiKey },
    });
    return response.data;
  }

  /**
   * Search Shodan
   */
  async search(query: string, page = 1): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Shodan API key not configured');
    }

    const response = await this.client.get('/shodan/host/search', {
      params: { key: this.apiKey, query, page },
    });
    return response.data;
  }

  /**
   * Get number of results for a query
   */
  async count(query: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Shodan API key not configured');
    }

    const response = await this.client.get('/shodan/host/count', {
      params: { key: this.apiKey, query },
    });
    return response.data;
  }

  /**
   * DNS lookup
   */
  async dnsResolve(hostnames: string[]): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Shodan API key not configured');
    }

    const response = await this.client.get('/dns/resolve', {
      params: { key: this.apiKey, hostnames: hostnames.join(',') },
    });
    return response.data;
  }

  /**
   * Reverse DNS lookup
   */
  async dnsReverse(ips: string[]): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Shodan API key not configured');
    }

    const response = await this.client.get('/dns/reverse', {
      params: { key: this.apiKey, ips: ips.join(',') },
    });
    return response.data;
  }

  /**
   * Get domain information
   */
  async domainInfo(domain: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Shodan API key not configured');
    }

    const response = await this.client.get(`/dns/domain/${domain}`, {
      params: { key: this.apiKey },
    });
    return response.data;
  }

  /**
   * Get API info (credits remaining, etc)
   */
  async apiInfo(): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Shodan API key not configured');
    }

    const response = await this.client.get('/api-info', {
      params: { key: this.apiKey },
    });
    return response.data;
  }

  /**
   * Search for exploits
   */
  async searchExploits(query: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Shodan API key not configured');
    }

    const response = await this.client.get('/exploits/search', {
      params: { key: this.apiKey, query },
    });
    return response.data;
  }

  /**
   * Get honeypot score for an IP
   */
  async honeyscore(ip: string): Promise<number> {
    if (!this.isConfigured()) {
      throw new Error('Shodan API key not configured');
    }

    const response = await this.client.get(`/labs/honeyscore/${ip}`, {
      params: { key: this.apiKey },
    });
    return response.data;
  }
}

