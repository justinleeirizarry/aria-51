/**
 * Stagehand Mode Handlers
 *
 * Handles keyboard testing, tree analysis, and WCAG audit modes.
 * All three follow the same init/run/close/catch pattern.
 */
import { Effect } from 'effect';
import { EXIT_CODES, setExitCode } from '@aria51/core';
import type { WcagLevel } from '@aria51/core';
import {
    createKeyboardTestService,
    createTreeAnalysisService,
    createWcagAuditService,
} from '@aria51/ai-auditor';

interface StagehandOptions {
    url: string;
    model?: string;
    verbose: boolean;
}

function jsonError(url: string, error: unknown, extra?: Record<string, unknown>) {
    console.log(JSON.stringify({
        url,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        success: false,
        ...extra,
    }, null, 2));
    setExitCode(EXIT_CODES.RUNTIME_ERROR);
}

export async function runKeyboardMode(opts: StagehandOptions & { maxTabPresses: number }): Promise<void> {
    const service = createKeyboardTestService();
    try {
        await Effect.runPromise(service.init({
            maxTabPresses: opts.maxTabPresses,
            verbose: opts.verbose,
            model: opts.model,
        }));
        const results = await Effect.runPromise(service.test(opts.url));
        console.log(JSON.stringify(results, null, 2));
        setExitCode(EXIT_CODES.SUCCESS);
    } catch (error) {
        jsonError(opts.url, error);
    } finally {
        await Effect.runPromise(service.close());
    }
}

export async function runTreeMode(opts: StagehandOptions & { includeFullTree: boolean }): Promise<void> {
    const service = createTreeAnalysisService();
    try {
        await Effect.runPromise(service.init({
            verbose: opts.verbose,
            model: opts.model,
            includeFullTree: opts.includeFullTree,
        }));
        const results = await Effect.runPromise(service.analyze(opts.url));
        console.log(JSON.stringify(results, null, 2));
        setExitCode(EXIT_CODES.SUCCESS);
    } catch (error) {
        jsonError(opts.url, error);
    } finally {
        await Effect.runPromise(service.close());
    }
}

export async function runWcagAuditMode(opts: StagehandOptions & { auditLevel: WcagLevel; maxSteps: number }): Promise<void> {
    const service = createWcagAuditService();
    try {
        await Effect.runPromise(service.init({
            targetLevel: opts.auditLevel,
            maxSteps: opts.maxSteps,
            verbose: opts.verbose,
            model: opts.model,
        }));
        const results = await Effect.runPromise(service.audit(opts.url));
        console.log(JSON.stringify(results, null, 2));
        setExitCode(EXIT_CODES.SUCCESS);
    } catch (error) {
        jsonError(opts.url, error, { targetLevel: opts.auditLevel });
    } finally {
        await Effect.runPromise(service.close());
    }
}
