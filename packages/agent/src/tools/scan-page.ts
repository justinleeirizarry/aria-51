/**
 * scan_page Tool
 *
 * Wraps @aria51/core's runScanAsPromise for single-page scanning.
 * Returns a compressed summary to the agent; full results go to session state.
 */
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import {
    runScanAsPromise,
    AppLayer,
    type ScanResults,
} from '@aria51/core';
import type { AuditSession } from '../types.js';

export const createScanPageTool = (session: AuditSession) =>
    betaZodTool({
        name: 'scan_page',
        description:
            'Scan a single URL for accessibility violations using axe-core, keyboard tests, and WCAG 2.2 checks. Returns a summary of findings. Use this for targeted deep scans of individual pages.',
        inputSchema: z.object({
            url: z.string().describe('The URL to scan'),
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
        run: async ({ url, includeKeyboardTests, mobile }) => {
            try {
                const result = await runScanAsPromise(
                    {
                        url,
                        browser: session.config.browser,
                        headless: session.config.headless,
                        includeKeyboardTests,
                        mobile,
                        stagehand: session.config.enableStagehand,
                    },
                    AppLayer
                );

                session.scanResults[url] = result.results;
                if (!session.scannedUrls.includes(url)) {
                    session.scannedUrls.push(url);
                }
                session.pendingUrls = session.pendingUrls.filter((u) => u !== url);

                return summarizeScanResults(url, result.results);
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                return `Scan failed for ${url}: ${msg}`;
            }
        },
    });

function summarizeScanResults(url: string, results: ScanResults): string {
    const lines: string[] = [`## Scan Results: ${url}`];

    lines.push(`- **Violations**: ${results.summary.totalViolations}`);
    lines.push(`- **Passes**: ${results.summary.totalPasses}`);
    lines.push(`- **Incomplete**: ${results.summary.totalIncomplete}`);

    if (results.violations.length > 0) {
        lines.push('\n### Top Violations:');
        for (const v of results.violations.slice(0, 10)) {
            const wcag = v.wcagCriteria?.map((c) => c.id).join(', ') || 'n/a';
            lines.push(`- **${v.id}** (${v.impact}): ${v.description} [WCAG ${wcag}] — ${v.nodes.length} instance(s)`);
        }
        if (results.violations.length > 10) {
            lines.push(`- ... and ${results.violations.length - 10} more`);
        }
    }

    if (results.wcag22) {
        lines.push(`\n### WCAG 2.2 Summary:`);
        lines.push(`- Total WCAG 2.2 violations: ${results.wcag22.summary.totalViolations}`);
        const byCriterion = results.wcag22.summary.byCriterion;
        for (const [criterion, count] of Object.entries(byCriterion)) {
            if ((count as number) > 0) {
                lines.push(`  - ${criterion}: ${count} violation(s)`);
            }
        }
    }

    if (results.supplementalResults && results.supplementalResults.length > 0) {
        const failures = results.supplementalResults.filter((r) => r.status === 'fail');
        if (failures.length > 0) {
            lines.push(`\n### Supplemental Check Failures: ${failures.length}`);
            for (const f of failures.slice(0, 5)) {
                lines.push(`- ${f.criterionId}: ${f.issues.map(i => i.message).join('; ')}`);
            }
        }
    }

    return lines.join('\n');
}
