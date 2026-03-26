/**
 * Page Prioritizer
 *
 * Scores and ranks discovered URLs by likely accessibility importance.
 */
import type { PrioritizedPage, SitemapEntry } from '../types.js';

/** URL patterns and their priority scores + template labels */
const PATTERN_RULES: Array<{
    pattern: RegExp;
    priority: number;
    template: string;
}> = [
    { pattern: /^\/$/, priority: 10, template: 'homepage' },
    { pattern: /\/(login|signin|sign-in)\b/i, priority: 9, template: 'auth' },
    { pattern: /\/(register|signup|sign-up)\b/i, priority: 9, template: 'auth' },
    { pattern: /\/(contact|support|help)\b/i, priority: 8, template: 'form' },
    { pattern: /\/(checkout|cart|payment)\b/i, priority: 8, template: 'form' },
    { pattern: /\/(search)\b/i, priority: 8, template: 'search' },
    { pattern: /\/(dashboard|account|profile|settings)\b/i, priority: 7, template: 'dashboard' },
    { pattern: /\/(about|team|company)\b/i, priority: 6, template: 'content' },
    { pattern: /\/(pricing|plans)\b/i, priority: 6, template: 'content' },
    { pattern: /\/(faq|docs|documentation)\b/i, priority: 5, template: 'content' },
    { pattern: /\/(blog|news|articles)\/?$/i, priority: 5, template: 'listing' },
    { pattern: /\/(blog|news|articles)\/.+/i, priority: 3, template: 'article' },
    { pattern: /\/page\/\d+/i, priority: 1, template: 'pagination' },
    { pattern: /[?&](page|p)=\d+/i, priority: 1, template: 'pagination' },
    { pattern: /\/(tag|category|archive)\//i, priority: 2, template: 'taxonomy' },
];

/**
 * Prioritize a list of URLs, optionally using sitemap metadata.
 */
export function prioritizePages(
    urls: string[],
    sitemapEntries?: SitemapEntry[],
    maxPages?: number
): PrioritizedPage[] {
    const sitemapMap = new Map<string, SitemapEntry>();
    if (sitemapEntries) {
        for (const entry of sitemapEntries) {
            sitemapMap.set(normalizeUrl(entry.url), entry);
        }
    }

    const scored: PrioritizedPage[] = urls.map((url) => {
        const path = new URL(url).pathname;
        const sitemapEntry = sitemapMap.get(normalizeUrl(url));

        // Find matching pattern
        let priority = 4; // default
        let template = 'page';
        let reason = 'default priority';

        for (const rule of PATTERN_RULES) {
            if (rule.pattern.test(path)) {
                priority = rule.priority;
                template = rule.template;
                reason = `matches ${rule.template} pattern`;
                break;
            }
        }

        // Boost from sitemap priority
        if (sitemapEntry?.priority) {
            priority = Math.max(priority, Math.round(sitemapEntry.priority * 10));
            reason += `, sitemap priority: ${sitemapEntry.priority}`;
        }

        return { url, priority, reason, template };
    });

    // Sort by priority descending, then deduplicate by template (prefer diversity)
    scored.sort((a, b) => b.priority - a.priority);

    if (maxPages && scored.length > maxPages) {
        // Ensure template diversity: take the top from each template first
        const byTemplate = new Map<string, PrioritizedPage[]>();
        for (const page of scored) {
            const list = byTemplate.get(page.template) || [];
            list.push(page);
            byTemplate.set(page.template, list);
        }

        const selected: PrioritizedPage[] = [];
        // First pass: one from each template
        for (const pages of byTemplate.values()) {
            if (selected.length < maxPages) {
                selected.push(pages[0]);
            }
        }
        // Second pass: fill remaining by priority
        for (const page of scored) {
            if (selected.length >= maxPages) break;
            if (!selected.includes(page)) {
                selected.push(page);
            }
        }
        return selected;
    }

    return scored;
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
