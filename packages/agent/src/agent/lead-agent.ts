/**
 * Lead Agent (Orchestrator)
 *
 * Implements the orchestrator-workers pattern using the Anthropic SDK's toolRunner.
 *
 * The lead agent:
 * 1. Analyzes the target site (crawl + initial scan) with adaptive thinking
 * 2. Plans which voters to spawn and writes specific instructions for each
 * 3. Shares crawl data + scan results with voters so they don't re-discover
 * 4. Runs voters in parallel
 * 5. Merges results via consensus
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { resilientToolRunner } from './resilient-client.js';
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
import { VOTER_LENSES, type VoterLens } from './voter-lenses.js';
import { mergeVoterReports, type VotingResult } from './voting-merger.js';
import {
    buildInformedVoterPrompt,
    buildInformedVoterMessage,
    buildLeadAgentPrompt,
} from './system-prompt.js';


// =============================================================================
// Types
// =============================================================================

export interface LeadAgentPlan {
    siteAnalysis: string;
    selectedLenses: VoterLens[];
    voterInstructions: Record<string, string>;
    crawlPlan: CrawlPlan | null;
    initialScanSummary: string;
}

// =============================================================================
// Lead Agent Orchestration
// =============================================================================

export async function runLeadAgentWithVoting(
    options: Partial<AgentConfig> & { targetUrl: string }
): Promise<VotingResult> {
    const config: AgentConfig = {
        ...DEFAULT_AGENT_CONFIG,
        ...options,
        voting: true,
    };

    const emit = (event: AgentEvent) => config.onEvent?.(event);
    const startTime = Date.now();

    // Phase 1: Lead agent analyzes site and plans delegation
    emit({ type: 'thinking', message: 'Lead agent analyzing site and planning delegation...' });
    const plan = await planDelegation(config, emit);

    emit({
        type: 'thinking',
        message: `Lead agent selected ${plan.selectedLenses.length} voters: ${plan.selectedLenses.map((l) => l.name).join(', ')}`,
    });

    // Phase 2: Run voters in parallel with shared context
    emit({ type: 'thinking', message: `Spawning ${plan.selectedLenses.length} voters in parallel...` });

    const voterPromises = plan.selectedLenses.map((lens) =>
        runInformedVoter(config, lens, plan, emit).catch((error) => {
            emit({
                type: 'thinking',
                message: `Voter ${lens.id} failed: ${error instanceof Error ? error.message : String(error)}`,
            });
            return null;
        })
    );

    const voterResults = await Promise.all(voterPromises);

    const successfulReports: AuditReport[] = [];
    const successfulIds: string[] = [];
    for (let i = 0; i < voterResults.length; i++) {
        if (voterResults[i]) {
            successfulReports.push(voterResults[i]!);
            successfulIds.push(plan.selectedLenses[i].id);
        }
    }

    if (successfulReports.length === 0) {
        throw new Error('All voters failed. Cannot produce a consensus report.');
    }

    // Phase 3: Merge via consensus
    emit({ type: 'thinking', message: `Merging results from ${successfulReports.length} voters...` });
    const votingResult = mergeVoterReports(successfulReports, successfulIds);

    votingResult.report.agentSummary =
        `## Lead Agent Site Analysis\n${plan.siteAnalysis}\n\n${votingResult.report.agentSummary}`;

    const unanimousCount = votingResult.voteDetails.filter(
        (v) => v.votes === successfulReports.length
    ).length;
    emit({ type: 'consensus', unanimousFindings: unanimousCount, totalFindings: votingResult.report.totalFindings });

    votingResult.report.scanDurationMs = Date.now() - startTime;
    emit({ type: 'complete', report: votingResult.report });

    return votingResult;
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

    const delegateTool = betaZodTool({
        name: 'delegate',
        description:
            'After analyzing the site, use this tool to delegate work to specialized voter agents. Specify which voters to use and give each voter specific instructions based on what you found during reconnaissance.',
        inputSchema: z.object({
            siteAnalysis: z
                .string()
                .describe('Your analysis of the site: what type of site is it, what technologies does it use, what are the main page types, and what accessibility concerns are most likely?'),
            selectedVoterIds: z
                .array(z.enum(['keyboard-navigation', 'visual-content', 'forms-interaction', 'structure-semantics']))
                .describe('Which specialized voters to spawn.'),
            voterInstructions: z
                .record(
                    z.string().describe('Voter lens ID'),
                    z.string().describe('Specific instructions for this voter')
                )
                .describe('Specific instructions for each voter based on your site analysis.'),
        }),
        run: async ({ siteAnalysis, selectedVoterIds, voterInstructions }) => {
            const selectedLenses = selectedVoterIds
                .map((id) => VOTER_LENSES.find((l) => l.id === id))
                .filter((l): l is VoterLens => l !== undefined);

            delegationPlan = {
                siteAnalysis,
                selectedLenses,
                voterInstructions,
                crawlPlan: session.crawlPlan,
                initialScanSummary: buildScanSummaryForVoters(session),
            };

            return `Delegation plan created. ${selectedLenses.length} voters will be spawned: ${selectedLenses.map((l) => l.name).join(', ')}`;
        },
    });

    const leadTools = [
        baseTools.plan_crawl,
        baseTools.scan_page,
        baseTools.read_state,
        delegateTool,
    ];

    const systemPrompt = buildLeadAgentPrompt(config);

    await resilientToolRunner({
        model: config.model,
        max_tokens: 16000,
        system: systemPrompt,
        thinking: { type: 'adaptive' },
        tools: leadTools,
        messages: [{
            role: 'user',
            content: `Analyze the website at ${config.targetUrl} and plan the accessibility audit delegation. First discover pages and run an initial scan of the homepage, then decide which specialist voters to assign and what each should focus on.`,
        }],
    }, { onEvent: emit });

    // Fallback if the lead agent didn't call delegate
    if (!delegationPlan) {
        delegationPlan = {
            siteAnalysis: 'Lead agent did not produce an explicit delegation plan. Using all voters.',
            selectedLenses: VOTER_LENSES.slice(0, config.voterCount || VOTER_LENSES.length),
            voterInstructions: {},
            crawlPlan: session.crawlPlan,
            initialScanSummary: buildScanSummaryForVoters(session),
        };
    }

    return delegationPlan;
}

// =============================================================================
// Phase 2: Informed Voter
// =============================================================================

async function runInformedVoter(
    config: AgentConfig,
    lens: VoterLens,
    plan: LeadAgentPlan,
    emit: (event: AgentEvent) => void
): Promise<AuditReport> {
    const startTime = Date.now();

    emit({ type: 'thinking', message: `Voter "${lens.name}" starting with shared context...` });

    const voterConfig: AgentConfig = {
        ...config,
        maxSteps: Math.max(10, Math.floor(config.maxSteps / 2)),
    };

    const session = createAuditSession(voterConfig);

    // Pre-populate session with lead agent's crawl plan
    if (plan.crawlPlan) {
        session.crawlPlan = plan.crawlPlan;
        session.pendingUrls = plan.crawlPlan.pages.map((p) => p.url);
        session.status = 'scanning';
    }

    const tools = Object.values(createToolRegistry(session));

    const specificInstructions = plan.voterInstructions[lens.id] || '';
    const voterPrompt = buildInformedVoterPrompt(config, lens, plan, specificInstructions);
    const initialMessage = buildInformedVoterMessage(config, lens, plan, specificInstructions);

    const finalMessage = await resilientToolRunner({
        model: config.model,
        max_tokens: 16000,
        system: voterPrompt,
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

    emit({ type: 'voter_complete', voterId: lens.id, findings: report.totalFindings });
    return report;
}

// =============================================================================
// Helpers
// =============================================================================

function buildScanSummaryForVoters(session: AuditSession): string {
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
