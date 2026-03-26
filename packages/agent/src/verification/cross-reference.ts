/**
 * Cross-Reference Verification
 *
 * Matches AI-generated findings against deterministic axe-core results
 * to assign confidence levels.
 */
import {
    AXE_WCAG_MAP,
    getCriterionById,
    type ScanResults,
} from '@aria51/core';
import type {
    VerifiedFinding,
    ConfidenceLevel,
    FindingSource,
    AuditSession,
    AgentWcagCriterionInfo,
} from '../types.js';
import { randomUUID } from 'crypto';

interface AIFinding {
    url: string;
    description: string;
    criterion?: string;
    selector?: string;
    impact?: 'critical' | 'serious' | 'moderate' | 'minor';
}

/**
 * Cross-reference AI findings against axe-core scan results
 * to produce verified findings with confidence levels.
 */
export function crossReferenceFindingsWithAxe(
    aiFindings: AIFinding[],
    session: AuditSession
): VerifiedFinding[] {
    const verified: VerifiedFinding[] = [];

    for (const aiFinding of aiFindings) {
        const scanResults = session.scanResults[aiFinding.url];
        const { confidence, sources } = assessConfidence(aiFinding, scanResults);

        const coreCriterion = aiFinding.criterion ? getCriterionById(aiFinding.criterion) : undefined;
        const criterion: AgentWcagCriterionInfo = coreCriterion
            ? { id: coreCriterion.id, title: coreCriterion.title, level: coreCriterion.level, principle: coreCriterion.principle, w3cUrl: coreCriterion.w3cUrl }
            : buildFallbackCriterion(aiFinding.criterion || 'unknown');

        verified.push({
            id: randomUUID(),
            url: aiFinding.url,
            criterion,
            description: aiFinding.description,
            impact: aiFinding.impact || 'moderate',
            selector: aiFinding.selector,
            confidence,
            sources: [
                { type: 'agent-observation', detail: aiFinding.description },
                ...sources,
            ],
            evidence: buildEvidence(aiFinding, sources, confidence),
        });
    }

    return verified;
}

function assessConfidence(
    aiFinding: AIFinding,
    scanResults?: ScanResults
): { confidence: ConfidenceLevel; sources: FindingSource[] } {
    if (!scanResults) {
        return { confidence: 'ai-only', sources: [] };
    }

    const sources: FindingSource[] = [];

    // 1. Check by CSS selector match
    if (aiFinding.selector) {
        for (const violation of scanResults.violations) {
            for (const node of violation.nodes) {
                const targets = node.target?.join(', ') || '';
                if (targets.includes(aiFinding.selector) || aiFinding.selector.includes(targets)) {
                    sources.push({
                        type: 'axe-core',
                        ruleId: violation.id,
                        detail: `axe-core found violation "${violation.id}" on matching element`,
                    });
                    return { confidence: 'confirmed', sources };
                }
            }
        }
    }

    // 2. Check by WCAG criterion match
    if (aiFinding.criterion) {
        for (const violation of scanResults.violations) {
            const wcagTags = violation.wcagCriteria?.map((c) => c.id) || [];
            if (wcagTags.includes(aiFinding.criterion)) {
                sources.push({
                    type: 'axe-core',
                    ruleId: violation.id,
                    detail: `axe-core found violation for same criterion ${aiFinding.criterion}`,
                });
                return { confidence: 'corroborated', sources };
            }
        }
    }

    // 3. Check by related rule ID mapping
    if (aiFinding.criterion) {
        for (const [ruleId, mapping] of Object.entries(AXE_WCAG_MAP)) {
            const criteria = (mapping as any).criteria || [];
            if (criteria.some((c: string) => c === aiFinding.criterion)) {
                // Check if axe passed this rule
                const passed = scanResults.passes?.some((p) => p.id === ruleId);
                if (passed) {
                    sources.push({
                        type: 'axe-core',
                        ruleId,
                        detail: `axe-core PASSED rule "${ruleId}" for criterion ${aiFinding.criterion}`,
                    });
                    return { confidence: 'contradicted', sources };
                }
            }
        }
    }

    // 4. Check WCAG 2.2 supplemental results
    if (aiFinding.criterion && scanResults.supplementalResults) {
        const matchingSupplemental = scanResults.supplementalResults.find(
            (r) => r.criterionId === aiFinding.criterion
        );
        if (matchingSupplemental) {
            sources.push({
                type: 'wcag22-check',
                detail: `Supplemental check for ${aiFinding.criterion}: ${matchingSupplemental.status} — ${matchingSupplemental.issues.map(i => i.message).join('; ')}`,
            });
            if (matchingSupplemental.status === 'fail') {
                return { confidence: 'corroborated', sources };
            }
            if (matchingSupplemental.status === 'pass') {
                return { confidence: 'contradicted', sources };
            }
        }
    }

    return { confidence: 'ai-only', sources };
}

function buildFallbackCriterion(id: string): AgentWcagCriterionInfo {
    return {
        id,
        title: id,
        level: 'AA',
        principle: 'Perceivable',
        w3cUrl: '',
    };
}

function buildEvidence(
    aiFinding: AIFinding,
    sources: FindingSource[],
    confidence: ConfidenceLevel
): string {
    const parts = [`AI observation: ${aiFinding.description}`];
    for (const source of sources) {
        parts.push(`${source.type}: ${source.detail}`);
    }
    parts.push(`Confidence: ${confidence}`);
    return parts.join('\n');
}
