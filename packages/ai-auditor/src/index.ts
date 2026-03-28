/**
 * @aria51/ai-auditor
 *
 * AI-powered accessibility auditing using Stagehand and Browserbase.
 * Provides intelligent WCAG auditing, keyboard navigation testing,
 * and accessibility tree analysis.
 *
 * @example
 * ```typescript
 * import {
 *   BrowserbaseClient,
 *   createLiveAuditSession,
 * } from '@aria51/ai-auditor';
 *
 * // Create a live audit session with Browserbase
 * const client = new BrowserbaseClient({
 *   apiKey: process.env.BROWSERBASE_API_KEY!,
 *   projectId: process.env.BROWSERBASE_PROJECT_ID!,
 * });
 *
 * const session = await createLiveAuditSession(client);
 * console.log(`Watch live: ${session.liveViewUrl}`);
 *
 * const results = await session.audit('https://example.com', {
 *   onProgress: (step) => console.log(step),
 *   onFinding: (finding) => console.log(finding),
 * });
 *
 * await session.close();
 * ```
 */

// =============================================================================
// Browserbase Integration
// =============================================================================

export {
    BrowserbaseClient,
    createBrowserbaseClient,
    type BrowserbaseConfig,
    type BrowserbaseSession,
} from './browserbase/client.js';

export {
    createLiveAuditSession,
    type AuditStreamCallbacks,
    type LiveAuditSession,
} from './browserbase/session.js';

// =============================================================================
// Stagehand Scanners
// =============================================================================

export {
    StagehandScanner,
    StagehandKeyboardTester,
    StagehandTreeAnalyzer,
    StagehandWcagAuditAgent,
    ScreenReaderNavigator,
    TestGenerator,
    // Prompt builders
    buildWcagAuditPrompt,
    buildCriteriaList,
    buildFocusedAuditPrompt,
    getKeyboardCriteria,
    getVisualCriteria,
    getFormsCriteria,
    getNavigationCriteria,
    getInitialAnalysisInstruction,
    getFinalSummaryInstruction,
    // Tree rules
    VALID_LANDMARK_ROLES,
    INTERACTIVE_ROLES,
    ROLES_REQUIRING_NAME,
    HEADING_ROLES,
    FORM_CONTROL_ROLES,
    VALID_ARIA_ROLES,
    TREE_ISSUE_WCAG_MAP,
    isValidRole,
    isLandmarkRole,
    isInteractiveRole,
    roleRequiresName,
    isFormControlRole,
    getHeadingLevelFromRole,
    // WCAG element mapping
    getRelatedCriteria,
    sortByWcagPriority,
    formatCriteriaComment,
} from './stagehand/index.js';

// =============================================================================
// Services
// =============================================================================

export {
    // Keyboard Test Service
    KeyboardTestService,
    createKeyboardTestService,
    // Tree Analysis Service
    TreeAnalysisService,
    createTreeAnalysisService,
    // WCAG Audit Service
    WcagAuditService,
    createWcagAuditService,
    // Test Generation Service
    TestGenerationService,
    createTestGenerationService,
    // Screen Reader Navigation Service
    ScreenReaderNavService,
    createScreenReaderNavService,
    // Service interfaces
    type IKeyboardTestService,
    type ITreeAnalysisService,
    type IWcagAuditService,
    type IScreenReaderNavService,
    type TestGenerationConfig,
    type ITestGenerationService,
} from './services/index.js';

// =============================================================================
// Errors
// =============================================================================

export {
    // Test Generation Errors
    TestGenNotInitializedError,
    TestGenInitError,
    TestGenNavigationError,
    TestGenDiscoveryError,
    // Keyboard Test Errors
    KeyboardTestInitError,
    KeyboardTestError,
    KeyboardTestNotInitializedError,
    // Tree Analysis Errors
    TreeAnalysisInitError,
    TreeAnalysisError,
    TreeAnalysisNotInitializedError,
    // WCAG Audit Errors
    WcagAuditInitError,
    WcagAuditError,
    WcagAuditNotInitializedError,
    // Screen Reader Navigation Errors
    ScreenReaderNavInitError,
    ScreenReaderNavError,
    ScreenReaderNavNotInitializedError,
    // Error type unions
    type TestGenErrors,
    type KeyboardTestErrors,
    type TreeAnalysisErrors,
    type WcagAuditErrors,
    type ScreenReaderNavErrors,
    type StagehandErrors,
} from './errors.js';

// =============================================================================
// Deep Audits (tier 1 core + tier 2 Stagehand composition)
// =============================================================================

export {
    deepAuditKeyboard,
    deepAuditStructure,
    deepAuditScreenReader,
} from './deep/index.js';

export type {
    DeepKeyboardAuditResult,
    DeepStructureAuditResult,
    DeepScreenReaderAuditResult,
    DeepAuditOptions,
} from './deep/index.js';

// =============================================================================
// Adapters (convert service results → supplemental test results)
// =============================================================================

export {
    keyboardResultsToSupplemental,
    treeResultsToSupplemental,
    screenReaderResultsToSupplemental,
} from './adapters/to-supplemental.js';

// =============================================================================
// Types
// =============================================================================

export type {
    // Stagehand config types
    StagehandConfig,
    StagehandResults,

    // Keyboard testing types
    StagehandKeyboardConfig,
    StagehandKeyboardIssue,
    StagehandKeyboardIssueType,
    StagehandKeyboardResults,
    TabOrderEntry,

    // Tree analysis types
    TreeAnalysisConfig,
    TreeAnalysisResult,
    TreeIssue,
    TreeIssueType,
    A11yTreeNode,

    // WCAG audit types
    WcagAuditOptions,
    WcagAuditResult,
    AuditFinding,
    AuditStatus,

    // Screen reader navigation types
    ScreenReaderNavigatorConfig,
    ScreenReaderNavigationResults,
    ScreenReaderIssue,
    ScreenReaderIssueType,
    LandmarkEntry,
    HeadingEntry,
    NavigationStep,

    // Test generation types
    ElementType,
    ElementDiscovery,
    TestGenerationOptions,
    TestGenerationResults,
} from './types.js';
