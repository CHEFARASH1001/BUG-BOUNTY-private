import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class CrtShService {
  private baseUrl = 'https://crt.sh';

  /**
   * Search for certificates by domain
   */
  async search(domain: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/`, {
        params: {
          q: `%.${domain}`,
          output: 'json',
        },
        timeout: 60000, // crt.sh can be slow
      });

      return response.data || [];
    } catch (error) {
      console.error('crt.sh error:', error);
      return [];
    }
  }

  /**
   * Get certificate by ID
   */
  async getCertificate(id: number): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/`, {
      params: {
        id,
        output: 'json',
      },
      timeout: 30000,
    });

    return response.data;
  }

  /**
   * Search for certificates by organization
   */
  async searchByOrganization(org: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/`, {
        params: {
          q: `O=${org}`,
          output: 'json',
        },
        timeout: 60000,
      });

      return response.data || [];
    } catch (error) {
      console.error('crt.sh org search error:', error);
      return [];
    }
  }

  /**
   * Extract unique subdomains from certificate results
   */
  extractSubdomains(results: any[], baseDomain: string): string[] {
    const subdomains = new Set<string>();

    for (const cert of results) {
      if (cert.name_value) {
        const names = cert.name_value.split('\n');
        for (const name of names) {
          const cleaned = name.replace('*.', '').trim().toLowerCase();
          if (cleaned.endsWith(baseDomain) && cleaned !== baseDomain) {
            subdomains.add(cleaned);
          }
        }
      }

      if (cert.common_name) {
        const cleaned = cert.common_name.replace('*.', '').trim().toLowerCase();
        if (cleaned.endsWith(baseDomain) && cleaned !== baseDomain) {
          subdomains.add(cleaned);
        }
      }
    }

    return Array.from(subdomains);
  }
}

