/**
 * read_state Tool
 *
 * Lets the agent introspect the current audit session state.
 */
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { AuditSession } from '../types.js';

export const createReadStateTool = (session: AuditSession) =>
    betaZodTool({
        name: 'read_state',
        description:
            'Read the current audit session state. Shows scanned pages, pending pages, finding counts, and session status. Optionally drill into a specific page\'s detailed results.',
        inputSchema: z.object({
            detailUrl: z
                .string()
                .optional()
                .describe('If provided, return detailed scan results for this specific URL'),
        }),
        run: async ({ detailUrl }) => {
            if (detailUrl) {
                const results = session.scanResults[detailUrl];
                if (!results) {
                    return `No scan results found for ${detailUrl}. Scanned URLs: ${session.scannedUrls.join(', ') || 'none'}`;
                }
                return formatDetailedResults(detailUrl, results);
            }

            return formatSessionOverview(session);
        },
    });

function formatSessionOverview(session: AuditSession): string {
    const lines: string[] = ['## Audit Session State'];
    lines.push(`- **Status**: ${session.status}`);
    lines.push(`- **Target**: ${session.config.targetUrl}`);
    lines.push(`- **WCAG Level**: ${session.config.wcagLevel}`);
    lines.push(`- **Pages Scanned**: ${session.scannedUrls.length}`);
    lines.push(`- **Pages Pending**: ${session.pendingUrls.length}`);
    lines.push(`- **Verified Findings**: ${session.findings.length}`);
    lines.push(`- **Steps Taken**: ${session.stepCount}`);
    lines.push(`- **Tool Calls**: ${session.toolCallCount}`);

    if (session.crawlPlan) {
        lines.push(`\n### Crawl Plan`);
        lines.push(`- Strategy: ${session.crawlPlan.strategy}`);
        lines.push(`- Total Discovered: ${session.crawlPlan.totalDiscovered}`);
        lines.push(`- Planned Pages: ${session.crawlPlan.pages.length}`);
    }

    if (session.scannedUrls.length > 0) {
        lines.push(`\n### Scanned Pages:`);
        for (const url of session.scannedUrls) {
            const r = session.scanResults[url];
            if (r) {
                lines.push(`- ${url}: ${r.summary.totalViolations} violations`);
            }
        }
    }

    if (session.pendingUrls.length > 0) {
        lines.push(`\n### Pending Pages:`);
        for (const url of session.pendingUrls.slice(0, 10)) {
            lines.push(`- ${url}`);
        }
        if (session.pendingUrls.length > 10) {
            lines.push(`- ... and ${session.pendingUrls.length - 10} more`);
        }
    }

    if (session.findings.length > 0) {
        const byConfidence = { confirmed: 0, corroborated: 0, 'ai-only': 0, contradicted: 0 };
        for (const f of session.findings) {
            byConfidence[f.confidence]++;
        }
        lines.push(`\n### Findings by Confidence:`);
        for (const [level, count] of Object.entries(byConfidence)) {
            if (count > 0) lines.push(`- ${level}: ${count}`);
        }
    }

    return lines.join('\n');
}

function formatDetailedResults(url: string, results: any): string {
    const lines: string[] = [`## Detailed Results: ${url}`];
    lines.push(`- Violations: ${results.summary?.totalViolations ?? 'unknown'}`);
    lines.push(`- Passes: ${results.summary?.totalPasses ?? 'unknown'}`);

    if (results.violations) {
        lines.push('\n### All Violations:');
        for (const v of results.violations) {
            lines.push(`\n#### ${v.id} (${v.impact})`);
            lines.push(`- ${v.description}`);
            lines.push(`- Help: ${v.helpUrl || 'n/a'}`);
            lines.push(`- WCAG: ${v.wcagCriteria?.map((c: any) => c.id).join(', ') || 'n/a'}`);
            lines.push(`- Instances: ${v.nodes?.length || 0}`);
            for (const node of (v.nodes || []).slice(0, 3)) {
                lines.push(`  - \`${node.target?.join(', ') || node.html?.slice(0, 80) || 'unknown'}\``);
            }
        }
    }

    return lines.join('\n');
}
