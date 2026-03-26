/**
 * generate_remediation Tool
 *
 * Produces a structured, prioritized remediation plan from verified findings.
 */
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { generateRemediationPlan } from '../remediation/prioritizer.js';
import type { AuditSession } from '../types.js';

export const createGenerateRemediationTool = (session: AuditSession) =>
    betaZodTool({
        name: 'generate_remediation',
        description:
            'Generate a prioritized remediation plan from verified findings. Groups issues into immediate/short-term/long-term phases based on severity, confidence, and WCAG level. Call this after verifying findings.',
        inputSchema: z.object({
            focusLevel: z
                .enum(['A', 'AA', 'AAA'])
                .optional()
                .describe('Only include issues at this WCAG level and below'),
            maxItems: z
                .number()
                .optional()
                .describe('Maximum items per phase'),
        }),
        run: async ({ focusLevel, maxItems }) => {
            if (session.findings.length === 0) {
                return 'No verified findings to generate a remediation plan from. Use verify_findings first.';
            }

            const plan = generateRemediationPlan(session, { focusLevel, maxItems });
            session.remediationPlan = plan;
            session.status = 'remediating';

            const lines: string[] = [
                `## Remediation Plan`,
                `- **Total Issues**: ${plan.totalIssues}`,
                `- **Estimated Effort**: ${plan.estimatedEffort}`,
                `- ${plan.summary}`,
                '',
            ];

            for (const phase of plan.phases) {
                lines.push(`### Phase ${phase.priority}: ${phase.title}`);
                lines.push(phase.description);
                lines.push('');

                for (const item of phase.items) {
                    const pages = item.affectedPages.length > 1
                        ? ` (${item.affectedPages.length} pages)`
                        : '';
                    lines.push(
                        `- **${item.finding.criterion.id}** (${item.finding.impact}, ${item.estimatedEffort} effort)${pages}: ${item.fix}`
                    );
                }
                lines.push('');
            }

            return lines.join('\n');
        },
    });
