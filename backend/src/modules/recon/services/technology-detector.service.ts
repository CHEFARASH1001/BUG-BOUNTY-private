import { Injectable } from '@nestjs/common';
import axios from 'axios';

interface TechSignature {
  name: string;
  category: string;
  patterns: {
    html?: RegExp[];
    headers?: Record<string, RegExp>;
    cookies?: RegExp[];
    meta?: Record<string, RegExp>;
    scripts?: RegExp[];
  };
}

@Injectable()
export class TechnologyDetector {
  private signatures: TechSignature[] = [
    // Web Servers
    {
      name: 'nginx',
      category: 'Web Server',
      patterns: {
        headers: { server: /nginx/i },
      },
    },
    {
      name: 'Apache',
      category: 'Web Server',
      patterns: {
        headers: { server: /apache/i },
      },
    },
    {
      name: 'IIS',
      category: 'Web Server',
      patterns: {
        headers: { server: /microsoft-iis/i },
      },
    },
    {
      name: 'Cloudflare',
      category: 'CDN',
      patterns: {
        headers: { server: /cloudflare/i, 'cf-ray': /.+/ },
      },
    },
    {
      name: 'AWS CloudFront',
      category: 'CDN',
      patterns: {
        headers: { 'x-amz-cf-id': /.+/, via: /cloudfront/i },
      },
    },
    // JavaScript Frameworks
    {
      name: 'React',
      category: 'JavaScript Framework',
      patterns: {
        html: [/react\.production\.min\.js/, /__REACT_DEVTOOLS_GLOBAL_HOOK__/, /data-reactroot/],
        scripts: [/react(@|\.|-)/i],
      },
    },
    {
      name: 'Next.js',
      category: 'JavaScript Framework',
      patterns: {
        html: [/__NEXT_DATA__/, /_next\/static/],
        headers: { 'x-powered-by': /next\.js/i },
      },
    },
    {
      name: 'Vue.js',
      category: 'JavaScript Framework',
      patterns: {
        html: [/vue\.js/, /v-cloak/, /__VUE__/, /vue\.runtime/],
        scripts: [/vue(@|\.)/i],
      },
    },
    {
      name: 'Nuxt.js',
      category: 'JavaScript Framework',
      patterns: {
        html: [/__NUXT__/, /_nuxt\//],
      },
    },
    {
      name: 'Angular',
      category: 'JavaScript Framework',
      patterns: {
        html: [/ng-version/, /angular\.js/, /ng-app/, /\[\(ngModel\)\]/],
      },
    },
    {
      name: 'jQuery',
      category: 'JavaScript Library',
      patterns: {
        html: [/jquery\.min\.js/, /jquery-\d+\.\d+/],
        scripts: [/jquery/i],
      },
    },
    // CMS
    {
      name: 'WordPress',
      category: 'CMS',
      patterns: {
        html: [/wp-content/, /wp-includes/, /wp-json/],
        meta: { generator: /wordpress/i },
      },
    },
    {
      name: 'Drupal',
      category: 'CMS',
      patterns: {
        html: [/drupal\.js/, /Drupal\.settings/],
        headers: { 'x-drupal-cache': /.+/, 'x-generator': /drupal/i },
      },
    },
    {
      name: 'Joomla',
      category: 'CMS',
      patterns: {
        html: [/\/media\/jui\//, /joomla/i],
        meta: { generator: /joomla/i },
      },
    },
    // E-commerce
    {
      name: 'Shopify',
      category: 'E-commerce',
      patterns: {
        html: [/cdn\.shopify\.com/, /Shopify\.theme/],
        headers: { 'x-shopify-stage': /.+/ },
      },
    },
    {
      name: 'Magento',
      category: 'E-commerce',
      patterns: {
        html: [/mage\/cookies\.js/, /Magento_/],
        cookies: [/PHPSESSID/],
      },
    },
    {
      name: 'WooCommerce',
      category: 'E-commerce',
      patterns: {
        html: [/woocommerce/, /wc-ajax/],
      },
    },
    // Backend Frameworks
    {
      name: 'Laravel',
      category: 'Backend Framework',
      patterns: {
        headers: { 'set-cookie': /laravel_session/i },
        cookies: [/laravel_session/],
      },
    },
    {
      name: 'Django',
      category: 'Backend Framework',
      patterns: {
        headers: { 'set-cookie': /csrftoken/i },
        cookies: [/csrftoken/, /django/i],
      },
    },
    {
      name: 'Express',
      category: 'Backend Framework',
      patterns: {
        headers: { 'x-powered-by': /express/i },
      },
    },
    {
      name: 'Ruby on Rails',
      category: 'Backend Framework',
      patterns: {
        headers: { 'x-powered-by': /phusion passenger/i },
        cookies: [/_session_id/],
      },
    },
    {
      name: 'ASP.NET',
      category: 'Backend Framework',
      patterns: {
        headers: { 'x-powered-by': /asp\.net/i, 'x-aspnet-version': /.+/ },
        cookies: [/ASP\.NET_SessionId/],
      },
    },
    {
      name: 'Spring',
      category: 'Backend Framework',
      patterns: {
        headers: { 'x-application-context': /.+/ },
        cookies: [/JSESSIONID/],
      },
    },
    // Analytics
    {
      name: 'Google Analytics',
      category: 'Analytics',
      patterns: {
        html: [/google-analytics\.com\/analytics\.js/, /gtag\(/],
        scripts: [/googletagmanager\.com/],
      },
    },
    {
      name: 'Google Tag Manager',
      category: 'Analytics',
      patterns: {
        html: [/googletagmanager\.com\/gtm\.js/],
      },
    },
    // Security
    {
      name: 'reCAPTCHA',
      category: 'Security',
      patterns: {
        html: [/google\.com\/recaptcha/, /grecaptcha/],
      },
    },
    {
      name: 'hCaptcha',
      category: 'Security',
      patterns: {
        html: [/hcaptcha\.com/],
      },
    },
    // CSS Frameworks
    {
      name: 'Bootstrap',
      category: 'CSS Framework',
      patterns: {
        html: [/bootstrap\.min\.css/, /bootstrap\.css/],
        scripts: [/bootstrap\.min\.js/],
      },
    },
    {
      name: 'Tailwind CSS',
      category: 'CSS Framework',
      patterns: {
        html: [/tailwindcss/, /class="[^"]*(?:flex|grid|bg-|text-|p-|m-)[^"]*"/],
      },
    },
    {
      name: 'Material UI',
      category: 'CSS Framework',
      patterns: {
        html: [/MuiBox-root/, /mui-/, /@mui/],
      },
    },
  ];

  /**
   * Detect technologies used by a URL
   */
  async detect(url: string): Promise<string[]> {
    const technologies: string[] = [];

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const html = typeof response.data === 'string' ? response.data : '';
      const headers = response.headers || {};
      const cookies = headers['set-cookie'] || [];

      for (const sig of this.signatures) {
        if (this.matchSignature(sig, html, headers, cookies)) {
          technologies.push(sig.name);
        }
      }

      // Additional detection from meta tags
      const metaTechs = this.detectFromMeta(html);
      technologies.push(...metaTechs);

      // Detect from script sources
      const scriptTechs = this.detectFromScripts(html);
      technologies.push(...scriptTechs);
    } catch (error) {
      console.error(`Technology detection error for ${url}:`, error);
    }

    return [...new Set(technologies)];
  }

  /**
   * Match technology signature
   */
  private matchSignature(
    sig: TechSignature,
    html: string,
    headers: Record<string, any>,
    cookies: string[],
  ): boolean {
    const { patterns } = sig;

    // Check HTML patterns
    if (patterns.html) {
      for (const pattern of patterns.html) {
        if (pattern.test(html)) {
          return true;
        }
      }
    }

    // Check header patterns
    if (patterns.headers) {
      for (const [header, pattern] of Object.entries(patterns.headers)) {
        const value = headers[header.toLowerCase()];
        if (value && pattern.test(String(value))) {
          return true;
        }
      }
    }

    // Check cookie patterns
    if (patterns.cookies) {
      const cookieStr = cookies.join(' ');
      for (const pattern of patterns.cookies) {
        if (pattern.test(cookieStr)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Detect technologies from meta tags
   */
  private detectFromMeta(html: string): string[] {
    const technologies: string[] = [];
    const generatorMatch = html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i);

    if (generatorMatch) {
      technologies.push(generatorMatch[1]);
    }

    return technologies;
  }

  /**
   * Detect technologies from script sources
   */
  private detectFromScripts(html: string): string[] {
    const technologies: string[] = [];
    const scriptRegex = /<script[^>]*src=["']([^"']+)["']/gi;
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      const src = match[1];

      // Common CDN patterns
      const cdnPatterns: Record<string, string> = {
        'cdnjs.cloudflare.com': 'Cloudflare CDN',
        'cdn.jsdelivr.net': 'jsDelivr',
        'unpkg.com': 'unpkg',
        'ajax.googleapis.com': 'Google Hosted Libraries',
        'code.jquery.com': 'jQuery CDN',
      };

      for (const [cdn, name] of Object.entries(cdnPatterns)) {
        if (src.includes(cdn)) {
          technologies.push(name);
        }
      }
    }

    return technologies;
  }
}

