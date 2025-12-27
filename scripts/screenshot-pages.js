const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUTPUT_DIR = path.join(__dirname, 'screenshots');

// Login credentials - set via environment variables
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || 'admin@example.com';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';

// All pages to screenshot
const PAGES = [
  // Public pages
  { path: '/', name: 'home', requiresAuth: false },
  { path: '/login', name: 'login', requiresAuth: false },
  { path: '/register', name: 'register', requiresAuth: false },
  
  // Dashboard pages (require auth)
  { path: '/dashboard', name: 'dashboard', requiresAuth: true },
  { path: '/dashboard/alerts', name: 'dashboard-alerts', requiresAuth: true },
  { path: '/dashboard/cron', name: 'dashboard-cron', requiresAuth: true },
  { path: '/dashboard/dns-brute', name: 'dashboard-dns-brute', requiresAuth: true },
  { path: '/dashboard/domains', name: 'dashboard-domains', requiresAuth: true },
  { path: '/dashboard/fuzzing', name: 'dashboard-fuzzing', requiresAuth: true },
  { path: '/dashboard/hexstrike', name: 'dashboard-hexstrike', requiresAuth: true },
  { path: '/dashboard/programs', name: 'dashboard-programs', requiresAuth: true },
  { path: '/dashboard/reports', name: 'dashboard-reports', requiresAuth: true },
  { path: '/dashboard/scans', name: 'dashboard-scans', requiresAuth: true },
  { path: '/dashboard/scores', name: 'dashboard-scores', requiresAuth: true },
  { path: '/dashboard/settings', name: 'dashboard-settings', requiresAuth: true },
  { path: '/dashboard/subdomains', name: 'dashboard-subdomains', requiresAuth: true },
  { path: '/dashboard/tools', name: 'dashboard-tools', requiresAuth: true },
  { path: '/dashboard/vulnerabilities', name: 'dashboard-vulnerabilities', requiresAuth: true },
  { path: '/dashboard/xss-encodings', name: 'dashboard-xss-encodings', requiresAuth: true },
];

async function login(page) {
  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    console.log('⚠️  No login credentials provided. Dashboard pages may show login screen.');
    console.log('   Set LOGIN_EMAIL and LOGIN_PASSWORD environment variables.\n');
    return false;
  }

  console.log('🔐 Logging in...');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
    
    // Fill in credentials
    await page.type('input[type="email"], input[name="email"]', LOGIN_EMAIL);
    await page.type('input[type="password"], input[name="password"]', LOGIN_PASSWORD);
    
    // Submit form
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    ]);
    
    // Check if login was successful (should redirect away from login page)
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      console.log('   ✅ Login successful!\n');
      return true;
    } else {
      console.log('   ❌ Login failed - still on login page\n');
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Login failed: ${error.message}\n`);
    return false;
  }
}

async function screenshotPage(page, pageInfo) {
  const url = `${BASE_URL}${pageInfo.path}`;
  const filename = `${pageInfo.name}.png`;
  const filepath = path.join(OUTPUT_DIR, filename);

  try {
    console.log(`📸 ${pageInfo.name}: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for page to stabilize
    await new Promise(r => setTimeout(r, 2000));
    
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`   ✅ Saved: ${filename}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

async function screenshotAllPages() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Login first for authenticated pages
  const isLoggedIn = await login(page);

  const publicPages = PAGES.filter(p => !p.requiresAuth);
  const authPages = PAGES.filter(p => p.requiresAuth);

  console.log(`\nScreenshotting ${publicPages.length} public pages...\n`);
  for (const pageInfo of publicPages) {
    await screenshotPage(page, pageInfo);
  }

  console.log(`\nScreenshotting ${authPages.length} dashboard pages...\n`);
  for (const pageInfo of authPages) {
    await screenshotPage(page, pageInfo);
  }

  await browser.close();
  console.log(`\n✨ Screenshots saved to: ${OUTPUT_DIR}`);
}

screenshotAllPages().catch(console.error);
