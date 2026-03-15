/**
 * @accessibility-toolkit/core
 *
 * Core library for accessibility testing. Framework-agnostic accessibility
 * scanning with axe-core, keyboard testing, and WCAG 2.2 checks.
 *
 * For React component attribution, use @accessibility-toolkit/react
 * For AI-powered auditing, use @accessibility-toolkit/ai-auditor
 */

// =============================================================================
// Services - Main API
// =============================================================================

export {
    // Browser Service
    BrowserService,
    createBrowserService,
    type BrowserServiceConfig,
    type NavigateOptions,
    type StabilityCheckResult,
    type IBrowserService,

    // Scanner Service
    ScannerService,
    createScannerService,
    type ScanExecutionOptions,
    type IScannerService,

    // Results Processor Service
    ResultsProcessorService,
    createResultsProcessorService,
    type ScanMetadata,
    type MCPToolContent,
    type MCPFormatOptions,
    type CIResult,
    type IResultsProcessorService,

    // Orchestration Types (service migrated to Effect-based implementation)
    type BaseScanOptions,
    type ScanOperationResult,
    type ScanProgressStep,
} from './services/index.js';

// =============================================================================
// Effect-based Services
// =============================================================================

export {
    // Effect orchestration
    runScanAsPromise,
    runMultiScanAsPromise,
    performScan,
    performScanWithCleanup,
    type EffectScanOptions,
    type EffectScanResult,
    type PerformScanError,

    // Effect service tags (for dependency injection)
    BrowserService as BrowserServiceTag,
    ScannerService as ScannerServiceTag,
    ResultsProcessorService as ResultsProcessorServiceTag,
    type EffectBrowserService,
    type EffectScannerService,
    type EffectResultsProcessorService,
    type ScanWorkflowServices,

    // Effect layers
    AppLayer,
    AppLayerManual,
    CoreServicesLayer,
    BrowserServiceLive,
    ScannerServiceLive,
    ResultsProcessorServiceLive,
} from './services/effect/index.js';

// =============================================================================
// Types
// =============================================================================

export type {
    // Core types
    ImpactLevel,
    ImpactLevelOrNull,
    SeverityLevel,
    WcagLevel,
    WcagPrinciple,
    WcagCriterionInfo,
    BrowserType,

    // Axe-core types
    AxeCheckResult,
    AxeNodeResult,
    AxeResult,
    AxeViolation,

    // Component types
    ComponentInfo,

    // Violation types
    FixSuggestion,
    RelatedNode,
    AttributedCheck,
    AttributedViolation,
    AttributedPass,
    AttributedIncomplete,

    // Keyboard testing types
    KeyboardTestResults,

    // Scan types
    ScanResults,
    ScanOptions,
    ScanError as ScanErrorInfo,
    BrowserScanData,
    BrowserScanOptions,

    // Prompt types
    PromptTemplate,
    PromptContext,
    PromptExportOptions,

    // WCAG 2.2 types
    WCAG22Results,
    WCAG22ViolationSummary,

    // API types
    ReactA11yScannerAPI,
} from './types.js';

// =============================================================================
// Errors
// =============================================================================


// ScanError - thrown by runScanAsPromise for well-formatted error messages
export { ScanError, formatTaggedError } from './errors/scan-error.js';

// Effect-compatible errors (Data.TaggedError) - preferred for Effect workflows
export {
    // Effect error types (prefixed)
    EffectReactNotDetectedError,
    EffectBrowserLaunchError,
    EffectBrowserNotLaunchedError,
    EffectBrowserAlreadyLaunchedError,
    EffectNavigationTimeoutError,
    EffectNavigationError,
    EffectContextDestroyedError,
    EffectScannerInjectionError,
    EffectMaxRetriesExceededError,
    EffectConfigurationError,
    EffectInvalidUrlError,
    EffectFileSystemError,
    EffectServiceStateError,
    EffectScanDataError,

    // Error type unions
    type BrowserErrors,
    type ScanErrors,
    type ValidationErrors,
    type ScanWorkflowErrors,
} from './errors/effect-errors.js';

// =============================================================================
// Configuration
// =============================================================================

export {
    getConfig,
    updateConfig,
    loadConfig,
    validateConfiguration,
    resetConfig,
    DEFAULT_CONFIG,
    type ScannerConfig,
    loadEnvConfig,
    hasEnvConfig,
    getSupportedEnvVars,
    getEnvVarDocs,
    loadConfigFile,
} from './config/index.js';

// =============================================================================
// Utilities
// =============================================================================

export { logger, LogLevel } from './utils/logger.js';
export { EXIT_CODES, setExitCode, exitWithCode, type ExitCode } from './utils/exit-codes.js';
export { validateUrl, validateBrowser, validateTags, validateThreshold } from './utils/validation.js';

// =============================================================================
// Prompts
// =============================================================================

export {
    generatePrompt,
    generateAndExport,
    exportPrompt,
} from './prompts/prompt-generator.js';


// =============================================================================
// Suggestions - Contextual fix generation
// =============================================================================

export {
    generateContextualFix,
    hasContextualSupport,
} from './scanner/suggestions/index.js';

// =============================================================================
// Plugin System
// =============================================================================

export type {
    FrameworkPlugin,
    FrameworkScanData,
    AttributedNode,
    GenericScanResults,
    GenericScanOptions,
} from './plugin.js';

export type {
    AttributedViolation as PluginAttributedViolation,
    AttributedPass as PluginAttributedPass,
    AttributedIncomplete as PluginAttributedIncomplete,
} from './plugin.js';

// =============================================================================
// WCAG Data
// =============================================================================

export {
    WCAG_CRITERIA,
    getAllCriteria,
    getCriteriaCount,
    AXE_WCAG_MAP,
    getMappedRuleIds,
    hasWcagMapping,
    getAxeMapping,
    getWcagCriteriaForViolation,
    getCriterionById,
    getAllCriteriaByLevel,
    getPrimaryCriterion,
    getHighestLevelForViolation,
    formatCriterionDisplay,
    extractCriteriaFromTags,
    getUniquePrinciples,
    type WcagCriterion,
    type AxeWcagMapping,
} from './data/index.js';

