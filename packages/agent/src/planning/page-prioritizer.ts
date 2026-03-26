/**
 * Page Deduplication & Normalization
 *
 * Deduplicates and normalizes discovered URLs. Prioritization is handled
 * by the LLM agent, which has richer context about the site.
 */
import type { DiscoveredPage, SitemapEntry } from '../types.js';

/**
 * Deduplicate and normalize a list of URLs, attaching sitemap metadata where available.
 */
export function deduplicatePages(
    urls: string[],
    sitemapEntries?: SitemapEntry[],
    maxPages?: number
): DiscoveredPage[] {
    const sitemapMap = new Map<string, SitemapEntry>();
    if (sitemapEntries) {
        for (const entry of sitemapEntries) {
            sitemapMap.set(normalizeUrl(entry.url), entry);
        }
    }

    const seen = new Set<string>();
    const pages: DiscoveredPage[] = [];

    for (const url of urls) {
        const normalized = normalizeUrl(url);
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        const sitemapEntry = sitemapMap.get(normalized);
        const page: DiscoveredPage = { url };
        if (sitemapEntry?.priority) page.sitemapPriority = sitemapEntry.priority;
        if (sitemapEntry?.lastmod) page.lastmod = sitemapEntry.lastmod;
        pages.push(page);
    }

    if (maxPages && pages.length > maxPages) {
        return pages.slice(0, maxPages);
    }

    return pages;
}

function normalizeUrl(url: string): string {
    try {
        const u = new URL(url);
        u.hash = '';
        return u.toString().replace(/\/$/, '');
    } catch {
        return url;
    }
}
