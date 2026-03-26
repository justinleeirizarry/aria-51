/**
 * diff_report Tool
 *
 * Compares current findings against a previous snapshot.
 */
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { AuditSession, DiffReport, VerifiedFinding } from '../types.js';

export const createDiffReportTool = (session: AuditSession) =>
    betaZodTool({
        name: 'diff_report',
        description:
            'Compare current audit findings against a previous snapshot to see what has improved, regressed, or remains. Useful for tracking remediation progress over time.',
        inputSchema: z.object({
            baselineSessionId: z
                .string()
                .optional()
                .describe(
                    'Session ID to compare against. If not provided, uses the most recent previous snapshot.'
                ),
        }),
        run: async ({ baselineSessionId }) => {
            const snapshots = session.previousSnapshots;
            if (snapshots.length === 0) {
                return 'No previous snapshots available for comparison. Run an audit first, then re-audit later to see a diff.';
            }

            const baseline = baselineSessionId
                ? snapshots.find((s) => s.sessionId === baselineSessionId)
                : snapshots[snapshots.length - 1];

            if (!baseline) {
                return `Snapshot not found. Available snapshots: ${snapshots.map((s) => s.sessionId).join(', ')}`;
            }

            const diff = computeDiff(baseline.findings, session.findings, baseline.sessionId, session.id);

            const lines: string[] = [
                `## Diff Report`,
                `- **Baseline**: ${diff.baselineSessionId} (${baseline.timestamp})`,
                `- **Current**: ${diff.currentSessionId}`,
                '',
                `### Summary:`,
                `- New violations: **${diff.newViolations.length}** (regressions)`,
                `- Resolved: **${diff.resolvedViolations.length}** (improvements)`,
                `- Persistent: **${diff.persistentViolations.length}** (still present)`,
                '',
            ];

            if (diff.resolvedViolations.length > 0) {
                lines.push('### Resolved:');
                for (const f of diff.resolvedViolations.slice(0, 10)) {
                    lines.push(`- ${f.criterion.id}: ${f.description}`);
                }
                lines.push('');
            }

            if (diff.newViolations.length > 0) {
                lines.push('### New Regressions:');
                for (const f of diff.newViolations.slice(0, 10)) {
                    lines.push(`- ${f.criterion.id} (${f.impact}): ${f.description}`);
                }
                lines.push('');
            }

            return lines.join('\n');
        },
    });

function computeDiff(
    baselineFindings: VerifiedFinding[],
    currentFindings: VerifiedFinding[],
    baselineId: string,
    currentId: string
): DiffReport {
    const findingKey = (f: VerifiedFinding) =>
        `${f.url}|${f.criterion.id}|${f.selector || ''}`;

    const baselineKeys = new Set(baselineFindings.map(findingKey));
    const currentKeys = new Set(currentFindings.map(findingKey));

    const newViolations = currentFindings.filter((f) => !baselineKeys.has(findingKey(f)));
    const resolvedViolations = baselineFindings.filter((f) => !currentKeys.has(findingKey(f)));
    const persistentViolations = currentFindings.filter((f) => baselineKeys.has(findingKey(f)));

    return {
        baselineSessionId: baselineId,
        currentSessionId: currentId,
        newViolations,
        resolvedViolations,
        persistentViolations,
        regressionCount: newViolations.length,
        improvementCount: resolvedViolations.length,
    };
}
