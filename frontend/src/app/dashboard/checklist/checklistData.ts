import {
  Search,
  Layers,
  Bug,
  Zap,
  Shield,
  Lock,
  Key,
  Globe,
  Server,
  Database,
  FileCode,
  Cloud,
  Smartphone,
  Network,
  Eye,
  Settings,
  AlertTriangle,
  Code,
} from 'lucide-react';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  tools?: string[];
  tips?: string[];
}

export interface ChecklistSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: ChecklistItem[];
}

export const checklistData: ChecklistSection[] = [
  // SECTION 1: RECONNAISSANCE
  {
    id: 'recon',
    title: '1. Reconnaissance & Information Gathering',
    icon: Search,
    color: 'text-blue-400',
    items: [
      {
        id: 'recon-1',
        title: 'Subdomain Enumeration',
        description: 'Find all subdomains using passive and active techniques',
        tools: ['subfinder', 'amass', 'assetfinder', 'findomain'],
        tips: [
          'Use multiple tools for better coverage',
          'Check crt.sh for certificate transparency logs',
          'Try permutations: dev, staging, api, admin, test',
          'Look for cloud assets: s3, blob, cdn subdomains',
        ],
      },
      {
        id: 'recon-2',
        title: 'DNS Records Analysis',
        description: 'Gather all DNS records (A, AAAA, CNAME, MX, TXT, NS, SOA)',
        tools: ['dnsx', 'whois'],
        tips: [
          'Check for zone transfer vulnerabilities (AXFR)',
          'Look for internal hostnames in TXT/SPF records',
          'Find mail servers for phishing scope',
          'Check for dangling DNS records',
        ],
      },
      {
        id: 'recon-3',
        title: 'Port Scanning & Service Detection',
        description: 'Identify open ports, services, and versions',
        tools: ['nmap', 'naabu'],
        tips: [
          'Scan all 65535 ports on critical targets',
          'Use -sV for version detection',
          'Check for non-standard ports (8080, 8443, 9000)',
          'Look for admin panels on high ports',
        ],
      },
      {
        id: 'recon-4',
        title: 'Technology Stack Fingerprinting',
        description: 'Identify web servers, frameworks, CMS, and libraries',
        tools: ['httpx', 'wafw00f'],
        tips: [
          'Check X-Powered-By, Server headers',
          'Look for framework-specific files (/wp-admin, /elmah.axd)',
          'Identify JavaScript libraries and versions',
          'Check for outdated software versions',
        ],
      },
      {
        id: 'recon-5',
        title: 'Wayback Machine & Archive Analysis',
        description: 'Find historical endpoints, old files, and removed content',
        tools: ['waybackurls', 'gau'],
        tips: [
          'Look for old API endpoints still active',
          'Find removed admin panels or debug pages',
          'Check for old JavaScript files with secrets',
          'Look for backup files (.bak, .old, .zip)',
        ],
      },
      {
        id: 'recon-6',
        title: 'GitHub/GitLab Dorking',
        description: 'Search for leaked credentials, API keys, and sensitive code',
        tools: ['trufflehog', 'gitleaks'],
        tips: [
          'Search: "company.com" password OR secret OR api_key',
          'Check commit history for removed secrets',
          'Look for .env files, config files',
          'Search for internal URLs and endpoints',
        ],
      },
      {
        id: 'recon-7',
        title: 'Google Dorking',
        description: 'Use advanced search operators to find sensitive information',
        tips: [
          'site:target.com filetype:pdf OR doc OR xls',
          'site:target.com inurl:admin OR login OR dashboard',
          'site:target.com ext:php inurl:?',
          '"target.com" password OR credentials filetype:txt',
          'site:pastebin.com "target.com"',
        ],
      },
      {
        id: 'recon-8',
        title: 'ASN & IP Range Discovery',
        description: 'Find all IP ranges owned by the organization',
        tools: ['amass', 'whois'],
        tips: [
          'Use BGP.he.net for ASN lookup',
          'Check for cloud IP ranges (AWS, Azure, GCP)',
          'Look for acquired company assets',
          'Scan entire IP ranges for web services',
        ],
      },
      {
        id: 'recon-9',
        title: 'Cloud Asset Discovery',
        description: 'Find S3 buckets, Azure blobs, GCP storage',
        tips: [
          'Try common bucket names: company-backup, company-dev',
          'Check for misconfigured bucket permissions',
          'Look for exposed cloud functions/lambdas',
          'Search for cloud metadata endpoints',
        ],
      },
      {
        id: 'recon-10',
        title: 'Email Harvesting & OSINT',
        description: 'Gather employee emails and organizational info',
        tips: [
          'Use Hunter.io, Phonebook.cz for emails',
          'Check LinkedIn for employee names',
          'Look for email patterns (first.last@company.com)',
          'Useful for password spraying and phishing scope',
        ],
      },
    ],
  },
  // SECTION 2: APPLICATION MAPPING
  {
    id: 'mapping',
    title: '2. Application Mapping & Content Discovery',
    icon: Layers,
    color: 'text-purple-400',
    items: [
      {
        id: 'map-1',
        title: 'Directory & File Bruteforcing',
        description: 'Discover hidden files, directories, and backup files',
        tools: ['ffuf', 'dirsearch', 'feroxbuster'],
        tips: [
          'Use multiple wordlists (SecLists, dirbuster)',
          'Try extensions: .php, .asp, .jsp, .bak, .old, .zip',
          'Check for .git, .svn, .env exposure',
          'Look for backup files: index.php.bak, web.config.old',
        ],
      },
      {
        id: 'map-2',
        title: 'Parameter Discovery',
        description: 'Find hidden and undocumented parameters',
        tools: ['arjun', 'paramspider', 'x8'],
        tips: [
          'Check for debug params: debug, test, admin',
          'Try common params: id, user, file, path, url, redirect',
          'Look for hidden form fields in HTML source',
          'Test parameter pollution (HPP)',
        ],
      },
      {
        id: 'map-3',
        title: 'JavaScript Analysis',
        description: 'Extract endpoints, secrets, and API keys from JS files',
        tools: ['linkfinder', 'secretfinder'],
        tips: [
          'Look for API endpoints and internal URLs',
          'Find hardcoded credentials and API keys',
          'Check for commented-out code with secrets',
          'Analyze webpack/source maps if available',
        ],
      },
      {
        id: 'map-4',
        title: 'Web Crawling & Spidering',
        description: 'Automatically discover all accessible pages and endpoints',
        tools: ['katana', 'hakrawler'],
        tips: [
          'Crawl with authentication for more coverage',
          'Set appropriate depth (3-5 levels)',
          'Extract forms and input fields',
          'Look for hidden links in comments',
        ],
      },
      {
        id: 'map-5',
        title: 'API Endpoint Discovery',
        description: 'Find REST, GraphQL, and SOAP API endpoints',
        tools: ['ffuf', 'katana'],
        tips: [
          'Check /api, /v1, /v2, /graphql, /swagger',
          'Look for OpenAPI/Swagger documentation',
          'Test API versioning bypass (v1 vs v2)',
          'Find undocumented API endpoints',
        ],
      },
      {
        id: 'map-6',
        title: 'Virtual Host Discovery',
        description: 'Find hidden virtual hosts on the same IP',
        tools: ['ffuf', 'httpx'],
        tips: [
          'Bruteforce Host header with wordlists',
          'Check for dev, staging, internal vhosts',
          'Look for default/catch-all vhost responses',
          'Test IP-based access vs hostname access',
        ],
      },
      {
        id: 'map-7',
        title: 'Sitemap & robots.txt Analysis',
        description: 'Extract URLs from sitemap.xml and robots.txt',
        tips: [
          'Check /sitemap.xml, /sitemap_index.xml',
          'Look for disallowed paths in robots.txt',
          'Find admin panels and sensitive directories',
          'Check for multiple sitemaps',
        ],
      },
      {
        id: 'map-8',
        title: 'Input Vector Mapping',
        description: 'Identify all user input points in the application',
        tips: [
          'Map all forms, search boxes, file uploads',
          'Check URL parameters, headers, cookies',
          'Look for JSON/XML input in API calls',
          'Identify WebSocket connections',
        ],
      },
    ],
  },
  // SECTION 3: AUTHENTICATION TESTING
  {
    id: 'auth',
    title: '3. Authentication Testing',
    icon: Key,
    color: 'text-orange-400',
    items: [
      {
        id: 'auth-1',
        title: 'Default Credentials',
        description: 'Test for default usernames and passwords',
        tips: [
          'Try admin:admin, admin:password, root:root',
          'Check vendor default credentials',
          'Test common passwords: password123, company name',
          'Look for credential lists for specific software',
        ],
      },
      {
        id: 'auth-2',
        title: 'Brute Force Protection',
        description: 'Test account lockout and rate limiting',
        tips: [
          'Check if accounts lock after failed attempts',
          'Test rate limiting on login endpoint',
          'Try IP rotation to bypass rate limits',
          'Check for CAPTCHA bypass possibilities',
        ],
      },
      {
        id: 'auth-3',
        title: 'Password Reset Flaws',
        description: 'Test password reset functionality for vulnerabilities',
        tips: [
          'Check for token predictability',
          'Test token expiration and reuse',
          'Try Host header injection in reset emails',
          'Check for user enumeration via reset',
        ],
      },
      {
        id: 'auth-4',
        title: 'Session Management',
        description: 'Test session tokens for security issues',
        tips: [
          'Check session token entropy/randomness',
          'Test session fixation vulnerabilities',
          'Verify session invalidation on logout',
          'Check for session timeout implementation',
        ],
      },
      {
        id: 'auth-5',
        title: 'Multi-Factor Authentication Bypass',
        description: 'Test MFA implementation for weaknesses',
        tips: [
          'Try direct URL access after first factor',
          'Check for MFA code reuse',
          'Test backup code implementation',
          'Look for MFA bypass via API',
        ],
      },
      {
        id: 'auth-6',
        title: 'OAuth/SSO Vulnerabilities',
        description: 'Test OAuth and Single Sign-On implementations',
        tips: [
          'Check redirect_uri validation (open redirect)',
          'Test state parameter for CSRF protection',
          'Look for token leakage in referrer',
          'Try scope manipulation attacks',
        ],
      },
      {
        id: 'auth-7',
        title: 'JWT Token Analysis',
        description: 'Test JSON Web Token implementation',
        tips: [
          'Check for algorithm confusion (none, HS256 vs RS256)',
          'Test for weak signing keys',
          'Look for sensitive data in payload',
          'Check token expiration and refresh logic',
        ],
      },
      {
        id: 'auth-8',
        title: 'Remember Me Functionality',
        description: 'Test persistent login implementation',
        tips: [
          'Check remember me token security',
          'Test token invalidation on password change',
          'Look for predictable token generation',
          'Verify secure cookie attributes',
        ],
      },
      {
        id: 'auth-9',
        title: 'User Enumeration',
        description: 'Test for username/email enumeration',
        tips: [
          'Compare login error messages',
          'Check registration for existing users',
          'Test password reset responses',
          'Look for timing differences in responses',
        ],
      },
      {
        id: 'auth-10',
        title: 'Account Takeover Vectors',
        description: 'Test for various account takeover methods',
        tips: [
          'Check for IDOR in profile/settings',
          'Test email change without verification',
          'Look for password change without old password',
          'Check for session hijacking possibilities',
        ],
      },
    ],
  },
  // SECTION 4: AUTHORIZATION TESTING
  {
    id: 'authz',
    title: '4. Authorization & Access Control',
    icon: Shield,
    color: 'text-green-400',
    items: [
      {
        id: 'authz-1',
        title: 'IDOR (Insecure Direct Object Reference)',
        description: 'Test for unauthorized access to objects via ID manipulation',
        tips: [
          'Change numeric IDs: /user/123 → /user/124',
          'Try UUID manipulation and prediction',
          'Test encoded IDs (base64, hex)',
          'Check for IDOR in file downloads, exports',
        ],
      },
      {
        id: 'authz-2',
        title: 'Horizontal Privilege Escalation',
        description: 'Access other users data at the same privilege level',
        tips: [
          'Swap user IDs in requests',
          'Test accessing other users profiles/data',
          'Check shared resources access',
          'Look for user context in cookies/headers',
        ],
      },
      {
        id: 'authz-3',
        title: 'Vertical Privilege Escalation',
        description: 'Gain higher privileges than authorized',
        tips: [
          'Access admin endpoints as regular user',
          'Modify role/privilege parameters',
          'Test admin functionality via API',
          'Check for privilege escalation via registration',
        ],
      },
      {
        id: 'authz-4',
        title: 'Forced Browsing',
        description: 'Access restricted pages by direct URL',
        tips: [
          'Try accessing /admin, /dashboard without auth',
          'Check for client-side only access control',
          'Test API endpoints without authentication',
          'Look for backup/debug endpoints',
        ],
      },
      {
        id: 'authz-5',
        title: 'Parameter Tampering',
        description: 'Modify parameters to bypass access controls',
        tips: [
          'Change isAdmin=false to isAdmin=true',
          'Modify price, quantity in e-commerce',
          'Test role parameter manipulation',
          'Check for mass assignment vulnerabilities',
        ],
      },
      {
        id: 'authz-6',
        title: 'HTTP Method Tampering',
        description: 'Test different HTTP methods for access bypass',
        tips: [
          'Try GET instead of POST and vice versa',
          'Test PUT, DELETE, PATCH on restricted endpoints',
          'Check for method override headers (X-HTTP-Method-Override)',
          'Look for different behavior per method',
        ],
      },
      {
        id: 'authz-7',
        title: 'Path Traversal in Authorization',
        description: 'Bypass authorization using path manipulation',
        tips: [
          'Try /admin/../user/profile',
          'Test URL encoding: %2e%2e%2f',
          'Check for case sensitivity: /Admin vs /admin',
          'Look for path normalization issues',
        ],
      },
      {
        id: 'authz-8',
        title: 'Multi-Tenancy Issues',
        description: 'Test isolation between different tenants/organizations',
        tips: [
          'Access other tenant data via ID manipulation',
          'Check subdomain isolation',
          'Test API key scope across tenants',
          'Look for shared resource leakage',
        ],
      },
    ],
  },
  // SECTION 5: INJECTION VULNERABILITIES
  {
    id: 'injection',
    title: '5. Injection Vulnerabilities',
    icon: Bug,
    color: 'text-red-400',
    items: [
      {
        id: 'inj-1',
        title: 'SQL Injection (SQLi)',
        description: 'Test all inputs for SQL injection vulnerabilities',
        tools: ['sqlmap'],
        tips: [
          "Basic test: ' OR '1'='1' --",
          'Test in: params, headers, cookies, JSON',
          'Try time-based blind: SLEEP(5)',
          'Check for second-order SQLi',
        ],
      },
      {
        id: 'inj-2',
        title: 'Cross-Site Scripting (XSS)',
        description: 'Test for reflected, stored, and DOM-based XSS',
        tools: ['dalfox'],
        tips: [
          'Basic: <script>alert(1)</script>',
          'Event handlers: <img src=x onerror=alert(1)>',
          'Check for CSP bypass techniques',
          'Test in all input fields, headers, file names',
        ],
      },
      {
        id: 'inj-3',
        title: 'Command Injection',
        description: 'Test for OS command injection',
        tips: [
          'Try: ; ls, | cat /etc/passwd, `id`',
          'Test in file operations, ping, DNS lookups',
          'Check for blind command injection',
          'Look for command injection in headers',
        ],
      },
      {
        id: 'inj-4',
        title: 'LDAP Injection',
        description: 'Test LDAP queries for injection',
        tips: [
          'Try: *)(&, *)(uid=*))(|(uid=*',
          'Test in login forms, search functions',
          'Check for authentication bypass',
          'Look for information disclosure',
        ],
      },
      {
        id: 'inj-5',
        title: 'XML/XXE Injection',
        description: 'Test for XML External Entity injection',
        tips: [
          'Try: <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
          'Test in XML uploads, SOAP requests',
          'Check for blind XXE via OOB',
          'Look for SSRF via XXE',
        ],
      },
      {
        id: 'inj-6',
        title: 'Server-Side Template Injection (SSTI)',
        description: 'Test for template engine injection',
        tips: [
          'Try: {{7*7}}, ${7*7}, <%= 7*7 %>',
          'Test in user profile fields, email templates',
          'Identify template engine for specific payloads',
          'Check for RCE via SSTI',
        ],
      },
      {
        id: 'inj-7',
        title: 'NoSQL Injection',
        description: 'Test MongoDB and other NoSQL databases',
        tips: [
          'Try: {"$gt": ""}, {"$ne": null}',
          'Test in JSON parameters',
          'Check for operator injection',
          'Look for authentication bypass',
        ],
      },
      {
        id: 'inj-8',
        title: 'GraphQL Injection',
        description: 'Test GraphQL endpoints for vulnerabilities',
        tips: [
          'Check for introspection enabled',
          'Test for batching attacks',
          'Look for authorization bypass in queries',
          'Check for DoS via deep nesting',
        ],
      },
      {
        id: 'inj-9',
        title: 'Header Injection',
        description: 'Test for HTTP header injection (CRLF)',
        tips: [
          'Try: %0d%0aSet-Cookie:malicious=value',
          'Test in redirect parameters',
          'Check for response splitting',
          'Look for cache poisoning via headers',
        ],
      },
      {
        id: 'inj-10',
        title: 'Expression Language Injection',
        description: 'Test for EL injection in Java applications',
        tips: [
          'Try: ${applicationScope}',
          'Test in Spring, JSF applications',
          'Check for RCE possibilities',
          'Look for information disclosure',
        ],
      },
    ],
  },
  // SECTION 6: CLIENT-SIDE VULNERABILITIES
  {
    id: 'client',
    title: '6. Client-Side Vulnerabilities',
    icon: Globe,
    color: 'text-cyan-400',
    items: [
      {
        id: 'client-1',
        title: 'DOM-Based XSS',
        description: 'Test for XSS in client-side JavaScript',
        tools: ['dalfox'],
        tips: [
          'Check document.location, document.URL usage',
          'Test innerHTML, document.write sinks',
          'Look for jQuery selector injection',
          'Check for postMessage vulnerabilities',
        ],
      },
      {
        id: 'client-2',
        title: 'Cross-Site Request Forgery (CSRF)',
        description: 'Test for CSRF in state-changing operations',
        tips: [
          'Check for CSRF tokens in forms',
          'Test token validation (remove, modify)',
          'Look for CSRF in JSON APIs',
          'Check SameSite cookie attribute',
        ],
      },
      {
        id: 'client-3',
        title: 'Clickjacking',
        description: 'Test for UI redressing attacks',
        tips: [
          'Check X-Frame-Options header',
          'Test CSP frame-ancestors directive',
          'Look for frameable sensitive pages',
          'Check for frame busting bypass',
        ],
      },
      {
        id: 'client-4',
        title: 'Open Redirect',
        description: 'Test for unvalidated redirects',
        tips: [
          'Check redirect parameters: url, next, return',
          'Try: //evil.com, \\\\evil.com',
          'Test URL encoding bypass',
          'Look for redirect in OAuth flows',
        ],
      },
      {
        id: 'client-5',
        title: 'WebSocket Security',
        description: 'Test WebSocket implementation',
        tips: [
          'Check for authentication on WS connection',
          'Test for CSWSH (Cross-Site WebSocket Hijacking)',
          'Look for injection in WS messages',
          'Check for sensitive data in WS traffic',
        ],
      },
      {
        id: 'client-6',
        title: 'PostMessage Vulnerabilities',
        description: 'Test window.postMessage implementation',
        tips: [
          'Check origin validation in message handlers',
          'Look for sensitive data in messages',
          'Test for DOM XSS via postMessage',
          'Check for authentication bypass',
        ],
      },
      {
        id: 'client-7',
        title: 'Local Storage Security',
        description: 'Check for sensitive data in browser storage',
        tips: [
          'Look for tokens, credentials in localStorage',
          'Check sessionStorage for sensitive data',
          'Test for XSS to steal storage data',
          'Look for PII in client-side storage',
        ],
      },
      {
        id: 'client-8',
        title: 'CORS Misconfiguration',
        description: 'Test Cross-Origin Resource Sharing settings',
        tips: [
          'Check Access-Control-Allow-Origin header',
          'Test for wildcard (*) with credentials',
          'Try null origin bypass',
          'Look for reflected origin without validation',
        ],
      },
    ],
  },
  // SECTION 7: SERVER-SIDE VULNERABILITIES
  {
    id: 'server',
    title: '7. Server-Side Vulnerabilities',
    icon: Server,
    color: 'text-pink-400',
    items: [
      {
        id: 'server-1',
        title: 'Server-Side Request Forgery (SSRF)',
        description: 'Test for SSRF in URL parameters and file fetching',
        tips: [
          'Test: http://127.0.0.1, http://localhost',
          'Try cloud metadata: 169.254.169.254',
          'Check for blind SSRF via DNS/HTTP callbacks',
          'Test URL parsers for bypass techniques',
        ],
      },
      {
        id: 'server-2',
        title: 'Local File Inclusion (LFI)',
        description: 'Test for local file read vulnerabilities',
        tips: [
          'Try: ../../../etc/passwd',
          'Test null byte: file.php%00.jpg',
          'Check for PHP wrappers: php://filter',
          'Look for log poisoning for RCE',
        ],
      },
      {
        id: 'server-3',
        title: 'Remote File Inclusion (RFI)',
        description: 'Test for remote file inclusion',
        tips: [
          'Try: http://evil.com/shell.txt',
          'Check allow_url_include setting',
          'Test with data:// wrapper',
          'Look for RFI in include parameters',
        ],
      },
      {
        id: 'server-4',
        title: 'Path Traversal',
        description: 'Test for directory traversal vulnerabilities',
        tips: [
          'Try: ....//....//etc/passwd',
          'Test URL encoding: %2e%2e%2f',
          'Check for double encoding',
          'Look for traversal in file downloads',
        ],
      },
      {
        id: 'server-5',
        title: 'File Upload Vulnerabilities',
        description: 'Test file upload for code execution',
        tips: [
          'Upload web shells (.php, .asp, .jsp)',
          'Test extension bypass: .php5, .phtml',
          'Check content-type validation bypass',
          'Look for path traversal in filename',
        ],
      },
      {
        id: 'server-6',
        title: 'Insecure Deserialization',
        description: 'Test for deserialization vulnerabilities',
        tips: [
          'Look for serialized objects in cookies/params',
          'Test Java, PHP, Python, .NET serialization',
          'Check for gadget chains for RCE',
          'Look for type confusion attacks',
        ],
      },
      {
        id: 'server-7',
        title: 'Race Conditions',
        description: 'Test for TOCTOU and race condition bugs',
        tips: [
          'Test concurrent requests on sensitive operations',
          'Check for double-spending in payments',
          'Look for race in coupon/voucher redemption',
          'Test file operations for race conditions',
        ],
      },
      {
        id: 'server-8',
        title: 'Business Logic Flaws',
        description: 'Test application-specific logic vulnerabilities',
        tips: [
          'Test negative values in quantities/prices',
          'Check for workflow bypass (skip steps)',
          'Look for coupon stacking/abuse',
          'Test referral/reward system abuse',
        ],
      },
      {
        id: 'server-9',
        title: 'Mass Assignment',
        description: 'Test for unprotected model binding',
        tips: [
          'Add extra parameters: isAdmin, role, balance',
          'Check for hidden fields in forms',
          'Test API endpoints for extra params',
          'Look for privilege escalation via assignment',
        ],
      },
      {
        id: 'server-10',
        title: 'Server-Side Prototype Pollution',
        description: 'Test for prototype pollution in Node.js',
        tips: [
          'Try: {"__proto__": {"admin": true}}',
          'Check for RCE via prototype pollution',
          'Test in JSON merge operations',
          'Look for DoS via pollution',
        ],
      },
    ],
  },
  // SECTION 8: API SECURITY
  {
    id: 'api',
    title: '8. API Security Testing',
    icon: Code,
    color: 'text-indigo-400',
    items: [
      {
        id: 'api-1',
        title: 'API Authentication Testing',
        description: 'Test API authentication mechanisms',
        tips: [
          'Check for missing authentication on endpoints',
          'Test API key security and rotation',
          'Look for authentication bypass via headers',
          'Check for token leakage in logs/errors',
        ],
      },
      {
        id: 'api-2',
        title: 'API Rate Limiting',
        description: 'Test for rate limiting and DoS protection',
        tips: [
          'Check for rate limits on sensitive endpoints',
          'Test rate limit bypass via headers',
          'Look for resource exhaustion attacks',
          'Check for different limits per endpoint',
        ],
      },
      {
        id: 'api-3',
        title: 'API Versioning Issues',
        description: 'Test for vulnerabilities in API versions',
        tips: [
          'Check if old API versions are still active',
          'Test for security fixes missing in old versions',
          'Look for version bypass techniques',
          'Check for inconsistent behavior across versions',
        ],
      },
      {
        id: 'api-4',
        title: 'Excessive Data Exposure',
        description: 'Check for sensitive data in API responses',
        tips: [
          'Look for PII, passwords, tokens in responses',
          'Check for verbose error messages',
          'Test for data leakage in debug mode',
          'Look for internal IDs and metadata',
        ],
      },
      {
        id: 'api-5',
        title: 'Broken Function Level Authorization',
        description: 'Test API endpoint authorization',
        tips: [
          'Access admin APIs as regular user',
          'Test DELETE/PUT on read-only resources',
          'Check for hidden admin endpoints',
          'Look for authorization bypass via method change',
        ],
      },
      {
        id: 'api-6',
        title: 'GraphQL Security',
        description: 'Test GraphQL-specific vulnerabilities',
        tips: [
          'Check introspection: {__schema{types{name}}}',
          'Test for batching attacks',
          'Look for nested query DoS',
          'Check for field-level authorization',
        ],
      },
      {
        id: 'api-7',
        title: 'REST API Security',
        description: 'Test REST API implementation',
        tips: [
          'Check for proper HTTP method usage',
          'Test for HATEOAS abuse',
          'Look for mass assignment in PUT/PATCH',
          'Check for filter/sort injection',
        ],
      },
      {
        id: 'api-8',
        title: 'API Documentation Exposure',
        description: 'Check for exposed API documentation',
        tips: [
          'Look for /swagger, /api-docs, /openapi.json',
          'Check for internal endpoints in docs',
          'Test documented vs undocumented endpoints',
          'Look for sensitive info in examples',
        ],
      },
    ],
  },
  // SECTION 9: INFRASTRUCTURE & CONFIGURATION
  {
    id: 'infra',
    title: '9. Infrastructure & Configuration',
    icon: Settings,
    color: 'text-gray-400',
    items: [
      {
        id: 'infra-1',
        title: 'Security Headers Analysis',
        description: 'Check for missing or misconfigured security headers',
        tools: ['httpx'],
        tips: [
          'Check: CSP, X-Frame-Options, X-XSS-Protection',
          'Verify HSTS implementation',
          'Look for X-Content-Type-Options: nosniff',
          'Check Referrer-Policy header',
        ],
      },
      {
        id: 'infra-2',
        title: 'SSL/TLS Configuration',
        description: 'Test SSL/TLS implementation',
        tools: ['nmap'],
        tips: [
          'Check for weak ciphers and protocols',
          'Test for SSL/TLS vulnerabilities (POODLE, BEAST)',
          'Verify certificate validity and chain',
          'Check for HSTS preload eligibility',
        ],
      },
      {
        id: 'infra-3',
        title: 'Cookie Security',
        description: 'Analyze cookie attributes and security',
        tips: [
          'Check Secure, HttpOnly, SameSite flags',
          'Look for sensitive data in cookies',
          'Test cookie scope (domain, path)',
          'Check for cookie-based vulnerabilities',
        ],
      },
      {
        id: 'infra-4',
        title: 'Error Handling & Information Disclosure',
        description: 'Test for verbose errors and stack traces',
        tips: [
          'Trigger errors with invalid input',
          'Check for stack traces in responses',
          'Look for database errors with queries',
          'Test for path disclosure in errors',
        ],
      },
      {
        id: 'infra-5',
        title: 'Debug/Admin Interfaces',
        description: 'Find exposed debug and admin interfaces',
        tools: ['ffuf', 'nuclei'],
        tips: [
          'Check for /debug, /trace, /actuator',
          'Look for phpinfo(), server-status',
          'Test for exposed profilers',
          'Check for admin panels without auth',
        ],
      },
      {
        id: 'infra-6',
        title: 'WAF Detection & Bypass',
        description: 'Identify and bypass Web Application Firewalls',
        tools: ['wafw00f'],
        tips: [
          'Identify WAF vendor and version',
          'Test encoding bypass techniques',
          'Try case variation and obfuscation',
          'Check for WAF bypass via headers',
        ],
      },
      {
        id: 'infra-7',
        title: 'Server Misconfiguration',
        description: 'Check for common server misconfigurations',
        tips: [
          'Test for directory listing enabled',
          'Check for default pages and files',
          'Look for backup files exposure',
          'Test for HTTP method tampering',
        ],
      },
      {
        id: 'infra-8',
        title: 'Cloud Misconfiguration',
        description: 'Test for cloud-specific vulnerabilities',
        tips: [
          'Check for exposed S3 buckets',
          'Test for IMDS access (169.254.169.254)',
          'Look for exposed cloud credentials',
          'Check for misconfigured cloud functions',
        ],
      },
      {
        id: 'infra-9',
        title: 'Subdomain Takeover',
        description: 'Check for dangling DNS and subdomain takeover',
        tools: ['httpx', 'nuclei'],
        tips: [
          'Look for NXDOMAIN with CNAME records',
          'Check for unclaimed cloud resources',
          'Test for expired third-party services',
          'Look for GitHub Pages takeover',
        ],
      },
    ],
  },
  // SECTION 10: DATA SECURITY
  {
    id: 'data',
    title: '10. Data Security & Privacy',
    icon: Database,
    color: 'text-emerald-400',
    items: [
      {
        id: 'data-1',
        title: 'Sensitive Data Exposure',
        description: 'Check for exposed sensitive information',
        tips: [
          'Look for PII in responses and logs',
          'Check for credit card data exposure',
          'Test for password visibility in forms',
          'Look for API keys in client-side code',
        ],
      },
      {
        id: 'data-2',
        title: 'Data Encryption',
        description: 'Verify data encryption at rest and in transit',
        tips: [
          'Check for HTTPS enforcement',
          'Look for sensitive data in URLs',
          'Test for encrypted storage of passwords',
          'Check for secure key management',
        ],
      },
      {
        id: 'data-3',
        title: 'Backup File Exposure',
        description: 'Find exposed backup and configuration files',
        tools: ['ffuf', 'dirsearch'],
        tips: [
          'Check for .bak, .old, .zip, .tar.gz files',
          'Look for database dumps (.sql)',
          'Test for config file exposure (.env, web.config)',
          'Check for source code backups',
        ],
      },
      {
        id: 'data-4',
        title: 'Log File Exposure',
        description: 'Check for exposed log files',
        tips: [
          'Look for /logs, /log, /debug.log',
          'Check for access.log, error.log exposure',
          'Test for sensitive data in logs',
          'Look for log injection vulnerabilities',
        ],
      },
      {
        id: 'data-5',
        title: 'Database Exposure',
        description: 'Check for exposed database interfaces',
        tips: [
          'Look for phpMyAdmin, Adminer exposure',
          'Check for MongoDB, Redis without auth',
          'Test for Elasticsearch open access',
          'Look for database backup exposure',
        ],
      },
    ],
  },
  // SECTION 11: MOBILE & THICK CLIENT
  {
    id: 'mobile',
    title: '11. Mobile & Thick Client Testing',
    icon: Smartphone,
    color: 'text-violet-400',
    items: [
      {
        id: 'mobile-1',
        title: 'API Endpoint Analysis',
        description: 'Analyze mobile app API communications',
        tips: [
          'Intercept traffic with Burp/mitmproxy',
          'Look for hardcoded API endpoints',
          'Check for certificate pinning bypass',
          'Test API endpoints found in app',
        ],
      },
      {
        id: 'mobile-2',
        title: 'Local Data Storage',
        description: 'Check for sensitive data stored locally',
        tips: [
          'Check SharedPreferences/NSUserDefaults',
          'Look for SQLite databases with sensitive data',
          'Test for credentials in local storage',
          'Check for sensitive data in cache',
        ],
      },
      {
        id: 'mobile-3',
        title: 'Binary Analysis',
        description: 'Analyze mobile app binary',
        tips: [
          'Decompile APK/IPA for secrets',
          'Look for hardcoded credentials',
          'Check for debug flags enabled',
          'Analyze native libraries',
        ],
      },
      {
        id: 'mobile-4',
        title: 'Deep Link Vulnerabilities',
        description: 'Test deep link and URL scheme handling',
        tips: [
          'Test for deep link hijacking',
          'Check for sensitive actions via deep links',
          'Look for parameter injection',
          'Test for authentication bypass',
        ],
      },
    ],
  },
  // SECTION 12: AUTOMATED SCANNING
  {
    id: 'scanning',
    title: '12. Automated Vulnerability Scanning',
    icon: Zap,
    color: 'text-yellow-400',
    items: [
      {
        id: 'scan-1',
        title: 'Nuclei Template Scanning',
        description: 'Run comprehensive nuclei scans',
        tools: ['nuclei'],
        tips: [
          'Run with -t cves/ for CVE detection',
          'Use -t exposures/ for sensitive files',
          'Check -t takeovers/ for subdomain takeover',
          'Run -t technologies/ for tech detection',
        ],
      },
      {
        id: 'scan-2',
        title: 'CVE & Known Vulnerability Check',
        description: 'Check for known CVEs in detected software',
        tools: ['nuclei', 'nmap'],
        tips: [
          'Match versions to CVE databases',
          'Check for public exploits',
          'Test for recent critical CVEs',
          'Look for unpatched vulnerabilities',
        ],
      },
      {
        id: 'scan-3',
        title: 'CMS-Specific Scanning',
        description: 'Run CMS-specific vulnerability scanners',
        tips: [
          'WordPress: WPScan for plugins/themes',
          'Drupal: Droopescan',
          'Joomla: JoomScan',
          'Check for outdated CMS versions',
        ],
      },
      {
        id: 'scan-4',
        title: 'Secret Detection',
        description: 'Scan for exposed secrets and credentials',
        tools: ['trufflehog', 'gitleaks', 'secretfinder'],
        tips: [
          'Scan JavaScript files for API keys',
          'Check git history for secrets',
          'Look for AWS keys, tokens, passwords',
          'Scan config files for credentials',
        ],
      },
    ],
  },
  // SECTION 13: URL PROCESSING & UTILITIES
  {
    id: 'utils',
    title: '13. URL Processing & Utilities',
    icon: Network,
    color: 'text-teal-400',
    items: [
      {
        id: 'util-1',
        title: 'URL Parsing & Analysis',
        description: 'Extract and analyze URL components',
        tools: ['unfurl'],
        tips: [
          'Extract domains, paths, parameters',
          'Identify unique endpoints',
          'Parse query strings for testing',
          'Extract file extensions',
        ],
      },
      {
        id: 'util-2',
        title: 'Parameter Manipulation',
        description: 'Replace and modify URL parameters',
        tools: ['qsreplace'],
        tips: [
          'Replace values with payloads',
          'Useful for mass testing',
          'Combine with other tools in pipelines',
          'Test parameter pollution',
        ],
      },
      {
        id: 'util-3',
        title: 'Pattern Matching & Filtering',
        description: 'Find interesting patterns in URLs',
        tools: ['gf'],
        tips: [
          'Use patterns for XSS, SQLi, SSRF, LFI',
          'Filter URLs by vulnerability type',
          'Create custom patterns',
          'Prioritize high-value targets',
        ],
      },
      {
        id: 'util-4',
        title: 'URL Deduplication',
        description: 'Remove duplicate and similar URLs',
        tools: ['uro'],
        tips: [
          'Clean up large URL lists',
          'Focus on unique endpoints',
          'Remove redundant parameters',
          'Optimize testing scope',
        ],
      },
    ],
  },
  // SECTION 14: REPORTING & DOCUMENTATION
  {
    id: 'reporting',
    title: '14. Reporting & Documentation',
    icon: FileCode,
    color: 'text-amber-400',
    items: [
      {
        id: 'report-1',
        title: 'Vulnerability Documentation',
        description: 'Document all findings with proper evidence',
        tips: [
          'Include clear reproduction steps',
          'Add screenshots and video POCs',
          'Document impact and severity',
          'Include affected endpoints/parameters',
        ],
      },
      {
        id: 'report-2',
        title: 'Impact Assessment',
        description: 'Assess and document business impact',
        tips: [
          'Describe worst-case scenario',
          'Quantify potential data exposure',
          'Consider compliance implications',
          'Document affected user base',
        ],
      },
      {
        id: 'report-3',
        title: 'Proof of Concept',
        description: 'Create clear and safe POCs',
        tips: [
          'Use benign payloads (alert, console.log)',
          'Avoid accessing real user data',
          'Create reproducible test cases',
          'Include curl commands when possible',
        ],
      },
      {
        id: 'report-4',
        title: 'Remediation Recommendations',
        description: 'Provide actionable fix recommendations',
        tips: [
          'Suggest specific code fixes',
          'Reference security best practices',
          'Include OWASP guidelines',
          'Prioritize fixes by severity',
        ],
      },
      {
        id: 'report-5',
        title: 'Report Submission',
        description: 'Submit report through proper channels',
        tips: [
          'Follow program disclosure guidelines',
          'Use platform-specific templates',
          'Set appropriate severity rating',
          'Be responsive to triager questions',
        ],
      },
    ],
  },
];
