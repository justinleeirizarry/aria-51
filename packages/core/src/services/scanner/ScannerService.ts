/**
 * Scanner Service - Manages in-page scanning operations
 *
 * Extracts scanner bundle injection and scan execution from launcher.ts
 */
import { Effect } from 'effect';
import type { Page } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { BrowserScanData } from '../../types.js';
import { logger } from '../../utils/logger.js';
import { ScannerInjectionError, ScanDataError } from '../../errors/effect-errors.js';
import { decodeBrowserScanDataLenient } from '../../schemas/decode.js';
import type { ScanExecutionOptions, IScannerService } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ScannerService - Handles injecting and executing the scanner bundle in pages
 *
 * This service encapsulates:
 * - Scanner bundle injection
 * - Scan execution with retry logic
 * - Navigation blocking during scan
 *
 * All methods return Effects for composability with the Effect ecosystem.
 */
export class ScannerService implements IScannerService {
    private bundlePath: string;

    constructor(bundlePath?: string) {
        // Default to the standard bundle location
        this.bundlePath = bundlePath ?? join(__dirname, '../../../dist/scanner-bundle.js');
    }

    /**
     * Check if the scanner bundle is already injected in the page
     */
    isBundleInjected(page: Page): Effect.Effect<boolean> {
        return Effect.promise(() =>
            page.evaluate(() => {
                return typeof (window as any).Aria51Scanner !== 'undefined';
            })
        );
    }

    /**
     * Inject the scanner bundle into the page
     */
    injectBundle(page: Page): Effect.Effect<void, ScannerInjectionError> {
        return Effect.gen(this, function* () {
            // Check if already injected
            const alreadyInjected = yield* this.isBundleInjected(page);
            if (alreadyInjected) {
                logger.debug('Scanner bundle already injected, skipping');
                return;
            }

            // Try to inject the bundle
            yield* Effect.tryPromise({
                try: () => page.addScriptTag({ path: this.bundlePath }),
                catch: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    const isCSP = errorMsg.includes('Content Security Policy') || errorMsg.includes('script-src');
                    const reason = isCSP
                        ? `This site's Content Security Policy (CSP) blocks inline script injection, which prevents accessibility scanning. To scan this site, try: (1) a staging/development environment without strict CSP, (2) a local development server, or (3) disabling CSP in browser launch flags.`
                        : `Failed to inject scanner bundle: ${errorMsg}. The dist/scanner-bundle.js file may be missing or corrupted. Try running "npm run build" to regenerate it.`;
                    return new ScannerInjectionError({ reason });
                }
            });

            logger.debug('Scanner bundle injected successfully');

            // Verify injection was successful
            const isInjected = yield* this.isBundleInjected(page);
            if (!isInjected) {
                return yield* Effect.fail(new ScannerInjectionError({
                    reason: 'Scanner bundle failed to load in page context. This may indicate a JavaScript error in the page. Try running with --headless=false to debug.'
                }));
            }
        });
    }

    /**
     * Run the scan on the page with retry logic
     */
    scan(page: Page, options?: ScanExecutionOptions): Effect.Effect<BrowserScanData, ScannerInjectionError | ScanDataError> {
        return Effect.gen(this, function* () {
            return yield* this._scanInternal(page, options);
        });
    }

    /**
     * Internal scan implementation
     */
    private _scanInternal(page: Page, options?: ScanExecutionOptions): Effect.Effect<BrowserScanData, ScannerInjectionError | ScanDataError> {
        return Effect.gen(this, function* () {
            // Ensure bundle is injected
            yield* this.injectBundle(page);

            // Run the scanner with retry logic
            const rawData = yield* this._executeScan(page, options);

            return rawData;
        });
    }

    /**
     * Execute the scan
     * Note: Retry logic is handled at the orchestration layer using Effect.retry()
     */
    private _executeScan(page: Page, options?: ScanExecutionOptions): Effect.Effect<BrowserScanData, ScanDataError> {
        const { tags, includeKeyboardTests, disableRules, exclude } = options ?? {};

        return Effect.gen(this, function* () {
            // Execute the scan in the browser context
            const rawEvaluateData = yield* Effect.tryPromise({
                try: async () => {
                    // Block navigation during scan to prevent context destruction
                    return await page.evaluate(
                        ({ scanTags, runKeyboardTests, rulesToDisable, excludeSelectors }) => {
                            // Save original navigation methods
                            const originalPushState = history.pushState;
                            const originalReplaceState = history.replaceState;

                            try {
                                // Temporarily block navigation
                                history.pushState = () => {};
                                history.replaceState = () => {};

                                const result = (window as any).Aria51Scanner!.scan({
                                    tags: scanTags,
                                    includeKeyboardTests: runKeyboardTests,
                                    disableRules: rulesToDisable,
                                    exclude: excludeSelectors,
                                });

                                return result;
                            } finally {
                                // Always restore navigation
                                history.pushState = originalPushState;
                                history.replaceState = originalReplaceState;
                            }
                        },
                        { scanTags: tags, runKeyboardTests: includeKeyboardTests, rulesToDisable: disableRules, excludeSelectors: exclude }
                    );
                },
                catch: (error) => new ScanDataError({
                    reason: error instanceof Error ? error.message : String(error)
                })
            });

            // Validate browser data through schema (lenient: logs warnings, falls back to raw cast)
            const rawData = yield* decodeBrowserScanDataLenient(rawEvaluateData);

            // Validate that we got results
            if (!rawData) {
                return yield* Effect.fail(new ScanDataError({ reason: 'No scan data returned from browser' }));
            }

            // Validate results have expected structure
            // Note: components array is only populated when using framework plugins (e.g., React)
            if (!Array.isArray(rawData.components)) {
                rawData.components = [];
            }

            if (!Array.isArray(rawData.violations)) {
                logger.warn('Scan returned invalid violations data');
                rawData.violations = [];
            }

            // Warn if accessibility tree is empty (page may have no accessible content)
            if (!rawData.accessibilityTree) {
                logger.debug('No accessibility tree generated - page may have no accessible content');
            }

            const componentInfo = rawData.components.length > 0
                ? ` and ${rawData.components.length} components`
                : '';
            logger.debug(
                `Scan complete: Found ${rawData.violations.length} violations${componentInfo}`
            );

            return rawData;
        });
    }
}

/**
 * Create a new ScannerService instance
 */
export function createScannerService(bundlePath?: string): IScannerService {
    return new ScannerService(bundlePath);
}
