/**
 * Top-level scan result schemas
 *
 * ComponentInfo, BrowserScanData (from page.evaluate), ScanResults (final output),
 * and related option/error types.
 */
import { Schema } from 'effect';
import { BrowserType, SourceLocation, type Mutable } from './primitives.js';
import { AttributedViolation, AttributedPass, AttributedIncomplete, InapplicableRule } from './violations.js';
import { KeyboardTestResults } from './keyboard.js';
import { WCAG22Results } from './wcag22-violations.js';
import { SupplementalTestResult } from './supplemental-results.js';

// Component information from element-source / fiber traversal
export const ComponentInfo = Schema.Struct({
    name: Schema.String,
    type: Schema.String,
    displayName: Schema.optional(Schema.String),
    domNode: Schema.optional(Schema.Unknown),
    path: Schema.Array(Schema.String),
    source: Schema.optional(SourceLocation),
});
export type ComponentInfo = Mutable<typeof ComponentInfo.Type>;

// Scan error information for debugging
export const ScanError = Schema.Struct({
    phase: Schema.Literal(
        'fiber-traversal', 'axe-scan', 'keyboard-tests', 'wcag22-checks', 'tree-building',
    ),
    message: Schema.String,
    stack: Schema.optional(Schema.String),
    recoverable: Schema.Boolean,
});
export type ScanError = Mutable<typeof ScanError.Type>;

// WCAG level breakdown in summary
const ViolationsByWcagLevel = Schema.Struct({
    wcag2a: Schema.Number,
    wcag2aa: Schema.Number,
    wcag2aaa: Schema.Number,
    wcag21a: Schema.Number,
    wcag21aa: Schema.Number,
    wcag22aa: Schema.Number,
    bestPractice: Schema.Number,
});

// Violations by severity in summary
const ViolationsBySeverity = Schema.Struct({
    critical: Schema.Number,
    serious: Schema.Number,
    moderate: Schema.Number,
    minor: Schema.Number,
});

// Raw scan data from browser context (what page.evaluate() returns)
export const BrowserScanData = Schema.Struct({
    components: Schema.Array(ComponentInfo),
    violations: Schema.Array(AttributedViolation),
    passes: Schema.optional(Schema.Array(AttributedPass)),
    incomplete: Schema.optional(Schema.Array(AttributedIncomplete)),
    inapplicable: Schema.optional(Schema.Array(InapplicableRule)),
    keyboardTests: Schema.optional(KeyboardTestResults),
    wcag22: Schema.optional(WCAG22Results),
    accessibilityTree: Schema.optional(Schema.Unknown),
    errors: Schema.optional(Schema.Array(ScanError)),
});
export type BrowserScanData = Mutable<typeof BrowserScanData.Type>;

// Final scan results
export const ScanResults = Schema.Struct({
    url: Schema.String,
    timestamp: Schema.String,
    browser: Schema.String,
    components: Schema.Array(ComponentInfo),
    violations: Schema.Array(AttributedViolation),
    passes: Schema.optional(Schema.Array(AttributedPass)),
    incomplete: Schema.optional(Schema.Array(AttributedIncomplete)),
    inapplicable: Schema.optional(Schema.Array(InapplicableRule)),
    accessibilityTree: Schema.optional(Schema.Unknown),
    keyboardTests: Schema.optional(KeyboardTestResults),
    wcag22: Schema.optional(WCAG22Results),
    supplementalResults: Schema.optional(Schema.Array(SupplementalTestResult)),
    summary: Schema.Struct({
        totalComponents: Schema.Number,
        totalViolations: Schema.Number,
        totalPasses: Schema.Number,
        totalIncomplete: Schema.Number,
        totalInapplicable: Schema.Number,
        violationsBySeverity: ViolationsBySeverity,
        violationsByWcagLevel: Schema.optional(ViolationsByWcagLevel),
        componentsWithViolations: Schema.Number,
        keyboardIssues: Schema.optional(Schema.Number),
        wcag22Issues: Schema.optional(Schema.Number),
    }),
});
export type ScanResults = Mutable<typeof ScanResults.Type>;

// Browser scan options
export const ScanOptions = Schema.Struct({
    url: Schema.String,
    browser: BrowserType,
    headless: Schema.Boolean,
    tags: Schema.optional(Schema.Array(Schema.String)),
    includeKeyboardTests: Schema.optional(Schema.Boolean),
});
export type ScanOptions = Mutable<typeof ScanOptions.Type>;

// Browser scanner API options
export const BrowserScanOptions = Schema.Struct({
    tags: Schema.optional(Schema.Array(Schema.String)),
    includeKeyboardTests: Schema.optional(Schema.Boolean),
});
export type BrowserScanOptions = Mutable<typeof BrowserScanOptions.Type>;
