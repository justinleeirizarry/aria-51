/**
 * Agent Loop
 *
 * The core agent harness powered by the Anthropic SDK's toolRunner.
 * Supports three modes:
 *   - Single pass: one generalist agent audits the site
 *   - Voting: multiple specialized voters audit independently, then merge via consensus
 *   - Lead agent (default for voting): orchestrator analyzes site first, delegates to targeted voters
 */
import Anthropic from '@anthropic-ai/sdk';
import { resilientToolRunner } from './resilient-client.js';
import type {
    AgentConfig,
    AgentEvent,
    AuditReport,
    AuditSession,
    ConfidenceLevel,
    ImpactLevel,
} from '../types.js';
import { DEFAULT_AGENT_CONFIG } from '../types.js';
import { createAuditSession } from '../state/audit-session.js';
import { createToolRegistry } from './tool-registry.js';
import {
    buildSystemPrompt,
    buildInitialMessage,
    buildVoterSystemPrompt,
    buildVoterInitialMessage,
} from './system-prompt.js';
import { VOTER_LENSES, type VoterLens } from './voter-lenses.js';
import { mergeVoterReports, type VotingResult } from './voting-merger.js';
import { runLeadAgentWithVoting } from './lead-agent.js';


// =============================================================================
// Public API
// =============================================================================

export interface RunAgentOptions extends Partial<AgentConfig> {
    /** Required: the URL to audit */
    targetUrl: string;
}

/**
 * Run the autonomous accessibility auditing agent.
 *
 * When `voting: true`, runs the lead agent orchestrator by default.
 */
export async function runAgent(options: RunAgentOptions): Promise<AuditReport> {
    const config: AgentConfig = {
        ...DEFAULT_AGENT_CONFIG,
        ...options,
    };

    if (config.voting) {
        const result = await runAgentWithVoting(config);
        return result.report;
    }

    return runSingleAgent(config);
}

/**
 * Run the voting variant and return the full VotingResult.
 *
 * Uses the lead agent orchestrator by default.
 * Set `useLeadAgent: false` to skip the lead agent and use flat voting.
 */
export async function runAgentWithVoting(
    options: RunAgentOptions & { useLeadAgent?: boolean }
): Promise<VotingResult> {
    const config: AgentConfig = {
        ...DEFAULT_AGENT_CONFIG,
        ...options,
        voting: true,
    };

    const useLeadAgent = options.useLeadAgent !== false;
    if (useLeadAgent) {
        return runLeadAgentWithVoting(config);
    }

    // Flat voting fallback (no lead agent)
    const emit = (event: AgentEvent) => config.onEvent?.(event);
    const startTime = Date.now();

    const voterCount = Math.min(config.voterCount || VOTER_LENSES.length, VOTER_LENSES.length);
    const lenses = VOTER_LENSES.slice(0, voterCount);

    emit({
        type: 'thinking',
        message: `Starting voting audit of ${config.targetUrl} with ${lenses.length} specialized voters: ${lenses.map((l) => l.name).join(', ')}`,
    });

    const voterPromises = lenses.map((lens) =>
        runVoter(config, lens, emit).catch((error) => {
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
            successfulIds.push(lenses[i].id);
        }
    }

    if (successfulReports.length === 0) {
        throw new Error('All voters failed. Cannot produce a consensus report.');
    }

    emit({ type: 'thinking', message: `Merging results from ${successfulReports.length} voters...` });
    const votingResult = mergeVoterReports(successfulReports, successfulIds);

    const unanimousCount = votingResult.voteDetails.filter(
        (v) => v.votes === successfulReports.length
    ).length;
    emit({
        type: 'consensus',
        unanimousFindings: unanimousCount,
        totalFindings: votingResult.report.totalFindings,
    });

    votingResult.report.scanDurationMs = Date.now() - startTime;
    emit({ type: 'complete', report: votingResult.report });

    return votingResult;
}

// =============================================================================
// Single Agent Pass
// =============================================================================

async function runSingleAgent(config: AgentConfig): Promise<AuditReport> {
    const startTime = Date.now();
    const session = createAuditSession(config);
    const tools = Object.values(createToolRegistry(session));
    const systemPrompt = buildSystemPrompt(config);
    const initialMessage = buildInitialMessage(config);

    const emit = (event: AgentEvent) => config.onEvent?.(event);
    emit({ type: 'thinking', message: `Starting audit of ${config.targetUrl}` });

    const finalMessage = await resilientToolRunner({
        model: config.model,
        max_tokens: 16000,
        system: systemPrompt,
        thinking: { type: 'adaptive' },
        tools,
        messages: [{ role: 'user', content: initialMessage }],
    }, { onEvent: emit });

    session.status = 'complete';
    const agentText = extractText(finalMessage);
    const report = buildReport(session, agentText, startTime);
    emit({ type: 'complete', report });
    return report;
}

// =============================================================================
// Flat Voter Runner
// =============================================================================

async function runVoter(
    config: AgentConfig,
    lens: VoterLens,
    emit: (event: AgentEvent) => void
): Promise<AuditReport> {
    const startTime = Date.now();

    emit({ type: 'thinking', message: `Voter "${lens.name}" starting...` });

    const voterConfig: AgentConfig = {
        ...config,
        maxSteps: Math.max(10, Math.floor(config.maxSteps / 2)),
    };

    const session = createAuditSession(voterConfig);
    const tools = Object.values(createToolRegistry(session));
    const systemPrompt = buildVoterSystemPrompt(voterConfig, lens);
    const initialMessage = buildVoterInitialMessage(voterConfig, lens);

    const finalMessage = await resilientToolRunner({
        model: config.model,
        max_tokens: 16000,
        system: systemPrompt,
        thinking: { type: 'adaptive' },
        tools,
        messages: [{ role: 'user', content: initialMessage }],
    }, { onEvent: emit });

    session.status = 'complete';
    const report = buildReport(session, extractText(finalMessage), startTime);

    emit({ type: 'voter_complete', voterId: lens.id, findings: report.totalFindings });
    return report;
}

// =============================================================================
// Helpers
// =============================================================================

function extractText(message: Anthropic.Beta.BetaMessage): string {
    return message.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
}

function buildReport(
    session: AuditSession,
    agentSummary: string,
    startTime: number
): AuditReport {
    const findingsByConfidence: Record<ConfidenceLevel, number> = {
        confirmed: 0,
        corroborated: 0,
        'ai-only': 0,
        contradicted: 0,
    };
    const findingsBySeverity: Record<ImpactLevel, number> = {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
    };

    for (const finding of session.findings) {
        findingsByConfidence[finding.confidence]++;
        findingsBySeverity[finding.impact]++;
    }

    return {
        sessionId: session.id,
        url: session.config.targetUrl,
        timestamp: new Date().toISOString(),
        wcagLevel: session.config.wcagLevel,
        pagesScanned: session.scannedUrls.length,
        totalFindings: session.findings.length,
        findingsByConfidence,
        findingsBySeverity,
        findings: session.findings,
        remediationPlan: session.remediationPlan,
        agentSummary,
        scanDurationMs: Date.now() - startTime,
    };
}
