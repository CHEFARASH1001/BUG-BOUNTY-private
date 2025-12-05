import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class HunterService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('HUNTER_API_KEY') || '';
    this.client = axios.create({
      baseURL: 'https://api.hunter.io/v2',
      timeout: 30000,
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for email addresses by domain
   */
  async domainSearch(domain: string, limit = 100): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Hunter.io API key not configured');
    }

    const response = await this.client.get('/domain-search', {
      params: { domain, api_key: this.apiKey, limit },
    });
    return response.data;
  }

  /**
   * Find email address for a person
   */
  async emailFinder(domain: string, firstName: string, lastName: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Hunter.io API key not configured');
    }

    const response = await this.client.get('/email-finder', {
      params: {
        domain,
        first_name: firstName,
        last_name: lastName,
        api_key: this.apiKey,
      },
    });
    return response.data;
  }

  /**
   * Verify email address
   */
  async emailVerifier(email: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Hunter.io API key not configured');
    }

    const response = await this.client.get('/email-verifier', {
      params: { email, api_key: this.apiKey },
    });
    return response.data;
  }

  /**
   * Get email count for a domain
   */
  async emailCount(domain: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Hunter.io API key not configured');
    }

    const response = await this.client.get('/email-count', {
      params: { domain, api_key: this.apiKey },
    });
    return response.data;
  }

  /**
   * Get account info
   */
  async getAccountInfo(): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Hunter.io API key not configured');
    }

    const response = await this.client.get('/account', {
      params: { api_key: this.apiKey },
    });
    return response.data;
  }
}

