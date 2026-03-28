/**
 * Effect-compatible error types for AI Auditor services
 *
 * These error types are used with Effect's typed error channel
 * for exhaustive error handling in Effect workflows.
 */
import { Data } from 'effect';

// ============================================================================
// Test Generation Errors
// ============================================================================

/**
 * Test generation service is not initialized
 */
export class TestGenNotInitializedError extends Data.TaggedError('TestGenNotInitializedError')<{
    readonly operation?: string;
}> {}

/**
 * Test generation service initialization failed
 */
export class TestGenInitError extends Data.TaggedError('TestGenInitError')<{
    readonly reason: string;
}> {}

/**
 * Test generation navigation failed
 */
export class TestGenNavigationError extends Data.TaggedError('TestGenNavigationError')<{
    readonly url: string;
    readonly reason: string;
}> {}

/**
 * Test generation element discovery failed
 */
export class TestGenDiscoveryError extends Data.TaggedError('TestGenDiscoveryError')<{
    readonly reason: string;
}> {}

// ============================================================================
// Stagehand Keyboard Test Errors
// ============================================================================

/**
 * Keyboard test service initialization failed
 */
export class KeyboardTestInitError extends Data.TaggedError('KeyboardTestInitError')<{
    readonly reason: string;
}> {}

/**
 * Keyboard test operation failed
 */
export class KeyboardTestError extends Data.TaggedError('KeyboardTestError')<{
    readonly operation: string;
    readonly reason: string;
}> {}

/**
 * Keyboard test service is not initialized
 */
export class KeyboardTestNotInitializedError extends Data.TaggedError('KeyboardTestNotInitializedError')<{
    readonly operation?: string;
}> {}

// ============================================================================
// Stagehand Tree Analysis Errors
// ============================================================================

/**
 * Tree analysis service initialization failed
 */
export class TreeAnalysisInitError extends Data.TaggedError('TreeAnalysisInitError')<{
    readonly reason: string;
}> {}

/**
 * Tree analysis operation failed
 */
export class TreeAnalysisError extends Data.TaggedError('TreeAnalysisError')<{
    readonly reason: string;
}> {}

/**
 * Tree analysis service is not initialized
 */
export class TreeAnalysisNotInitializedError extends Data.TaggedError('TreeAnalysisNotInitializedError')<{
    readonly operation?: string;
}> {}

// ============================================================================
// Stagehand WCAG Audit Errors
// ============================================================================

/**
 * WCAG audit service initialization failed
 */
export class WcagAuditInitError extends Data.TaggedError('WcagAuditInitError')<{
    readonly reason: string;
}> {}

/**
 * WCAG audit operation failed
 */
export class WcagAuditError extends Data.TaggedError('WcagAuditError')<{
    readonly operation: string;
    readonly reason: string;
}> {}

/**
 * WCAG audit service is not initialized
 */
export class WcagAuditNotInitializedError extends Data.TaggedError('WcagAuditNotInitializedError')<{
    readonly operation?: string;
}> {}

// ============================================================================
// Screen Reader Navigator Errors
// ============================================================================

/**
 * Screen reader navigator initialization failed
 */
export class ScreenReaderNavInitError extends Data.TaggedError('ScreenReaderNavInitError')<{
    readonly reason: string;
}> {}

/**
 * Screen reader navigation operation failed
 */
export class ScreenReaderNavError extends Data.TaggedError('ScreenReaderNavError')<{
    readonly reason: string;
}> {}

/**
 * Screen reader navigator is not initialized
 */
export class ScreenReaderNavNotInitializedError extends Data.TaggedError('ScreenReaderNavNotInitializedError')<{
    readonly operation?: string;
}> {}

/**
 * Union of all test generation errors
 */
export type TestGenErrors =
    | TestGenNotInitializedError
    | TestGenInitError
    | TestGenNavigationError
    | TestGenDiscoveryError;

/**
 * Union of all keyboard test errors
 */
export type KeyboardTestErrors =
    | KeyboardTestInitError
    | KeyboardTestError
    | KeyboardTestNotInitializedError;

/**
 * Union of all tree analysis errors
 */
export type TreeAnalysisErrors =
    | TreeAnalysisInitError
    | TreeAnalysisError
    | TreeAnalysisNotInitializedError;

/**
 * Union of all WCAG audit errors
 */
export type WcagAuditErrors =
    | WcagAuditInitError
    | WcagAuditError
    | WcagAuditNotInitializedError;

/**
 * Union of all screen reader navigator errors
 */
export type ScreenReaderNavErrors =
    | ScreenReaderNavInitError
    | ScreenReaderNavError
    | ScreenReaderNavNotInitializedError;

/**
 * Union of all Stagehand-related errors
 */
export type StagehandErrors =
    | TestGenErrors
    | KeyboardTestErrors
    | TreeAnalysisErrors
    | WcagAuditErrors
    | ScreenReaderNavErrors;
