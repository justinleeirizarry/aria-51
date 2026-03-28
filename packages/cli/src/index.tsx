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
import App from './App.js';
import type { BrowserType, WcagLevel } from '@aria51/core';
import {
    validateUrl,
    validateTags,
    validateThreshold,
    validateBrowser,
    EXIT_CODES,
    exitWithCode,
    updateConfig,
    loadEnvConfig,
    hasEnvConfig,
    loadConfigFile,
    logger,
    LogLevel,
} from '@aria51/core';
import {
    runAgentMode,
    runKeyboardMode,
    runTreeMode,
    runWcagAuditMode,
    runTestGenMode,
    runScanMode,
} from './modes/index.js';

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
    $ aria51 <url> [url2] [url3] ...

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
    --mobile           Emulate a mobile device viewport
    --keyboard-nav     Run keyboard navigation tests [default: true]
    --tree             Show component hierarchy view
    --quiet, -q        Minimal output - show only summary line

  Autonomous Agent Mode (mutually exclusive with scan/test-gen)
    --agent               Run autonomous accessibility audit with AI agent
    --agent-model         Model for agent (default: claude-sonnet-4-6)
    --specialists         Use multi-specialist mode (4 parallel auditors)
    --max-pages           Max pages to scan in agent mode [default: 10]

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
    $ aria51 https://example.com
    $ aria51 https://example.com --browser firefox
    $ aria51 https://example.com --output report.json --ci

    # Multiple URLs
    $ aria51 https://example.com https://example.com/about https://example.com/contact

    # Component Attribution (auto-detected, disable with --no-components)
    $ aria51 https://my-app.com --no-components
    $ aria51 https://my-app.com --ai --tree

    # Autonomous Agent Audit
    $ aria51 https://example.com --agent
    $ aria51 https://example.com --agent --specialists
    $ aria51 https://example.com --agent --max-pages 5

    # Test Generation
    $ aria51 https://example.com --generate-test
    $ aria51 https://example.com --generate-test --test-file tests/a11y.spec.ts

    # AI-Powered WCAG Audit
    $ aria51 https://example.com --wcag-audit --audit-level AA
    $ aria51 https://example.com --stagehand-keyboard
    $ aria51 https://example.com --stagehand-tree
`,
    {
        importMeta: import.meta,
        flags: {
            browser: { type: 'string', shortFlag: 'b', default: 'chromium' },
            components: { type: 'boolean', default: true },
            output: { type: 'string', shortFlag: 'o' },
            ci: { type: 'boolean', default: false },
            threshold: { type: 'number', default: 0 },
            headless: { type: 'boolean', default: true },
            ai: { type: 'boolean', default: false },
            tags: { type: 'string', default: '' },
            disableRules: { type: 'string', default: '' },
            exclude: { type: 'string', default: '' },
            mobile: { type: 'boolean', default: false },
            keyboardNav: { type: 'boolean', default: true },
            tree: { type: 'boolean', default: false },
            quiet: { type: 'boolean', shortFlag: 'q', default: false },
            // Agent mode
            agent: { type: 'boolean', default: false },
            agentModel: { type: 'string' },
            specialists: { type: 'boolean', default: false },
            maxPages: { type: 'number', default: 10 },
            // Stagehand
            stagehandModel: { type: 'string' },
            stagehandVerbose: { type: 'boolean', default: false },
            generateTest: { type: 'boolean', default: false },
            testFile: { type: 'string' },
            stagehandKeyboard: { type: 'boolean', default: false },
            maxTabPresses: { type: 'number', default: 100 },
            stagehandTree: { type: 'boolean', default: false },
            includeFullTree: { type: 'boolean', default: false },
            wcagAudit: { type: 'boolean', default: false },
            auditLevel: { type: 'string', default: 'AA' },
            maxSteps: { type: 'number', default: 30 },
        },
    }
);

// =============================================================================
// Validation
// =============================================================================

if (cli.input.length === 0) {
    console.error('Error: URL is required\n');
    cli.showHelp();
    exitWithCode(EXIT_CODES.VALIDATION_ERROR);
}

const urls = cli.input;
const url = urls[0];

for (const u of urls) {
    const urlValidation = validateUrl(u);
    if (!urlValidation.valid) {
        console.error(`Error: ${urlValidation.error}\n`);
        exitWithCode(EXIT_CODES.VALIDATION_ERROR);
    }
}

const browserValidation = validateBrowser(cli.flags.browser);
if (!browserValidation.valid) {
    console.error(`Error: ${browserValidation.error}\n`);
    exitWithCode(EXIT_CODES.VALIDATION_ERROR);
}

if (cli.flags.tags) {
    const tagsValidation = validateTags(cli.flags.tags);
    if (!tagsValidation.valid) {
        console.error(`Error: ${tagsValidation.error}\n`);
        exitWithCode(EXIT_CODES.VALIDATION_ERROR);
    }
}

const thresholdValidation = validateThreshold(cli.flags.threshold);
if (!thresholdValidation.valid) {
    console.error(`Error: ${thresholdValidation.error}\n`);
    exitWithCode(EXIT_CODES.VALIDATION_ERROR);
}

const validLevels = ['A', 'AA', 'AAA'];
if (!validLevels.includes(cli.flags.auditLevel.toUpperCase())) {
    console.error(`Error: Invalid audit level "${cli.flags.auditLevel}". Must be A, AA, or AAA.\n`);
    exitWithCode(EXIT_CODES.VALIDATION_ERROR);
}
const auditLevel = cli.flags.auditLevel.toUpperCase() as WcagLevel;

// Determine mode
const isAgentMode = cli.flags.agent;
const isTestGenerationMode = cli.flags.generateTest;
const isStagehandKeyboardMode = cli.flags.stagehandKeyboard;
const isStagehandTreeMode = cli.flags.stagehandTree;
const isWcagAuditMode = cli.flags.wcagAudit;
const isStagehandMode = isStagehandKeyboardMode || isStagehandTreeMode || isWcagAuditMode;

const modeCount = [isAgentMode, isTestGenerationMode, isStagehandKeyboardMode, isStagehandTreeMode, isWcagAuditMode].filter(Boolean).length;
if (modeCount > 1) {
    console.error('Error: Only one mode can be active at a time.\n');
    console.error('Modes: --agent, --generate-test, --stagehand-keyboard, --stagehand-tree, --wcag-audit\n');
    exitWithCode(EXIT_CODES.VALIDATION_ERROR);
}

if (isTestGenerationMode || isStagehandMode) {
    const scanOnlyFlags = [
        { flag: 'ai', name: '--ai' },
        { flag: 'tree', name: '--tree' },
        { flag: 'output', name: '--output' },
        { flag: 'ci', name: '--ci' },
        { flag: 'tags', name: '--tags' },
    ];
    const conflicting = scanOnlyFlags.filter(({ flag }) => {
        const value = cli.flags[flag as keyof typeof cli.flags];
        return flag === 'tags' ? value !== '' : !!value;
    });
    if (conflicting.length > 0) {
        const modeName = isTestGenerationMode ? '--generate-test' :
            isStagehandKeyboardMode ? '--stagehand-keyboard' :
            isStagehandTreeMode ? '--stagehand-tree' : '--wcag-audit';
        console.error(`Error: Cannot use ${conflicting.map(f => f.name).join(', ')} with ${modeName}\n`);
        exitWithCode(EXIT_CODES.VALIDATION_ERROR);
    }
}

// =============================================================================
// Dispatch
// =============================================================================

const isTTY = process.stdout.isTTY === true;

if (cli.flags.quiet) {
    logger.setLevel(LogLevel.SILENT);
}

// Helper for test generation output file
const getFilenameFromUrl = (urlStr: string): string => {
    try {
        const hostname = new URL(urlStr).hostname.replace(/^www\./, '');
        const sanitized = hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const timestamp = new Date().toISOString().replace(/T/, '-').replace(/:/g, '').replace(/\..+/, '').slice(0, 17);
        return `generated-tests/${sanitized}-${timestamp}.spec.ts`;
    } catch {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return `generated-tests/a11y-test-${timestamp}.spec.ts`;
    }
};

if (isAgentMode) {
    // Agent mode works the same in TTY and non-TTY (handled internally)
    if (!isTTY) logger.setUseStderr(true);
    runAgentMode({
        url,
        maxPages: cli.flags.maxPages,
        maxSteps: cli.flags.maxSteps,
        specialists: cli.flags.specialists,
        model: cli.flags.agentModel,
        wcagLevel: auditLevel,
        output: cli.flags.output,
        isTTY,
    });
} else if (!isTTY) {
    // Non-TTY: JSON output for all modes
    logger.setUseStderr(true);
    (async () => {
        if (isStagehandKeyboardMode) {
            await runKeyboardMode({ url, model: cli.flags.stagehandModel, verbose: cli.flags.stagehandVerbose, maxTabPresses: cli.flags.maxTabPresses });
        } else if (isStagehandTreeMode) {
            await runTreeMode({ url, model: cli.flags.stagehandModel, verbose: cli.flags.stagehandVerbose, includeFullTree: cli.flags.includeFullTree });
        } else if (isWcagAuditMode) {
            await runWcagAuditMode({ url, model: cli.flags.stagehandModel, verbose: cli.flags.stagehandVerbose, auditLevel, maxSteps: cli.flags.maxSteps });
        } else if (isTestGenerationMode) {
            await runTestGenMode({ url, outputFile: cli.flags.testFile || getFilenameFromUrl(url), model: cli.flags.stagehandModel, verbose: cli.flags.stagehandVerbose });
        } else {
            await runScanMode({
                urls,
                browser: cli.flags.browser as BrowserType,
                headless: cli.flags.headless,
                tags: cli.flags.tags ? cli.flags.tags.split(',') : undefined,
                mobile: cli.flags.mobile,
                keyboardNav: cli.flags.keyboardNav,
                output: cli.flags.output,
                ci: cli.flags.ci,
                threshold: cli.flags.threshold,
                components: cli.flags.components,
                disableRules: cli.flags.disableRules ? cli.flags.disableRules.split(',') : undefined,
                exclude: cli.flags.exclude ? cli.flags.exclude.split(',') : undefined,
                quiet: cli.flags.quiet,
                ai: cli.flags.ai,
            });
        }
    })();
} else {
    // TTY mode: render the Ink UI (single URL only)
    if (urls.length > 1) {
        console.error(`Note: Interactive mode only supports one URL. Scanning ${url} only.`);
        console.error('Use non-interactive mode (pipe output) for multi-URL scanning.\n');
    }

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
            testFile={cli.flags.testFile || getFilenameFromUrl(url)}
            stagehandModel={cli.flags.stagehandModel}
            stagehandVerbose={cli.flags.stagehandVerbose}
            maxTabPresses={cli.flags.maxTabPresses}
            includeFullTree={cli.flags.includeFullTree}
            auditLevel={auditLevel}
            maxSteps={cli.flags.maxSteps}
        />
    );

    (async () => {
        try {
            await waitUntilExit();
            exitWithCode((process.exitCode ?? EXIT_CODES.SUCCESS) as 0 | 1 | 2);
        } catch (error) {
            console.error('Fatal error:', error instanceof Error ? error.message : String(error));
            exitWithCode(EXIT_CODES.RUNTIME_ERROR);
        }
    })();
}
