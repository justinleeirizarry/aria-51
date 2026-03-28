/**
 * Scan Mode Handler
 *
 * Handles the default accessibility scan mode (non-TTY).
 * Outputs results in quiet or full format to stdout.
 */
import type { BrowserType, ScanResults } from '@aria51/core';
import {
    runScanAsPromise,
    runMultiScanAsPromise,
    AppLayer,
    EXIT_CODES,
    setExitCode,
    generateAndExport,
    ScanError,
} from '@aria51/core';
import { getComponentBundlePath } from '@aria51/components';

export interface ScanModeOptions {
    urls: string[];
    browser: BrowserType;
    headless: boolean;
    tags?: string[];
    mobile?: boolean;
    keyboardNav?: boolean;
    output?: string;
    ci: boolean;
    threshold: number;
    components: boolean;
    disableRules?: string[];
    exclude?: string[];
    quiet: boolean;
    ai: boolean;
}

export async function runScanMode(opts: ScanModeOptions): Promise<void> {
    const commonOptions = {
        browser: opts.browser,
        headless: opts.headless,
        tags: opts.tags,
        mobile: opts.mobile,
        includeKeyboardTests: opts.keyboardNav,
        outputFile: opts.output,
        ciMode: opts.ci,
        ciThreshold: opts.threshold,
        componentBundlePath: opts.components ? getComponentBundlePath() : undefined,
        disableRules: opts.disableRules,
        exclude: opts.exclude,
    };

    try {
        const scanResults = opts.urls.length > 1
            ? await runMultiScanAsPromise(opts.urls, commonOptions, AppLayer)
            : [await runScanAsPromise({ ...commonOptions, url: opts.urls[0] }, AppLayer)];

        let allCiPassed = true;
        for (let i = 0; i < scanResults.length; i++) {
            const ciPassed = outputResult(opts.urls[i], scanResults[i], opts);
            if (ciPassed === false) allCiPassed = false;
        }

        if (opts.ci) {
            setExitCode(allCiPassed ? EXIT_CODES.SUCCESS : EXIT_CODES.VIOLATIONS_FOUND);
        } else {
            setExitCode(EXIT_CODES.SUCCESS);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify({
            error: errorMessage,
            ...(error instanceof ScanError ? { tag: error.tag, details: error.details } : {}),
            stack: error instanceof Error ? error.stack : undefined,
        }, null, 2));
        setExitCode(EXIT_CODES.RUNTIME_ERROR);
    }
}

function outputResult(
    scanUrl: string,
    { results, ciPassed }: { results: ScanResults; ciPassed?: boolean },
    opts: ScanModeOptions,
): boolean | undefined {
    if (opts.quiet) {
        outputQuiet(scanUrl, results);
    } else {
        outputFull(scanUrl, results);
    }

    if (opts.ai) {
        const promptPath = generateAndExport(results, {
            template: 'fix-all',
            format: 'md',
            outputPath: undefined,
        });
        console.error(`AI prompt written to: ${promptPath}`);
    }

    return ciPassed;
}

function outputQuiet(scanUrl: string, results: ScanResults): void {
    const { summary, violations } = results;
    const statusIcon = summary.totalViolations > 0 ? 'x' : 'v';
    console.log(`${statusIcon} ${scanUrl} - ${summary.totalViolations} violations, ${summary.totalPasses} passes`);

    if (summary.totalViolations > 0) {
        const { violationsBySeverity } = summary;
        const parts = [];
        if (violationsBySeverity.critical > 0) parts.push(`${violationsBySeverity.critical} critical`);
        if (violationsBySeverity.serious > 0) parts.push(`${violationsBySeverity.serious} serious`);
        if (violationsBySeverity.moderate > 0) parts.push(`${violationsBySeverity.moderate} moderate`);
        if (violationsBySeverity.minor > 0) parts.push(`${violationsBySeverity.minor} minor`);
        if (parts.length > 0) console.log(parts.join(' '));
    }

    for (const violation of violations) {
        console.log(`[${violation.impact}] ${violation.id} (${violation.nodes.length}): ${violation.description}`);
        if (violation.helpUrl) console.log(`  Docs: ${violation.helpUrl}`);
    }

    if (results.wcag22 && results.wcag22.summary.totalViolations > 0) {
        console.log(`WCAG 2.2: ${results.wcag22.summary.totalViolations} violations`);
    }
    if (results.supplementalResults && results.supplementalResults.length > 0) {
        const passed = results.supplementalResults.filter(r => r.status === 'pass').length;
        const failed = results.supplementalResults.filter(r => r.status === 'fail').length;
        console.log(`Supplemental: ${results.supplementalResults.length} tests, ${passed} passed, ${failed} failed`);
    }
    if (results.keyboardTests) {
        const kb = results.keyboardTests;
        const parts = [];
        if (kb.tabOrder.violations.length > 0) parts.push(`${kb.tabOrder.violations.length} tab-order`);
        if (kb.focusManagement.focusIndicatorIssues.length > 0) parts.push(`${kb.focusManagement.focusIndicatorIssues.length} focus-indicator`);
        const widgetIssues = kb.shortcuts.customWidgets.filter(w => w.keyboardSupport !== 'full').length;
        if (widgetIssues > 0) parts.push(`${widgetIssues} widget`);
        if (parts.length > 0) console.log(`Keyboard: ${parts.join(', ')} issues`);
    }
}

function outputFull(scanUrl: string, results: ScanResults): void {
    const { summary, violations, incomplete } = results;
    const sev = summary.violationsBySeverity;
    const sep = '─'.repeat(60);

    console.log(`aria51 / ${scanUrl}\n`);
    const sevParts = [];
    if (sev.critical > 0) sevParts.push(`${sev.critical} critical`);
    if (sev.serious > 0) sevParts.push(`${sev.serious} serious`);
    if (sev.moderate > 0) sevParts.push(`${sev.moderate} moderate`);
    if (sev.minor > 0) sevParts.push(`${sev.minor} minor`);
    const componentsPart = summary.totalComponents > 0 ? `  ${summary.totalComponents} components` : '';
    console.log(`${summary.totalViolations} violations  ${summary.totalPasses} passes${componentsPart}`);
    if (sevParts.length > 0) console.log(sevParts.join('  '));
    if (results.keyboardTests) {
        const kb = results.keyboardTests;
        const parts = [];
        if (kb.tabOrder.violations.length > 0) parts.push(`${kb.tabOrder.violations.length} tab-order`);
        if (kb.focusManagement.focusIndicatorIssues.length > 0) parts.push(`${kb.focusManagement.focusIndicatorIssues.length} focus-indicator`);
        const widgetIssues = kb.shortcuts.customWidgets.filter(w => w.keyboardSupport !== 'full').length;
        if (widgetIssues > 0) parts.push(`${widgetIssues} widget`);
        if (parts.length > 0) console.log(`Keyboard: ${parts.join(', ')} issues`);
    }
    console.log(`\n${sep}\n`);

    if (violations.length === 0) {
        console.log('No violations found.\n');
    }

    for (const v of violations) {
        console.log(`${v.impact.toUpperCase()}  ${v.id}  ${v.nodes.length} instance${v.nodes.length !== 1 ? 's' : ''}`);
        console.log(v.description);
        if (v.fixSuggestion) console.log(`FIX: ${v.fixSuggestion.summary}`);
        console.log('');

        for (const n of v.nodes) {
            const src = (n as any).source;
            const sourceStack = (n as any).sourceStack as Array<{ filePath: string; lineNumber?: number | null; columnNumber?: number | null; componentName?: string | null }> | undefined;
            const fmtLoc = (s: any) => s?.filePath ? s.filePath + (s.lineNumber ? ':' + s.lineNumber : '') + (s.columnNumber ? ':' + s.columnNumber : '') : '';
            const loc = fmtLoc(src);
            const path = (n.userComponentPath || n.componentPath || []).filter(
                (name: string) => name.length > 2 && name[0] === name[0].toUpperCase() && !/^(Provider|Context|Fragment|Suspense)/.test(name)
            );
            const comp = path.length > 0 ? path[path.length - 1] : (n.component && n.component.length > 2 ? n.component : null);

            if (loc && comp) {
                console.log(`  ${loc} in ${comp}`);
            } else if (loc) {
                console.log(`  ${loc}`);
            } else if (comp) {
                console.log(`  ${comp}`);
            }

            if (sourceStack && sourceStack.length > 1) {
                for (const frame of sourceStack.slice(0, 5)) {
                    const name = frame.componentName && frame.componentName.length > 2 ? frame.componentName : '';
                    const frameLoc = fmtLoc(frame);
                    console.log(`    ${name ? 'in ' + name + ' ' : ''}(${frameLoc})`);
                }
            }

            console.log(`  ${(n.htmlSnippet || n.html || '').substring(0, 80)}`);
        }

        if (v.helpUrl) console.log(`\n  ${v.helpUrl}`);
        console.log(`\n${sep}\n`);
    }

    if (incomplete && incomplete.length > 0) {
        console.log(`REVIEW  ${incomplete.length} items need manual review\n`);
        for (const item of incomplete.slice(0, 5)) {
            console.log(`  ${item.id}`);
            console.log(`  ${item.description}`);
        }
    }

    if (results.wcag22 && results.wcag22.summary.totalViolations > 0) {
        const w = results.wcag22;
        console.log(`\nWCAG 2.2 CHECKS  ${w.summary.totalViolations} violations\n`);
        for (const [key, arr] of Object.entries(w)) {
            if (key === 'summary') continue;
            const items = arr as any[];
            if (items && items.length > 0) {
                const label = (items[0] as any).criterion || key;
                console.log(`  ${label}: ${items.length}`);
            }
        }
        console.log('');
    }

    if (results.supplementalResults && results.supplementalResults.length > 0) {
        const passed = results.supplementalResults.filter(r => r.status === 'pass').length;
        const failed = results.supplementalResults.filter(r => r.status === 'fail');
        console.log(`SUPPLEMENTAL TESTS  ${results.supplementalResults.length} criteria  ${passed} passed  ${failed.length} failed\n`);
        for (const r of results.supplementalResults) {
            const icon = r.status === 'pass' ? 'PASS' : 'FAIL';
            const issueCount = r.issues.length > 0 ? ` (${r.issues.length} issues)` : '';
            console.log(`  [${icon}] ${r.criterionId}${issueCount}  ${r.source}`);
            if (r.status === 'fail') {
                for (const issue of r.issues.slice(0, 3)) {
                    console.log(`         [${issue.severity}] ${issue.message}`);
                }
                if (r.issues.length > 3) {
                    console.log(`         ...and ${r.issues.length - 3} more`);
                }
            }
        }
        console.log('');
    }
}
