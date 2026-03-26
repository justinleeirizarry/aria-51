/**
 * Agent Harness Types
 *
 * All TypeScript types for the autonomous accessibility auditing agent.
 */
import type {
    ScanResults,
    EffectScanResult,
    BrowserType,
    ScanProgressStep,
} from '@aria51/core';

export type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Flexible WCAG criterion info for agent use.
 * Unlike @aria51/core's WcagCriterionInfo which has a strict id union,
 * this allows arbitrary criterion IDs from AI-generated findings.
 */
export interface AgentWcagCriterionInfo {
    id: string;
    title: string;
    level: 'A' | 'AA' | 'AAA';
    principle: 'Perceivable' | 'Operable' | 'Understandable' | 'Robust';
    w3cUrl: string;
    testability?: 'manual' | 'automated' | 'semi-automated' | 'multi-page';
    successCriterionText?: string;
}

// =============================================================================
// Agent Configuration
// =============================================================================

export interface AgentConfig {
    /** Target URL to audit */
    targetUrl: string;
    /** WCAG conformance level to check against */
    wcagLevel: 'A' | 'AA' | 'AAA';
    /** Maximum pages to scan (default: 20) */
    maxPages: number;
    /** Maximum agent loop iterations (default: 50) */
    maxSteps: number;
    /** Concurrent browser sessions for batch scanning (default: 3) */
    concurrency: number;
    /** Claude model to use */
    model: string;
    /** Browser engine */
    browser: BrowserType;
    /** Run browser headlessly */
    headless: boolean;
    /** Enable Stagehand AI-powered tests */
    enableStagehand: boolean;
    /** Directory for file-backed session persistence */
    sessionDir?: string;
    /** Enable voting mode — run multiple specialized voters and merge results */
    voting?: boolean;
    /** Number of voter lenses to use (default: 4, all lenses) */
    voterCount?: number;
    /** Event callback for streaming progress */
    onEvent?: (event: AgentEvent) => void;
}

export const DEFAULT_AGENT_CONFIG: Omit<AgentConfig, 'targetUrl'> = {
    wcagLevel: 'AA',
    maxPages: 20,
    maxSteps: 50,
    concurrency: 3,
    model: 'claude-opus-4-6',
    browser: 'chromium',
    headless: true,
    enableStagehand: false,
};

// =============================================================================
// Agent Events (streamed to callers)
// =============================================================================

export type AgentEvent =
    | { type: 'thinking'; message: string }
    | { type: 'tool_call'; tool: string; input: unknown }
    | { type: 'tool_result'; tool: string; output: unknown }
    | { type: 'scan_progress'; url: string; step: ScanProgressStep }
    | { type: 'finding'; finding: VerifiedFinding }
    | { type: 'step_complete'; stepIndex: number; toolCalls: number }
    | { type: 'voter_complete'; voterId: string; findings: number }
    | { type: 'consensus'; unanimousFindings: number; totalFindings: number }
    | { type: 'complete'; report: AuditReport };

// =============================================================================
// Crawl Planning
// =============================================================================

export interface SitemapEntry {
    url: string;
    lastmod?: string;
    priority?: number;
    changefreq?: string;
}

export interface CrawlPlan {
    baseUrl: string;
    strategy: 'sitemap' | 'crawl' | 'manual';
    pages: PrioritizedPage[];
    totalDiscovered: number;
}

export interface PrioritizedPage {
    url: string;
    priority: number;
    reason: string;
    template: string;
}

// =============================================================================
// Audit Session
// =============================================================================

export type SessionStatus = 'planning' | 'scanning' | 'verifying' | 'remediating' | 'complete';

export interface AuditSession {
    id: string;
    createdAt: string;
    updatedAt: string;
    config: AgentConfig;
    status: SessionStatus;

    /** Crawl state */
    crawlPlan: CrawlPlan | null;
    scannedUrls: string[];
    pendingUrls: string[];

    /** Scan results keyed by URL */
    scanResults: Record<string, ScanResults>;
    previousSnapshots: AuditSnapshot[];

    /** Verified findings */
    findings: VerifiedFinding[];

    /** Remediation */
    remediationPlan: RemediationPlan | null;

    /** Conversation metrics */
    stepCount: number;
    toolCallCount: number;
}

export interface AuditSnapshot {
    sessionId: string;
    timestamp: string;
    findings: VerifiedFinding[];
    pagesScanned: number;
}

// =============================================================================
// Verified Findings
// =============================================================================

export type ConfidenceLevel = 'confirmed' | 'corroborated' | 'ai-only' | 'contradicted';

export interface VerifiedFinding {
    id: string;
    url: string;
    criterion: AgentWcagCriterionInfo;
    description: string;
    impact: ImpactLevel;
    selector?: string;
    element?: string;
    confidence: ConfidenceLevel;
    sources: FindingSource[];
    evidence: string;
}

export interface FindingSource {
    type: 'axe-core' | 'wcag22-check' | 'stagehand' | 'agent-observation';
    ruleId?: string;
    detail: string;
}

// =============================================================================
// Remediation
// =============================================================================

export interface RemediationPlan {
    summary: string;
    totalIssues: number;
    estimatedEffort: 'low' | 'medium' | 'high';
    phases: RemediationPhase[];
}

export interface RemediationPhase {
    priority: number;
    title: string;
    description: string;
    items: RemediationItem[];
}

export interface RemediationItem {
    finding: VerifiedFinding;
    fix: string;
    affectedPages: string[];
    estimatedEffort: 'low' | 'medium' | 'high';
    wcagCriteria: AgentWcagCriterionInfo[];
}

// =============================================================================
// Audit Report (final output)
// =============================================================================

export interface AuditReport {
    sessionId: string;
    url: string;
    timestamp: string;
    wcagLevel: 'A' | 'AA' | 'AAA';
    pagesScanned: number;
    totalFindings: number;
    findingsByConfidence: Record<ConfidenceLevel, number>;
    findingsBySeverity: Record<ImpactLevel, number>;
    findings: VerifiedFinding[];
    remediationPlan: RemediationPlan | null;
    agentSummary: string;
    scanDurationMs: number;
}

// =============================================================================
// Diff Report
// =============================================================================

export interface DiffReport {
    baselineSessionId: string;
    currentSessionId: string;
    newViolations: VerifiedFinding[];
    resolvedViolations: VerifiedFinding[];
    persistentViolations: VerifiedFinding[];
    regressionCount: number;
    improvementCount: number;
}

// =============================================================================
// Tool I/O Types
// =============================================================================

export interface PlanCrawlInput {
    url: string;
    maxPages?: number;
    strategy?: 'sitemap' | 'crawl' | 'auto';
}

export interface ScanPageInput {
    url: string;
    includeKeyboardTests?: boolean;
    mobile?: boolean;
}

export interface ScanBatchInput {
    urls: string[];
    includeKeyboardTests?: boolean;
    mobile?: boolean;
}

export interface VerifyFindingsInput {
    findings: Array<{
        url: string;
        description: string;
        criterion?: string;
        selector?: string;
        impact?: ImpactLevel;
    }>;
}

export interface DiffReportInput {
    baselineSessionId?: string;
}

export interface GenerateRemediationInput {
    focusLevel?: 'A' | 'AA' | 'AAA';
    maxItems?: number;
}
