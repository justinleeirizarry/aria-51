/**
 * WCAG Utilities - Shared functions for WCAG level handling
 *
 * This module centralizes WCAG-related logic to avoid duplication
 * between results-parser.ts and ResultsProcessorService.ts
 */
import type { AttributedViolation, ScanResults, WCAG22Results } from '../types.js';

/**
 * WCAG level breakdown type
 */
export type WcagLevelBreakdown = NonNullable<ScanResults['summary']['violationsByWcagLevel']>;

/**
 * Count violations by WCAG level based on tags
 *
 * @param violations - Array of attributed violations from axe-core
 * @returns Breakdown of violation counts by WCAG level
 */
export function countViolationsByWcagLevel(
    violations: AttributedViolation[]
): WcagLevelBreakdown {
    const counts: WcagLevelBreakdown = {
        wcag2a: 0,
        wcag2aa: 0,
        wcag2aaa: 0,
        wcag21a: 0,
        wcag21aa: 0,
        wcag22aa: 0,
        bestPractice: 0,
    };

    for (const violation of violations) {
        const nodeCount = violation.nodes.length;
        const tags = violation.tags || [];

        // Count by WCAG level tags present
        // A violation can have multiple tags (e.g., wcag2a and wcag21a)
        if (tags.includes('wcag2a')) counts.wcag2a += nodeCount;
        if (tags.includes('wcag2aa')) counts.wcag2aa += nodeCount;
        if (tags.includes('wcag2aaa')) counts.wcag2aaa += nodeCount;
        if (tags.includes('wcag21a')) counts.wcag21a += nodeCount;
        if (tags.includes('wcag21aa')) counts.wcag21aa += nodeCount;
        if (tags.includes('wcag22aa')) counts.wcag22aa += nodeCount;
        if (tags.includes('best-practice')) counts.bestPractice += nodeCount;
    }

    return counts;
}

/**
 * Add WCAG 2.2 custom check results to the level breakdown
 *
 * WCAG 2.2 checks are run separately from axe-core and need to be
 * integrated into the overall level counts.
 *
 * @param counts - Existing WCAG level counts to update (mutates in place)
 * @param wcag22 - WCAG 2.2 custom check results
 */
export function addWcag22ToLevelCounts(
    counts: WcagLevelBreakdown,
    wcag22: WCAG22Results
): void {
    // These are all AA level criteria in WCAG 2.2
    counts.wcag22aa +=
        wcag22.targetSize.length +
        wcag22.focusObscured.length +
        wcag22.dragging.length +
        wcag22.authentication.length +
        wcag22.errorSuggestion.length;

    // Focus Appearance is AAA level
    counts.wcag2aaa += wcag22.focusAppearance.length;
}

/**
 * Get the primary WCAG level from a set of tags
 *
 * Returns the most specific level found, or 'unknown' if no WCAG tag present.
 *
 * @param tags - Array of axe-core tags
 * @returns The WCAG level ('A', 'AA', 'AAA') or 'unknown'
 */
export function getWcagLevel(tags: string[]): 'A' | 'AA' | 'AAA' | 'unknown' {
    // Check in order of specificity (AAA is most specific)
    if (
        tags.includes('wcag2aaa') ||
        tags.includes('wcag21aaa') ||
        tags.includes('wcag22aaa')
    ) {
        return 'AAA';
    }
    if (
        tags.includes('wcag2aa') ||
        tags.includes('wcag21aa') ||
        tags.includes('wcag22aa')
    ) {
        return 'AA';
    }
    if (
        tags.includes('wcag2a') ||
        tags.includes('wcag21a') ||
        tags.includes('wcag22a')
    ) {
        return 'A';
    }
    return 'unknown';
}
