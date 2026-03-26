/**
 * Link Discoverer
 *
 * Uses Playwright to load a page and extract all internal links.
 * Falls back to this when no sitemap is available.
 */
import { runScanAsPromise, AppLayer } from '@aria51/core';
import type { BrowserType } from '@aria51/core';

export interface LinkDiscoveryOptions {
    browser: BrowserType;
    headless: boolean;
    maxDepth?: number;
}

/**
 * Discover internal links from a page by loading it in a browser
 * and extracting all anchor hrefs.
 */
export async function discoverLinks(
    baseUrl: string,
    options: LinkDiscoveryOptions
): Promise<string[]> {
    const origin = new URL(baseUrl).origin;

    try {
        // We use a lightweight approach: import playwright dynamically
        // and just extract links, rather than running a full scan
        const { chromium, firefox, webkit } = await import('playwright');
        const browsers = { chromium, firefox, webkit };
        const browserType = browsers[options.browser] || chromium;

        const browser = await browserType.launch({ headless: options.headless });
        const page = await browser.newPage();

        try {
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // Extract all anchor hrefs
            const hrefs = await page.evaluate(() => {
                const anchors = document.querySelectorAll('a[href]');
                return Array.from(anchors).map((a) => (a as HTMLAnchorElement).href);
            });

            // Filter to same-origin internal links
            const internalLinks = hrefs
                .filter((href) => {
                    try {
                        const url = new URL(href);
                        return url.origin === origin;
                    } catch {
                        return false;
                    }
                })
                .map((href) => {
                    // Normalize: strip hash and trailing slash
                    const url = new URL(href);
                    url.hash = '';
                    return url.toString().replace(/\/$/, '');
                });

            // Deduplicate
            return [...new Set(internalLinks)];
        } finally {
            await browser.close();
        }
    } catch (error) {
        // If browser-based discovery fails, return just the base URL
        return [baseUrl];
    }
}
