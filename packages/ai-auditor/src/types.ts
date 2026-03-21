/**
 * AI Auditor Types
 *
 * Types for AI-powered accessibility auditing with Stagehand and Browserbase.
 */

// Re-export core types that are commonly needed
export type {
    ImpactLevel,
    WcagLevel,
    WcagCriterionInfo,
} from '@aria51/core';

// ============================================================================
// Stagehand Keyboard Testing Types
// ============================================================================

/**
 * Configuration for Stagehand-based keyboard navigation testing
 */
export interface StagehandKeyboardConfig {
    /** Maximum number of Tab key presses to test (default: 100) */
    maxTabPresses?: number;
    /** Test keyboard shortcuts (default: true) */
    testShortcuts?: boolean;
    /** Test skip links functionality (default: true) */
    testSkipLinks?: boolean;
    /** Enable verbose logging */
    verbose?: boolean;
    /** AI model to use (default: "openai/gpt-4o-mini") */
    model?: string;
}

/**
 * Types of keyboard navigation issues that can be detected
 */
export type StagehandKeyboardIssueType =
    | 'focus-trap'
    | 'no-focus-indicator'
    | 'tab-order-violation'
    | 'keyboard-inaccessible'
    | 'skip-link-broken'
    | 'shortcut-conflict';

/**
 * A keyboard navigation issue detected by Stagehand
 */
export interface StagehandKeyboardIssue {
    /** Type of keyboard issue */
    type: StagehandKeyboardIssueType;
    /** Element information */
    element: {
        description: string;
        selector: string;
        role?: string;
    };
    /** Human-readable issue description */
    message: string;
    /** Related WCAG criteria */
    wcagCriteria: import('@aria51/core').WcagCriterionInfo[];
    /** Issue severity */
    severity: 'critical' | 'serious' | 'moderate';
    /** Steps to reproduce the issue */
    reproduction: string[];
}

/**
 * Tab order entry for keyboard navigation results
 */
export interface TabOrderEntry {
    /** Position in tab order */
    index: number;
    /** Element description */
    element: string;
    /** CSS selector */
    selector: string;
    /** ARIA role */
    role: string;
    /** Whether element has visible focus indicator */
    hasFocusIndicator: boolean;
}

/**
 * Results from Stagehand keyboard navigation testing
 */
export interface StagehandKeyboardResults {
    /** URL that was tested */
    url: string;
    /** When the test was performed */
    timestamp: string;
    /** Tab order sequence discovered */
    tabOrder: TabOrderEntry[];
    /** Keyboard navigation issues found */
    issues: StagehandKeyboardIssue[];
    /** Coverage statistics */
    coverage: {
        /** Total interactive elements on page */
        totalInteractive: number;
        /** Number accessible via keyboard */
        keyboardAccessible: number;
        /** Percentage accessible */
        percentAccessible: number;
    };
    /** Summary of issues */
    summary: {
        totalIssues: number;
        focusTraps: number;
        missingIndicators: number;
        inaccessibleElements: number;
    };
}

// ============================================================================
// Accessibility Tree Analysis Types
// ============================================================================

/**
 * Node in the accessibility tree
 */
export interface A11yTreeNode {
    /** ARIA role */
    role: string;
    /** Accessible name */
    name?: string;
    /** Accessible description */
    description?: string;
    /** CSS selector to locate this element */
    selector: string;
    /** Child nodes */
    children?: A11yTreeNode[];
    /** State properties */
    checked?: boolean;
    disabled?: boolean;
    expanded?: boolean;
    focused?: boolean;
    required?: boolean;
    selected?: boolean;
    hidden?: boolean;
    /** Additional properties */
    level?: number;
    valueMin?: number;
    valueMax?: number;
    valueNow?: number;
    valueText?: string;
}

/**
 * Types of accessibility tree issues
 */
export type TreeIssueType =
    | 'missing-name'
    | 'missing-role'
    | 'invalid-role'
    | 'missing-landmark'
    | 'heading-skip'
    | 'orphaned-control'
    | 'duplicate-id'
    | 'focusable-hidden';

/**
 * An accessibility tree issue
 */
export interface TreeIssue {
    /** Type of issue */
    type: TreeIssueType;
    /** Affected node */
    node: {
        role: string;
        name?: string;
        selector: string;
    };
    /** Human-readable description */
    message: string;
    /** Related WCAG criteria */
    wcagCriteria: import('@aria51/core').WcagCriterionInfo[];
    /** Issue severity */
    severity: 'critical' | 'serious' | 'moderate' | 'minor';
}

/**
 * Results from accessibility tree analysis
 */
export interface TreeAnalysisResult {
    /** URL that was analyzed */
    url: string;
    /** When the analysis was performed */
    timestamp: string;
    /** The full accessibility tree */
    tree: A11yTreeNode;
    /** Tree statistics */
    stats: {
        landmarks: number;
        headings: number;
        formControls: number;
        interactiveElements: number;
        totalNodes: number;
    };
    /** Issues found in the tree */
    issues: TreeIssue[];
    /** Summary of analysis */
    summary: {
        totalIssues: number;
        bySeverity: Record<string, number>;
    };
}

/**
 * Configuration for accessibility tree analysis
 */
export interface TreeAnalysisConfig {
    /** Enable verbose logging */
    verbose?: boolean;
    /** AI model to use */
    model?: string;
    /** Include full tree in results (can be large) */
    includeFullTree?: boolean;
}

// ============================================================================
// WCAG Audit Agent Types
// ============================================================================

/**
 * Configuration for WCAG audit
 */
export interface WcagAuditOptions {
    /** Target WCAG conformance level */
    targetLevel: import('@aria51/core').WcagLevel;
    /** Maximum pages to visit (for multi-page audits) */
    maxPages?: number;
    /** Maximum agent steps before stopping */
    maxSteps?: number;
    /** Specific criteria to test (by ID, e.g., "2.4.7") */
    criteria?: string[];
    /** Enable verbose logging */
    verbose?: boolean;
    /** AI model to use */
    model?: string;
}

/**
 * Status of an audit finding
 */
export type AuditStatus = 'pass' | 'fail' | 'manual-review';

/**
 * A single audit finding for a WCAG criterion
 */
export interface AuditFinding {
    /** The WCAG criterion being tested */
    criterion: import('@aria51/core').WcagCriterionInfo;
    /** Result status */
    status: AuditStatus;
    /** Affected element (if applicable) */
    element?: string;
    /** CSS selector (if applicable) */
    selector?: string;
    /** Description of the finding */
    description: string;
    /** Impact level (for failures) */
    impact?: import('@aria51/core').ImpactLevel;
    /** Evidence or details supporting the finding */
    evidence?: string;
}

/**
 * Results from WCAG audit
 */
export interface WcagAuditResult {
    /** URL that was audited */
    url: string;
    /** When the audit was performed */
    timestamp: string;
    /** Target conformance level */
    targetLevel: import('@aria51/core').WcagLevel;
    /** All audit findings */
    findings: AuditFinding[];
    /** Summary statistics */
    summary: {
        passed: number;
        failed: number;
        manualReview: number;
        /** Number of pages visited */
        pagesVisited: number;
        /** Number of application states checked */
        statesChecked: number;
    };
    /** Final agent summary message */
    agentMessage: string;
}

// ============================================================================
// Screen Reader Navigator Types
// ============================================================================

/**
 * Configuration for simulated screen reader navigation
 */
export interface ScreenReaderNavigatorConfig {
    /** Enable verbose logging */
    verbose?: boolean;
    /** AI model to use */
    model?: string;
    /** Browserbase session ID (for remote sessions with live view) */
    browserbaseSessionId?: string;
    /** Test keyboard navigation between elements (default: true) */
    testKeyboardNav?: boolean;
    /** Maximum tab presses during keyboard nav test (default: 50) */
    maxTabPresses?: number;
}

/**
 * Types of screen reader navigation issues
 */
export type ScreenReaderIssueType =
    | 'missing-landmark'
    | 'missing-main-landmark'
    | 'multiple-main-landmarks'
    | 'landmark-no-label'
    | 'heading-skip'
    | 'missing-h1'
    | 'multiple-h1'
    | 'empty-heading'
    | 'missing-skip-link'
    | 'broken-skip-link'
    | 'missing-page-title'
    | 'generic-link-text'
    | 'missing-alt-text'
    | 'missing-form-label'
    | 'missing-element-name'
    | 'tab-not-following-landmarks';

/**
 * A screen reader navigation issue
 */
export interface ScreenReaderIssue {
    /** Type of issue */
    type: ScreenReaderIssueType;
    /** Affected element (if applicable) */
    element?: {
        role: string;
        name?: string;
        level?: number;
    };
    /** Human-readable description */
    message: string;
    /** Related WCAG criteria */
    wcagCriteria: import('@aria51/core').WcagCriterionInfo[];
    /** Issue severity */
    severity: 'critical' | 'serious' | 'moderate' | 'minor';
}

/**
 * A landmark discovered during navigation
 */
export interface LandmarkEntry {
    /** ARIA landmark role */
    role: string;
    /** Accessible label */
    name?: string;
    /** Number of child nodes */
    childCount: number;
}

/**
 * A heading discovered during navigation
 */
export interface HeadingEntry {
    /** Heading level (1-6) */
    level: number;
    /** Heading text content */
    text: string;
}

/**
 * A step in the navigation sequence
 */
export interface NavigationStep {
    /** Type of navigation action */
    action: 'read-title' | 'list-landmarks' | 'navigate-landmark' | 'list-headings' | 'navigate-heading' | 'tab-focus';
    /** Human-readable description of the step */
    description: string;
    /** Element involved (if applicable) */
    element?: {
        role: string;
        name?: string;
        level?: number;
    };
    /** Timestamp */
    timestamp: number;
}

/**
 * Complete results from screen reader navigation testing
 */
export interface ScreenReaderNavigationResults {
    /** URL that was tested */
    url: string;
    /** When the test was performed */
    timestamp: string;
    /** Page title */
    pageTitle: string;
    /** Landmarks discovered */
    landmarks: LandmarkEntry[];
    /** Headings discovered */
    headings: HeadingEntry[];
    /** Step-by-step navigation log */
    navigationSteps: NavigationStep[];
    /** Issues found */
    issues: ScreenReaderIssue[];
    /** Summary statistics */
    summary: {
        totalLandmarks: number;
        totalHeadings: number;
        totalIssues: number;
        issuesBySeverity: Record<string, number>;
        landmarkCoverage: string[];
        headingStructureValid: boolean;
    };
}

// ============================================================================
// Stagehand Scanner Config Types
// ============================================================================

/**
 * Configuration for the Stagehand AI scanner
 */
export interface StagehandConfig {
    enabled: boolean;
    model?: string;
    apiKey?: string;
    verbose?: boolean;
}

/**
 * Results from Stagehand element discovery
 */
export interface StagehandResults {
    elements: ElementDiscovery[];
}

// ============================================================================
// Test Generation Types
// ============================================================================

/**
 * Element type for test generation
 */
export type ElementType =
    | 'button'
    | 'link'
    | 'input'
    | 'checkbox'
    | 'radio'
    | 'select'
    | 'custom';

/**
 * Discovered element for test generation
 */
export interface ElementDiscovery {
    selector: string;
    description: string;
    suggestedMethod?: string;
    type: ElementType;
}

/**
 * Test generation options
 */
export interface TestGenerationOptions {
    url: string;
    outputFile: string;
    model?: string;
    verbose?: boolean;
}

/**
 * Test generation results
 */
export interface TestGenerationResults {
    url: string;
    timestamp: string;
    outputFile: string;
    elementsDiscovered: number;
    elements: ElementDiscovery[];
    success: boolean;
    error?: string;
}
