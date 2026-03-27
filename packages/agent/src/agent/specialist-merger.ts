/**
 * Specialist Merger
 *
 * Merges findings from multiple independent specialist runs.
 * Deduplicates overlapping findings and builds a coverage map.
 * Confidence comes from the cross-reference system (axe-core, WCAG checks),
 * not from vote counting.
 */
import type {
    AuditReport,
    VerifiedFinding,
    ConfidenceLevel,
    ImpactLevel,
} from '../types.js';
import type { SpecialistLens } from './specialist-lenses.js';
import { generateRemediationPlan } from '../remediation/prioritizer.js';
import { randomUUID } from 'crypto';

export interface MultiAgentResult {
    /** The merged report */
    report: AuditReport;
    /** Individual specialist reports for transparency */
    specialistReports: AuditReport[];
    /** Which WCAG criteria each specialist covers */
    coverageMap: Record<string, string[]>;
}

/**
 * Merge findings from multiple specialist audit reports.
 *
 * Deduplication logic: two findings match if they share the same
 * WCAG criterion + URL + similar selector. When duplicates are found,
 * the most detailed finding is kept and sources are merged.
 */
export function mergeSpecialistReports(
    specialistReports: AuditReport[],
    specialistIds: string[],
    lenses: SpecialistLens[]
): MultiAgentResult {
    // Collect all findings tagged with their specialist source
    const taggedFindings: Array<{ finding: VerifiedFinding; specialistId: string }> = [];
    for (let i = 0; i < specialistReports.length; i++) {
        for (const finding of specialistReports[i].findings) {
            taggedFindings.push({ finding, specialistId: specialistIds[i] });
        }
    }

    // Group by fingerprint (criterion + url + normalized selector)
    const groups = new Map<string, Array<{ finding: VerifiedFinding; specialistId: string }>>();
    for (const tagged of taggedFindings) {
        const key = fingerprintFinding(tagged.finding);
        const group = groups.get(key) || [];
        group.push(tagged);
        groups.set(key, group);
    }

    // Merge each group — keep the most detailed finding, combine sources
    const mergedFindings: VerifiedFinding[] = [];
    let deduplicatedCount = 0;

    for (const [, group] of groups) {
        const base = group.reduce((best, curr) =>
            curr.finding.evidence.length > best.finding.evidence.length ? curr : best
        );

        const contributors = [...new Set(group.map((g) => g.specialistId))];

        // Merge sources from all specialists
        const allSources = group.flatMap((g) => g.finding.sources);
        const uniqueSources = deduplicateSources(allSources);

        // Note if multiple specialists independently found this
        const evidence = contributors.length > 1
            ? `${base.finding.evidence}\nAlso identified by: ${contributors.join(', ')}`
            : base.finding.evidence;

        if (contributors.length > 1) {
            deduplicatedCount++;
        }

        const merged: VerifiedFinding = {
            ...base.finding,
            id: randomUUID(),
            sources: uniqueSources,
            evidence,
        };

        mergedFindings.push(merged);
    }

    // Sort by confidence then impact
    mergedFindings.sort((a, b) => {
        const confOrder: Record<ConfidenceLevel, number> = { confirmed: 0, corroborated: 1, 'ai-only': 2, contradicted: 3 };
        const impOrder: Record<ImpactLevel, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
        const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
        if (confDiff !== 0) return confDiff;
        return impOrder[a.impact] - impOrder[b.impact];
    });

    // Build remediation plan from merged findings
    const mockSession = {
        findings: mergedFindings,
        config: { wcagLevel: specialistReports[0]?.wcagLevel || 'AA' },
    };
    const remediationPlan = mergedFindings.length > 0
        ? generateRemediationPlan(mockSession as any)
        : null;

    // Build coverage map
    const coverageMap: Record<string, string[]> = {};
    for (const lens of lenses) {
        if (specialistIds.includes(lens.id)) {
            coverageMap[lens.id] = lens.wcagFocus;
        }
    }

    const combinedSummary = buildCoverageSummary(
        specialistReports,
        specialistIds,
        mergedFindings,
        deduplicatedCount,
        coverageMap
    );

    const findingsByConfidence: Record<ConfidenceLevel, number> = { confirmed: 0, corroborated: 0, 'ai-only': 0, contradicted: 0 };
    const findingsBySeverity: Record<ImpactLevel, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const f of mergedFindings) {
        findingsByConfidence[f.confidence]++;
        findingsBySeverity[f.impact]++;
    }

    const report: AuditReport = {
        sessionId: `multi-specialist-${randomUUID().slice(0, 8)}`,
        url: specialistReports[0]?.url || '',
        timestamp: new Date().toISOString(),
        wcagLevel: specialistReports[0]?.wcagLevel || 'AA',
        pagesScanned: Math.max(...specialistReports.map((r) => r.pagesScanned)),
        totalFindings: mergedFindings.length,
        findingsByConfidence,
        findingsBySeverity,
        findings: mergedFindings,
        remediationPlan,
        agentSummary: combinedSummary,
        scanDurationMs: specialistReports.reduce((sum, r) => sum + r.scanDurationMs, 0),
    };

    return { report, specialistReports, coverageMap };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a fingerprint for deduplication.
 * Two findings match if they target the same criterion on the same URL
 * with a similar selector.
 */
function fingerprintFinding(f: VerifiedFinding): string {
    const selector = normalizeSelector(f.selector || '');
    return `${f.url}|${f.criterion.id}|${selector}`;
}

function normalizeSelector(selector: string): string {
    return selector
        .replace(/::?[\w-]+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function deduplicateSources(sources: VerifiedFinding['sources']): VerifiedFinding['sources'] {
    const seen = new Set<string>();
    return sources.filter((s) => {
        const key = `${s.type}|${s.ruleId || ''}|${s.detail.slice(0, 50)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildCoverageSummary(
    specialistReports: AuditReport[],
    specialistIds: string[],
    mergedFindings: VerifiedFinding[],
    deduplicatedCount: number,
    coverageMap: Record<string, string[]>
): string {
    const totalRawFindings = specialistReports.reduce((sum, r) => sum + r.totalFindings, 0);

    const lines = [
        `## Multi-Specialist Audit Report (${specialistReports.length} specialists)`,
        '',
        `**${mergedFindings.length}** unique findings from ${specialistReports.length} specialized audit passes.`,
        deduplicatedCount > 0
            ? `${deduplicatedCount} finding(s) independently identified by multiple specialists (${totalRawFindings} raw → ${mergedFindings.length} deduplicated).`
            : '',
        '',
        '### Specialist Contributions:',
    ];

    for (let i = 0; i < specialistReports.length; i++) {
        const report = specialistReports[i];
        const id = specialistIds[i];
        const criteria = coverageMap[id] || [];
        lines.push(`- **${id}**: ${report.totalFindings} findings, ${report.pagesScanned} pages scanned — WCAG criteria: ${criteria.slice(0, 5).join(', ')}${criteria.length > 5 ? '...' : ''}`);
    }

    lines.push('');
    lines.push('### WCAG Coverage:');
    const allCriteria = new Set(Object.values(coverageMap).flat());
    const principles: Record<string, string[]> = {
        Perceivable: [],
        Operable: [],
        Understandable: [],
        Robust: [],
    };
    for (const c of allCriteria) {
        const prefix = c.split('.')[0];
        if (prefix === '1') principles.Perceivable.push(c);
        else if (prefix === '2') principles.Operable.push(c);
        else if (prefix === '3') principles.Understandable.push(c);
        else if (prefix === '4') principles.Robust.push(c);
    }
    for (const [principle, criteria] of Object.entries(principles)) {
        if (criteria.length > 0) {
            lines.push(`- **${principle}**: ${criteria.sort().join(', ')}`);
        }
    }

    lines.push('');
    lines.push('### Individual Specialist Summaries:');
    for (let i = 0; i < specialistReports.length; i++) {
        const report = specialistReports[i];
        lines.push(`\n#### ${specialistIds[i]}`);
        const summary = report.agentSummary.slice(0, 500);
        lines.push(summary + (report.agentSummary.length > 500 ? '...' : ''));
    }

    return lines.filter(Boolean).join('\n');
}
