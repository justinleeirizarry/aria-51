/**
 * React Browser Bundle - Injected into pages for React-specific scanning
 *
 * This file gets bundled and injected into the browser page to traverse
 * the React Fiber tree and attribute violations to components.
 *
 * Uses element-source for component attribution and source location resolution.
 */

// Import React-specific scanner components
import { findReactRoot, traverseFiberTree, enrichComponentsWithSource, buildDomToComponentMap } from './fiber/traversal.js';
import {
    attributeViolationsToComponents,
    attributePassesToComponents,
    attributeIncompleteToComponents
} from './attribution/index.js';
import type { ComponentInfo, AttributedViolation, AttributedPass, AttributedIncomplete } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Scan error information
 */
interface ScanError {
    phase: string;
    message: string;
    stack?: string;
    recoverable: boolean;
}

/**
 * React scan data returned from browser context
 */
export interface ReactBrowserScanData {
    /** Components found in the fiber tree */
    components: ComponentInfo[];
    /** Errors encountered during scan */
    errors?: ScanError[];
}

/**
 * React scan with attribution data
 */
export interface ReactAttributedScanData {
    /** Components found in the fiber tree */
    components: ComponentInfo[];
    /** Violations attributed to components */
    violations: AttributedViolation[];
    /** Passes attributed to components */
    passes: AttributedPass[];
    /** Incomplete results attributed to components */
    incomplete: AttributedIncomplete[];
    /** Errors encountered during scan */
    errors?: ScanError[];
}

/**
 * API exposed on window.Aria51ReactPlugin
 */
export interface Aria51ReactPluginAPI {
    scan: () => Promise<ReactBrowserScanData>;
    attributeViolations: (
        violations: any[],
        passes: any[],
        incomplete: any[]
    ) => Promise<ReactAttributedScanData>;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Scan the page for React components
 *
 * This traverses the React Fiber tree and collects component information,
 * then enriches components with source location data via element-source.
 */
export async function scan(): Promise<ReactBrowserScanData> {
    const errors: ScanError[] = [];

    console.log('🔍 Starting React component scan...');

    // Find React root
    const root = findReactRoot();
    if (!root) {
        throw new Error('Could not find React root fiber node. Is this a React application?');
    }

    console.log('✓ Found React root');

    // Traverse fiber tree to get components
    let components: ComponentInfo[] = [];
    try {
        const MAX_COMPONENTS = 10000;
        components = traverseFiberTree(root);
        if (components.length > MAX_COMPONENTS) {
            console.warn(`[aria51-react] Component limit reached (${MAX_COMPONENTS}), truncating`);
            components = components.slice(0, MAX_COMPONENTS);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('[aria51-react] Fiber traversal failed:', error);
        errors.push({
            phase: 'fiber-traversal',
            message: errorMessage,
            stack: errorStack,
            recoverable: true,
        });
        components = [];
    }

    // Enrich components with source location data from element-source
    try {
        await enrichComponentsWithSource(components);
    } catch (error) {
        console.warn('[aria51-react] Source enrichment failed:', error);
    }

    console.log(`✓ Found ${components.length} React components`);

    return {
        components,
        errors: errors.length > 0 ? errors : undefined,
    };
}

/**
 * Attribute axe-core results to React components
 *
 * Takes the raw axe results (violations, passes, incomplete) and
 * returns them with React component attribution via element-source.
 */
export async function attributeViolations(
    violations: any[],
    passes: any[],
    incomplete: any[]
): Promise<ReactAttributedScanData> {
    const errors: ScanError[] = [];

    // First scan for components
    const scanData = await scan();
    if (scanData.errors) {
        errors.push(...scanData.errors);
    }

    // Build DOM-to-component map for attribution
    const domToComponentMap = buildDomToComponentMap(scanData.components);

    // Attribute violations to components
    const attributedViolations = await attributeViolationsToComponents(violations, domToComponentMap);
    console.log(`✓ Attributed ${attributedViolations.length} violations to components`);

    // Attribute passes to components (lighter attribution)
    const attributedPasses = await attributePassesToComponents(passes, domToComponentMap);
    console.log(`✓ Attributed ${attributedPasses.length} passing rules`);

    // Attribute incomplete results (needs manual review)
    const attributedIncomplete = await attributeIncompleteToComponents(incomplete, domToComponentMap);
    if (attributedIncomplete.length > 0) {
        console.log(`⚠️  ${attributedIncomplete.length} rules need manual review`);
    }

    return {
        components: scanData.components,
        violations: attributedViolations,
        passes: attributedPasses,
        incomplete: attributedIncomplete,
        errors: errors.length > 0 ? errors : undefined,
    };
}

// ============================================================================
// Global Window Export
// ============================================================================

// Expose to global window for evaluation
if (typeof window !== 'undefined') {
    (window as any).Aria51ReactPlugin = { scan, attributeViolations };
}

// Type augmentation for window
declare global {
    interface Window {
        Aria51ReactPlugin?: Aria51ReactPluginAPI;
    }
}
