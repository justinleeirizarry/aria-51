/**
 * Effect-based Orchestration
 *
 * This module provides Effect-based scan workflows with proper error typing
 * and automatic resource management.
 */
import { Effect, Exit, Cause, Chunk, Option, pipe, type Layer } from 'effect';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import type { ScanResults, BrowserScanData, BrowserType } from '../../types.js';
import { logger } from '../../utils/logger.js';
import {
    BrowserService,
    ScannerService,
    ResultsProcessorService,
} from './tags.js';
import {
    EffectReactNotDetectedError,
    EffectFileSystemError,
    EffectScanDataError,
    type BrowserErrors,
    type ScanErrors,
} from '../../errors/effect-errors.js';
import { ScanError, formatTaggedError } from '../../errors/scan-error.js';
import { createRetrySchedule } from '../../utils/effect-retry.js';
import { getConfig } from '../../config/index.js';
import { checkReflow } from '../../scanner/wcag22/reflow-check.js';
import { checkHoverFocusContent } from '../../scanner/wcag22/hover-focus-check.js';
import { checkScreenReaderNavigation } from '../../scanner/wcag22/screen-reader-check.js';
import { checkKeyboardNavigation } from '../../scanner/wcag22/keyboard-nav-check.js';
import { checkMultiPage } from '../../scanner/multi-page/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Base options for scan operations
 */
export interface BaseScanOptions {
    url: string;
    browser: BrowserType;
    headless: boolean;
    tags?: string[];
    includeKeyboardTests?: boolean;
    outputFile?: string;
    ciMode?: boolean;
    ciThreshold?: number;
    /** Require a supported framework to be detected on the page (default: false for generic scanning) */
    requireFramework?: boolean;
    /** Path to the component attribution bundle for framework-aware scanning */
    componentBundlePath?: string;
    /** Emulate a mobile device (375x812 viewport, touch enabled) */
    mobile?: boolean;
    /** Axe rule IDs to disable (e.g. ['color-contrast']) */
    disableRules?: string[];
    /** CSS selectors to exclude from scanning */
    exclude?: string[];
    /** Enable AI-powered Stagehand tests (keyboard, tree, screen reader) */
    stagehand?: boolean;
    /** Stagehand AI model (default: openai/gpt-4o-mini) */
    stagehandModel?: string;
    /** Progress callback fired at each scan step */
    onProgress?: (step: ScanProgressStep) => void;
}

/**
 * Progress step emitted during a scan
 */
export interface ScanProgressStep {
    step: 'launching' | 'navigating' | 'stabilizing' | 'detecting' | 'scanning' | 'attributing' | 'supplemental-checks' | 'ai-testing' | 'processing' | 'done';
    message: string;
}

/**
 * Result of a scan operation
 */
export interface ScanOperationResult {
    results: ScanResults;
    ciPassed?: boolean;
    outputFile?: string;
}

export type EffectScanOptions = BaseScanOptions;
export type EffectScanResult = ScanOperationResult;

/**
 * Union of all errors that can occur during the scan workflow
 */
export type PerformScanError = BrowserErrors | ScanErrors | EffectReactNotDetectedError | EffectFileSystemError;

// ============================================================================
// Scan Workflow
// ============================================================================

/**
 * Perform an accessibility scan using Effect
 *
 * This is the main Effect-based scan workflow. It:
 * 1. Launches the browser
 * 2. Navigates to the URL
 * 3. Waits for page stability
 * 4. Checks for React
 * 5. Runs the scan with retry logic
 * 6. Processes the results
 * 7. Optionally writes to file and checks CI threshold
 *
 * The browser is automatically cleaned up when the Effect completes.
 *
 * @example
 * ```ts
 * const result = yield* pipe(
 *   performScan({
 *     url: 'http://localhost:3000',
 *     browser: 'chromium',
 *     headless: true
 *   }),
 *   Effect.provide(AppLayer),
 *   Effect.scoped
 * );
 * ```
 */
export const performScan = (
    options: EffectScanOptions
): Effect.Effect<
    EffectScanResult,
    PerformScanError,
    BrowserService | ScannerService | ResultsProcessorService
> =>
    Effect.gen(function* () {
        const browser = yield* BrowserService;
        const scanner = yield* ScannerService;
        const processor = yield* ResultsProcessorService;
        const config = getConfig();

        const {
            url,
            browser: browserType,
            headless,
            tags,
            includeKeyboardTests,
            outputFile,
            ciMode,
            ciThreshold = 0,
            componentBundlePath,
            mobile,
            disableRules,
            exclude,
            stagehand: enableStagehand,
            stagehandModel,
            onProgress,
        } = options;

        const progress = (step: ScanProgressStep['step'], message: string) => {
            onProgress?.({ step, message });
        };

        // Launch browser (with mobile viewport if requested)
        progress('launching', `Launching ${browserType} browser…`);
        yield* browser.launch({
            browserType,
            headless,
            ...(mobile ? {
                viewport: { width: 375, height: 812 },
                isMobile: true,
                hasTouch: true,
            } : {}),
        });

        // Navigate to URL
        progress('navigating', `Navigating to ${url}…`);
        yield* browser.navigate(url);

        // Wait for page stability (important for SPAs)
        progress('stabilizing', 'Waiting for page to stabilize…');
        yield* browser.waitForStability();

        // Check for supported framework (only fail if explicitly required)
        progress('detecting', 'Detecting frameworks…');
        const hasFramework = yield* browser.detectFramework();
        if (options.requireFramework && !hasFramework) {
            return yield* Effect.fail(new EffectReactNotDetectedError({ url }));
        }
        if (!hasFramework) {
            logger.debug('No supported framework detected on page - running generic accessibility scan');
        }

        // Get page for scanning
        const page = yield* browser.getPage();

        // Create retry schedule for scan
        const retrySchedule = createRetrySchedule({
            maxRetries: config.scan.maxRetries,
            delayMs: config.scan.retryDelayBase,
            backoff: 'linear',
        });

        // Run scan with retry logic
        progress('scanning', 'Running accessibility scan…');
        let rawData = yield* pipe(
            scanner.scan(page, { tags, includeKeyboardTests, disableRules, exclude }),
            Effect.retry(retrySchedule),
            Effect.tap(() => Effect.sync(() => logger.debug('Scan completed successfully')))
        );

        // Run post-scan Playwright-based WCAG checks (reflow, hover/focus)
        yield* Effect.tryPromise({
            try: async () => {
                logger.debug('Running post-scan Playwright checks…');
                const [reflowViolations, hoverViolations] = await Promise.all([
                    checkReflow(page),
                    checkHoverFocusContent(page),
                ]);

                // Merge into wcag22 results
                if (rawData.wcag22) {
                    rawData.wcag22.reflow = reflowViolations;
                    rawData.wcag22.hoverFocusContent = hoverViolations;
                    rawData.wcag22.summary.totalViolations += reflowViolations.length + hoverViolations.length;
                    for (const v of [...reflowViolations, ...hoverViolations]) {
                        const key = v.criterion;
                        rawData.wcag22.summary.byCriterion[key] = (rawData.wcag22.summary.byCriterion[key] || 0) + 1;
                        if (v.level === 'AA') rawData.wcag22.summary.byLevel.AA++;
                    }
                }
                logger.debug(`Post-scan checks: ${reflowViolations.length} reflow, ${hoverViolations.length} hover/focus violations`);
            },
            catch: (err) => {
                logger.warn(`Post-scan Playwright checks failed (non-fatal): ${err}`);
                return new EffectScanDataError({ reason: `Post-scan checks failed: ${err}` });
            },
        }).pipe(Effect.catchAll(() => Effect.void));

        // If supported framework detected and component bundle provided, inject and attribute
        logger.debug(`Framework detected: ${hasFramework}, bundle path: ${componentBundlePath ?? 'not provided'}`);
        if (hasFramework && componentBundlePath) {
            progress('attributing', 'Attributing violations to components…');
            rawData = yield* attributeWithComponentPlugin(page, rawData, componentBundlePath);
        }

        // Process results
        progress('processing', 'Processing results…');
        const results = yield* processor.process(rawData, {
            url,
            browser: browserType,
        });

        // Run lightweight Playwright-based supplemental checks (always, no AI needed)
        progress('supplemental-checks', 'Running supplemental accessibility checks…');
        yield* Effect.tryPromise({
            try: async () => {
                const [screenReaderResults, keyboardResults] = await Promise.all([
                    checkScreenReaderNavigation(page),
                    checkKeyboardNavigation(page),
                ]);
                results.supplementalResults = [...screenReaderResults, ...keyboardResults];
                logger.debug(`Supplemental checks: ${results.supplementalResults.length} criteria evaluated`);
            },
            catch: (err) => {
                logger.warn(`Supplemental checks failed (non-fatal): ${err}`);
                return new EffectScanDataError({ reason: `Supplemental checks failed: ${err}` });
            },
        }).pipe(Effect.catchAll(() => Effect.void));

        // Run optional AI-powered Stagehand tests (keyboard, tree, screen reader)
        if (enableStagehand) {
            progress('ai-testing', 'Running AI-powered accessibility tests…');
            yield* Effect.tryPromise({
                try: async () => {
                    const { runStagehandTests } = await import('./stagehand-runner.js');
                    const supplemental = await runStagehandTests(url, { model: stagehandModel }, results.supplementalResults);
                    results.supplementalResults = supplemental;
                    logger.info(`Stagehand tests complete: ${supplemental.length} criteria evaluated`);
                },
                catch: (err) => {
                    logger.warn(`Stagehand tests failed (non-fatal): ${err}`);
                    return new EffectScanDataError({ reason: `Stagehand tests failed: ${err}` });
                },
            }).pipe(Effect.catchAll(() => Effect.void));
        }

        // Build result
        const result: EffectScanResult = { results };

        // Handle CI mode
        if (ciMode) {
            const ciResult = yield* processor.formatForCI(results, ciThreshold);
            result.ciPassed = ciResult.passed;
            logger.info(ciResult.message);
        }

        // Handle file output
        if (outputFile) {
            yield* writeResultsToFile(results, outputFile, processor);
            result.outputFile = outputFile;
        }

        return result;
    });

/**
 * Perform scan with explicit cleanup
 *
 * This wraps performScan with Effect.ensuring to guarantee
 * browser cleanup even if the scan fails.
 *
 * NOTE: Use this with `AppLayerManual` (non-scoped browser layer).
 * If using `AppLayer` (scoped), prefer `performScan` with `Effect.scoped`
 * to avoid double cleanup.
 *
 * @example
 * ```ts
 * const result = yield* pipe(
 *   performScanWithCleanup(options),
 *   Effect.provide(AppLayerManual)
 * );
 * ```
 */
export const performScanWithCleanup = (
    options: EffectScanOptions
): Effect.Effect<
    EffectScanResult,
    PerformScanError,
    BrowserService | ScannerService | ResultsProcessorService
> =>
    Effect.gen(function* () {
        const browser = yield* BrowserService;

        return yield* pipe(
            performScan(options),
            Effect.ensuring(browser.close())
        );
    });

// ============================================================================
// React Plugin Attribution
// ============================================================================

/**
 * Inject the component attribution bundle and attribute violations to components
 *
 * This injects the component bundle into the page, which uses element-source to
 * resolve DOM elements to their framework component names and source locations.
 */
const attributeWithComponentPlugin = (
    page: import('playwright').Page,
    rawData: BrowserScanData,
    componentBundlePath: string
): Effect.Effect<BrowserScanData, EffectScanDataError> =>
    Effect.gen(function* () {
        // Inject the component attribution bundle
        yield* Effect.tryPromise({
            try: () => page.addScriptTag({ path: componentBundlePath }),
            catch: (error) => {
                const msg = error instanceof Error ? error.message : String(error);
                logger.warn(`Failed to inject component bundle: ${msg}`);
                return new EffectScanDataError({
                    reason: `Failed to inject component plugin bundle: ${msg}`
                });
            }
        });

        // Verify ReactA11yPlugin is available (window global name kept for bundle compat)
        const hasPlugin = yield* Effect.tryPromise({
            try: () => page.evaluate(() => typeof (window as any).ReactA11yPlugin !== 'undefined'),
            catch: () => new EffectScanDataError({ reason: 'Failed to verify component plugin injection' })
        });

        if (!hasPlugin) {
            logger.warn('Component plugin bundle did not expose ReactA11yPlugin on window');
            return rawData;
        }

        logger.debug('Component plugin injected, attributing violations to components...');

        // Call ReactA11yPlugin.attributeViolations in browser context
        const attributed = yield* Effect.tryPromise({
            try: () => page.evaluate(
                ({ violations, passes, incomplete }) => {
                    return (window as any).ReactA11yPlugin.attributeViolations(
                        violations,
                        passes || [],
                        incomplete || []
                    );
                },
                {
                    violations: rawData.violations,
                    passes: rawData.passes || [],
                    incomplete: rawData.incomplete || [],
                }
            ),
            catch: (error) => {
                const msg = error instanceof Error ? error.message : String(error);
                logger.warn(`Component attribution failed: ${msg}`);
                return new EffectScanDataError({ reason: `Component attribution failed: ${msg}` });
            }
        });

        if (attributed && attributed.components) {
            logger.debug(`Component attribution complete: ${attributed.components.length} components found`);
            return {
                ...rawData,
                components: attributed.components,
                violations: attributed.violations,
                passes: attributed.passes,
                incomplete: attributed.incomplete,
            };
        }

        return rawData;
    }).pipe(
        // Don't fail the entire scan if component attribution fails - just log and continue
        Effect.catchAll((error) => {
            logger.warn(`Component attribution failed, continuing without it: ${error.reason}`);
            return Effect.succeed(rawData);
        })
    );

// ============================================================================
// File Output Helpers
// ============================================================================

/**
 * Write results to file with directory creation
 */
const writeResultsToFile = (
    results: ScanResults,
    filePath: string,
    processor: { formatAsJSON: (results: ScanResults) => Effect.Effect<string> }
): Effect.Effect<void, EffectFileSystemError> =>
    Effect.gen(function* () {
        const jsonContent = yield* processor.formatAsJSON(results);

        // Create directory if needed (mkdir with recursive:true is idempotent)
        const dir = dirname(filePath);
        if (dir !== '.') {
            yield* Effect.tryPromise({
                try: () => mkdir(dir, { recursive: true }),
                catch: (error) =>
                    new EffectFileSystemError({
                        operation: 'mkdir',
                        path: dir,
                        reason: error instanceof Error ? error.message : String(error),
                    }),
            });
        }

        // Write file
        yield* Effect.tryPromise({
            try: () => writeFile(filePath, jsonContent),
            catch: (error) =>
                new EffectFileSystemError({
                    operation: 'write',
                    path: filePath,
                    reason: error instanceof Error ? error.message : String(error),
                }),
        });

        logger.info(`Results written to ${filePath}`);
    });

// ============================================================================
// Promise Adapter
// ============================================================================

/**
 * Run the scan workflow and return a Promise
 *
 * This is a convenience function for code that can't use Effect directly.
 * It provides a backwards-compatible Promise-based API.
 *
 * Uses `performScan` with `Effect.scoped` to properly handle scoped layers
 * like `AppLayer`. The browser is automatically cleaned up when the scope ends.
 *
 * @example
 * ```ts
 * const result = await runScanAsPromise({
 *   url: 'http://localhost:3000',
 *   browser: 'chromium',
 *   headless: true
 * }, AppLayer);
 * ```
 */
export const runScanAsPromise = (
    options: EffectScanOptions,
    layer: Layer.Layer<BrowserService | ScannerService | ResultsProcessorService, never, never>
): Promise<EffectScanResult> => {
    const program = pipe(
        performScan(options),
        Effect.provide(layer),
        Effect.scoped
    );
    return Effect.runPromiseExit(program).then((exit) => {
        if (Exit.isSuccess(exit)) {
            return exit.value;
        }
        // Extract typed failures from the Cause
        const failures = Cause.failures(exit.cause);
        const firstError = Chunk.head(failures);
        if (Option.isSome(firstError)) {
            const tagged = firstError.value as { _tag: string; [key: string]: unknown };
            throw new ScanError(
                tagged._tag,
                formatTaggedError(tagged),
                { ...tagged },
                tagged
            );
        }
        // Defects or interrupts — no typed error available
        throw new Error(Cause.pretty(exit.cause));
    });
};

// ============================================================================
// Multi-Page Scanning
// ============================================================================

/**
 * Run scans for multiple URLs sequentially and return a Promise.
 *
 * Each URL gets its own browser session (launched and closed per scan).
 * Results are returned as an array, one per URL.
 */
export const runMultiScanAsPromise = async (
    urls: string[],
    baseOptions: Omit<EffectScanOptions, 'url'>,
    layer: Layer.Layer<BrowserService | ScannerService | ResultsProcessorService, never, never>
): Promise<EffectScanResult[]> => {
    const results: EffectScanResult[] = [];
    for (const url of urls) {
        const result = await runScanAsPromise({ ...baseOptions, url }, layer);
        results.push(result);
    }

    // Run cross-page comparison checks when multiple pages are scanned
    if (results.length >= 2) {
        try {
            const allScanResults = results.map(r => r.results);
            const multiPageResults = checkMultiPage(allScanResults);
            if (multiPageResults.length > 0) {
                logger.info(`Multi-page checks: ${multiPageResults.length} criteria evaluated across ${results.length} pages`);
                // Attach multi-page results to every page's supplementalResults
                for (const result of results) {
                    const existing = result.results.supplementalResults || [];
                    result.results.supplementalResults = [...existing, ...multiPageResults];
                }
            }
        } catch (err) {
            logger.warn(`Multi-page checks failed (non-fatal): ${err}`);
        }
    }

    return results;
};
