/**
 * plan_crawl Tool
 */
import { z } from 'zod';
import { parseSitemap } from '../planning/sitemap-parser.js';
import { discoverLinks } from '../planning/link-discoverer.js';
import { deduplicatePages } from '../planning/page-prioritizer.js';
import type { AgentToolDef } from '../agent/provider.js';
import type { AuditSession, CrawlPlan } from '../types.js';

export const createCrawlPlannerTool = (session: AuditSession): AgentToolDef =>
    ({
        name: 'plan_crawl',
        description:
            'Discover pages on a website for accessibility auditing. Tries sitemap.xml first, falls back to crawling links from the page. Returns all discovered URLs for you to prioritize based on accessibility importance.',
        inputSchema: z.object({
            url: z.string().describe('The base URL of the site to plan a crawl for'),
            maxPages: z.number().optional().describe('Maximum number of pages to include'),
            strategy: z.enum(['sitemap', 'crawl', 'auto']).optional().default('auto').describe('Discovery strategy'),
        }),
        run: async ({ url, maxPages, strategy }: any) => {
            const limit = maxPages || session.config.maxPages;
            let allUrls: string[] = [];
            let usedStrategy: 'sitemap' | 'crawl' = 'crawl';
            let sitemapEntries;

            if (strategy === 'sitemap' || strategy === 'auto') {
                sitemapEntries = await parseSitemap(url);
                if (sitemapEntries.length > 0) { allUrls = sitemapEntries.map((e) => e.url); usedStrategy = 'sitemap'; }
            }
            if (allUrls.length === 0 && (strategy === 'crawl' || strategy === 'auto')) {
                allUrls = await discoverLinks(url, { browser: session.config.browser, headless: session.config.headless });
                usedStrategy = 'crawl';
            }
            if (!allUrls.includes(url)) allUrls.unshift(url);

            const pages = deduplicatePages(allUrls, sitemapEntries, limit);
            const crawlPlan: CrawlPlan = { baseUrl: url, strategy: usedStrategy, pages, totalDiscovered: allUrls.length };
            session.crawlPlan = crawlPlan;
            session.pendingUrls = pages.map((p) => p.url);
            session.status = 'scanning';

            const lines = [
                `## Crawl Plan for ${url}`,
                `- **Strategy**: ${usedStrategy}`,
                `- **Total discovered**: ${allUrls.length}`,
                `- **Pages in plan**: ${pages.length}`,
                '',
                '### Discovered Pages',
                'Review these URLs and prioritize by accessibility importance. Focus on pages with forms, interactive content, navigation, and diverse templates rather than many similar pages.',
                '',
            ];
            for (const page of pages) {
                const meta: string[] = [];
                if (page.sitemapPriority) meta.push(`sitemap priority: ${page.sitemapPriority}`);
                if (page.lastmod) meta.push(`updated: ${page.lastmod}`);
                const suffix = meta.length > 0 ? ` (${meta.join(', ')})` : '';
                lines.push(`- ${page.url}${suffix}`);
            }
            return lines.join('\n');
        },
    });
