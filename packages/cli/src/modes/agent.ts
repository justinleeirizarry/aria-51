/**
 * Agent Mode Handler
 *
 * Runs the autonomous accessibility audit agent.
 * TTY: streams colored events to terminal, prints formatted report.
 * Non-TTY: logs events to stderr, outputs JSON report to stdout.
 */
import { EXIT_CODES, setExitCode, exitWithCode, logger } from '@aria51/core';
import type { WcagLevel } from '@aria51/core';

export interface AgentModeOptions {
    url: string;
    maxPages: number;
    maxSteps: number;
    specialists: boolean;
    model?: string;
    wcagLevel: WcagLevel;
    output?: string;
    isTTY: boolean;
}

export async function runAgentMode(opts: AgentModeOptions): Promise<void> {
    const { runAgent } = await import('@aria51/agent');
    const model = opts.model || 'claude-sonnet-4-6';

    if (opts.isTTY) {
        await runAgentTTY(opts, runAgent, model);
    } else {
        await runAgentJSON(opts, runAgent, model);
    }
}

async function runAgentTTY(
    opts: AgentModeOptions,
    runAgent: any,
    model: string,
): Promise<void> {
    try {
        const chalk = (await import('chalk')).default;

        console.log(chalk.bold(`\naria51 agent / ${opts.url}\n`));
        console.log(chalk.dim(`Model: ${model} | WCAG ${opts.wcagLevel} | Max pages: ${opts.maxPages}${opts.specialists ? ' | Multi-specialist' : ''}\n`));

        const startTime = Date.now();
        const report = await runAgent({
            targetUrl: opts.url,
            maxPages: opts.maxPages,
            maxSteps: opts.maxSteps,
            specialists: opts.specialists,
            model,
            wcagLevel: opts.wcagLevel,
            onEvent: (event: any) => {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                switch (event.type) {
                    case 'thinking':
                        console.log(chalk.dim(`[${elapsed}s]`), event.message);
                        break;
                    case 'tool_call':
                        console.log(chalk.dim(`[${elapsed}s]`), chalk.cyan(event.message));
                        break;
                    case 'specialist_complete':
                        console.log(chalk.dim(`[${elapsed}s]`), chalk.green(`Specialist ${event.specialistId}: ${event.findings} findings`));
                        break;
                    case 'merge_complete':
                        console.log(chalk.dim(`[${elapsed}s]`), chalk.green(`Merged: ${event.totalFindings} findings (${event.deduplicatedCount} deduplicated)`));
                        break;
                    case 'complete':
                        console.log(chalk.dim(`[${elapsed}s]`), chalk.bold.green('Audit complete'));
                        break;
                }
            },
        });

        console.log(`\n${'─'.repeat(60)}\n`);
        console.log(chalk.bold('AUDIT REPORT'));
        console.log(`Pages scanned: ${report.pagesScanned}`);
        console.log(`Total findings: ${report.totalFindings}`);
        console.log(`Duration: ${(report.scanDurationMs / 1000).toFixed(1)}s\n`);

        if (report.totalFindings > 0) {
            const conf = report.findingsByConfidence;
            const sev = report.findingsBySeverity;
            console.log(`By confidence: ${conf.confirmed} confirmed, ${conf.corroborated} corroborated, ${conf['ai-only']} ai-only`);
            console.log(`By severity: ${sev.critical} critical, ${sev.serious} serious, ${sev.moderate} moderate, ${sev.minor} minor\n`);

            console.log(chalk.bold('Findings:'));
            for (const f of report.findings) {
                const color = f.impact === 'critical' ? chalk.red : f.impact === 'serious' ? chalk.yellow : chalk.white;
                console.log(color(`  [${f.confidence}] ${f.criterion?.id || '?'} (${f.impact}): ${f.description}`));
            }
        }

        if (report.remediationPlan) {
            console.log(`\n${chalk.bold('Remediation Plan:')} ${report.remediationPlan.totalIssues} issues, ${report.remediationPlan.estimatedEffort}`);
            for (const phase of report.remediationPlan.phases) {
                console.log(`  Phase ${phase.priority}: ${phase.title} (${phase.items.length} items)`);
            }
        }

        if (report.agentSummary) {
            console.log(`\n${chalk.bold('Agent Summary:')}`);
            console.log(report.agentSummary.slice(0, 1000));
            if (report.agentSummary.length > 1000) console.log(chalk.dim(`... (${report.agentSummary.length} chars total)`));
        }

        if (opts.output) {
            const fs = await import('fs/promises');
            await fs.writeFile(opts.output, JSON.stringify(report, null, 2));
            console.log(`\nReport written to ${opts.output}`);
        }

        setExitCode(EXIT_CODES.SUCCESS);
        exitWithCode(EXIT_CODES.SUCCESS);
    } catch (error) {
        console.error('Agent failed:', error instanceof Error ? error.message : String(error));
        exitWithCode(EXIT_CODES.RUNTIME_ERROR);
    }
}

async function runAgentJSON(
    opts: AgentModeOptions,
    runAgent: any,
    model: string,
): Promise<void> {
    try {
        const report = await runAgent({
            targetUrl: opts.url,
            maxPages: opts.maxPages,
            maxSteps: opts.maxSteps,
            specialists: opts.specialists,
            model,
            wcagLevel: opts.wcagLevel,
            onEvent: (event: any) => {
                if (event.type === 'thinking') logger.info(event.message);
                else if (event.type === 'tool_call') logger.info(`Tool: ${event.message}`);
                else if (event.type === 'specialist_complete') logger.info(`Specialist ${event.specialistId}: ${event.findings} findings`);
                else if (event.type === 'merge_complete') logger.info(`Merged: ${event.totalFindings} findings (${event.deduplicatedCount} deduplicated)`);
            },
        });
        console.log(JSON.stringify(report, null, 2));
        setExitCode(EXIT_CODES.SUCCESS);
    } catch (error) {
        console.log(JSON.stringify({
            url: opts.url,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            success: false,
        }, null, 2));
        setExitCode(EXIT_CODES.RUNTIME_ERROR);
    }
}
