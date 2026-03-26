/**
 * Sitemap Parser
 *
 * Fetches and parses robots.txt and XML sitemaps to discover pages.
 */
import type { SitemapEntry } from '../types.js';

/**
 * Discover pages from a site's sitemap.xml and robots.txt
 */
export async function parseSitemap(baseUrl: string): Promise<SitemapEntry[]> {
    const origin = new URL(baseUrl).origin;
    const entries: SitemapEntry[] = [];

    // 1. Try to find sitemap URLs from robots.txt
    const sitemapUrls = await findSitemapUrls(origin);

    // 2. If no sitemaps found, try common locations
    if (sitemapUrls.length === 0) {
        sitemapUrls.push(`${origin}/sitemap.xml`);
    }

    // 3. Fetch and parse each sitemap
    for (const sitemapUrl of sitemapUrls) {
        const sitemapEntries = await fetchSitemap(sitemapUrl);
        entries.push(...sitemapEntries);
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    return entries.filter((entry) => {
        if (seen.has(entry.url)) return false;
        seen.add(entry.url);
        return true;
    });
}

async function findSitemapUrls(origin: string): Promise<string[]> {
    try {
        const resp = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) return [];
        const text = await resp.text();
        const urls: string[] = [];
        for (const line of text.split('\n')) {
            const match = line.match(/^Sitemap:\s*(.+)$/i);
            if (match) {
                urls.push(match[1].trim());
            }
        }
        return urls;
    } catch {
        return [];
    }
}

async function fetchSitemap(url: string): Promise<SitemapEntry[]> {
    try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) return [];
        const xml = await resp.text();

        // Check if it's a sitemap index
        if (xml.includes('<sitemapindex')) {
            return parseSitemapIndex(xml);
        }

        return parseSitemapXml(xml);
    } catch {
        return [];
    }
}

function parseSitemapXml(xml: string): SitemapEntry[] {
    const entries: SitemapEntry[] = [];
    // Simple regex-based XML parsing (avoids heavy XML dependency)
    const urlRegex = /<url>([\s\S]*?)<\/url>/gi;
    let match;
    while ((match = urlRegex.exec(xml)) !== null) {
        const block = match[1];
        const loc = extractTag(block, 'loc');
        if (!loc) continue;
        entries.push({
            url: loc,
            lastmod: extractTag(block, 'lastmod') || undefined,
            priority: parseFloat(extractTag(block, 'priority') || '') || undefined,
            changefreq: extractTag(block, 'changefreq') || undefined,
        });
    }
    return entries;
}

async function parseSitemapIndex(xml: string): Promise<SitemapEntry[]> {
    const entries: SitemapEntry[] = [];
    const locRegex = /<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/gi;
    let match;
    const childUrls: string[] = [];
    while ((match = locRegex.exec(xml)) !== null) {
        childUrls.push(match[1].trim());
    }
    // Fetch child sitemaps (limit to 5 to avoid overload)
    for (const childUrl of childUrls.slice(0, 5)) {
        const childEntries = await fetchSitemap(childUrl);
        entries.push(...childEntries);
    }
    return entries;
}

function extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
}
