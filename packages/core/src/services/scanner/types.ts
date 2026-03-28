/**
 * Scanner Service Types
 */
import type { Effect } from 'effect';
import type { Page } from 'playwright';
import type { BrowserScanData } from '../../types.js';
import type { ScannerInjectionError, ScanDataError } from '../../errors/effect-errors.js';

/**
 * Options for scanner execution (subset of full ScanOptions)
 */
export interface ScanExecutionOptions {
    tags?: string[];
    includeKeyboardTests?: boolean;
    disableRules?: string[];
    exclude?: string[];
}

/**
 * Effect-first Scanner Service interface
 *
 * All methods return Effects for composability with the Effect ecosystem.
 */
export interface IScannerService {
    /**
     * Check if the scanner bundle is already injected in the page
     */
    isBundleInjected(page: Page): Effect.Effect<boolean>;

    /**
     * Inject the scanner bundle into the page
     */
    injectBundle(page: Page): Effect.Effect<void, ScannerInjectionError>;

    /**
     * Run the scan on the page
     */
    scan(page: Page, options?: ScanExecutionOptions): Effect.Effect<BrowserScanData, ScannerInjectionError | ScanDataError>;
}

