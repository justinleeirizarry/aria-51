/**
 * Orchestration Service Types
 */
import type { ScanResults, BrowserType } from '../../types.js';

// Re-export for backwards compatibility
export type { BrowserType };

/**
 * Base options for scan operations (used by Effect-based implementation)
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
    /** Progress callback fired at each scan step */
    onProgress?: (step: ScanProgressStep) => void;
}

/**
 * Progress step emitted during a scan
 */
export interface ScanProgressStep {
    step: 'launching' | 'navigating' | 'stabilizing' | 'detecting' | 'scanning' | 'attributing' | 'processing' | 'done';
    message: string;
}

/**
 * Result of a scan operation (used by Effect-based implementation)
 */
export interface ScanOperationResult {
    results: ScanResults;
    ciPassed?: boolean;
    outputFile?: string;
}
