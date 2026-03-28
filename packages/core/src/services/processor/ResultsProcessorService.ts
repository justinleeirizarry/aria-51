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

            // --- Build content as separate blocks so nothing gets truncated ---
            const content: MCPToolContent[] = [];

            // Block 1: Summary + coverage overview
            const wcag22Total = results.wcag22?.summary?.totalViolations || 0;
            const supplementalTotal = results.supplementalResults?.length || 0;
            const supplementalFailed = results.supplementalResults?.filter(r => r.status === 'fail').length || 0;
            const supplementalPassed = supplementalTotal - supplementalFailed;

            let header = `## Scan Complete for ${results.url}\n\n`;
            header += `Found **${violationCount}** axe-core violations (**${criticalCount}** critical), **${wcag22Total}** WCAG 2.2 check violations.\n`;
            header += `**Supplemental tests:** ${supplementalTotal} criteria evaluated — ${supplementalPassed} passed, ${supplementalFailed} failed.\n`;

            // Add keyboard test summary
            if (results.keyboardTests && results.summary.keyboardIssues && results.summary.keyboardIssues > 0) {
                header += `**Keyboard issues:** ${results.summary.keyboardIssues}\n`;
            }

            content.push({ type: 'text', text: header });

            // Block 2: Supplemental test results (screen reader + keyboard checks)
            if (results.supplementalResults && results.supplementalResults.length > 0) {
                let supplementalText = '\n### Supplemental Test Results\n\n';
                for (const result of results.supplementalResults) {
                    const icon = result.status === 'pass' ? 'PASS' : result.status === 'fail' ? 'FAIL' : 'REVIEW';
                    supplementalText += `- **[${icon}]** ${result.criterionId} (${result.source})`;
                    if (result.status === 'fail' && result.issues.length > 0) {
                        supplementalText += ` — ${result.issues.length} issue(s)\n`;
                        for (const issue of result.issues.slice(0, 3)) {
                            supplementalText += `  - [${issue.severity}] ${issue.message}\n`;
                        }
                        if (result.issues.length > 3) {
                            supplementalText += `  - *...and ${result.issues.length - 3} more*\n`;
                        }
                    } else {
                        supplementalText += '\n';
                    }
                }
                content.push({ type: 'text', text: supplementalText });
            }

            // Block 3: WCAG 2.2 custom check violations
            if (results.wcag22 && wcag22Total > 0) {
                const wcag22Checks = results.wcag22;
                const checkCategories: Array<{ key: string; label: string }> = [
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
                    { key: 'sensoryCharacteristics', label: 'Sensory Characteristics (1.3.3)' },
                    { key: 'identifyPurpose', label: 'Identify Purpose (1.3.6)' },
                    { key: 'visualPresentation', label: 'Visual Presentation (1.4.8)' },
                    { key: 'characterKeyShortcuts', label: 'Character Key Shortcuts (2.1.4)' },
                    { key: 'animationInteractions', label: 'Animation from Interactions (2.3.3)' },
                    { key: 'threeFlashes', label: 'Three Flashes (2.3.1)' },
                    { key: 'sectionHeadings', label: 'Section Headings (2.4.10)' },
                    { key: 'pointerGestures', label: 'Pointer Gestures (2.5.1)' },
                    { key: 'pointerCancellation', label: 'Pointer Cancellation (2.5.2)' },
                    { key: 'motionActuation', label: 'Motion Actuation (2.5.4)' },
                    { key: 'onFocus', label: 'On Focus (3.2.1)' },
                    { key: 'onInput', label: 'On Input (3.2.2)' },
                    { key: 'redundantEntry', label: 'Redundant Entry (3.3.7)' },
                    { key: 'mediaAudioDescription', label: 'Audio Description (1.2.3)' },
                    { key: 'mediaLiveCaptions', label: 'Captions — Live (1.2.4)' },
                    { key: 'mediaSignLanguage', label: 'Sign Language (1.2.6)' },
                    { key: 'mediaExtendedAudioDescription', label: 'Extended Audio Description (1.2.7)' },
                    { key: 'mediaAlternative', label: 'Media Alternative (1.2.8)' },
                    { key: 'mediaLiveAudio', label: 'Audio-only — Live (1.2.9)' },
                    { key: 'mediaBackgroundAudio', label: 'Low/No Background Audio (1.4.7)' },
                    { key: 'imagesOfText', label: 'Images of Text (1.4.9)' },
                    { key: 'keyboardNoException', label: 'Keyboard — No Exception (2.1.3)' },
                    { key: 'noTiming', label: 'No Timing (2.2.3)' },
                    { key: 'interruptions', label: 'Interruptions (2.2.4)' },
                    { key: 'reAuthenticating', label: 'Re-authenticating (2.2.5)' },
                    { key: 'timeouts', label: 'Timeouts (2.2.6)' },
                    { key: 'threeFlashesAbsolute', label: 'Three Flashes (2.3.2)' },
                    { key: 'location', label: 'Location (2.4.8)' },
                    { key: 'focusNotObscuredEnhanced', label: 'Focus Not Obscured — Enhanced (2.4.12)' },
                    { key: 'targetSizeEnhanced', label: 'Target Size — Enhanced (2.5.5)' },
                    { key: 'concurrentInput', label: 'Concurrent Input Mechanisms (2.5.6)' },
                    { key: 'unusualWords', label: 'Unusual Words (3.1.3)' },
                    { key: 'abbreviations', label: 'Abbreviations (3.1.4)' },
                    { key: 'readingLevel', label: 'Reading Level (3.1.5)' },
                    { key: 'pronunciation', label: 'Pronunciation (3.1.6)' },
                    { key: 'errorPreventionLegal', label: 'Error Prevention — Legal/Financial (3.3.4)' },
                    { key: 'help', label: 'Help (3.3.5)' },
                    { key: 'errorPreventionAll', label: 'Error Prevention — All (3.3.6)' },
                    { key: 'accessibleAuthEnhanced', label: 'Accessible Auth — Enhanced (3.3.9)' },
                ];

                let wcag22Text = '\n### WCAG 2.2 Custom Check Violations\n';
                for (const { key, label } of checkCategories) {
                    const items = (wcag22Checks as Record<string, unknown>)[key] as Array<{ description: string; selector: string; impact: string }> | undefined;
                    if (items && items.length > 0) {
                        wcag22Text += `\n#### ${label} — ${items.length} violation(s)\n`;
                        const maxShow = 3;
                        for (const v of items.slice(0, maxShow)) {
                            wcag22Text += `- **${v.description}**\n  Element: \`${v.selector}\`\n  Impact: ${v.impact}\n`;
                        }
                        if (items.length > maxShow) {
                            wcag22Text += `- *...and ${items.length - maxShow} more*\n`;
                        }
                    }
                }
                content.push({ type: 'text', text: wcag22Text });
            }

            // Block 4: Axe-core violation details
            if (violationCount > 0) {
                let axeText = '\n### Axe-Core Violation Details\n';
                axeText += formatViolations(results.violations);
                content.push({ type: 'text', text: axeText });
            } else {
                content.push({ type: 'text', text: '\nNo axe-core violations found!' });
            }

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
