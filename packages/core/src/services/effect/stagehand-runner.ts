/**
 * Stagehand test runner — dynamically imported by orchestration when --stagehand is enabled.
 *
 * Runs keyboard, tree analysis, and screen reader tests using the ai-auditor package,
 * then converts results to SupplementalTestResult[] via adapters.
 */
import type { SupplementalTestResult } from '../../types.js';
import { logger } from '../../utils/logger.js';

interface StagehandRunnerOptions {
    model?: string;
}

export async function runStagehandTests(
    url: string,
    options?: StagehandRunnerOptions,
    existingResults?: SupplementalTestResult[],
): Promise<SupplementalTestResult[]> {
    // Dynamic import so the ai-auditor dependency is optional (not in core's package.json)
    // @ts-ignore — ai-auditor is an optional peer, resolved at runtime
    const auditor = await import('@aria51/ai-auditor') as any;
    const { Effect } = await import('effect');
    const model = options?.model || 'openai/gpt-4o-mini';
    const allResults: SupplementalTestResult[] = [];

    // Run keyboard tests
    try {
        logger.info('Running Stagehand keyboard tests…');
        const service = auditor.createKeyboardTestService();
        await Effect.runPromise(service.init({ model }));
        const results: any = await Effect.runPromise(service.test(url));
        await Effect.runPromise(service.close());
        allResults.push(...auditor.keyboardResultsToSupplemental(results));
        logger.info(`Keyboard tests: ${results.issues.length} issues found`);
    } catch (err) {
        logger.warn(`Keyboard tests failed: ${extractErrorMessage(err)}`);
    }

    // Run tree analysis
    try {
        logger.info('Running Stagehand tree analysis…');
        const service = auditor.createTreeAnalysisService();
        await Effect.runPromise(service.init({ model }));
        const results: any = await Effect.runPromise(service.analyze(url));
        await Effect.runPromise(service.close());
        allResults.push(...auditor.treeResultsToSupplemental(results));
        logger.info(`Tree analysis: ${results.issues.length} issues found`);
    } catch (err) {
        logger.warn(`Tree analysis failed: ${extractErrorMessage(err)}`);
    }

    // Run screen reader navigation
    try {
        logger.info('Running Stagehand screen reader navigation…');
        const service = auditor.createScreenReaderNavService();
        await Effect.runPromise(service.init({ model }));
        const results: any = await Effect.runPromise(service.navigate(url));
        await Effect.runPromise(service.close());
        allResults.push(...auditor.screenReaderResultsToSupplemental(results));
        logger.info(`Screen reader: ${results.issues.length} issues found`);
    } catch (err) {
        logger.warn(`Screen reader tests failed: ${extractErrorMessage(err)}`);
    }

    // Deduplicate Stagehand results among themselves first
    const byId = new Map<string, SupplementalTestResult>();
    for (const result of allResults) {
        const existing = byId.get(result.criterionId);
        if (!existing) {
            byId.set(result.criterionId, result);
        } else if (result.status === 'fail' && existing.status === 'pass') {
            byId.set(result.criterionId, {
                ...result,
                issues: [...existing.issues, ...result.issues],
            });
        } else if (existing.status === 'fail' && result.status === 'fail') {
            existing.issues.push(...result.issues);
            existing.source += `, ${result.source}`;
        }
    }

    // Merge with lightweight Playwright results (if any)
    // Stagehand results override same criterion (higher fidelity), merging issues
    const merged = new Map<string, SupplementalTestResult>();

    // Start with existing lightweight results
    if (existingResults) {
        for (const r of existingResults) {
            merged.set(r.criterionId, r);
        }
    }

    // Stagehand overrides, combining issues from both sources
    for (const r of byId.values()) {
        const prev = merged.get(r.criterionId);
        if (!prev) {
            merged.set(r.criterionId, r);
        } else {
            merged.set(r.criterionId, {
                ...r,
                source: `${r.source}, ${prev.source}`,
                issues: [...r.issues, ...prev.issues],
            });
        }
    }

    return Array.from(merged.values());
}

/** Extract a clean error message from Effect FiberFailure or plain Error */
function extractErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        // Effect FiberFailure wraps the real error — dig it out
        const cause = (err as any).cause;
        if (cause?._tag) return `${cause._tag}: ${cause.reason || cause.message || cause.operation || 'unknown'}`;
        return err.message;
    }
    return String(err);
}
