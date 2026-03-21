/**
 * Effect Schema definitions for accessibility types
 *
 * Single source of truth: each schema provides both a TypeScript type
 * and runtime validation via Effect Schema.
 *
 * Usage:
 *   import { Schemas } from '@aria51/core';
 *   const result = Schema.decodeUnknownSync(Schemas.BrowserScanData)(rawData);
 */

// Primitives
export {
    ImpactLevel,
    ImpactLevelOrNull,
    SeverityLevel,
    WcagLevel,
    WcagPrinciple,
    BrowserType,
    FixPriority,
    SourceLocation,
} from './primitives.js';

// WCAG
export {
    WcagCriterionId,
    WcagCriterionInfo,
} from './wcag.js';

// Axe-core
export {
    AxeCheckResult,
    AxeNodeResult,
    AxeResult,
    AxeViolation,
} from './axe.js';

// Violations
export {
    RelatedNode,
    AttributedCheck,
    FixSuggestion,
    AttributedViolation,
    AttributedPass,
    AttributedIncomplete,
    InapplicableRule,
} from './violations.js';

// WCAG 2.2 violations
export {
    WCAG22ViolationId,
    WCAG22ExceptionType,
    TargetSizeDetails,
    TargetSizeViolation,
    FocusObscuredDetails,
    FocusObscuredViolation,
    FocusAppearanceDetails,
    FocusAppearanceViolation,
    DraggingDetails,
    DraggingViolation,
    AccessibleAuthDetails,
    AccessibleAuthViolation,
    WCAG22ViolationSummary,
    WCAG22Results,
} from './wcag22-violations.js';

// Keyboard
export { KeyboardTestResults } from './keyboard.js';

// Scan results
export {
    ComponentInfo,
    ScanError,
    BrowserScanData,
    ScanResults,
    ScanOptions,
    BrowserScanOptions,
} from './scan-results.js';

// Decode utilities
export {
    decodeBrowserScanData,
    decodeBrowserScanDataLenient,
} from './decode.js';
