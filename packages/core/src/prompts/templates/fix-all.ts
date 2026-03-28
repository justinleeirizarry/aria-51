import type { PromptTemplate } from '../../types.js';
import { formatViolations } from '../formatters.js';

export const fixAllTemplate: PromptTemplate = {
    name: 'fix-all',
    description: 'Comprehensive prompt to fix all accessibility violations',
    render: (context) => {
        const { violations, url, summary } = context;

        // Count violations (rules) by severity from the violations array
        const rulesBySeverity = violations.reduce((acc, v) => {
            acc[v.impact] = (acc[v.impact] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Format severity breakdown for rules
        const severityLines: string[] = [];
        if (rulesBySeverity.critical) severityLines.push(`- Critical: ${rulesBySeverity.critical}`);
        if (rulesBySeverity.serious) severityLines.push(`- Serious: ${rulesBySeverity.serious}`);
        if (rulesBySeverity.moderate) severityLines.push(`- Moderate: ${rulesBySeverity.moderate}`);
        if (rulesBySeverity.minor) severityLines.push(`- Minor: ${rulesBySeverity.minor}`);

        // Count total instances across all violations
        const totalInstances = violations.reduce((acc, v) => acc + v.nodes.length, 0);

        // Add passes context if available
        const passesNote = summary.totalPasses > 0
            ? `\n> ${summary.totalPasses} accessibility rules are passing.`
            : '';

        // Add incomplete note if needed
        const incompleteNote = summary.totalIncomplete > 0
            ? `\n> ${summary.totalIncomplete} items need manual review (not included below).`
            : '';

        // WCAG 2.2 custom check section
        let wcag22Section = '';
        if (context.wcag22 && context.wcag22.summary.totalViolations > 0) {
            const lines: string[] = ['## WCAG 2.2 Custom Check Violations\n'];
            for (const [criterion, count] of Object.entries(context.wcag22.summary.byCriterion)) {
                if ((count as number) > 0) {
                    lines.push(`- **${criterion}**: ${count} violation(s)`);
                }
            }
            wcag22Section = '\n' + lines.join('\n') + '\n';
        }

        // Supplemental test section (keyboard + screen reader)
        let supplementalSection = '';
        if (context.supplementalResults && context.supplementalResults.length > 0) {
            const failures = context.supplementalResults.filter(r => r.status === 'fail');
            if (failures.length > 0) {
                const lines: string[] = ['## Supplemental Test Failures\n'];
                for (const f of failures) {
                    lines.push(`### ${f.criterionId} (${f.source})\n`);
                    for (const issue of f.issues) {
                        lines.push(`- **[${issue.severity}]** ${issue.message}`);
                    }
                    lines.push('');
                }
                supplementalSection = '\n' + lines.join('\n');
            }
        }

        // Keyboard test section
        let keyboardSection = '';
        if (context.keyboardTests && summary.keyboardIssues && summary.keyboardIssues > 0) {
            keyboardSection = `\n## Keyboard Navigation Issues\n\n**${summary.keyboardIssues} keyboard issue(s) detected.**\n`;
        }

        return `# Accessibility Fix Request

You are an expert developer and accessibility specialist.
I need you to fix ALL accessibility violations in my application.
Source file locations are provided where available — use them to navigate directly to the code that needs fixing.

## Scan Context
**URL:** ${url}

### Summary
- **Total Components:** ${summary.totalComponents}
- **Components with Issues:** ${summary.componentsWithViolations}
- **Violated Rules:** ${violations.length}
- **Total Instances:** ${totalInstances}

### Rules by Severity
${severityLines.length > 0 ? severityLines.join('\n') : '- None'}
${passesNote}${incompleteNote}

## Detailed Violations
${formatViolations(violations)}
${wcag22Section}${supplementalSection}${keyboardSection}

## Requirements
1. **Fix all violations** — use the source file locations to navigate to and edit the right files
2. Use **semantic HTML** where possible (prefer \`<main>\`, \`<nav>\`, \`<header>\`, \`<footer>\` over \`<div>\`)
3. Add **ARIA attributes** only when semantic HTML is not sufficient
4. Ensure **keyboard navigation** works correctly
5. Maintain current styling and layout
6. Follow **WCAG 2.1 AA** guidelines

## Deliverables
For each violation:
1. Open the source file at the specified location
2. Apply the fix
3. Briefly explain the change

## Who Benefits
- Screen reader users
- Keyboard-only users
- Users with low vision or color blindness
- Users with motor disabilities`;
    }
};
