/**
 * Shared Types for Stagehand Services
 */
import type { Effect } from 'effect';
import type { Page } from 'playwright';
import type {
    StagehandKeyboardConfig,
    StagehandKeyboardResults,
    TreeAnalysisConfig,
    TreeAnalysisResult,
    WcagAuditOptions,
    WcagAuditResult,
    ScreenReaderNavigatorConfig,
    ScreenReaderNavigationResults,
} from '../types.js';
import type {
    KeyboardTestInitError,
    KeyboardTestError,
    KeyboardTestNotInitializedError,
    TreeAnalysisInitError,
    TreeAnalysisError,
    TreeAnalysisNotInitializedError,
    WcagAuditInitError,
    WcagAuditError,
    WcagAuditNotInitializedError,
    ScreenReaderNavInitError,
    ScreenReaderNavError,
    ScreenReaderNavNotInitializedError,
} from '../errors.js';

/**
 * Effect-first Keyboard Test Service interface
 */
export interface IKeyboardTestService {
    /**
     * Initialize the keyboard test service
     */
    init(config?: StagehandKeyboardConfig): Effect.Effect<void, KeyboardTestInitError>;

    /**
     * Run keyboard navigation tests on a URL
     */
    test(url: string): Effect.Effect<
        StagehandKeyboardResults,
        KeyboardTestNotInitializedError | KeyboardTestError
    >;

    /**
     * Get the underlying page instance
     */
    getPage(): Effect.Effect<Page, KeyboardTestNotInitializedError>;

    /**
     * Close the service and clean up resources
     */
    close(): Effect.Effect<void>;

    /**
     * Check if service is initialized
     */
    isInitialized(): Effect.Effect<boolean>;
}

/**
 * Effect-first Tree Analysis Service interface
 */
export interface ITreeAnalysisService {
    /**
     * Initialize the tree analysis service
     */
    init(config?: TreeAnalysisConfig): Effect.Effect<void, TreeAnalysisInitError>;

    /**
     * Analyze accessibility tree of a URL
     */
    analyze(url: string): Effect.Effect<
        TreeAnalysisResult,
        TreeAnalysisNotInitializedError | TreeAnalysisError
    >;

    /**
     * Get the underlying page instance
     */
    getPage(): Effect.Effect<Page, TreeAnalysisNotInitializedError>;

    /**
     * Close the service and clean up resources
     */
    close(): Effect.Effect<void>;

    /**
     * Check if service is initialized
     */
    isInitialized(): Effect.Effect<boolean>;
}

/**
 * Effect-first WCAG Audit Service interface
 */
export interface IWcagAuditService {
    /**
     * Initialize the WCAG audit service
     */
    init(options?: WcagAuditOptions): Effect.Effect<void, WcagAuditInitError>;

    /**
     * Run a WCAG audit on a URL
     */
    audit(url: string): Effect.Effect<
        WcagAuditResult,
        WcagAuditNotInitializedError | WcagAuditError
    >;

    /**
     * Get the underlying page instance
     */
    getPage(): Effect.Effect<Page, WcagAuditNotInitializedError>;

    /**
     * Close the service and clean up resources
     */
    close(): Effect.Effect<void>;

    /**
     * Check if service is initialized
     */
    isInitialized(): Effect.Effect<boolean>;
}

/**
 * Effect-first Screen Reader Navigation Service interface
 */
export interface IScreenReaderNavService {
    /**
     * Initialize the screen reader navigation service
     */
    init(config?: ScreenReaderNavigatorConfig): Effect.Effect<void, ScreenReaderNavInitError>;

    /**
     * Run screen reader navigation test on a URL
     */
    navigate(url: string): Effect.Effect<
        ScreenReaderNavigationResults,
        ScreenReaderNavNotInitializedError | ScreenReaderNavError
    >;

    /**
     * Get the underlying page instance
     */
    getPage(): Effect.Effect<Page, ScreenReaderNavNotInitializedError>;

    /**
     * Close the service and clean up resources
     */
    close(): Effect.Effect<void>;

    /**
     * Check if service is initialized
     */
    isInitialized(): Effect.Effect<boolean>;
}
