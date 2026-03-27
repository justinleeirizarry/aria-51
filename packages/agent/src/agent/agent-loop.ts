/**
 * Agent Loop
 *
 * The core agent harness. Supports two providers:
 * - 'anthropic': Native SDK (betaZodTool + toolRunner + adaptive thinking + resilient fallback)
 * - 'ai-sdk': Vercel AI SDK (any provider — OpenAI, Google, Ollama, etc.)
 *
 * And three execution modes:
 * - Single pass: one generalist agent
 * - Multi-specialist: multiple specialized auditors, deduplication merge
 * - Lead agent (default for specialists): orchestrator plans → specialists execute
 */
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
import { createProvider } from './provider.js';
import {
    buildSystemPrompt,
    buildInitialMessage,
    buildSpecialistSystemPrompt,
    buildSpecialistInitialMessage,
} from './system-prompt.js';
import { SPECIALIST_LENSES, type SpecialistLens } from './specialist-lenses.js';
import { mergeSpecialistReports, type MultiAgentResult } from './specialist-merger.js';
import { runLeadAgentWithSpecialists } from './lead-agent.js';

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
 * @example
 * // Anthropic (default)
 * await runAgent({ targetUrl: 'https://example.com' });
 *
 * // OpenAI via AI SDK
 * import { openai } from '@ai-sdk/openai';
 * await runAgent({ targetUrl: 'https://example.com', provider: { type: 'ai-sdk', model: openai('gpt-4o') } });
 *
 * // Multi-specialist mode
 * await runAgent({ targetUrl: 'https://example.com', specialists: true });
 */
export async function runAgent(options: RunAgentOptions): Promise<AuditReport> {
    const config: AgentConfig = {
        ...DEFAULT_AGENT_CONFIG,
        ...options,
    };

    if (config.specialists) {
        const result = await runAgentWithSpecialists(config);
        return result.report;
    }

    return runSingleAgent(config);
}

/**
 * Run the multi-specialist variant and return the full MultiAgentResult.
 */
export async function runAgentWithSpecialists(
    options: RunAgentOptions & { useLeadAgent?: boolean }
): Promise<MultiAgentResult> {
    const config: AgentConfig = {
        ...DEFAULT_AGENT_CONFIG,
        ...options,
        specialists: true,
    };

    // Lead agent only supported with Anthropic provider (needs adaptive thinking + delegate tool)
    const useLeadAgent = options.useLeadAgent !== false && config.provider === 'anthropic';
    if (useLeadAgent) {
        return runLeadAgentWithSpecialists(config);
    }

    // Flat specialist dispatch — works with any provider
    const emit = (event: AgentEvent) => config.onEvent?.(event);
    const startTime = Date.now();
    const provider = createProvider(config.provider);

    const specialistCount = Math.min(config.specialistCount || SPECIALIST_LENSES.length, SPECIALIST_LENSES.length);
    const lenses = SPECIALIST_LENSES.slice(0, specialistCount);

    emit({
        type: 'thinking',
        message: `Starting multi-specialist audit with ${lenses.length} specialists (provider: ${typeof config.provider === 'string' ? config.provider : config.provider.type})`,
    });

    const specialistPromises = lenses.map((lens) =>
        runSpecialist(config, provider, lens, emit).catch((error) => {
            emit({ type: 'thinking', message: `Specialist ${lens.id} failed: ${error instanceof Error ? error.message : String(error)}` });
            return null;
        })
    );

    const specialistResults = await Promise.all(specialistPromises);

    const successfulReports: AuditReport[] = [];
    const successfulIds: string[] = [];
    for (let i = 0; i < specialistResults.length; i++) {
        if (specialistResults[i]) {
            successfulReports.push(specialistResults[i]!);
            successfulIds.push(lenses[i].id);
        }
    }

    if (successfulReports.length === 0) throw new Error('All specialists failed.');

    const result = mergeSpecialistReports(successfulReports, successfulIds, lenses);
    result.report.scanDurationMs = Date.now() - startTime;
    emit({ type: 'complete', report: result.report });
    return result;
}

// =============================================================================
// Single Agent Pass
// =============================================================================

async function runSingleAgent(config: AgentConfig): Promise<AuditReport> {
    const startTime = Date.now();
    const provider = createProvider(config.provider);
    const session = createAuditSession(config);
    const tools = Object.values(createToolRegistry(session));

    const emit = (event: AgentEvent) => config.onEvent?.(event);
    emit({ type: 'thinking', message: `Starting audit of ${config.targetUrl}` });

    const result = await provider.runWithTools({
        model: config.model,
        system: buildSystemPrompt(config),
        prompt: buildInitialMessage(config),
        tools,
        maxSteps: config.maxSteps,
        onEvent: emit as any,
    });

    session.status = 'complete';
    const report = buildReport(session, result.text, startTime);
    emit({ type: 'complete', report });
    return report;
}

// =============================================================================
// Flat Specialist Runner
// =============================================================================

async function runSpecialist(
    config: AgentConfig,
    provider: ReturnType<typeof createProvider>,
    lens: SpecialistLens,
    emit: (event: AgentEvent) => void
): Promise<AuditReport> {
    const startTime = Date.now();
    emit({ type: 'thinking', message: `Specialist "${lens.name}" starting...` });

    const specialistConfig: AgentConfig = { ...config, maxSteps: Math.max(10, Math.floor(config.maxSteps / 2)) };
    const session = createAuditSession(specialistConfig);
    const tools = Object.values(createToolRegistry(session));

    const result = await provider.runWithTools({
        model: config.model,
        system: buildSpecialistSystemPrompt(specialistConfig, lens),
        prompt: buildSpecialistInitialMessage(specialistConfig, lens),
        tools,
        maxSteps: specialistConfig.maxSteps,
        onEvent: emit as any,
    });

    session.status = 'complete';
    const report = buildReport(session, result.text, startTime);
    emit({ type: 'specialist_complete', specialistId: lens.id, findings: report.totalFindings });
    return report;
}

// =============================================================================
// Helpers
// =============================================================================

function buildReport(
    session: AuditSession,
    agentSummary: string,
    startTime: number
): AuditReport {
    const findingsByConfidence: Record<ConfidenceLevel, number> = { confirmed: 0, corroborated: 0, 'ai-only': 0, contradicted: 0 };
    const findingsBySeverity: Record<ImpactLevel, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };

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
