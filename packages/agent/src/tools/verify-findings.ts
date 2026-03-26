/**
 * verify_findings Tool
 *
 * Cross-references AI-generated findings with deterministic axe-core results.
 */
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { crossReferenceFindingsWithAxe } from '../verification/cross-reference.js';
import { sortByScore } from '../verification/confidence-scorer.js';
import type { AuditSession } from '../types.js';

export const createVerifyFindingsTool = (session: AuditSession) =>
    betaZodTool({
        name: 'verify_findings',
        description:
            'Cross-reference your accessibility observations with axe-core deterministic scan results. Each finding gets a confidence level: confirmed (axe-core agrees), corroborated (related evidence), ai-only (needs manual review), or contradicted (axe-core disagrees). Use this after analyzing scan results to validate your findings.',
        inputSchema: z.object({
            findings: z.array(
                z.object({
                    url: z.string().describe('The URL where the issue was observed'),
                    description: z.string().describe('Description of the accessibility issue'),
                    criterion: z
                        .string()
                        .optional()
                        .describe('WCAG criterion ID (e.g., "2.4.7")'),
                    selector: z
                        .string()
                        .optional()
                        .describe('CSS selector of the affected element'),
                    impact: z
                        .enum(['critical', 'serious', 'moderate', 'minor'])
                        .optional()
                        .describe('Severity of the issue'),
                })
            ).describe('AI-generated findings to verify against axe-core results'),
        }),
        run: async ({ findings }) => {
            const verified = crossReferenceFindingsWithAxe(findings, session);
            const sorted = sortByScore(verified);

            session.findings.push(...sorted);
            session.status = 'verifying';

            const byConfidence = {
                confirmed: sorted.filter((f) => f.confidence === 'confirmed'),
                corroborated: sorted.filter((f) => f.confidence === 'corroborated'),
                'ai-only': sorted.filter((f) => f.confidence === 'ai-only'),
                contradicted: sorted.filter((f) => f.confidence === 'contradicted'),
            };

            const lines: string[] = [
                `## Verification Results: ${sorted.length} findings analyzed`,
                '',
            ];

            if (byConfidence.confirmed.length > 0) {
                lines.push(`### Confirmed (${byConfidence.confirmed.length}) — axe-core agrees:`);
                for (const f of byConfidence.confirmed) {
                    lines.push(`- **${f.criterion.id}** (${f.impact}): ${f.description}`);
                }
                lines.push('');
            }

            if (byConfidence.corroborated.length > 0) {
                lines.push(`### Corroborated (${byConfidence.corroborated.length}) — related evidence found:`);
                for (const f of byConfidence.corroborated) {
                    lines.push(`- **${f.criterion.id}** (${f.impact}): ${f.description}`);
                }
                lines.push('');
            }

            if (byConfidence['ai-only'].length > 0) {
                lines.push(`### AI-Only (${byConfidence['ai-only'].length}) — needs manual review:`);
                for (const f of byConfidence['ai-only']) {
                    lines.push(`- **${f.criterion.id}** (${f.impact}): ${f.description}`);
                }
                lines.push('');
            }

            if (byConfidence.contradicted.length > 0) {
                lines.push(`### Contradicted (${byConfidence.contradicted.length}) — axe-core disagrees:`);
                for (const f of byConfidence.contradicted) {
                    lines.push(`- **${f.criterion.id}** (${f.impact}): ${f.description}`);
                    lines.push(`  Evidence: ${f.evidence.split('\n').pop()}`);
                }
                lines.push('');
            }

            return lines.join('\n');
        },
    });
