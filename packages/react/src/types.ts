/**
 * React Plugin Types
 *
 * Types specific to React component attribution and fiber traversal.
 */

// Re-export core types that are needed
export type {
    ImpactLevel,
    ImpactLevelOrNull,
    WcagLevel,
    AxeViolation,
    AxeResult,
    AxeCheckResult,
    WcagCriterionInfo,
    FixSuggestion,
} from '@aria51/core';

/**
 * Source location information from element-source
 */
export interface SourceLocation {
    filePath: string;
    lineNumber: number | null;
    columnNumber: number | null;
    componentName?: string | null;
}

/**
 * Component information from element-source / fiber traversal
 */
export interface ComponentInfo {
    /** Component name (from displayName, function name, or debug source) */
    name: string;
    /** Component type: 'host' for DOM elements, 'component' for React components */
    type: string;
    /** Display name if different from name */
    displayName?: string;
    /** Associated DOM node (for host components) */
    domNode?: Element | null;
    /** Full path from root component */
    path: string[];
    /** Source file location */
    source?: SourceLocation;
    /** Full source stack */
    sourceStack?: SourceLocation[];
}

/**
 * React-specific scan data returned from the plugin
 */
export interface ReactScanData {
    /** All components found in the fiber tree */
    components: ComponentInfo[];
    /** DOM element to component mapping */
    domToComponentMap: Map<Element, ComponentInfo>;
}

/**
 * Attributed check with related node information
 */
export interface AttributedCheck {
    id: string;
    impact: import('@aria51/core').ImpactLevelOrNull;
    message: string;
    relatedNodes?: Array<{
        html: string;
        target: string[];
        htmlSnippet?: string;
    }>;
}

/**
 * A violation node with React component attribution
 */
export interface AttributedViolationNode {
    /** Component name (null if not in a React component) */
    component: string | null;
    /** Full component path from root */
    componentPath: string[];
    /** Filtered path with only user components (no framework components) */
    userComponentPath: string[];
    /** Component type */
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
    /** Source file location of the nearest component */
    source?: SourceLocation;
    /** Full source stack with file locations at each component level */
    sourceStack?: SourceLocation[];
    /** Detailed check results */
    checks?: {
        any?: AttributedCheck[];
        all?: AttributedCheck[];
        none?: AttributedCheck[];
    };
}

/**
 * Violation with React component attribution
 */
export interface AttributedViolation {
    id: string;
    impact: import('@aria51/core').ImpactLevel;
    description: string;
    help: string;
    helpUrl: string;
    tags: string[];
    wcagCriteria?: import('@aria51/core').WcagCriterionInfo[];
    nodes: AttributedViolationNode[];
    fixSuggestion?: import('@aria51/core').FixSuggestion;
}

/**
 * Pass result with component attribution
 */
export interface AttributedPass {
    id: string;
    impact: import('@aria51/core').ImpactLevelOrNull;
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
    impact: import('@aria51/core').ImpactLevelOrNull;
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
