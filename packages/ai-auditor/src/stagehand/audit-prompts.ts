/**
 * WCAG Audit Agent Prompts
 *
 * System prompts and instructions for the WCAG audit agent.
 */

import type { WcagLevel } from '../types.js';
import { WCAG_CRITERIA, getAllCriteriaByLevel } from '@aria51/core';

/**
 * Build the main WCAG audit system prompt
 */
export function buildWcagAuditPrompt(targetLevel: WcagLevel, criteriaList: string): string {
    return `You are an expert WCAG 2.2 accessibility auditor. Your task is to systematically test this web page for accessibility compliance.

## Target Conformance Level: ${targetLevel}

## WCAG Criteria to Test

${criteriaList}

## Testing Process

For each criterion, you should:

1. **Observe** - Look at the current state of the page
2. **Interact** - Use keyboard navigation, click elements, fill forms as needed
3. **Evaluate** - Determine if the criterion passes, fails, or needs manual review
4. **Document** - Record your finding with specific details

## Testing Guidelines

### Keyboard Navigation (2.1.x)
- Tab through all interactive elements
- Verify focus is visible on each element
- Check for keyboard traps
- Test keyboard shortcuts

### Visual Presentation (1.4.x)
- Check color contrast of text
- Verify text can be resized
- Look for text spacing issues
- Check content on hover/focus

### Navigation (2.4.x)
- Check for skip links
- Verify page title is descriptive
- Check heading structure
- Test link purposes

### Forms (3.3.x)
- Check for error identification
- Verify labels and instructions
- Look for error suggestions
- Check authentication requirements

### Semantic Structure (1.3.x, 4.1.x)
- Verify proper heading hierarchy
- Check landmark regions
- Validate form labels
- Check name, role, value of widgets

## Response Format

For each issue found, provide:
- Criterion ID and title
- Status (pass/fail/manual-review)
- Affected element selector
- Description of the finding
- Impact level (critical/serious/moderate/minor)

Be thorough but efficient. Focus on actual accessibility barriers that affect users.`;
}

/**
 * Build criteria list for the specified level
 */
export function buildCriteriaList(targetLevel: WcagLevel, specificCriteria?: string[]): string {
    let criteria: typeof WCAG_CRITERIA[string][] = [];

    if (specificCriteria && specificCriteria.length > 0) {
        // Use specific criteria if provided
        criteria = specificCriteria
            .map(id => WCAG_CRITERIA[id])
            .filter((c): c is NonNullable<typeof c> => c !== undefined);
    } else {
        // Get all criteria up to and including target level
        criteria = getAllCriteriaByLevel('A');
        if (targetLevel === 'AA' || targetLevel === 'AAA') {
            criteria = [...criteria, ...getAllCriteriaByLevel('AA')];
        }
        if (targetLevel === 'AAA') {
            criteria = [...criteria, ...getAllCriteriaByLevel('AAA')];
        }
    }

    return criteria.map(c =>
        `### ${c.id} ${c.title} (Level ${c.level})
${c.description}
[Understanding ${c.id}](${c.w3cUrl})`
    ).join('\n\n');
}

/**
 * Get criteria relevant to keyboard accessibility for quick audit
 */
export function getKeyboardCriteria(): string[] {
    return [
        '2.1.1', // Keyboard
        '2.1.2', // No Keyboard Trap
        '2.1.4', // Character Key Shortcuts
        '2.4.3', // Focus Order
        '2.4.7', // Focus Visible
        '2.4.11', // Focus Not Obscured
    ];
}

/**
 * Get criteria relevant to visual presentation
 */
export function getVisualCriteria(): string[] {
    return [
        '1.4.1', // Use of Color
        '1.4.3', // Contrast (Minimum)
        '1.4.4', // Resize Text
        '1.4.10', // Reflow
        '1.4.11', // Non-text Contrast
        '1.4.12', // Text Spacing
        '1.4.13', // Content on Hover or Focus
    ];
}

/**
 * Get criteria relevant to forms
 */
export function getFormsCriteria(): string[] {
    return [
        '1.3.5', // Identify Input Purpose
        '3.3.1', // Error Identification
        '3.3.2', // Labels or Instructions
        '3.3.3', // Error Suggestion
        '3.3.4', // Error Prevention
        '3.3.7', // Redundant Entry
        '3.3.8', // Accessible Authentication
    ];
}

/**
 * Get criteria relevant to navigation/structure
 */
export function getNavigationCriteria(): string[] {
    return [
        '1.3.1', // Info and Relationships
        '1.3.2', // Meaningful Sequence
        '2.4.1', // Bypass Blocks
        '2.4.2', // Page Titled
        '2.4.4', // Link Purpose
        '2.4.6', // Headings and Labels
        '4.1.2', // Name, Role, Value
    ];
}

/**
 * Build a focused audit prompt for specific categories
 */
export function buildFocusedAuditPrompt(
    category: 'keyboard' | 'visual' | 'forms' | 'navigation',
    targetLevel: WcagLevel
): string {
    let criteria: string[];

    switch (category) {
        case 'keyboard':
            criteria = getKeyboardCriteria();
            break;
        case 'visual':
            criteria = getVisualCriteria();
            break;
        case 'forms':
            criteria = getFormsCriteria();
            break;
        case 'navigation':
            criteria = getNavigationCriteria();
            break;
    }

    const criteriaList = buildCriteriaList(targetLevel, criteria);
    return buildWcagAuditPrompt(targetLevel, criteriaList);
}

/**
 * Generate instruction for initial page analysis
 */
export function getInitialAnalysisInstruction(): string {
    return `First, analyze the current page:
1. What type of page is this? (landing page, form, dashboard, etc.)
2. What are the main interactive elements?
3. Are there any obvious accessibility issues visible?
4. What areas should be tested first?

Provide a brief overview before beginning systematic testing.`;
}

/**
 * Generate instruction for final summary
 */
export function getFinalSummaryInstruction(): string {
    return `Now provide a final summary:
1. Total number of issues found by severity
2. Most critical issues that need immediate attention
3. Overall accessibility score (0-100)
4. Top 3 recommendations for improvement

Be concise but comprehensive.`;
}
