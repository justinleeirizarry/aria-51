/**
 * Generic Browser Bundle - Framework-Agnostic Accessibility Scanner
 *
 * This file gets bundled and injected into the browser page.
 * It runs in the browser context and uses only axe-core - no framework dependencies.
 *
 * For framework-specific features (React component attribution), use the
 * framework plugin packages (e.g., @aria51/react).
 */

// @ts-ignore - axe-core is bundled as IIFE by esbuild and TypeScript cannot resolve the runtime import
import axe from 'axe-core';

// Import modular scanner components
import { runAxeFullScan } from './axe/runner.js';
import { runKeyboardTests } from './keyboard/index.js';
import { buildAccessibilityTree } from './axe/tree-builder.js';
import { runWCAG22Checks } from './wcag22/index.js';
import type {
    AxeViolation,
    AxeResult,
    KeyboardTestResults,
    WCAG22Results,
    ScanError,
} from '../types.js';

// ============================================================================
// Generic Scan Types (Browser Context)
// ============================================================================

/**
 * Options for generic browser scan
 */
export interface GenericBrowserScanOptions {
    /** axe-core rule tags to include */
    tags?: string[];
    /** Include keyboard navigation tests */
    includeKeyboardTests?: boolean;
    /** Include WCAG 2.2 custom checks */
    includeWcag22Checks?: boolean;
    /** Axe rule IDs to disable */
    disableRules?: string[];
    /** CSS selectors to exclude from scanning */
    exclude?: string[];
}

/**
 * Generic scan data returned from browser context
 */
export interface GenericBrowserScanData {
    /** Components array - empty for generic scan, populated by framework plugins */
    components: Array<{ name: string; elementCount: number }>;
    /** Raw axe violations (no component attribution) */
    violations: AxeViolation[];
    /** Rules that passed */
    passes: AxeResult[];
    /** Rules needing manual review */
    incomplete: AxeResult[];
    /** Rules that don't apply */
    inapplicable: Array<{
        id: string;
        description: string;
        help: string;
        helpUrl: string;
        tags: string[];
    }>;
    /** Keyboard test results (if requested) */
    keyboardTests?: KeyboardTestResults;
    /** WCAG 2.2 custom check results */
    wcag22?: WCAG22Results;
    /** Accessibility tree snapshot */
    accessibilityTree?: unknown;
    /** Non-fatal errors encountered during scan */
    errors?: ScanError[];
}

/**
 * API exposed on window.Aria51Scanner
 */
export interface Aria51ScannerAPI {
    scan: (options?: GenericBrowserScanOptions) => Promise<GenericBrowserScanData>;
}

// ============================================================================
// Main Scan Function
// ============================================================================

/**
 * Main scan function - called from Node context
 *
 * This performs a generic accessibility scan without any framework-specific
 * component attribution. For React component attribution, use the React plugin.
 */
export async function scan(options: GenericBrowserScanOptions = {}): Promise<GenericBrowserScanData> {
    // Track non-fatal errors for debugging
    const errors: ScanError[] = [];

    console.log('🔍 Starting generic accessibility scan...');

    // Run axe accessibility scan (full results)
    const axeResults = await runAxeFullScan(options.tags, options.disableRules, options.exclude);
    console.log(`✓ Found ${axeResults.violations.length} violations, ${axeResults.passes.length} passes, ${axeResults.incomplete.length} incomplete`);

    // Check if axe had an error
    if (axeResults.error) {
        errors.push({
            phase: 'axe-scan',
            message: axeResults.error.message,
            stack: axeResults.error.stack,
            recoverable: true,
        });
    }

    // Run keyboard tests if requested
    let keyboardTests: KeyboardTestResults | undefined;
    if (options.includeKeyboardTests) {
        console.log('🎹 Starting keyboard tests...');
        console.warn('⚠️  Keyboard testing is experimental and may not detect all issues');
        try {
            keyboardTests = runKeyboardTests();
            console.log(`✓ Keyboard tests complete: ${keyboardTests.summary.totalIssues} issues found`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('❌ Failed to run keyboard tests:', error);
            errors.push({
                phase: 'keyboard-tests',
                message: errorMessage,
                stack: errorStack,
                recoverable: true,
            });
        }
    }

    // Run WCAG 2.2 custom checks
    let wcag22Results: WCAG22Results | undefined;
    if (options.includeWcag22Checks !== false) {
        try {
            wcag22Results = runWCAG22Checks();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('❌ Failed to run WCAG 2.2 checks:', error);
            errors.push({
                phase: 'wcag22-checks',
                message: errorMessage,
                stack: errorStack,
                recoverable: true,
            });
        }
    }

    // Build accessibility tree
    console.log('🌳 Building accessibility tree...');
    let accessibilityTree: unknown;
    try {
        accessibilityTree = buildAccessibilityTree();
        console.log('✓ Accessibility tree built');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('❌ Failed to build accessibility tree:', error);
        errors.push({
            phase: 'tree-building',
            message: errorMessage,
            stack: errorStack,
            recoverable: true,
        });
    }

    return {
        // Generic scan doesn't provide component info - that comes from framework plugins
        components: [],
        violations: axeResults.violations,
        passes: axeResults.passes,
        incomplete: axeResults.incomplete,
        inapplicable: axeResults.inapplicable,
        keyboardTests,
        wcag22: wcag22Results,
        accessibilityTree,
        errors: errors.length > 0 ? errors : undefined,
    };
}

// ============================================================================
// Global Window Export
// ============================================================================

// Expose to global window for evaluation
if (typeof window !== 'undefined') {
    (window as any).Aria51Scanner = { scan };
}

