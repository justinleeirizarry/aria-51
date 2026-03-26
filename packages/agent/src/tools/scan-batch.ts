/**
 * scan_batch Tool
 *
 * Parallel multi-page scanning with concurrency control.
 */
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { runScanAsPromise, AppLayer } from '@aria51/core';
import type { AuditSession } from '../types.js';

export const createScanBatchTool = (session: AuditSession) =>
    betaZodTool({
        name: 'scan_batch',
        description:
            'Scan multiple URLs in parallel for accessibility violations. More efficient than scanning pages one by one. Returns a summary per page.',
        inputSchema: z.object({
            urls: z.array(z.string()).describe('URLs to scan'),
            includeKeyboardTests: z
                .boolean()
                .optional()
                .default(true)
                .describe('Include keyboard navigation tests'),
            mobile: z
                .boolean()
                .optional()
                .default(false)
                .describe('Emulate a mobile device viewport'),
        }),
        run: async ({ urls, includeKeyboardTests, mobile }) => {
            const concurrency = session.config.concurrency;
            const results: string[] = [];

            for (let i = 0; i < urls.length; i += concurrency) {
                const batch = urls.slice(i, i + concurrency);
                const batchResults = await Promise.allSettled(
                    batch.map((url) =>
                        runScanAsPromise(
                            {
                                url,
                                browser: session.config.browser,
                                headless: session.config.headless,
                                includeKeyboardTests,
                                mobile,
                            },
                            AppLayer
                        ).then((result) => {
                            session.scanResults[url] = result.results;
                            if (!session.scannedUrls.includes(url)) {
                                session.scannedUrls.push(url);
                            }
                            session.pendingUrls = session.pendingUrls.filter((u) => u !== url);
                            return { url, results: result.results };
                        })
                    )
                );

                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        const { url, results: scanResults } = result.value;
                        results.push(
                            `**${url}**: ${scanResults.summary.totalViolations} violations, ${scanResults.summary.totalPasses} passes`
                        );
                    } else {
                        const failedUrl = batch[batchResults.indexOf(result)];
                        results.push(`**${failedUrl}**: FAILED — ${result.reason}`);
                    }
                }
            }

            return `## Batch Scan Results (${urls.length} pages)\n\n${results.map((r) => `- ${r}`).join('\n')}\n\nUse \`read_state\` to get detailed results for any specific page.`;
        },
    });
