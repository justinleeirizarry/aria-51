/**
 * plan_crawl Tool
 *
 * Discovers and prioritizes pages for accessibility auditing.
 */
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { parseSitemap } from '../planning/sitemap-parser.js';
import { discoverLinks } from '../planning/link-discoverer.js';
import { prioritizePages } from '../planning/page-prioritizer.js';
import type { AuditSession, CrawlPlan } from '../types.js';

export const createCrawlPlannerTool = (session: AuditSession) =>
    betaZodTool({
        name: 'plan_crawl',
        description:
            'Discover and prioritize pages on a website for accessibility auditing. Tries sitemap.xml first, falls back to crawling links from the page. Returns a prioritized list of URLs to scan.',
        inputSchema: z.object({
            url: z.string().describe('The base URL of the site to plan a crawl for'),
            maxPages: z
                .number()
                .optional()
                .describe('Maximum number of pages to include in the plan'),
            strategy: z
                .enum(['sitemap', 'crawl', 'auto'])
                .optional()
                .default('auto')
                .describe('Discovery strategy: sitemap, crawl, or auto (try sitemap first)'),
        }),
        run: async ({ url, maxPages, strategy }) => {
            const limit = maxPages || session.config.maxPages;
            let allUrls: string[] = [];
            let usedStrategy: 'sitemap' | 'crawl' = 'crawl';
            let sitemapEntries;

            if (strategy === 'sitemap' || strategy === 'auto') {
                sitemapEntries = await parseSitemap(url);
                if (sitemapEntries.length > 0) {
                    allUrls = sitemapEntries.map((e) => e.url);
                    usedStrategy = 'sitemap';
                }
            }

            if (allUrls.length === 0 && (strategy === 'crawl' || strategy === 'auto')) {
                allUrls = await discoverLinks(url, {
                    browser: session.config.browser,
                    headless: session.config.headless,
                });
                usedStrategy = 'crawl';
            }

            if (!allUrls.includes(url)) {
                allUrls.unshift(url);
            }

            const prioritized = prioritizePages(allUrls, sitemapEntries, limit);

            const crawlPlan: CrawlPlan = {
                baseUrl: url,
                strategy: usedStrategy,
                pages: prioritized,
                totalDiscovered: allUrls.length,
            };
            session.crawlPlan = crawlPlan;
            session.pendingUrls = prioritized.map((p) => p.url);
            session.status = 'scanning';

            const lines: string[] = [
                `## Crawl Plan for ${url}`,
                `- **Strategy**: ${usedStrategy}`,
                `- **Total pages discovered**: ${allUrls.length}`,
                `- **Pages in plan**: ${prioritized.length}`,
                '',
                '### Prioritized Pages:',
            ];

            for (const page of prioritized) {
                lines.push(
                    `${page.priority}. **${page.template}** — ${page.url} (${page.reason})`
                );
            }

            return lines.join('\n');
        },
    });
