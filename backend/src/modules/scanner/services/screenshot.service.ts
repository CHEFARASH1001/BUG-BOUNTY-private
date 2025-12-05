import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ScreenshotService {
  private browser: puppeteer.Browser | null = null;

  /**
   * Get or create browser instance
   */
  private async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });
    }
    return this.browser;
  }

  /**
   * Capture screenshot of a URL
   */
  async capture(url: string, outputPath?: string): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      // Navigate with timeout
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait a bit for dynamic content
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Generate output path if not provided
      const finalPath = outputPath || path.join('/app/results/screenshots', `${uuidv4()}.png`);

      // Ensure directory exists
      await fs.mkdir(path.dirname(finalPath), { recursive: true });

      // Take screenshot
      await page.screenshot({
        path: finalPath,
        fullPage: false,
        type: 'png',
      });

      return finalPath;
    } finally {
      await page.close();
    }
  }

  /**
   * Capture screenshots for multiple URLs
   */
  async captureBatch(
    urls: string[],
    outputDir: string,
    concurrency = 5,
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Process in batches
    const chunks = this.chunkArray(urls, concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(async (url) => {
        try {
          const filename = this.urlToFilename(url);
          const outputPath = path.join(outputDir, filename);
          const result = await this.capture(url, outputPath);
          return { url, path: result };
        } catch (error) {
          console.error(`Screenshot error for ${url}:`, error);
          return { url, path: null };
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ url, path }) => {
        if (path) {
          results.set(url, path);
        }
      });
    }

    return results;
  }

  /**
   * Generate thumbnail from screenshot
   */
  async generateThumbnail(
    screenshotPath: string,
    thumbnailPath: string,
    width = 400,
  ): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Read original image and resize
      const sharp = require('sharp');
      await sharp(screenshotPath)
        .resize(width)
        .png({ quality: 80 })
        .toFile(thumbnailPath);

      return thumbnailPath;
    } finally {
      await page.close();
    }
  }

  /**
   * Capture screenshot with JavaScript disabled
   */
  async captureWithoutJs(url: string, outputPath?: string): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setJavaScriptEnabled(false);
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const finalPath = outputPath || path.join('/app/results/screenshots', `${uuidv4()}-nojs.png`);
      await fs.mkdir(path.dirname(finalPath), { recursive: true });

      await page.screenshot({
        path: finalPath,
        fullPage: false,
        type: 'png',
      });

      return finalPath;
    } finally {
      await page.close();
    }
  }

  /**
   * Get page info along with screenshot
   */
  async captureWithInfo(url: string, outputPath?: string): Promise<{
    screenshotPath: string;
    title: string;
    url: string;
    cookies: any[];
    localStorage: Record<string, string>;
    forms: any[];
    links: string[];
  }> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get page info
      const title = await page.title();
      const finalUrl = page.url();
      const cookies = await page.cookies();

      // Get localStorage
      const localStorage = await page.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            items[key] = window.localStorage.getItem(key) || '';
          }
        }
        return items;
      });

      // Get forms
      const forms = await page.evaluate(() => {
        return Array.from(document.forms).map((form) => ({
          action: form.action,
          method: form.method,
          inputs: Array.from(form.elements)
            .filter((el): el is HTMLInputElement => el instanceof HTMLInputElement)
            .map((input) => ({
              name: input.name,
              type: input.type,
              id: input.id,
            })),
        }));
      });

      // Get links
      const links = await page.evaluate(() => {
        return Array.from(document.links).map((link) => link.href).filter(Boolean);
      });

      // Take screenshot
      const finalPath = outputPath || path.join('/app/results/screenshots', `${uuidv4()}.png`);
      await fs.mkdir(path.dirname(finalPath), { recursive: true });

      await page.screenshot({
        path: finalPath,
        fullPage: false,
        type: 'png',
      });

      return {
        screenshotPath: finalPath,
        title,
        url: finalUrl,
        cookies,
        localStorage,
        forms,
        links: [...new Set(links)],
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Convert URL to safe filename
   */
  private urlToFilename(url: string): string {
    try {
      const parsed = new URL(url);
      const safeName = `${parsed.hostname}${parsed.pathname}`
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 100);
      return `${safeName}_${Date.now()}.png`;
    } catch {
      return `${uuidv4()}.png`;
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

