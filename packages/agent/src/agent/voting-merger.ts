/**
 * Voting Merger
 *
 * Merges findings from multiple independent voter runs.
 * Findings that multiple voters agree on get boosted confidence.
 * This is the core of the voting/consensus pattern.
 */
import type {
    AuditReport,
    VerifiedFinding,
    ConfidenceLevel,
    ImpactLevel,
    RemediationPlan,
} from '../types.js';
import { generateRemediationPlan } from '../remediation/prioritizer.js';
import { randomUUID } from 'crypto';

export interface VotingResult {
    /** The merged consensus report */
    report: AuditReport;
    /** Individual voter reports for transparency */
    voterReports: AuditReport[];
    /** How many voters agreed on each finding */
    voteDetails: VoteDetail[];
}

export interface VoteDetail {
    finding: VerifiedFinding;
    /** Number of voters that flagged this issue */
    votes: number;
    /** Total number of voters */
    totalVoters: number;
    /** Which voter lenses flagged it */
    votedBy: string[];
    /** Original confidence before vote boosting */
    originalConfidence: ConfidenceLevel;
    /** Boosted confidence after vote counting */
    finalConfidence: ConfidenceLevel;
}

/**
 * Merge findings from multiple voter audit reports into a consensus report.
 *
 * Deduplication logic: two findings match if they share the same
 * WCAG criterion + URL + similar selector.
 *
 * Confidence boosting:
 * - 1 voter: keep original confidence
 * - 2 voters: ai-only → corroborated, corroborated → confirmed
 * - 3+ voters: ai-only → corroborated, corroborated → confirmed, confirmed stays confirmed
 * - contradicted stays contradicted unless 2+ other voters confirmed it
 */
export function mergeVoterReports(
    voterReports: AuditReport[],
    voterIds: string[]
): VotingResult {
    const startTime = Date.now();

    // Collect all findings with their voter source
    const taggedFindings: Array<{ finding: VerifiedFinding; voterId: string }> = [];
    for (let i = 0; i < voterReports.length; i++) {
        for (const finding of voterReports[i].findings) {
            taggedFindings.push({ finding, voterId: voterIds[i] });
        }
    }

    // Group by fingerprint (criterion + url + normalized selector)
    const groups = new Map<string, Array<{ finding: VerifiedFinding; voterId: string }>>();
    for (const tagged of taggedFindings) {
        const key = fingerprintFinding(tagged.finding);
        const group = groups.get(key) || [];
        group.push(tagged);
        groups.set(key, group);
    }

    // Merge each group into a single finding with vote-boosted confidence
    const mergedFindings: VerifiedFinding[] = [];
    const voteDetails: VoteDetail[] = [];

    for (const [, group] of groups) {
        // Pick the most detailed finding as the base
        const base = group.reduce((best, curr) =>
            curr.finding.evidence.length > best.finding.evidence.length ? curr : best
        );

        const votes = group.length;
        const votedBy = [...new Set(group.map((g) => g.voterId))];
        const uniqueVotes = votedBy.length;
        const originalConfidence = base.finding.confidence;

        // Boost confidence based on vote count
        const finalConfidence = boostConfidence(originalConfidence, uniqueVotes, voterReports.length);

        // Merge sources from all voters
        const allSources = group.flatMap((g) => g.finding.sources);
        const uniqueSources = deduplicateSources(allSources);

        // Add voter consensus to evidence
        const voterEvidence = `Voter consensus: ${uniqueVotes}/${voterReports.length} voters flagged this issue (${votedBy.join(', ')})`;

        const merged: VerifiedFinding = {
            ...base.finding,
            id: randomUUID(),
            confidence: finalConfidence,
            sources: uniqueSources,
            evidence: `${base.finding.evidence}\n${voterEvidence}`,
        };

        mergedFindings.push(merged);
        voteDetails.push({
            finding: merged,
            votes: uniqueVotes,
            totalVoters: voterReports.length,
            votedBy,
            originalConfidence,
            finalConfidence,
        });
    }

    // Sort by confidence then impact
    mergedFindings.sort((a, b) => {
        const confOrder: Record<ConfidenceLevel, number> = { confirmed: 0, corroborated: 1, 'ai-only': 2, contradicted: 3 };
        const impOrder: Record<ImpactLevel, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
        const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
        if (confDiff !== 0) return confDiff;
        return impOrder[a.impact] - impOrder[b.impact];
    });

    // Build consensus remediation plan from merged session
    const mockSession = {
        findings: mergedFindings,
        config: { wcagLevel: voterReports[0]?.wcagLevel || 'AA' },
    };
    const remediationPlan = mergedFindings.length > 0
        ? generateRemediationPlan(mockSession as any)
        : null;

    // Combine agent summaries
    const combinedSummary = buildConsensusSummary(voterReports, mergedFindings, voteDetails);

    // Aggregate stats
    const allScannedUrls = new Set(voterReports.flatMap((r) =>
        Object.keys((r as any).scanResults || {})
    ));

    const findingsByConfidence: Record<ConfidenceLevel, number> = { confirmed: 0, corroborated: 0, 'ai-only': 0, contradicted: 0 };
    const findingsBySeverity: Record<ImpactLevel, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const f of mergedFindings) {
        findingsByConfidence[f.confidence]++;
        findingsBySeverity[f.impact]++;
    }

    const report: AuditReport = {
        sessionId: `consensus-${randomUUID().slice(0, 8)}`,
        url: voterReports[0]?.url || '',
        timestamp: new Date().toISOString(),
        wcagLevel: voterReports[0]?.wcagLevel || 'AA',
        pagesScanned: Math.max(...voterReports.map((r) => r.pagesScanned)),
        totalFindings: mergedFindings.length,
        findingsByConfidence,
        findingsBySeverity,
        findings: mergedFindings,
        remediationPlan,
        agentSummary: combinedSummary,
        scanDurationMs: voterReports.reduce((sum, r) => sum + r.scanDurationMs, 0),
    };

    return { report, voterReports, voteDetails };
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
    // Strip pseudo-classes and normalize whitespace for fuzzy matching
    return selector
        .replace(/::?[\w-]+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function boostConfidence(
    original: ConfidenceLevel,
    votes: number,
    totalVoters: number
): ConfidenceLevel {
    // Contradicted findings need strong consensus to override
    if (original === 'contradicted') {
        return votes >= 3 ? 'ai-only' : 'contradicted';
    }

    if (votes >= 3) {
        if (original === 'ai-only') return 'corroborated';
        if (original === 'corroborated') return 'confirmed';
        return 'confirmed';
    }

    if (votes >= 2) {
        if (original === 'ai-only') return 'corroborated';
        if (original === 'corroborated') return 'confirmed';
        return original;
    }

    return original;
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

function buildConsensusSummary(
    voterReports: AuditReport[],
    mergedFindings: VerifiedFinding[],
    voteDetails: VoteDetail[]
): string {
    const unanimousCount = voteDetails.filter((v) => v.votes === voterReports.length).length;
    const majorityCount = voteDetails.filter((v) => v.votes >= Math.ceil(voterReports.length / 2)).length;
    const boostedCount = voteDetails.filter((v) => v.finalConfidence !== v.originalConfidence).length;

    const lines = [
        `## Consensus Audit Report (${voterReports.length} independent voters)`,
        '',
        `**${mergedFindings.length}** unique findings from ${voterReports.length} specialized audit passes.`,
        '',
        `### Voting Statistics:`,
        `- Unanimous agreement (all voters): **${unanimousCount}** findings`,
        `- Majority agreement (≥${Math.ceil(voterReports.length / 2)} voters): **${majorityCount}** findings`,
        `- Confidence boosted by consensus: **${boostedCount}** findings`,
        '',
        '### Voter Perspectives:',
    ];

    for (const report of voterReports) {
        lines.push(`- **${report.sessionId}**: ${report.totalFindings} findings, ${report.pagesScanned} pages scanned`);
    }

    lines.push('');
    lines.push('### Individual Voter Summaries:');
    for (const report of voterReports) {
        lines.push(`\n#### ${report.sessionId}`);
        // Truncate individual summaries to keep consensus report focused
        const summary = report.agentSummary.slice(0, 500);
        lines.push(summary + (report.agentSummary.length > 500 ? '...' : ''));
    }

    return lines.join('\n');
}
