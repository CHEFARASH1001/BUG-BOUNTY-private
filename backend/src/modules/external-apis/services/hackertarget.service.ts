import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class HackerTargetService {
  private baseUrl = 'https://api.hackertarget.com';

  /**
   * Host search - find hosts related to a domain
   */
  async hostsearch(domain: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/hostsearch/`, {
      params: { q: domain },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * DNS lookup
   */
  async dnslookup(domain: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/dnslookup/`, {
      params: { q: domain },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * Reverse DNS lookup
   */
  async reversedns(ip: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/reversedns/`, {
      params: { q: ip },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * Find shared DNS servers
   */
  async findshareddns(nameserver: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/findshareddns/`, {
      params: { q: nameserver },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * Zone transfer check
   */
  async zonetransfer(domain: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/zonetransfer/`, {
      params: { q: domain },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * WHOIS lookup
   */
  async whois(domain: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/whois/`, {
      params: { q: domain },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * GeoIP lookup
   */
  async geoip(ip: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/geoip/`, {
      params: { q: ip },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * Reverse IP lookup
   */
  async reverseiplookup(ip: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/reverseiplookup/`, {
      params: { q: ip },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * HTTP headers check
   */
  async httpheaders(url: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/httpheaders/`, {
      params: { q: url },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * Page links extraction
   */
  async pagelinks(url: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/pagelinks/`, {
      params: { q: url },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * ASN lookup
   */
  async aslookup(ip: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/aslookup/`, {
      params: { q: ip },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * Subnet calculator
   */
  async subnetcalc(cidr: string): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/subnetcalc/`, {
      params: { q: cidr },
      timeout: 30000,
    });
    return response.data;
  }
}

