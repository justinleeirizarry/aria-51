/**
 * Plugin System for Framework-Specific Functionality
 *
 * This module provides interfaces for extending the core accessibility toolkit
 * with framework-specific capabilities like React Fiber traversal.
 */

import type { Page } from 'playwright';
import type { AxeViolation, AxeResult, ComponentInfo } from './types.js';

// ============================================================================
// Framework Plugin Types
// ============================================================================

/**
 * Framework-specific scan data returned from a plugin
 */
export interface FrameworkScanData {
    /** Components found by the framework plugin */
    components: ComponentInfo[];
    /** DOM to component mapping for attribution */
    domToComponentMap: Map<string, ComponentInfo>;
    /** Any additional framework-specific data */
    metadata?: Record<string, unknown>;
}

/**
 * Node with component attribution from a framework plugin
 */
export interface AttributedNode {
    /** Component name (null if not in a framework component) */
    component: string | null;
    /** Full component path from root */
    componentPath: string[];
    /** Filtered path with only user components */
    userComponentPath: string[];
    /** Type of component */
    componentType: 'host' | 'component' | null;
    /** Original HTML of the element */
    html: string;
    /** Truncated, readable HTML snippet */
    htmlSnippet: string;
    /** Generated CSS selector for easy location */
    cssSelector: string;
    /** axe-core target selectors */
    target: string[];
    /** Failure summary from axe */
    failureSummary: string;
    /** Whether this is a framework internal component */
    isFrameworkComponent: boolean;
}

/**
 * Plugin interface for framework-specific attribution
 *
 * Framework plugins (e.g., React, Vue, Angular) implement this interface
 * to provide component attribution for accessibility violations.
 *
 * @example
 * ```typescript
 * import { FrameworkPlugin } from '@aria51/core';
 *
 * export const ReactPlugin: FrameworkPlugin = {
 *   name: 'react',
 *
 *   async detect(page) {
 *     return page.evaluate(() => {
 *       return !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size;
 *     });
 *   },
 *
 *   async scan(page) {
 *     // Inject React-specific bundle, traverse Fiber tree
 *     const bundle = await loadReactBundle();
 *     await page.evaluate(bundle);
 *     return page.evaluate(() => (window as any).Aria51ReactPlugin.scan());
 *   },
 *
 *   attributeViolations(violations, data) {
 *     return attributeViolationsToComponents(violations, data.domToComponentMap);
 *   }
 * };
 * ```
 */
export interface FrameworkPlugin {
    /** Unique name for this plugin (e.g., 'react', 'vue', 'angular') */
    name: string;

    /**
     * Detect if this framework is present on the page
     *
     * This should be a fast check that returns true if the framework
     * is detected on the page.
     */
    detect: (page: Page) => Promise<boolean>;

    /**
     * Scan the page for framework-specific data
     *
     * This typically involves:
     * 1. Injecting a framework-specific bundle
     * 2. Traversing the framework's component tree
     * 3. Building a DOM-to-component map
     */
    scan: (page: Page) => Promise<FrameworkScanData>;

    /**
     * Attribute violations to framework components
     *
     * Takes the raw axe violations and the framework scan data,
     * and returns violations with component attribution.
     */
    attributeViolations: (
        violations: AxeViolation[],
        data: FrameworkScanData
    ) => AttributedViolation[];

    /**
     * Optional: Attribute passes to framework components
     */
    attributePasses?: (
        passes: AxeResult[],
        data: FrameworkScanData
    ) => AttributedPass[];

    /**
     * Optional: Attribute incomplete results to framework components
     */
    attributeIncomplete?: (
        incomplete: AxeResult[],
        data: FrameworkScanData
    ) => AttributedIncomplete[];
}

// ============================================================================
// Generic Attributed Types (for use by plugins)
// ============================================================================

import type {
    ImpactLevel,
    FixSuggestion,
    WcagCriterionInfo,
    ImpactLevelOrNull,
    AttributedCheck,
} from './types.js';

/**
 * Violation with component attribution (returned by framework plugins)
 */
export interface AttributedViolation {
    id: string;
    impact: ImpactLevel;
    description: string;
    help: string;
    helpUrl: string;
    tags: string[];
    wcagCriteria?: WcagCriterionInfo[];
    nodes: Array<AttributedNode & {
        checks?: {
            any?: AttributedCheck[];
            all?: AttributedCheck[];
            none?: AttributedCheck[];
        };
    }>;
    fixSuggestion?: FixSuggestion;
}

/**
 * Pass result with component attribution
 */
export interface AttributedPass {
    id: string;
    impact: ImpactLevelOrNull;
    description: string;
    help: string;
    helpUrl: string;
    tags: string[];
    nodes: Array<{
        component: string | null;
        html: string;
        htmlSnippet: string;
        target: string[];
    }>;
}

/**
 * Incomplete result with component attribution (needs manual review)
 */
export interface AttributedIncomplete {
    id: string;
    impact: ImpactLevelOrNull;
    description: string;
    help: string;
    helpUrl: string;
    tags: string[];
    nodes: Array<{
        component: string | null;
        html: string;
        htmlSnippet: string;
        target: string[];
        message?: string;
        checks?: {
            any?: AttributedCheck[];
            all?: AttributedCheck[];
            none?: AttributedCheck[];
        };
    }>;
}

// ============================================================================
// Generic Scan Results (no framework attribution)
// ============================================================================

import type {
    KeyboardTestResults,
    WCAG22Results,
    ScanError
} from './types.js';

/**
 * Generic scan results without framework-specific attribution
 *
 * This is returned when scanning without any framework plugins,
 * or before plugin attribution is applied.
 */
export interface GenericScanResults {
    /** URL that was scanned */
    url: string;
    /** Timestamp of the scan */
    timestamp: string;
    /** Browser used for scanning */
    browser: string;
    /** Raw axe violations (without component attribution) */
    violations: AxeViolation[];
    /** Rules that passed */
    passes?: AxeResult[];
    /** Rules needing manual review */
    incomplete?: AxeResult[];
    /** Rules that don't apply */
    inapplicable?: Array<{
        id: string;
        description: string;
        help: string;
        helpUrl: string;
        tags: string[];
    }>;
    /** Accessibility tree snapshot */
    accessibilityTree?: unknown;
    /** Keyboard navigation test results */
    keyboardTests?: KeyboardTestResults;
    /** WCAG 2.2 custom check results */
    wcag22?: WCAG22Results;
    /** Non-fatal errors during scan */
    errors?: ScanError[];
    /** Summary statistics */
    summary: {
        totalViolations: number;
        totalPasses: number;
        totalIncomplete: number;
        totalInapplicable: number;
        violationsBySeverity: {
            critical: number;
            serious: number;
            moderate: number;
            minor: number;
        };
        violationsByWcagLevel?: {
            wcag2a: number;
            wcag2aa: number;
            wcag2aaa: number;
            wcag21a: number;
            wcag21aa: number;
            wcag22aa: number;
            bestPractice: number;
        };
        keyboardIssues?: number;
        wcag22Issues?: number;
    };
}

/**
 * Scan options with optional framework plugins
 */
export interface GenericScanOptions {
    /** URL to scan */
    url: string;
    /** Browser type */
    browser?: 'chromium' | 'firefox' | 'webkit';
    /** Run in headless mode */
    headless?: boolean;
    /** Include keyboard navigation tests */
    keyboardTests?: boolean;
    /** Include WCAG 2.2 custom checks */
    wcag22Checks?: boolean;
    /** Framework plugins to use for attribution */
    plugins?: FrameworkPlugin[];
    /** axe-core rule tags to include */
    tags?: string[];
}
