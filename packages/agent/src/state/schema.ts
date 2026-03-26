/**
 * Zod Schemas for Session Serialization
 *
 * Handles safe round-tripping of AuditSession through JSON.
 */
import { z } from 'zod';

export const FindingSourceSchema = z.object({
    type: z.enum(['axe-core', 'wcag22-check', 'stagehand', 'agent-observation']),
    ruleId: z.string().optional(),
    detail: z.string(),
});

export const WcagCriterionInfoSchema = z.object({
    id: z.string(),
    title: z.string(),
    level: z.enum(['A', 'AA', 'AAA']),
    principle: z.enum(['Perceivable', 'Operable', 'Understandable', 'Robust']),
    w3cUrl: z.string(),
    testability: z.enum(['manual', 'automated', 'semi-automated', 'multi-page']).optional(),
    successCriterionText: z.string().optional(),
});

export const VerifiedFindingSchema = z.object({
    id: z.string(),
    url: z.string(),
    criterion: WcagCriterionInfoSchema,
    description: z.string(),
    impact: z.enum(['critical', 'serious', 'moderate', 'minor']),
    selector: z.string().optional(),
    element: z.string().optional(),
    confidence: z.enum(['confirmed', 'corroborated', 'ai-only', 'contradicted']),
    sources: z.array(FindingSourceSchema),
    evidence: z.string(),
});

export const PrioritizedPageSchema = z.object({
    url: z.string(),
    priority: z.number(),
    reason: z.string(),
    template: z.string(),
});

export const CrawlPlanSchema = z.object({
    baseUrl: z.string(),
    strategy: z.enum(['sitemap', 'crawl', 'manual']),
    pages: z.array(PrioritizedPageSchema),
    totalDiscovered: z.number(),
});

export const RemediationItemSchema = z.object({
    finding: VerifiedFindingSchema,
    fix: z.string(),
    affectedPages: z.array(z.string()),
    estimatedEffort: z.enum(['low', 'medium', 'high']),
    wcagCriteria: z.array(WcagCriterionInfoSchema),
});

export const RemediationPhaseSchema = z.object({
    priority: z.number(),
    title: z.string(),
    description: z.string(),
    items: z.array(RemediationItemSchema),
});

export const RemediationPlanSchema = z.object({
    summary: z.string(),
    totalIssues: z.number(),
    estimatedEffort: z.enum(['low', 'medium', 'high']),
    phases: z.array(RemediationPhaseSchema),
});

export const AuditSnapshotSchema = z.object({
    sessionId: z.string(),
    timestamp: z.string(),
    findings: z.array(VerifiedFindingSchema),
    pagesScanned: z.number(),
});

export const AgentConfigSchema = z.object({
    targetUrl: z.string(),
    wcagLevel: z.enum(['A', 'AA', 'AAA']),
    maxPages: z.number(),
    maxSteps: z.number(),
    concurrency: z.number(),
    model: z.string(),
    browser: z.enum(['chromium', 'firefox', 'webkit']),
    headless: z.boolean(),
    enableStagehand: z.boolean(),
    sessionDir: z.string().optional(),
});

export const AuditSessionSchema = z.object({
    id: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    config: AgentConfigSchema,
    status: z.enum(['planning', 'scanning', 'verifying', 'remediating', 'complete']),
    crawlPlan: CrawlPlanSchema.nullable(),
    scannedUrls: z.array(z.string()),
    pendingUrls: z.array(z.string()),
    // ScanResults are stored separately as raw JSON (too complex for Zod)
    scanResultKeys: z.array(z.string()),
    previousSnapshots: z.array(AuditSnapshotSchema),
    findings: z.array(VerifiedFindingSchema),
    remediationPlan: RemediationPlanSchema.nullable(),
    stepCount: z.number(),
    toolCallCount: z.number(),
});
