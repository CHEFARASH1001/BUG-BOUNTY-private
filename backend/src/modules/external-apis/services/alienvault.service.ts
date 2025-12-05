import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class AlienVaultService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ALIENVAULT_API_KEY') || '';
    this.client = axios.create({
      baseURL: 'https://otx.alienvault.com/api/v1',
      timeout: 30000,
      headers: this.apiKey ? { 'X-OTX-API-KEY': this.apiKey } : {},
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get indicator details
   */
  async getIndicator(indicator: string, type: 'IPv4' | 'IPv6' | 'domain' | 'hostname' | 'url'): Promise<any> {
    const response = await this.client.get(`/indicators/${type}/${indicator}/general`);
    return response.data;
  }

  /**
   * Get passive DNS for an indicator
   */
  async getPassiveDns(indicator: string): Promise<any> {
    const response = await this.client.get(`/indicators/domain/${indicator}/passive_dns`);
    return response.data;
  }

  /**
   * Get URL list for a domain
   */
  async getUrlList(domain: string): Promise<any> {
    const response = await this.client.get(`/indicators/domain/${domain}/url_list`);
    return response.data;
  }

  /**
   * Get malware samples related to indicator
   */
  async getMalware(indicator: string, type: string): Promise<any> {
    const response = await this.client.get(`/indicators/${type}/${indicator}/malware`);
    return response.data;
  }

  /**
   * Get reputation for an IP
   */
  async getReputation(ip: string): Promise<any> {
    const response = await this.client.get(`/indicators/IPv4/${ip}/reputation`);
    return response.data;
  }

  /**
   * Search pulses
   */
  async searchPulses(query: string): Promise<any> {
    const response = await this.client.get('/search/pulses', {
      params: { q: query },
    });
    return response.data;
  }

  /**
   * Get WHOIS information
   */
  async getWhois(domain: string): Promise<any> {
    const response = await this.client.get(`/indicators/domain/${domain}/whois`);
    return response.data;
  }
}

