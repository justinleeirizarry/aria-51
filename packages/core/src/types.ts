// ============================================================================
// Shared Type Definitions
//
// Types with Effect Schema equivalents are re-exported from ./schemas/.
// Types without schemas (PromptTemplate, Aria51ScannerAPI, etc.) remain here.
// ============================================================================

// --- Re-exports from schemas (single source of truth) ---

export type { ImpactLevel } from './schemas/primitives.js';
export type { ImpactLevelOrNull } from './schemas/primitives.js';
export type { SeverityLevel } from './schemas/primitives.js';
export type { WcagLevel } from './schemas/primitives.js';
export type { WcagPrinciple } from './schemas/primitives.js';
export type { BrowserType } from './schemas/primitives.js';
export type { TestabilityLevel } from './schemas/primitives.js';

export type { WcagCriterionInfo } from './schemas/wcag.js';

export type { AxeCheckResult } from './schemas/axe.js';
export type { AxeNodeResult } from './schemas/axe.js';
export type { AxeResult } from './schemas/axe.js';
export type { AxeViolation } from './schemas/axe.js';

export type { RelatedNode } from './schemas/violations.js';
export type { AttributedCheck } from './schemas/violations.js';
export type { FixSuggestion } from './schemas/violations.js';
export type { AttributedViolation } from './schemas/violations.js';
export type { AttributedPass } from './schemas/violations.js';
export type { AttributedIncomplete } from './schemas/violations.js';

export type { KeyboardTestResults } from './schemas/keyboard.js';

export type { SourceLocation } from './schemas/primitives.js';
export type { ComponentInfo } from './schemas/scan-results.js';
export type { ScanResults } from './schemas/scan-results.js';
export type { ScanOptions } from './schemas/scan-results.js';
export type { BrowserScanData } from './schemas/scan-results.js';
export type { BrowserScanOptions } from './schemas/scan-results.js';
export type { ScanError } from './schemas/scan-results.js';

export type { WCAG22Results } from './schemas/wcag22-violations.js';
export type { WCAG22ViolationSummary } from './schemas/wcag22-violations.js';

export type { SupplementalTestResult } from './schemas/supplemental-results.js';
export type { SupplementalIssue } from './schemas/supplemental-results.js';

// --- Types without schemas (remain defined here) ---

// Prompt template types
import type { AttributedViolation } from './schemas/violations.js';
import type { ScanResults } from './schemas/scan-results.js';
import type { BrowserScanOptions } from './schemas/scan-results.js';
import type { BrowserScanData } from './schemas/scan-results.js';

export interface PromptTemplate {
    name: string;
    description: string;
    render: (context: PromptContext) => string;
}

export interface PromptContext {
    violations: AttributedViolation[];
    summary: ScanResults['summary'];
    url: string;
    accessibilityTree?: any;
    wcag22?: ScanResults['wcag22'];
    supplementalResults?: ScanResults['supplementalResults'];
    keyboardTests?: ScanResults['keyboardTests'];
}

export interface PromptExportOptions {
    template: string;
    format: 'txt' | 'md' | 'json';
    outputPath?: string;
}

// Aria51Scanner API exposed on window in browser context
export interface Aria51ScannerAPI {
    scan: (options?: BrowserScanOptions) => Promise<BrowserScanData>;
}

// Global window augmentation for browser context
declare global {
    interface Window {
        Aria51Scanner?: Aria51ScannerAPI;
    }
}
