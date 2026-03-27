/**
 * Lead Agent (Orchestrator)
 *
 * Implements the orchestrator-workers pattern using the Anthropic SDK's toolRunner.
 *
 * The lead agent:
 * 1. Analyzes the target site (crawl + initial scan) with adaptive thinking
 * 2. Plans which specialists to spawn and writes specific instructions for each
 * 3. Shares crawl data + scan results with specialists so they don't re-discover
 * 4. Runs specialists in parallel
 * 5. Merges results by deduplication
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { resilientToolRunner } from './resilient-client.js';
import { toNativeAnthropicTools } from './provider.js';
import type {
    AgentConfig,
    AgentEvent,
    AuditReport,
    AuditSession,
    CrawlPlan,
    ConfidenceLevel,
    ImpactLevel,
} from '../types.js';
import { DEFAULT_AGENT_CONFIG } from '../types.js';
import { createAuditSession } from '../state/audit-session.js';
import { createToolRegistry } from './tool-registry.js';
import { SPECIALIST_LENSES, type SpecialistLens } from './specialist-lenses.js';
import { mergeSpecialistReports, type MultiAgentResult } from './specialist-merger.js';
import {
    buildInformedSpecialistPrompt,
    buildInformedSpecialistMessage,
    buildLeadAgentPrompt,
} from './system-prompt.js';


// =============================================================================
// Types
// =============================================================================

export interface LeadAgentPlan {
    siteAnalysis: string;
    selectedLenses: SpecialistLens[];
    specialistInstructions: Record<string, string>;
    crawlPlan: CrawlPlan | null;
    initialScanSummary: string;
}

// =============================================================================
// Lead Agent Orchestration
// =============================================================================

export async function runLeadAgentWithSpecialists(
    options: Partial<AgentConfig> & { targetUrl: string }
): Promise<MultiAgentResult> {
    const config: AgentConfig = {
        ...DEFAULT_AGENT_CONFIG,
        ...options,
        specialists: true,
    };

    const emit = (event: AgentEvent) => config.onEvent?.(event);
    const startTime = Date.now();

    // Phase 1: Lead agent analyzes site and plans delegation
    emit({ type: 'thinking', message: 'Lead agent analyzing site and planning delegation...' });
    const plan = await planDelegation(config, emit);

    emit({
        type: 'thinking',
        message: `Lead agent selected ${plan.selectedLenses.length} specialists: ${plan.selectedLenses.map((l) => l.name).join(', ')}`,
    });

    // Phase 2: Run specialists in parallel with shared context
    emit({ type: 'thinking', message: `Spawning ${plan.selectedLenses.length} specialists in parallel...` });

    const specialistPromises = plan.selectedLenses.map((lens) =>
        runInformedSpecialist(config, lens, plan, emit).catch((error) => {
            emit({
                type: 'thinking',
                message: `Specialist ${lens.id} failed: ${error instanceof Error ? error.message : String(error)}`,
            });
            return null;
        })
    );

    const specialistResults = await Promise.all(specialistPromises);

    const successfulReports: AuditReport[] = [];
    const successfulIds: string[] = [];
    for (let i = 0; i < specialistResults.length; i++) {
        if (specialistResults[i]) {
            successfulReports.push(specialistResults[i]!);
            successfulIds.push(plan.selectedLenses[i].id);
        }
    }

    if (successfulReports.length === 0) {
        throw new Error('All specialists failed. Cannot produce a report.');
    }

    // Phase 3: Merge specialist reports
    emit({ type: 'thinking', message: `Merging results from ${successfulReports.length} specialists...` });
    const result = mergeSpecialistReports(successfulReports, successfulIds, plan.selectedLenses);

    result.report.agentSummary =
        `## Lead Agent Site Analysis\n${plan.siteAnalysis}\n\n${result.report.agentSummary}`;

    const totalRawFindings = successfulReports.reduce((sum, r) => sum + r.totalFindings, 0);
    const deduplicatedCount = totalRawFindings - result.report.totalFindings;
    emit({
        type: 'merge_complete',
        totalFindings: result.report.totalFindings,
        deduplicatedCount,
        coverageMap: result.coverageMap,
    });

    result.report.scanDurationMs = Date.now() - startTime;
    emit({ type: 'complete', report: result.report });

    return result;
}

// =============================================================================
// Phase 1: Plan Delegation
// =============================================================================

async function planDelegation(
    config: AgentConfig,
    emit: (event: AgentEvent) => void
): Promise<LeadAgentPlan> {
    const session = createAuditSession(config);
    const baseTools = createToolRegistry(session);

    let delegationPlan: LeadAgentPlan | null = null;

    // Define the delegate tool as an AgentToolDef
    const delegateToolDef: import('./provider.js').AgentToolDef = {
        name: 'delegate',
        description:
            'After analyzing the site, use this tool to delegate work to specialist auditors. Specify which specialists to use and give each one specific instructions based on what you found during reconnaissance.',
        inputSchema: z.object({
            siteAnalysis: z
                .string()
                .describe('Your analysis of the site'),
            selectedSpecialistIds: z
                .array(z.enum(['keyboard-navigation', 'visual-content', 'forms-interaction', 'structure-semantics']))
                .describe('Which specialists to spawn.'),
            specialistInstructions: z
                .record(z.string(), z.string())
                .describe('Specific instructions for each specialist.'),
        }),
        run: async (input: any) => {
            const { siteAnalysis, selectedSpecialistIds, specialistInstructions } = input;
            const selectedLenses = selectedSpecialistIds
                .map((id: string) => SPECIALIST_LENSES.find((l) => l.id === id))
                .filter((l: SpecialistLens | undefined): l is SpecialistLens => l !== undefined);

            delegationPlan = {
                siteAnalysis,
                selectedLenses,
                specialistInstructions,
                crawlPlan: session.crawlPlan,
                initialScanSummary: buildScanSummaryForSpecialists(session),
            };

            return `Delegation plan created. ${selectedLenses.length} specialists will be spawned: ${selectedLenses.map((l: SpecialistLens) => l.name).join(', ')}`;
        },
    };

    // Convert all tools to Anthropic-native format via zod/v4
    const allToolDefs = [baseTools.plan_crawl, baseTools.scan_page, baseTools.read_state, delegateToolDef];
    const leadTools = toNativeAnthropicTools(allToolDefs);

    const systemPrompt = buildLeadAgentPrompt(config);

    await resilientToolRunner({
        model: config.model,
        max_tokens: 16000,
        system: systemPrompt,
        thinking: { type: 'adaptive' },
        tools: leadTools,
        messages: [{
            role: 'user',
            content: `Analyze the website at ${config.targetUrl} and plan the accessibility audit delegation. First discover pages and run an initial scan of the homepage, then decide which specialist auditors to assign and what each should focus on.`,
        }],
    }, { onEvent: emit });

    // Fallback if the lead agent didn't call delegate
    if (!delegationPlan) {
        delegationPlan = {
            siteAnalysis: 'Lead agent did not produce an explicit delegation plan. Using all specialists.',
            selectedLenses: SPECIALIST_LENSES.slice(0, config.specialistCount || SPECIALIST_LENSES.length),
            specialistInstructions: {},
            crawlPlan: session.crawlPlan,
            initialScanSummary: buildScanSummaryForSpecialists(session),
        };
    }

    return delegationPlan;
}

// =============================================================================
// Phase 2: Informed Specialist
// =============================================================================

async function runInformedSpecialist(
    config: AgentConfig,
    lens: SpecialistLens,
    plan: LeadAgentPlan,
    emit: (event: AgentEvent) => void
): Promise<AuditReport> {
    const startTime = Date.now();

    emit({ type: 'thinking', message: `Specialist "${lens.name}" starting with shared context...` });

    const specialistConfig: AgentConfig = {
        ...config,
        maxSteps: Math.max(10, Math.floor(config.maxSteps / 2)),
    };

    const session = createAuditSession(specialistConfig);

    // Pre-populate session with lead agent's crawl plan
    if (plan.crawlPlan) {
        session.crawlPlan = plan.crawlPlan;
        session.pendingUrls = plan.crawlPlan.pages.map((p) => p.url);
        session.status = 'scanning';
    }

    const rawTools = Object.values(createToolRegistry(session));
    const tools = toNativeAnthropicTools(rawTools);

    const specificInstructions = plan.specialistInstructions[lens.id] || '';
    const specialistPrompt = buildInformedSpecialistPrompt(config, lens, plan, specificInstructions);
    const initialMessage = buildInformedSpecialistMessage(config, lens, plan, specificInstructions);

    const finalMessage = await resilientToolRunner({
        model: config.model,
        max_tokens: 16000,
        system: specialistPrompt,
        thinking: { type: 'adaptive' },
        tools,
        messages: [{ role: 'user', content: initialMessage }],
    }, { onEvent: emit });

    session.status = 'complete';

    const findingsByConfidence: Record<ConfidenceLevel, number> = { confirmed: 0, corroborated: 0, 'ai-only': 0, contradicted: 0 };
    const findingsBySeverity: Record<ImpactLevel, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const f of session.findings) {
        findingsByConfidence[f.confidence]++;
        findingsBySeverity[f.impact]++;
    }

    const agentText = finalMessage.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

    const report: AuditReport = {
        sessionId: session.id,
        url: config.targetUrl,
        timestamp: new Date().toISOString(),
        wcagLevel: config.wcagLevel,
        pagesScanned: session.scannedUrls.length,
        totalFindings: session.findings.length,
        findingsByConfidence,
        findingsBySeverity,
        findings: session.findings,
        remediationPlan: session.remediationPlan,
        agentSummary: agentText,
        scanDurationMs: Date.now() - startTime,
    };

    emit({ type: 'specialist_complete', specialistId: lens.id, findings: report.totalFindings });
    return report;
}

// =============================================================================
// Helpers
// =============================================================================

function buildScanSummaryForSpecialists(session: AuditSession): string {
    if (session.scannedUrls.length === 0) return '';

    const lines: string[] = ['Initial scan results from lead agent:'];
    for (const url of session.scannedUrls) {
        const r = session.scanResults[url];
        if (r) {
            lines.push(`- ${url}: ${r.summary.totalViolations} violations, ${r.summary.totalPasses} passes`);
            if (r.violations.length > 0) {
                const topViolations = r.violations.slice(0, 5).map(
                    (v) => `  - ${v.id} (${v.impact}): ${v.nodes.length} instance(s)`
                );
                lines.push(...topViolations);
            }
        }
    }
    return lines.join('\n');
}
