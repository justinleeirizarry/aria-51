/**
 * @aria51/agent
 *
 * Autonomous accessibility auditing agent harness powered by Claude.
 * Combines @aria51/core scanning with AI-driven planning, verification,
 * and remediation to produce comprehensive accessibility audit reports.
 *
 * @example
 * ```typescript
 * import { runAgent } from '@aria51/agent';
 *
 * const report = await runAgent({
 *   targetUrl: 'https://example.com',
 *   wcagLevel: 'AA',
 *   maxPages: 10,
 *   onEvent: (event) => console.log(event.type, event),
 * });
 *
 * console.log(`Found ${report.totalFindings} issues across ${report.pagesScanned} pages`);
 * console.log(report.agentSummary);
 * ```
 */

// =============================================================================
// Agent — Main API
// =============================================================================

export { runAgent, runAgentWithVoting, type RunAgentOptions } from './agent/agent-loop.js';
export {
    createProvider,
    createAnthropicProvider,
    createAiSdkProvider,
    type ProviderConfig,
    type AgentProvider,
    type AgentToolDef,
} from './agent/provider.js';

// =============================================================================
// Types
// =============================================================================

export type {
    AgentConfig,
    AgentEvent,
    AgentWcagCriterionInfo,
    AuditReport,
    AuditSession,
    AuditSnapshot,
    CrawlPlan,
    ConfidenceLevel,
    DiffReport,
    FindingSource,
    ImpactLevel,
    DiscoveredPage,
    RemediationItem,
    RemediationPhase,
    RemediationPlan,
    SessionStatus,
    SitemapEntry,
    VerifiedFinding,
} from './types.js';

export { DEFAULT_AGENT_CONFIG } from './types.js';

// =============================================================================
// State Management
// =============================================================================

export {
    SessionStore,
    createMemorySessionStore,
    createFileSessionStore,
    type ISessionStore,
} from './state/session-store.js';

export { createAuditSession, createSnapshot } from './state/audit-session.js';

// =============================================================================
// Planning (for advanced usage / custom harnesses)
// =============================================================================

export { parseSitemap } from './planning/sitemap-parser.js';
export { discoverLinks, type LinkDiscoveryOptions } from './planning/link-discoverer.js';
export { deduplicatePages } from './planning/page-prioritizer.js';

// =============================================================================
// Verification (for advanced usage / custom harnesses)
// =============================================================================

export { crossReferenceFindingsWithAxe } from './verification/cross-reference.js';
export { scoreFinding, sortByScore, filterHighConfidence } from './verification/confidence-scorer.js';

// =============================================================================
// Remediation (for advanced usage / custom harnesses)
// =============================================================================

export { generateRemediationPlan } from './remediation/prioritizer.js';

// =============================================================================
// Voting (consensus pattern)
// =============================================================================

export { VOTER_LENSES, type VoterLens } from './agent/voter-lenses.js';
export { mergeVoterReports, type VotingResult, type VoteDetail } from './agent/voting-merger.js';
export { runLeadAgentWithVoting, type LeadAgentPlan } from './agent/lead-agent.js';
export { resilientToolRunner, type ResilientClientOptions } from './agent/resilient-client.js';

// =============================================================================
// Errors
// =============================================================================

export {
    AgentMaxStepsError,
    AgentToolExecutionError,
    AgentApiError,
    CrawlPlanError,
    SessionNotFoundError,
    SessionSerializationError,
    VerificationError,
    type AgentErrors,
} from './errors.js';
