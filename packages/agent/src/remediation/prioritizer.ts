/**
 * Remediation Prioritizer
 *
 * Ranks verified findings by impact, effort, WCAG level, and frequency
 * to produce a prioritized remediation plan.
 */
import type { VerifiedFinding, RemediationPlan, RemediationPhase, RemediationItem } from '../types.js';
import { scoreFinding, filterHighConfidence } from '../verification/confidence-scorer.js';
import type { AuditSession } from '../types.js';

const LEVEL_PRIORITY: Record<string, number> = { A: 3, AA: 2, AAA: 1 };

/**
 * Generate a structured remediation plan from verified findings.
 */
export function generateRemediationPlan(
    session: AuditSession,
    options?: { focusLevel?: 'A' | 'AA' | 'AAA'; maxItems?: number }
): RemediationPlan {
    // Filter out contradicted findings
    const findings = filterHighConfidence(session.findings, 'ai-only');

    // Optionally filter by WCAG level
    const focusLevel = options?.focusLevel || session.config.wcagLevel;
    const levelPriority = LEVEL_PRIORITY[focusLevel] || 2;
    const filtered = findings.filter(
        (f) => (LEVEL_PRIORITY[f.criterion.level] || 0) >= levelPriority
    );

    // Group by priority phase
    const immediate: RemediationItem[] = []; // critical + serious confirmed/corroborated
    const shortTerm: RemediationItem[] = [];  // moderate + confirmed ai-only
    const longTerm: RemediationItem[] = [];   // minor + low confidence

    for (const finding of filtered) {
        const score = scoreFinding(finding);
        const item = buildRemediationItem(finding, session);

        if (score >= 0.7) {
            immediate.push(item);
        } else if (score >= 0.4) {
            shortTerm.push(item);
        } else {
            longTerm.push(item);
        }
    }

    // Apply maxItems limit
    const maxItems = options?.maxItems || 50;
    const phases: RemediationPhase[] = [];

    if (immediate.length > 0) {
        phases.push({
            priority: 1,
            title: 'Immediate — Critical Accessibility Failures',
            description: 'High-confidence, high-impact issues that should be fixed first. These likely affect users now and may have legal compliance implications.',
            items: immediate.slice(0, maxItems),
        });
    }

    if (shortTerm.length > 0) {
        phases.push({
            priority: 2,
            title: 'Short-Term — Moderate Issues',
            description: 'Medium-impact issues that should be addressed in the next sprint or release cycle.',
            items: shortTerm.slice(0, maxItems),
        });
    }

    if (longTerm.length > 0) {
        phases.push({
            priority: 3,
            title: 'Long-Term — Minor Improvements',
            description: 'Lower-priority issues or AI-only findings that should be reviewed manually and addressed over time.',
            items: longTerm.slice(0, maxItems),
        });
    }

    const totalIssues = immediate.length + shortTerm.length + longTerm.length;
    const estimatedEffort: 'low' | 'medium' | 'high' =
        immediate.length > 10 ? 'high' : immediate.length > 3 ? 'medium' : 'low';

    return {
        summary: `${totalIssues} issues across ${phases.length} priority phases. ${immediate.length} require immediate attention.`,
        totalIssues,
        estimatedEffort,
        phases,
    };
}

function buildRemediationItem(
    finding: VerifiedFinding,
    session: AuditSession
): RemediationItem {
    // Find all pages where this criterion failed
    const affectedPages = session.findings
        .filter((f) => f.criterion.id === finding.criterion.id)
        .map((f) => f.url)
        .filter((url, i, arr) => arr.indexOf(url) === i);

    return {
        finding,
        fix: suggestFix(finding),
        affectedPages,
        estimatedEffort: estimateEffort(finding),
        wcagCriteria: [finding.criterion],
    };
}

function suggestFix(finding: VerifiedFinding): string {
    // Return a generic fix suggestion based on the finding
    // The agent will provide more specific suggestions in its final report
    const parts = [`Fix ${finding.criterion.id} (${finding.criterion.title})`];
    if (finding.selector) {
        parts.push(`on element \`${finding.selector}\``);
    }
    parts.push(`— ${finding.description}`);
    return parts.join(' ');
}

function estimateEffort(finding: VerifiedFinding): 'low' | 'medium' | 'high' {
    // Heuristic effort estimation
    const id = finding.criterion.id;
    // Color contrast, alt text, labels = typically low effort
    if (/^(1\.1|1\.4\.3|1\.3\.1|4\.1\.2)/.test(id)) return 'low';
    // Keyboard, focus, reflow = medium effort
    if (/^(2\.1|2\.4|1\.4\.10)/.test(id)) return 'medium';
    // Structural changes, timing, animation = high effort
    if (/^(1\.3\.2|2\.2|2\.3|3\.)/.test(id)) return 'high';
    return 'medium';
}
