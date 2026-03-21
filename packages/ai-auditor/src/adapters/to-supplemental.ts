/**
 * Adapters to convert ai-auditor service results into SupplementalTestResult[]
 * for integration with the main scan compliance table.
 */
import type { SupplementalTestResult, SupplementalIssue } from '@aria51/core';
import type {
    StagehandKeyboardResults,
    StagehandKeyboardIssue,
    TreeAnalysisResult,
    TreeIssue,
    ScreenReaderNavigationResults,
    ScreenReaderIssue,
} from '../types.js';

// Maps keyboard issue types to primary WCAG criteria
const KEYBOARD_ISSUE_CRITERIA: Record<string, string> = {
    'focus-trap': '2.1.2',
    'no-focus-indicator': '2.4.7',
    'tab-order-violation': '2.4.3',
    'keyboard-inaccessible': '2.1.1',
    'skip-link-broken': '2.4.1',
    'shortcut-conflict': '2.1.4',
};

// Maps tree issue types to primary WCAG criteria
const TREE_ISSUE_CRITERIA: Record<string, string> = {
    'missing-name': '4.1.2',
    'missing-role': '4.1.2',
    'invalid-role': '4.1.2',
    'missing-landmark': '1.3.1',
    'heading-skip': '1.3.1',
    'orphaned-control': '1.3.1',
    'duplicate-id': '4.1.1',
    'focusable-hidden': '4.1.2',
};

// Maps screen reader issue types to primary WCAG criteria
const SCREEN_READER_ISSUE_CRITERIA: Record<string, string> = {
    'missing-landmark': '1.3.1',
    'missing-main-landmark': '1.3.1',
    'multiple-main-landmarks': '1.3.1',
    'landmark-no-label': '2.4.1',
    'heading-skip': '1.3.1',
    'missing-h1': '2.4.6',
    'multiple-h1': '1.3.1',
    'empty-heading': '2.4.6',
    'missing-skip-link': '2.4.1',
    'broken-skip-link': '2.4.1',
    'missing-page-title': '2.4.2',
    'generic-link-text': '2.4.4',
    'missing-alt-text': '1.1.1',
    'missing-form-label': '1.3.1',
    'missing-element-name': '4.1.2',
    'tab-not-following-landmarks': '2.4.3',
};

/**
 * Convert keyboard test results to supplemental results
 */
export function keyboardResultsToSupplemental(
    results: StagehandKeyboardResults
): SupplementalTestResult[] {
    // Group issues by criterion
    const byCriterion = new Map<string, SupplementalIssue[]>();

    for (const issue of results.issues) {
        const criterionId = KEYBOARD_ISSUE_CRITERIA[issue.type] || '2.1.1';
        if (!byCriterion.has(criterionId)) {
            byCriterion.set(criterionId, []);
        }
        byCriterion.get(criterionId)!.push({
            message: issue.message,
            selector: issue.element?.selector,
            severity: issue.severity,
            evidence: issue.reproduction?.join('; '),
        });
    }

    // All criteria keyboard testing covers
    const testedCriteria = ['2.1.1', '2.1.2', '2.4.3', '2.4.7'];
    const supplemental: SupplementalTestResult[] = [];

    for (const criterionId of testedCriteria) {
        const issues = byCriterion.get(criterionId) || [];
        supplemental.push({
            criterionId,
            status: issues.length > 0 ? 'fail' : 'pass',
            source: 'stagehand-keyboard',
            issues,
        });
    }

    return supplemental;
}

/**
 * Convert tree analysis results to supplemental results
 */
export function treeResultsToSupplemental(
    results: TreeAnalysisResult
): SupplementalTestResult[] {
    const byCriterion = new Map<string, SupplementalIssue[]>();

    for (const issue of results.issues) {
        const criterionId = TREE_ISSUE_CRITERIA[issue.type] || '4.1.2';
        if (!byCriterion.has(criterionId)) {
            byCriterion.set(criterionId, []);
        }
        byCriterion.get(criterionId)!.push({
            message: issue.message,
            selector: issue.node?.selector,
            severity: issue.severity,
        });
    }

    // All criteria tree analysis covers
    const testedCriteria = ['1.3.1', '4.1.2', '2.4.6', '4.1.1'];
    const supplemental: SupplementalTestResult[] = [];

    for (const criterionId of testedCriteria) {
        const issues = byCriterion.get(criterionId) || [];
        supplemental.push({
            criterionId,
            status: issues.length > 0 ? 'fail' : 'pass',
            source: 'stagehand-tree',
            issues,
        });
    }

    return supplemental;
}

/**
 * Convert screen reader navigation results to supplemental results
 */
export function screenReaderResultsToSupplemental(
    results: ScreenReaderNavigationResults
): SupplementalTestResult[] {
    const byCriterion = new Map<string, SupplementalIssue[]>();

    for (const issue of results.issues) {
        const criterionId = SCREEN_READER_ISSUE_CRITERIA[issue.type] || '1.3.1';
        if (!byCriterion.has(criterionId)) {
            byCriterion.set(criterionId, []);
        }
        byCriterion.get(criterionId)!.push({
            message: issue.message,
            selector: undefined,
            severity: issue.severity,
        });
    }

    // All criteria screen reader testing covers
    const testedCriteria = ['2.4.1', '2.4.2', '2.4.4', '2.4.6', '1.1.1'];
    const supplemental: SupplementalTestResult[] = [];

    for (const criterionId of testedCriteria) {
        const issues = byCriterion.get(criterionId) || [];
        supplemental.push({
            criterionId,
            status: issues.length > 0 ? 'fail' : 'pass',
            source: 'stagehand-screen-reader',
            issues,
        });
    }

    return supplemental;
}
