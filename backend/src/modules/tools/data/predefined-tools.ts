import { ToolCategory } from '../../../schemas/tool.schema';

/**
 * Installation method types
 */
export type InstallMethod = 'go' | 'pip' | 'apt' | 'brew' | 'cargo' | 'npm' | 'git' | 'manual';

/**
 * Installation command for a specific method
 */
export interface InstallCommand {
  method: InstallMethod;
  command: string;
  // Some tools need post-install steps
  postInstall?: string;
}

/**
 * Predefined tool data structure for bulk import
 */
export interface PredefinedTool {
  name: string;
  displayName: string;
  description: string;
  githubUrl: string;
  categories: ToolCategory[];
  binaryName: string;
  installCommands?: InstallCommand[];
  /** Docker container name for containerized tools (e.g., 'bb-katana') */
  containerName?: string;
}

/**
 * Predefined list of security tools for bulk import
 * Requirements: 7.1
 * 
 * This list contains 26 well-known security reconnaissance and scanning tools
 * that are commonly used in bug bounty and security research workflows.
 */
export const PREDEFINED_TOOLS: PredefinedTool[] = [
  {
    name: 'sqlmap',
    displayName: 'SQLMap',
    description: 'Automatic SQL injection and database takeover tool',
    githubUrl: 'https://github.com/sqlmapproject/sqlmap',
    categories: [ToolCategory.EXPLOITATION],
    binaryName: 'sqlmap',
    installCommands: [
      { method: 'pip', command: 'pip install --break-system-packages sqlmap' },
      { method: 'apt', command: 'sudo apt install -y sqlmap' },
      { method: 'brew', command: 'brew install sqlmap' },
      { method: 'git', command: 'git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git /opt/sqlmap && ln -sf /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap' },
    ],
  },
  {
    name: 'whois',
    displayName: 'Whois',
    description: 'Domain registration information lookup tool',
    githubUrl: 'https://github.com/rfc1036/whois',
    categories: [ToolCategory.OSINT],
    binaryName: 'whois',
    installCommands: [
      { method: 'apt', command: 'sudo apt install -y whois' },
      { method: 'brew', command: 'brew install whois' },
    ],
  },
  {
    name: 'httpx',
    displayName: 'httpx',
    description: 'Fast and multi-purpose HTTP toolkit for probing web servers',
    githubUrl: 'https://github.com/projectdiscovery/httpx',
    categories: [ToolCategory.HTTP_PROBING],
    binaryName: 'httpx',
    containerName: 'bb-httpx',
    installCommands: [
      { method: 'go', command: 'go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest' },
      { method: 'brew', command: 'brew install httpx' },
      { method: 'apt', command: 'sudo apt install -y httpx-toolkit' },
    ],
  },
  {
    name: 'dirsearch',
    displayName: 'Dirsearch',
    description: 'Web path scanner for discovering hidden directories and files',
    githubUrl: 'https://github.com/maurosoria/dirsearch',
    categories: [ToolCategory.DIRECTORY_FUZZING],
    binaryName: 'dirsearch',
    installCommands: [
      { method: 'pip', command: 'pip install --break-system-packages dirsearch' },
      { method: 'apt', command: 'sudo apt install -y dirsearch' },
      { method: 'git', command: 'git clone https://github.com/maurosoria/dirsearch.git /opt/dirsearch && ln -sf /opt/dirsearch/dirsearch.py /usr/local/bin/dirsearch' },
    ],
  },
  {
    name: 'katana',
    displayName: 'Katana',
    description: 'Next-generation crawling and spidering framework',
    githubUrl: 'https://github.com/projectdiscovery/katana',
    categories: [ToolCategory.WEB_CRAWLING, ToolCategory.URL_DISCOVERY],
    binaryName: 'katana',
    containerName: 'bb-katana',
    installCommands: [
      { method: 'go', command: 'go install github.com/projectdiscovery/katana/cmd/katana@latest' },
      { method: 'brew', command: 'brew install katana' },
    ],
  },
  {
    name: 'subfinder',
    displayName: 'Subfinder',
    description: 'Fast passive subdomain enumeration tool',
    githubUrl: 'https://github.com/projectdiscovery/subfinder',
    categories: [ToolCategory.SUBDOMAIN_ENUMERATION],
    binaryName: 'subfinder',
    containerName: 'bb-subfinder',
    installCommands: [
      { method: 'go', command: 'go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest' },
      { method: 'brew', command: 'brew install subfinder' },
      { method: 'apt', command: 'sudo apt install -y subfinder' },
    ],
  },
  {
    name: 'waybackurls',
    displayName: 'Waybackurls',
    description: 'Fetch URLs from the Wayback Machine for a domain',
    githubUrl: 'https://github.com/tomnomnom/waybackurls',
    categories: [ToolCategory.URL_DISCOVERY],
    binaryName: 'waybackurls',
    installCommands: [
      { method: 'go', command: 'go install github.com/tomnomnom/waybackurls@latest' },
    ],
  },
  {
    name: 'trufflehog',
    displayName: 'TruffleHog',
    description: 'Find and verify credentials in git repositories and other sources',
    githubUrl: 'https://github.com/trufflesecurity/trufflehog',
    categories: [ToolCategory.SECRET_DETECTION],
    binaryName: 'trufflehog',
    installCommands: [
      { method: 'brew', command: 'brew install trufflehog' },
      { method: 'pip', command: 'pip install --break-system-packages trufflehog' },
      { method: 'go', command: 'go install github.com/trufflesecurity/trufflehog/v3@latest' },
    ],
  },
  {
    name: 'nmap',
    displayName: 'Nmap',
    description: 'Network exploration and security auditing tool',
    githubUrl: 'https://github.com/nmap/nmap',
    categories: [ToolCategory.PORT_SCANNING],
    binaryName: 'nmap',
    installCommands: [
      { method: 'apt', command: 'sudo apt install -y nmap' },
      { method: 'brew', command: 'brew install nmap' },
    ],
  },
  {
    name: 'amass',
    displayName: 'Amass',
    description: 'In-depth attack surface mapping and asset discovery',
    githubUrl: 'https://github.com/owasp-amass/amass',
    categories: [ToolCategory.SUBDOMAIN_ENUMERATION, ToolCategory.OSINT],
    binaryName: 'amass',
    installCommands: [
      { method: 'go', command: 'go install -v github.com/owasp-amass/amass/v4/...@master' },
      { method: 'brew', command: 'brew install amass' },
      { method: 'apt', command: 'sudo apt install -y amass' },
    ],
  },
  {
    name: 'findomain',
    displayName: 'Findomain',
    description: 'Fast subdomain enumeration tool with multiple sources',
    githubUrl: 'https://github.com/Findomain/Findomain',
    categories: [ToolCategory.SUBDOMAIN_ENUMERATION],
    binaryName: 'findomain',
    installCommands: [
      { method: 'cargo', command: 'cargo install findomain' },
      { method: 'brew', command: 'brew install findomain' },
    ],
  },
  {
    name: 'dnsx',
    displayName: 'dnsx',
    description: 'Fast and multi-purpose DNS toolkit for running DNS queries',
    githubUrl: 'https://github.com/projectdiscovery/dnsx',
    categories: [ToolCategory.DNS_TOOLS],
    binaryName: 'dnsx',
    installCommands: [
      { method: 'go', command: 'go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest' },
      { method: 'brew', command: 'brew install dnsx' },
    ],
  },
  {
    name: 'shuffledns',
    displayName: 'ShuffleDNS',
    description: 'Wrapper around massdns for active bruteforcing and resolution',
    githubUrl: 'https://github.com/projectdiscovery/shuffledns',
    categories: [ToolCategory.DNS_TOOLS, ToolCategory.SUBDOMAIN_ENUMERATION],
    binaryName: 'shuffledns',
    installCommands: [
      { method: 'go', command: 'go install -v github.com/projectdiscovery/shuffledns/cmd/shuffledns@latest' },
    ],
  },
  {
    name: 'gau',
    displayName: 'GAU',
    description: 'Fetch known URLs from AlienVault OTX, Wayback Machine, and Common Crawl',
    githubUrl: 'https://github.com/lc/gau',
    categories: [ToolCategory.URL_DISCOVERY],
    binaryName: 'gau',
    installCommands: [
      { method: 'go', command: 'go install github.com/lc/gau/v2/cmd/gau@latest' },
    ],
  },
  {
    name: 'hakrawler',
    displayName: 'Hakrawler',
    description: 'Simple and fast web crawler for discovering endpoints and assets',
    githubUrl: 'https://github.com/hakluke/hakrawler',
    categories: [ToolCategory.WEB_CRAWLING],
    binaryName: 'hakrawler',
    installCommands: [
      { method: 'go', command: 'go install github.com/hakluke/hakrawler@latest' },
    ],
  },
  {
    name: 'urlfinder',
    displayName: 'URLFinder',
    description: 'High-speed passive URL discovery tool',
    githubUrl: 'https://github.com/projectdiscovery/urlfinder',
    categories: [ToolCategory.URL_DISCOVERY, ToolCategory.JAVASCRIPT_ANALYSIS],
    binaryName: 'urlfinder',
    installCommands: [
      { method: 'go', command: 'go install -v github.com/projectdiscovery/urlfinder/cmd/urlfinder@latest' },
    ],
  },
  {
    name: 'ffuf',
    displayName: 'ffuf',
    description: 'Fast web fuzzer written in Go',
    githubUrl: 'https://github.com/ffuf/ffuf',
    categories: [ToolCategory.DIRECTORY_FUZZING, ToolCategory.PARAMETER_DISCOVERY],
    binaryName: 'ffuf',
    installCommands: [
      { method: 'go', command: 'go install github.com/ffuf/ffuf/v2@latest' },
      { method: 'brew', command: 'brew install ffuf' },
      { method: 'apt', command: 'sudo apt install -y ffuf' },
    ],
  },
  {
    name: 'feroxbuster',
    displayName: 'Feroxbuster',
    description: 'Fast, simple, recursive content discovery tool',
    githubUrl: 'https://github.com/epi052/feroxbuster',
    categories: [ToolCategory.DIRECTORY_FUZZING],
    binaryName: 'feroxbuster',
    installCommands: [
      { method: 'cargo', command: 'cargo install feroxbuster' },
      { method: 'brew', command: 'brew install feroxbuster' },
      { method: 'apt', command: 'sudo apt install -y feroxbuster' },
    ],
  },
  {
    name: 'arjun',
    displayName: 'Arjun',
    description: 'HTTP parameter discovery suite',
    githubUrl: 'https://github.com/s0md3v/Arjun',
    categories: [ToolCategory.PARAMETER_DISCOVERY],
    binaryName: 'arjun',
    installCommands: [
      { method: 'pip', command: 'pip install --break-system-packages arjun' },
    ],
  },
  {
    name: 'linkfinder',
    displayName: 'LinkFinder',
    description: 'Python script to find endpoints in JavaScript files',
    githubUrl: 'https://github.com/GerbenJavado/LinkFinder',
    categories: [ToolCategory.JAVASCRIPT_ANALYSIS, ToolCategory.URL_DISCOVERY],
    binaryName: 'linkfinder',
    installCommands: [
      { method: 'pip', command: 'pip install --break-system-packages linkfinder' },
      { method: 'git', command: 'git clone https://github.com/GerbenJavado/LinkFinder.git /opt/linkfinder && cd /opt/linkfinder && pip install --break-system-packages -r requirements.txt && ln -sf /opt/linkfinder/linkfinder.py /usr/local/bin/linkfinder' },
    ],
  },
  {
    name: 'secretfinder',
    displayName: 'SecretFinder',
    description: 'Python script to find sensitive data in JavaScript files',
    githubUrl: 'https://github.com/m4ll0k/SecretFinder',
    categories: [ToolCategory.SECRET_DETECTION, ToolCategory.JAVASCRIPT_ANALYSIS],
    binaryName: 'secretfinder',
    installCommands: [
      { method: 'git', command: 'git clone https://github.com/m4ll0k/SecretFinder.git /opt/secretfinder && cd /opt/secretfinder && pip install --break-system-packages -r requirements.txt && ln -sf /opt/secretfinder/SecretFinder.py /usr/local/bin/secretfinder' },
    ],
  },



  {
    name: 'assetfinder',
    displayName: 'Assetfinder',
    description: 'Find domains and subdomains related to a given domain',
    githubUrl: 'https://github.com/tomnomnom/assetfinder',
    categories: [ToolCategory.SUBDOMAIN_ENUMERATION],
    binaryName: 'assetfinder',
    installCommands: [
      { method: 'go', command: 'go install github.com/tomnomnom/assetfinder@latest' },
    ],
  },
  {
    name: 'nuclei',
    displayName: 'Nuclei',
    description: 'Fast and customizable vulnerability scanner based on templates',
    githubUrl: 'https://github.com/projectdiscovery/nuclei',
    categories: [ToolCategory.VULNERABILITY_SCANNING],
    binaryName: 'nuclei',
    containerName: 'bb-nuclei',
    installCommands: [
      { method: 'go', command: 'go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest' },
      { method: 'brew', command: 'brew install nuclei' },
      { method: 'apt', command: 'sudo apt install -y nuclei' },
    ],
  },
  {
    name: 'wafw00f',
    displayName: 'wafw00f',
    description: 'Web Application Firewall fingerprinting tool',
    githubUrl: 'https://github.com/EnableSecurity/wafw00f',
    categories: [ToolCategory.WAF_DETECTION],
    binaryName: 'wafw00f',
    installCommands: [
      { method: 'pip', command: 'pip install --break-system-packages wafw00f' },
      { method: 'apt', command: 'sudo apt install -y wafw00f' },
    ],
  },

  // ============================================
  // PARAMETER DISCOVERY TOOLS
  // ============================================
  {
    name: 'paramspider',
    displayName: 'ParamSpider',
    description: 'Mining parameters from dark corners of Web Archives for bug hunting',
    githubUrl: 'https://github.com/devanshbatham/ParamSpider',
    categories: [ToolCategory.PARAMETER_DISCOVERY, ToolCategory.URL_DISCOVERY],
    binaryName: 'paramspider',
    installCommands: [
      { method: 'pip', command: 'pip install --break-system-packages paramspider' },
      { method: 'git', command: 'git clone https://github.com/devanshbatham/ParamSpider.git /opt/paramspider && cd /opt/paramspider && pip install --break-system-packages .' },
    ],
  },
  {
    name: 'x8',
    displayName: 'x8',
    description: 'Hidden parameters discovery suite - finds hidden GET/POST parameters',
    githubUrl: 'https://github.com/Sh1Yo/x8',
    categories: [ToolCategory.PARAMETER_DISCOVERY],
    binaryName: 'x8',
    installCommands: [
      { method: 'cargo', command: 'cargo install x8' },
      { method: 'git', command: 'git clone https://github.com/Sh1Yo/x8.git /opt/x8 && cd /opt/x8 && cargo build --release && cp target/release/x8 /usr/local/bin/' },
    ],
  },
  {
    name: 'unfurl',
    displayName: 'Unfurl',
    description: 'Pull out bits of URLs provided on stdin - extract params, paths, etc',
    githubUrl: 'https://github.com/tomnomnom/unfurl',
    categories: [ToolCategory.PARAMETER_DISCOVERY, ToolCategory.URL_DISCOVERY],
    binaryName: 'unfurl',
    installCommands: [
      { method: 'go', command: 'go install github.com/tomnomnom/unfurl@latest' },
    ],
  },
  {
    name: 'qsreplace',
    displayName: 'qsreplace',
    description: 'Accept URLs on stdin, replace all query string values with a user-supplied value',
    githubUrl: 'https://github.com/tomnomnom/qsreplace',
    categories: [ToolCategory.PARAMETER_DISCOVERY],
    binaryName: 'qsreplace',
    installCommands: [
      { method: 'go', command: 'go install github.com/tomnomnom/qsreplace@latest' },
    ],
  },
  {
    name: 'gf',
    displayName: 'gf',
    description: 'A wrapper around grep to avoid typing common patterns - great for finding params',
    githubUrl: 'https://github.com/tomnomnom/gf',
    categories: [ToolCategory.PARAMETER_DISCOVERY, ToolCategory.URL_DISCOVERY],
    binaryName: 'gf',
    installCommands: [
      { method: 'go', command: 'go install github.com/tomnomnom/gf@latest' },
    ],
  },
  {
    name: 'uro',
    displayName: 'uro',
    description: 'Declutters URL lists for crawling/pentesting - removes duplicates with different params',
    githubUrl: 'https://github.com/s0md3v/uro',
    categories: [ToolCategory.PARAMETER_DISCOVERY, ToolCategory.URL_DISCOVERY],
    binaryName: 'uro',
    installCommands: [
      { method: 'pip', command: 'pip install --break-system-packages uro' },
    ],
  },
  {
    name: 'gospider',
    displayName: 'GoSpider',
    description: 'Fast web spider written in Go - extracts URLs, params, and endpoints',
    githubUrl: 'https://github.com/jaeles-project/gospider',
    categories: [ToolCategory.WEB_CRAWLING, ToolCategory.PARAMETER_DISCOVERY, ToolCategory.URL_DISCOVERY],
    binaryName: 'gospider',
    installCommands: [
      { method: 'go', command: 'go install github.com/jaeles-project/gospider@latest' },
    ],
  },
  {
    name: 'cariddi',
    displayName: 'Cariddi',
    description: 'Take a list of domains, crawl URLs and scan for endpoints, secrets, api keys, etc',
    githubUrl: 'https://github.com/edoardottt/cariddi',
    categories: [ToolCategory.WEB_CRAWLING, ToolCategory.PARAMETER_DISCOVERY, ToolCategory.SECRET_DETECTION],
    binaryName: 'cariddi',
    installCommands: [
      { method: 'go', command: 'go install github.com/edoardottt/cariddi/cmd/cariddi@latest' },
    ],
  },
  {
    name: 'xnlinkfinder',
    displayName: 'xnLinkFinder',
    description: 'Discover endpoints, parameters, and potential vulnerabilities from URLs',
    githubUrl: 'https://github.com/xnl-h4ck3r/xnLinkFinder',
    categories: [ToolCategory.PARAMETER_DISCOVERY, ToolCategory.URL_DISCOVERY, ToolCategory.JAVASCRIPT_ANALYSIS],
    binaryName: 'xnLinkFinder',
    installCommands: [
      { method: 'pip', command: 'pip install --break-system-packages xnLinkFinder' },
    ],
  },
  {
    name: 'waymore',
    displayName: 'Waymore',
    description: 'Find way more from the Wayback Machine - extracts URLs with params from archives',
    githubUrl: 'https://github.com/xnl-h4ck3r/waymore',
    categories: [ToolCategory.URL_DISCOVERY, ToolCategory.PARAMETER_DISCOVERY],
    binaryName: 'waymore',
    installCommands: [
      { method: 'pip', command: 'pip install --break-system-packages waymore' },
    ],
  },

];
