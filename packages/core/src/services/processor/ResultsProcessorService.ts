/**
 * Results Processor Service - Centralizes results transformation and formatting
 *
 * Combines logic from results-parser.ts, mcp-server.ts, and App.tsx
 */
import { Effect } from 'effect';
import type { BrowserScanData, ScanResults, AttributedViolation, WcagCriterionInfo } from '../../types.js';
import { formatViolations } from '../../prompts/formatters.js';
import { countViolationsByWcagLevel, addWcag22ToLevelCounts } from '../../utils/wcag-utils.js';
import { getWcagCriteriaForViolation } from '../../data/index.js';
import type {
    ScanMetadata,
    MCPToolContent,
    MCPFormatOptions,
    CIResult,
    IResultsProcessorService,
} from './types.js';

/**
 * ResultsProcessorService - Handles all results transformation and formatting
 *
 * This service centralizes:
 * - Raw data to ScanResults transformation
 * - JSON formatting (with circular reference handling)
 * - MCP format output
 * - CI mode threshold checking
 *
 * All methods return Effects for composability with the Effect ecosystem.
 */
export class ResultsProcessorService implements IResultsProcessorService {
    /**
     * Enrich violations with full WCAG criterion information
     */
    private enrichViolationsWithWcagCriteria(violations: AttributedViolation[]): AttributedViolation[] {
        return violations.map(violation => {
            const criteria = getWcagCriteriaForViolation(violation.id);
            if (criteria.length === 0) {
                return violation;
            }

            // Convert WcagCriterion to WcagCriterionInfo (subset for serialization)
            const wcagCriteria: WcagCriterionInfo[] = criteria.map(c => ({
                id: c.id,
                title: c.title,
                level: c.level,
                principle: c.principle,
                w3cUrl: c.w3cUrl
            }));

            return {
                ...violation,
                wcagCriteria
            };
        });
    }

    /**
     * Process raw scan data into structured results
     */
    process(data: BrowserScanData, metadata: ScanMetadata): Effect.Effect<ScanResults> {
        return Effect.sync(() => {
            const {
                components,
                violations: rawViolations,
                passes,
                incomplete,
                inapplicable,
                keyboardTests,
                wcag22,
                accessibilityTree
            } = data;
            const { url, browser, timestamp } = metadata;

            // Enrich violations with WCAG criterion information
            const attributedViolations = this.enrichViolationsWithWcagCriteria(rawViolations);

            // Count unique components with violations
            const componentsWithViolationsSet = new Set<string>();
            for (const violation of attributedViolations) {
                for (const node of violation.nodes) {
                    if (node.component) {
                        componentsWithViolationsSet.add(node.component);
                    }
                }
            }

            // Calculate total violations (sum of all instances)
            const totalViolations = attributedViolations.reduce((acc, v) => acc + v.nodes.length, 0);

            // Calculate totals for passes, incomplete, inapplicable
            const totalPasses = passes?.length || 0;
            const totalIncomplete = incomplete?.length || 0;
            const totalInapplicable = inapplicable?.length || 0;

            // Calculate keyboard issues if keyboard tests were run
            const keyboardIssues = keyboardTests?.summary.totalIssues;

            // Calculate severity breakdown by instances
            const violationsBySeverity = {
                critical: attributedViolations
                    .filter((v) => v.impact === 'critical')
                    .reduce((acc, v) => acc + v.nodes.length, 0),
                serious: attributedViolations
                    .filter((v) => v.impact === 'serious')
                    .reduce((acc, v) => acc + v.nodes.length, 0),
                moderate: attributedViolations
                    .filter((v) => v.impact === 'moderate')
                    .reduce((acc, v) => acc + v.nodes.length, 0),
                minor: attributedViolations
                    .filter((v) => v.impact === 'minor')
                    .reduce((acc, v) => acc + v.nodes.length, 0),
            };

            // Calculate WCAG level breakdown
            const violationsByWcagLevel = countViolationsByWcagLevel(attributedViolations);

            // Add WCAG 2.2 violations to the level counts
            if (wcag22) {
                addWcag22ToLevelCounts(violationsByWcagLevel, wcag22);
            }

            // Calculate WCAG 2.2 issues if checks were run
            const wcag22Issues = wcag22?.summary.totalViolations;

            // Calculate summary statistics
            const summary = {
                totalComponents: components.length,
                totalViolations,
                totalPasses,
                totalIncomplete,
                totalInapplicable,
                violationsBySeverity,
                violationsByWcagLevel,
                componentsWithViolations: componentsWithViolationsSet.size,
                keyboardIssues,
                wcag22Issues,
            };

            return {
                url,
                timestamp: timestamp ?? new Date().toISOString(),
                browser,
                components,
                violations: attributedViolations,
                passes,
                incomplete,
                inapplicable,
                accessibilityTree,
                keyboardTests,
                wcag22,
                summary,
            };
        });
    }

    /**
     * Format results as JSON string
     * Handles circular references that can occur with Fiber data
     */
    formatAsJSON(results: ScanResults, pretty = true): Effect.Effect<string> {
        return Effect.sync(() => {
            const seen = new WeakSet();
            const replacer = (_key: string, value: any) => {
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return '[Circular Reference]';
                    }
                    seen.add(value);
                }
                return value;
            };

            return pretty ? JSON.stringify(results, replacer, 2) : JSON.stringify(results, replacer);
        });
    }

    /**
     * Format results for MCP (Model Context Protocol) output
     */
    formatForMCP(results: ScanResults, options?: MCPFormatOptions): Effect.Effect<MCPToolContent[]> {
        return Effect.sync(() => {
            const violationCount = results.violations.length;
            const criticalCount = results.summary.violationsBySeverity.critical;

            let summary = `## Scan Complete for ${results.url}\n\n`;
            summary += `Found **${violationCount}** violations (**${criticalCount}** critical).\n\n`;

            if (violationCount > 0) {
                summary += '### Violations Summary\n';
                summary += formatViolations(results.violations);
            } else {
                summary += 'No accessibility violations found!';
            }

            // Add WCAG 2.2 custom check violations
            if (results.wcag22) {
                const wcag22Checks = results.wcag22;
                const checkCategories = [
                    { key: 'targetSize', label: 'Target Size (2.5.8)' },
                    { key: 'focusObscured', label: 'Focus Not Obscured (2.4.11)' },
                    { key: 'focusAppearance', label: 'Focus Appearance (2.4.13)' },
                    { key: 'dragging', label: 'Dragging Movements (2.5.7)' },
                    { key: 'authentication', label: 'Accessible Authentication (3.3.8)' },
                    { key: 'statusMessages', label: 'Status Messages (4.1.3)' },
                    { key: 'errorIdentification', label: 'Error Identification (3.3.1)' },
                    { key: 'errorSuggestion', label: 'Error Suggestion (3.3.3)' },
                    { key: 'meaningfulSequence', label: 'Meaningful Sequence (1.3.2)' },
                    { key: 'reflow', label: 'Reflow (1.4.10)' },
                    { key: 'hoverFocusContent', label: 'Content on Hover or Focus (1.4.13)' },
                ] as const;

                const wcag22Violations: string[] = [];
                for (const { key, label } of checkCategories) {
                    const items = (wcag22Checks as any)[key];
                    if (items && items.length > 0) {
                        wcag22Violations.push(`\n#### ${label} — ${items.length} violation(s)\n`);
                        for (const v of items) {
                            wcag22Violations.push(`- **${v.description}**\n  Element: \`${v.selector}\`\n  Impact: ${v.impact}\n`);
                        }
                    }
                }

                if (wcag22Violations.length > 0) {
                    summary += '\n### WCAG 2.2 Custom Check Violations\n';
                    summary += wcag22Violations.join('');
                }
            }

            // Add supplemental (Stagehand) results
            if (results.supplementalResults && results.supplementalResults.length > 0) {
                const failed = results.supplementalResults.filter(r => r.status === 'fail');
                if (failed.length > 0) {
                    summary += '\n### AI-Powered Test Findings\n';
                    for (const result of failed) {
                        summary += `\n#### ${result.criterionId} — ${result.issues.length} issue(s) (${result.source})\n`;
                        for (const issue of result.issues) {
                            summary += `- **[${issue.severity}]** ${issue.message}`;
                            if (issue.selector) summary += `\n  Element: \`${issue.selector}\``;
                            summary += '\n';
                        }
                    }
                }
                const passed = results.supplementalResults.filter(r => r.status === 'pass').length;
                summary += `\n*AI tests: ${passed} criteria passed, ${failed.length} criteria with issues*\n`;
            }

            // Add keyboard test summary
            if (results.keyboardTests && results.summary.keyboardIssues && results.summary.keyboardIssues > 0) {
                summary += `\n### Keyboard Issues\n`;
                summary += `Found **${results.summary.keyboardIssues}** keyboard accessibility issues.\n`;
            }

            const content: MCPToolContent[] = [{ type: 'text', text: summary }];

            // Optionally include accessibility tree
            if (options?.includeTree && results.accessibilityTree) {
                content.push({
                    type: 'text',
                    text:
                        '\n\n### Accessibility Tree\n```json\n' +
                        JSON.stringify(results.accessibilityTree, null, 2) +
                        '\n```',
                });
            }

            return content;
        });
    }

    /**
     * Format results for CI mode with threshold checking
     */
    formatForCI(results: ScanResults, threshold: number): Effect.Effect<CIResult> {
        return Effect.sync(() => {
            const totalViolations = results.summary.totalViolations;
            const criticalViolations = results.summary.violationsBySeverity.critical;
            const passed = totalViolations <= threshold;

            const message = passed
                ? `CI Check Passed: ${totalViolations} violation(s) found (threshold: ${threshold})`
                : `CI Check Failed: ${totalViolations} violation(s) found (threshold: ${threshold})`;

            return {
                passed,
                totalViolations,
                criticalViolations,
                threshold,
                message,
            };
        });
    }
}

/**
 * Create a new ResultsProcessorService instance
 */
export function createResultsProcessorService(): IResultsProcessorService {
    return new ResultsProcessorService();
}
