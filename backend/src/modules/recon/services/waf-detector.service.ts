import { Injectable } from '@nestjs/common';
import axios from 'axios';

interface WafSignature {
  name: string;
  patterns: {
    headers?: Record<string, RegExp>;
    body?: RegExp[];
    cookies?: RegExp[];
    statusCodes?: number[];
  };
}

@Injectable()
export class WafDetector {
  private signatures: WafSignature[] = [
    {
      name: 'Cloudflare',
      patterns: {
        headers: {
          server: /cloudflare/i,
          'cf-ray': /.+/,
          'cf-cache-status': /.+/,
        },
        cookies: [/(__cf|cf_)/i],
      },
    },
    {
      name: 'AWS WAF',
      patterns: {
        headers: {
          'x-amzn-requestid': /.+/,
          'x-amz-cf-id': /.+/,
        },
      },
    },
    {
      name: 'Akamai',
      patterns: {
        headers: {
          'x-akamai-transformed': /.+/,
          server: /akamaighost/i,
        },
      },
    },
    {
      name: 'Imperva Incapsula',
      patterns: {
        headers: {
          'x-iinfo': /.+/,
          'x-cdn': /incapsula/i,
        },
        cookies: [/incap_ses|visid_incap/i],
      },
    },
    {
      name: 'Sucuri',
      patterns: {
        headers: {
          'x-sucuri-id': /.+/,
          'x-sucuri-cache': /.+/,
          server: /sucuri/i,
        },
      },
    },
    {
      name: 'ModSecurity',
      patterns: {
        headers: {
          server: /mod_security|modsecurity/i,
        },
        body: [/mod_security|modsecurity/i],
      },
    },
    {
      name: 'F5 BIG-IP ASM',
      patterns: {
        headers: {
          server: /big-ip|bigip/i,
          'x-wa-info': /.+/,
        },
        cookies: [/TS[a-z0-9]{3,}/i, /BIGipServer/i],
      },
    },
    {
      name: 'Barracuda',
      patterns: {
        headers: {
          server: /barracuda/i,
        },
        cookies: [/barra_counter_session/i],
      },
    },
    {
      name: 'DenyAll',
      patterns: {
        headers: {
          'set-cookie': /sessioncookie/i,
        },
      },
    },
    {
      name: 'Fortinet FortiWeb',
      patterns: {
        headers: {
          'set-cookie': /fortiweb/i,
        },
      },
    },
    {
      name: 'Wallarm',
      patterns: {
        headers: {
          server: /nginx-wallarm/i,
        },
      },
    },
    {
      name: 'AWS Shield',
      patterns: {
        headers: {
          'x-amz-cf-pop': /.+/,
        },
      },
    },
    {
      name: 'Fastly',
      patterns: {
        headers: {
          'x-fastly-request-id': /.+/,
          via: /fastly/i,
        },
      },
    },
    {
      name: 'StackPath',
      patterns: {
        headers: {
          'x-sp-waf': /.+/,
          'x-sp-edge-host': /.+/,
        },
      },
    },
    {
      name: 'Reblaze',
      patterns: {
        headers: {
          server: /reblaze/i,
        },
        cookies: [/rbzid/i],
      },
    },
    {
      name: 'Edgecast',
      patterns: {
        headers: {
          server: /ecacc/i,
          'x-ec-custom-error': /.+/,
        },
      },
    },
    {
      name: 'Wordfence',
      patterns: {
        body: [/wordfence/i, /wfwaf/i],
        headers: {
          'x-wf-timestamp': /.+/,
        },
      },
    },
    {
      name: 'DDoS-Guard',
      patterns: {
        headers: {
          server: /ddos-guard/i,
        },
        cookies: [/__ddg[0-9]/i],
      },
    },
  ];

  /**
   * Detect WAF/CDN protection on a URL
   */
  async detect(url: string): Promise<string[]> {
    const detected: string[] = [];

    try {
      // Normal request
      const normalResponse = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 3,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      // Check signatures against normal response
      for (const sig of this.signatures) {
        if (this.matchSignature(sig, normalResponse)) {
          detected.push(sig.name);
        }
      }

      // Try malicious request to trigger WAF
      const maliciousPayloads = [
        `${url}?id=1' OR '1'='1`,
        `${url}?id=<script>alert(1)</script>`,
        `${url}/../../../etc/passwd`,
      ];

      for (const payload of maliciousPayloads) {
        try {
          const maliciousResponse = await axios.get(payload, {
            timeout: 10000,
            maxRedirects: 3,
            validateStatus: () => true,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });

          // Check for WAF block responses
          const blockSignatures = this.detectBlockResponse(maliciousResponse);
          detected.push(...blockSignatures);
        } catch {
          // Request blocked - WAF detected
          detected.push('Unknown WAF (Connection Blocked)');
        }
      }
    } catch (error) {
      console.error(`WAF detection error for ${url}:`, error);
    }

    return [...new Set(detected)];
  }

  /**
   * Match WAF signature against response
   */
  private matchSignature(sig: WafSignature, response: any): boolean {
    const { patterns } = sig;
    const headers = response.headers || {};
    const body = typeof response.data === 'string' ? response.data : '';
    const cookies = headers['set-cookie'] || [];

    // Check headers
    if (patterns.headers) {
      for (const [header, pattern] of Object.entries(patterns.headers)) {
        const value = headers[header.toLowerCase()];
        if (value && pattern.test(String(value))) {
          return true;
        }
      }
    }

    // Check body
    if (patterns.body) {
      for (const pattern of patterns.body) {
        if (pattern.test(body)) {
          return true;
        }
      }
    }

    // Check cookies
    if (patterns.cookies) {
      const cookieStr = Array.isArray(cookies) ? cookies.join(' ') : String(cookies);
      for (const pattern of patterns.cookies) {
        if (pattern.test(cookieStr)) {
          return true;
        }
      }
    }

    // Check status codes
    if (patterns.statusCodes && patterns.statusCodes.includes(response.status)) {
      return true;
    }

    return false;
  }

  /**
   * Detect WAF from block response
   */
  private detectBlockResponse(response: any): string[] {
    const detected: string[] = [];
    const body = typeof response.data === 'string' ? response.data : '';
    const status = response.status;

    // Common WAF block status codes
    if ([403, 406, 429, 503].includes(status)) {
      // Check body for WAF signatures
      const blockPatterns: Record<string, RegExp> = {
        'Cloudflare': /attention required|cloudflare ray id/i,
        'Akamai': /access denied|akamai/i,
        'AWS WAF': /request blocked|aws/i,
        'Imperva': /incapsula incident id|access denied/i,
        'Sucuri': /sucuri website firewall/i,
        'ModSecurity': /mod_security|modsec/i,
        'Wordfence': /wordfence/i,
        'F5 BIG-IP': /the requested url was rejected/i,
      };

      for (const [waf, pattern] of Object.entries(blockPatterns)) {
        if (pattern.test(body)) {
          detected.push(waf);
        }
      }

      if (detected.length === 0 && status === 403) {
        detected.push('Unknown WAF (403 Forbidden)');
      }
    }

    return detected;
  }
}

