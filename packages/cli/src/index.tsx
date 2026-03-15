#!/usr/bin/env node
import { configDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load .env from current directory or monorepo root (for pnpm workspace)
const envPaths = ['.env', '../../.env'].map(p => resolve(process.cwd(), p));
const envPath = envPaths.find(p => existsSync(p));
configDotenv({ path: envPath, quiet: true });
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { Effect } from 'effect';
import App from './App.js';
import { getComponentBundlePath } from '@accessibility-toolkit/react';
import type { BrowserType, WcagLevel } from '@accessibility-toolkit/core';
import {
    validateUrl,
    validateTags,
    validateThreshold,
    validateBrowser,
    runScanAsPromise,
    runMultiScanAsPromise,
    AppLayer,
    EXIT_CODES,
    setExitCode,
    exitWithCode,
    updateConfig,
    loadEnvConfig,
    hasEnvConfig,
    loadConfigFile,
    logger,
    LogLevel,
    generateAndExport,
    generatePrompt,
    ScanError,
} from '@accessibility-toolkit/core';
import {
    createTestGenerationService,
    createKeyboardTestService,
    createTreeAnalysisService,
    createWcagAuditService,
} from '@accessibility-toolkit/ai-auditor';

// Load configuration: config file first, then env vars override
const configFileResult = await loadConfigFile();
if (configFileResult) {
    updateConfig(configFileResult.config);
    logger.debug(`Loaded config from ${configFileResult.filepath}`);
}
if (hasEnvConfig()) {
    updateConfig(loadEnvConfig());
}

const cli = meow(
    `
  Usage
    $ a11y-toolkit <url> [url2] [url3] ...

  Accessibility Scan Options
    --browser, -b      Browser to use (chromium, firefox, webkit) [default: chromium]
    --no-components    Disable automatic component attribution (React, Vue, Svelte, Solid)
    --output, -o       Output file path (JSON format)
    --ci               CI mode - exit with code 1 if violations found
    --threshold        Maximum allowed violations in CI mode [default: 0]
    --headless         Run browser in headless mode [default: true]
    --ai               Generate AI prompt for fixing violations (markdown)
    --tags             Comma-separated list of axe-core tags (e.g. wcag2a,best-practice)
    --disable-rules    Comma-separated axe rule IDs to disable (e.g. color-contrast,link-name)
    --exclude          Comma-separated CSS selectors to exclude from scanning
    --keyboard-nav     Run keyboard navigation tests [default: true]
    --tree             Show component hierarchy view
    --quiet, -q        Minimal output - show only summary line

  Test Generation (mutually exclusive with scan options)
    --generate-test    Enable test generation mode (skips accessibility scan)
    --test-file        Output file for generated test [default: generated-tests/<domain>-<timestamp>.spec.ts]
    --stagehand-model <model> AI model for test generation [default: openai/gpt-4o-mini]
    --stagehand-verbose       Enable verbose Stagehand logging

  Stagehand Advanced Testing (mutually exclusive with scan/test-gen)
    --stagehand-keyboard      Test keyboard navigation using AI
    --max-tab-presses         Max Tab presses for keyboard test [default: 100]
    --stagehand-tree          Analyze accessibility tree using AI
    --include-full-tree       Include full tree structure in output
    --wcag-audit              Run AI-powered WCAG compliance audit
    --audit-level             Target WCAG level (A, AA, AAA) [default: AA]
    --max-steps               Max agent steps for audit [default: 30]

  Examples
    # Generic Accessibility Scanning (any website)
    $ a11y-toolkit https://example.com
    $ a11y-toolkit https://example.com --browser firefox
    $ a11y-toolkit https://example.com --output report.json --ci

    # Multiple URLs
    $ a11y-toolkit https://example.com https://example.com/about https://example.com/contact

    # Component Attribution (auto-detected, disable with --no-components)
    $ a11y-toolkit https://my-app.com --no-components
    $ a11y-toolkit https://my-app.com --ai --tree

    # Test Generation
    $ a11y-toolkit https://example.com --generate-test
    $ a11y-toolkit https://example.com --generate-test --test-file tests/a11y.spec.ts

    # AI-Powered WCAG Audit
    $ a11y-toolkit https://example.com --wcag-audit --audit-level AA
    $ a11y-toolkit https://example.com --stagehand-keyboard
    $ a11y-toolkit https://example.com --stagehand-tree
`,
    {
        importMeta: import.meta,
        flags: {
            browser: {
                type: 'string',
                shortFlag: 'b',
                default: 'chromium',
            },
            components: {
                type: 'boolean',
                default: true,
            },
            output: {
                type: 'string',
                shortFlag: 'o',
            },
            ci: {
                type: 'boolean',
                default: false,
            },
            threshold: {
                type: 'number',
                default: 0,
            },
            headless: {
                type: 'boolean',
                default: true,
            },
            ai: {
                type: 'boolean',
                default: false,
            },
            tags: {
                type: 'string',
                default: '',
            },
            disableRules: {
                type: 'string',
                default: '',
            },
            exclude: {
                type: 'string',
                default: '',
            },
            keyboardNav: {
                type: 'boolean',
                default: true,
            },
            tree: {
                type: 'boolean',
                default: false,
            },
            quiet: {
                type: 'boolean',
                shortFlag: 'q',
                default: false,
            },
            stagehandModel: {
                type: 'string',
            },
            stagehandVerbose: {
                type: 'boolean',
                default: false,
            },
            generateTest: {
                type: 'boolean',
                default: false,
            },
            testFile: {
                type: 'string',
            },
            // Stagehand Advanced Testing flags
            stagehandKeyboard: {
                type: 'boolean',
                default: false,
            },
            maxTabPresses: {
                type: 'number',
                default: 100,
            },
            stagehandTree: {
                type: 'boolean',
                default: false,
            },
            includeFullTree: {
                type: 'boolean',
                default: false,
            },
            wcagAudit: {
                type: 'boolean',
                default: false,
            },
            auditLevel: {
                type: 'string',
                default: 'AA',
            },
            maxSteps: {
                type: 'number',
                default: 30,
            },
        },
    }
);

// Validate URL argument(s)
if (cli.input.length === 0) {
    console.error('Error: URL is required\n');
    cli.showHelp();
    exitWithCode(EXIT_CODES.VALIDATION_ERROR);
}

const urls = cli.input;
const url = urls[0]; // Primary URL (used for single-page modes)

// Validate all URL formats
for (const u of urls) {
    const urlValidation = validateUrl(u);
    if (!urlValidation.valid) {
        console.error(`Error: ${urlValidation.error}\n`);
        exitWithCode(EXIT_CODES.VALIDATION_ERROR);
    }
}

// Validate browser type
const browserValidation = validateBrowser(cli.flags.browser);
if (!browserValidation.valid) {
    console.error(`Error: ${browserValidation.error}\n`);
    exitWithCode(EXIT_CODES.VALIDATION_ERROR);
}

// Validate tags if provided
if (cli.flags.tags) {
    const tagsValidation = validateTags(cli.flags.tags);
    if (!tagsValidation.valid) {
        console.error(`Error: ${tagsValidation.error}\n`);
        exitWithCode(EXIT_CODES.VALIDATION_ERROR);
    }
}

// Validate threshold
const thresholdValidation = validateThreshold(cli.flags.threshold);
if (!thresholdValidation.valid) {
    console.error(`Error: ${thresholdValidation.error}\n`);
    exitWithCode(EXIT_CODES.VALIDATION_ERROR);
}

// Determine mode: test generation, stagehand tests, or accessibility scan
const isTestGenerationMode = cli.flags.generateTest;
const isStagehandKeyboardMode = cli.flags.stagehandKeyboard;
const isStagehandTreeMode = cli.flags.stagehandTree;
const isWcagAuditMode = cli.flags.wcagAudit;
const isStagehandMode = isStagehandKeyboardMode || isStagehandTreeMode || isWcagAuditMode;

// Validate WCAG level
const validLevels = ['A', 'AA', 'AAA'];
if (!validLevels.includes(cli.flags.auditLevel.toUpperCase())) {
    console.error(`Error: Invalid audit level "${cli.flags.auditLevel}". Must be A, AA, or AAA.\n`);
    exitWithCode(EXIT_CODES.VALIDATION_ERROR);
}
const auditLevel = cli.flags.auditLevel.toUpperCase() as WcagLevel;

// Helper to generate filename from URL with timestamp in generated-tests directory
const getFilenameFromUrl = (urlStr: string): string => {
    try {
        const urlObj = new URL(urlStr);
        const hostname = urlObj.hostname.replace(/^www\./, '');
        const sanitized = hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase();

        // Generate timestamp: YYYY-MM-DD-HHmmss
        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/T/, '-')
            .replace(/:/g, '')
            .replace(/\..+/, '')
            .slice(0, 17); // YYYY-MM-DD-HHmmss

        return `generated-tests/${sanitized}-${timestamp}.spec.ts`;
    } catch {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return `generated-tests/a11y-test-${timestamp}.spec.ts`;
    }
};

// Determine output file for test generation
const testOutputFile = cli.flags.testFile || getFilenameFromUrl(url);

// Validate mutually exclusive modes
const modeCount = [
    isTestGenerationMode,
    isStagehandKeyboardMode,
    isStagehandTreeMode,
    isWcagAuditMode
].filter(Boolean).length;

if (modeCount > 1) {
    console.error('Error: Only one mode can be active at a time.\n');
    console.error('Modes: --generate-test, --stagehand-keyboard, --stagehand-tree, --wcag-audit\n');
    exitWithCode(EXIT_CODES.VALIDATION_ERROR);
}

// Validate mutually exclusive flags for test generation
if (isTestGenerationMode || isStagehandMode) {
    const scanOnlyFlags = [
        { flag: 'ai', name: '--ai' },
        { flag: 'tree', name: '--tree' },
        { flag: 'output', name: '--output' },
        { flag: 'ci', name: '--ci' },
        { flag: 'tags', name: '--tags' },
    ];

    const conflictingFlags = scanOnlyFlags.filter(({ flag }) => {
        const value = cli.flags[flag as keyof typeof cli.flags];
        return flag === 'tags' ? value !== '' : !!value;
    });

    if (conflictingFlags.length > 0) {
        const modeName = isTestGenerationMode ? '--generate-test' :
            isStagehandKeyboardMode ? '--stagehand-keyboard' :
            isStagehandTreeMode ? '--stagehand-tree' : '--wcag-audit';
        console.error(`Error: Cannot use ${conflictingFlags.map(f => f.name).join(', ')} with ${modeName}\n`);
        console.error('These modes are mutually exclusive with accessibility scan options.\n');
        exitWithCode(EXIT_CODES.VALIDATION_ERROR);
    }
}

// Check if stdout is a TTY (interactive terminal)
const isTTY = process.stdout.isTTY === true;

// Set logger to silent in quiet mode
if (cli.flags.quiet) {
    logger.setLevel(LogLevel.SILENT);
}

// If not a TTY (non-interactive), use JSON output mode
// Route all logger output to stderr so stdout stays clean for JSON
if (!isTTY) {
    logger.setUseStderr(true);
    (async () => {
        try {
            if (isStagehandKeyboardMode) {
                // Stagehand keyboard navigation testing mode
                const keyboardService = createKeyboardTestService();
                try {
                    await Effect.runPromise(keyboardService.init({
                        maxTabPresses: cli.flags.maxTabPresses,
                        verbose: cli.flags.stagehandVerbose,
                        model: cli.flags.stagehandModel,
                    }));
                    const results = await Effect.runPromise(keyboardService.test(url));
                    console.log(JSON.stringify(results, null, 2));
                    setExitCode(EXIT_CODES.SUCCESS);
                } catch (error) {
                    console.log(JSON.stringify({
                        url,
                        timestamp: new Date().toISOString(),
                        error: error instanceof Error ? error.message : String(error),
                        success: false,
                    }, null, 2));
                    setExitCode(EXIT_CODES.RUNTIME_ERROR);
                } finally {
                    await Effect.runPromise(keyboardService.close());
                }
            } else if (isStagehandTreeMode) {
                // Stagehand tree analysis mode
                const treeService = createTreeAnalysisService();
                try {
                    await Effect.runPromise(treeService.init({
                        verbose: cli.flags.stagehandVerbose,
                        model: cli.flags.stagehandModel,
                        includeFullTree: cli.flags.includeFullTree,
                    }));
                    const results = await Effect.runPromise(treeService.analyze(url));
                    console.log(JSON.stringify(results, null, 2));
                    setExitCode(EXIT_CODES.SUCCESS);
                } catch (error) {
                    console.log(JSON.stringify({
                        url,
                        timestamp: new Date().toISOString(),
                        error: error instanceof Error ? error.message : String(error),
                        success: false,
                    }, null, 2));
                    setExitCode(EXIT_CODES.RUNTIME_ERROR);
                } finally {
                    await Effect.runPromise(treeService.close());
                }
            } else if (isWcagAuditMode) {
                // WCAG audit mode
                const auditService = createWcagAuditService();
                try {
                    await Effect.runPromise(auditService.init({
                        targetLevel: auditLevel,
                        maxSteps: cli.flags.maxSteps,
                        verbose: cli.flags.stagehandVerbose,
                        model: cli.flags.stagehandModel,
                    }));
                    const results = await Effect.runPromise(auditService.audit(url));
                    console.log(JSON.stringify(results, null, 2));
                    setExitCode(EXIT_CODES.SUCCESS);
                } catch (error) {
                    console.log(JSON.stringify({
                        url,
                        timestamp: new Date().toISOString(),
                        targetLevel: auditLevel,
                        error: error instanceof Error ? error.message : String(error),
                        success: false,
                    }, null, 2));
                    setExitCode(EXIT_CODES.RUNTIME_ERROR);
                } finally {
                    await Effect.runPromise(auditService.close());
                }
            } else if (isTestGenerationMode) {
                // Test generation mode
                const testGenService = createTestGenerationService();
                try {
                    await Effect.runPromise(testGenService.init({ model: cli.flags.stagehandModel, verbose: cli.flags.stagehandVerbose }));
                    await Effect.runPromise(testGenService.navigateTo(url));
                    const elements = await Effect.runPromise(testGenService.discoverElements());
                    const testContent = await Effect.runPromise(testGenService.generateTest(url, elements));

                    // Write test file
                    const fs = await import('fs/promises');
                    const path = await import('path');
                    const dir = path.dirname(testOutputFile);
                    if (dir !== '.') {
                        await fs.mkdir(dir, { recursive: true }).catch(() => {});
                    }
                    await fs.writeFile(testOutputFile, testContent);

                    const testResults = {
                        url,
                        timestamp: new Date().toISOString(),
                        outputFile: testOutputFile,
                        elementsDiscovered: elements.length,
                        elements,
                        success: true,
                    };

                    // Output JSON to stdout
                    console.log(JSON.stringify(testResults, null, 2));
                    setExitCode(EXIT_CODES.SUCCESS);
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    const testResults = {
                        url,
                        timestamp: new Date().toISOString(),
                        outputFile: testOutputFile,
                        elementsDiscovered: 0,
                        elements: [],
                        success: false,
                        error: errorMsg,
                    };
                    console.log(JSON.stringify(testResults, null, 2));
                    setExitCode(EXIT_CODES.RUNTIME_ERROR);
                } finally {
                    await Effect.runPromise(testGenService.close());
                }
            } else {
                // Accessibility scan mode using Effect-based orchestration
                const commonOptions = {
                    browser: cli.flags.browser as BrowserType,
                    headless: cli.flags.headless,
                    tags: cli.flags.tags ? cli.flags.tags.split(',') : undefined,
                    includeKeyboardTests: cli.flags.keyboardNav,
                    outputFile: cli.flags.output,
                    ciMode: cli.flags.ci,
                    ciThreshold: cli.flags.threshold,
                    componentBundlePath: cli.flags.components ? getComponentBundlePath() : undefined,
                    disableRules: cli.flags.disableRules ? cli.flags.disableRules.split(',') : undefined,
                    exclude: cli.flags.exclude ? cli.flags.exclude.split(',') : undefined,
                };

                const scanResults = urls.length > 1
                    ? await runMultiScanAsPromise(urls, commonOptions, AppLayer)
                    : [await runScanAsPromise({ ...commonOptions, url }, AppLayer)];

                // Helper to output a single scan result
                const outputResult = (scanUrl: string, { results, ciPassed }: { results: typeof scanResults[0]['results']; ciPassed?: boolean }) => {
                    if (cli.flags.quiet) {
                        const { summary, violations } = results;
                        const statusIcon = summary.totalViolations > 0 ? 'x' : 'v';
                        console.log(`${statusIcon} ${scanUrl} - ${summary.totalViolations} violations, ${summary.totalPasses} passes`);

                        if (summary.totalViolations > 0) {
                            const { violationsBySeverity } = summary;
                            const severityParts = [];
                            if (violationsBySeverity.critical > 0) severityParts.push(`${violationsBySeverity.critical} critical`);
                            if (violationsBySeverity.serious > 0) severityParts.push(`${violationsBySeverity.serious} serious`);
                            if (violationsBySeverity.moderate > 0) severityParts.push(`${violationsBySeverity.moderate} moderate`);
                            if (violationsBySeverity.minor > 0) severityParts.push(`${violationsBySeverity.minor} minor`);
                            if (severityParts.length > 0) console.log(severityParts.join(' '));
                        }

                        for (const violation of violations) {
                            console.log(`[${violation.impact}] ${violation.id}: ${violation.description}`);
                            for (const node of violation.nodes) {
                                const componentName = node.userComponentPath?.length
                                    ? node.userComponentPath[node.userComponentPath.length - 1]
                                    : node.component || 'Unknown';
                                console.log(`  - ${componentName}${node.cssSelector ? ` (${node.cssSelector})` : ''}`);
                            }
                            if (violation.helpUrl) console.log(`  Docs: ${violation.helpUrl}`);
                        }
                    } else {
                        // Minimal formatted output
                        const { summary, violations, incomplete } = results;
                        const sev = summary.violationsBySeverity;
                        const sep = '─'.repeat(60);

                        console.log(`A11Y SCAN / ${scanUrl}\n`);
                        const sevParts = [];
                        if (sev.critical > 0) sevParts.push(`${sev.critical} critical`);
                        if (sev.serious > 0) sevParts.push(`${sev.serious} serious`);
                        if (sev.moderate > 0) sevParts.push(`${sev.moderate} moderate`);
                        if (sev.minor > 0) sevParts.push(`${sev.minor} minor`);
                        console.log(`${summary.totalViolations} violations  ${summary.totalPasses} passes  ${summary.totalComponents} components`);
                        if (sevParts.length > 0) console.log(sevParts.join('  '));
                        if (summary.keyboardIssues) console.log(`${summary.keyboardIssues} keyboard issues`);
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

                                // Source + component
                                if (loc && comp) {
                                    console.log(`  ${loc} in ${comp}`);
                                } else if (loc) {
                                    console.log(`  ${loc}`);
                                } else if (comp) {
                                    console.log(`  ${comp}`);
                                }

                                // Source stack
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
                    }

                    // Handle AI prompt generation
                    if (cli.flags.ai) {
                        const promptPath = generateAndExport(
                            results,
                            {
                                template: 'fix-all',
                                format: 'md',
                                outputPath: undefined,
                            }
                        );
                        console.error(`AI prompt written to: ${promptPath}`);
                    }

                    return ciPassed;
                };

                // Output each result
                let allCiPassed = true;
                for (let i = 0; i < scanResults.length; i++) {
                    const ciPassed = outputResult(urls[i], scanResults[i]);
                    if (ciPassed === false) allCiPassed = false;
                }

                // Handle CI mode
                if (cli.flags.ci) {
                    setExitCode(allCiPassed ? EXIT_CODES.SUCCESS : EXIT_CODES.VIOLATIONS_FOUND);
                } else {
                    setExitCode(EXIT_CODES.SUCCESS);
                }
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
    })();
} else {
    // TTY mode: render the Ink UI (single URL only)
    if (urls.length > 1) {
        console.error(`Note: Interactive mode only supports one URL. Scanning ${url} only.`);
        console.error('Use non-interactive mode (pipe output) for multi-URL scanning.\n');
    }
    // Determine mode for App component
    const appMode = isTestGenerationMode ? 'generate-test' :
        isStagehandKeyboardMode ? 'stagehand-keyboard' :
        isStagehandTreeMode ? 'stagehand-tree' :
        isWcagAuditMode ? 'wcag-audit' : 'scan';

    const { waitUntilExit } = render(
        <App
            mode={appMode}
            url={url}
            browser={cli.flags.browser as BrowserType}
            components={cli.flags.components}
            output={cli.flags.output}
            ci={cli.flags.ci}
            threshold={cli.flags.threshold}
            headless={cli.flags.headless}
            ai={cli.flags.ai}
            tags={cli.flags.tags ? cli.flags.tags.split(',') : undefined}
            disableRules={cli.flags.disableRules ? cli.flags.disableRules.split(',') : undefined}
            exclude={cli.flags.exclude ? cli.flags.exclude.split(',') : undefined}
            keyboardNav={cli.flags.keyboardNav}
            tree={cli.flags.tree}
            quiet={cli.flags.quiet}
            generateTest={cli.flags.generateTest}
            testFile={testOutputFile}
            stagehandModel={cli.flags.stagehandModel}
            stagehandVerbose={cli.flags.stagehandVerbose}
            maxTabPresses={cli.flags.maxTabPresses}
            includeFullTree={cli.flags.includeFullTree}
            auditLevel={auditLevel}
            maxSteps={cli.flags.maxSteps}
        />
    );

    // Wait for app to finish and handle exit code
    (async () => {
        try {
            await waitUntilExit();
            // Exit code will be set by the App component
            exitWithCode((process.exitCode ?? EXIT_CODES.SUCCESS) as 0 | 1 | 2);
        } catch (error) {
            console.error('Fatal error:', error instanceof Error ? error.message : String(error));
            if (error instanceof Error && error.stack) {
                console.error('\nStack trace:', error.stack);
            }
            exitWithCode(EXIT_CODES.RUNTIME_ERROR);
        }
    })();
}
