/**
 * Confidence Scorer
 *
 * Assigns numeric confidence scores to verified findings
 * for sorting and filtering.
 */
import type { VerifiedFinding, ConfidenceLevel } from '../types.js';

const CONFIDENCE_WEIGHTS: Record<ConfidenceLevel, number> = {
    confirmed: 1.0,
    corroborated: 0.75,
    'ai-only': 0.4,
    contradicted: 0.1,
};

const IMPACT_WEIGHTS: Record<string, number> = {
    critical: 1.0,
    serious: 0.75,
    moderate: 0.5,
    minor: 0.25,
};

/**
 * Compute a numeric score (0-1) for a finding based on
 * confidence level and impact severity.
 */
export function scoreFinding(finding: VerifiedFinding): number {
    const confidenceWeight = CONFIDENCE_WEIGHTS[finding.confidence] || 0.5;
    const impactWeight = IMPACT_WEIGHTS[finding.impact] || 0.5;
    return confidenceWeight * 0.6 + impactWeight * 0.4;
}

/**
 * Sort findings by composite score (highest first)
 */
export function sortByScore(findings: VerifiedFinding[]): VerifiedFinding[] {
    return [...findings].sort((a, b) => scoreFinding(b) - scoreFinding(a));
}

/**
 * Filter out contradicted and low-confidence findings
 */
export function filterHighConfidence(
    findings: VerifiedFinding[],
    minConfidence: ConfidenceLevel = 'ai-only'
): VerifiedFinding[] {
    const minWeight = CONFIDENCE_WEIGHTS[minConfidence];
    return findings.filter(
        (f) => CONFIDENCE_WEIGHTS[f.confidence] >= minWeight
    );
}
