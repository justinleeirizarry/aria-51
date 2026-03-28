/**
 * Tree Analysis Service - Manages Stagehand-based accessibility tree analysis
 *
 * Wraps StagehandTreeAnalyzer with a cleaner Effect-based interface.
 * All methods return Effects for composability with the Effect ecosystem.
 */
import { Effect } from 'effect';
import type { Page } from 'playwright';
import { StagehandTreeAnalyzer } from '../stagehand/a11y-tree-analyzer.js';
import type { TreeAnalysisConfig, TreeAnalysisResult } from '../types.js';
import { logger } from '@aria51/core';
import {
    TreeAnalysisInitError,
    TreeAnalysisError,
    TreeAnalysisNotInitializedError,
} from '../errors.js';
import type { ITreeAnalysisService } from './types.js';

/**
 * TreeAnalysisService - Clean interface for Stagehand accessibility tree analysis
 *
 * This service wraps StagehandTreeAnalyzer with Effect-based error handling
 * for composability with the Effect ecosystem.
 */
export class TreeAnalysisService implements ITreeAnalysisService {
    private analyzer: StagehandTreeAnalyzer | null = null;
    private config: TreeAnalysisConfig = {};

    /**
     * Initialize the tree analysis service
     */
    init(config?: TreeAnalysisConfig): Effect.Effect<void, TreeAnalysisInitError> {
        return Effect.tryPromise({
            try: async () => {
                this.config = config ?? {};

                if (this.config.verbose) {
                    logger.setLevel(0); // DEBUG
                }

                this.analyzer = new StagehandTreeAnalyzer(this.config);
                await this.analyzer.init();

                logger.debug('TreeAnalysisService initialized');
            },
            catch: (error) => new TreeAnalysisInitError({
                reason: error instanceof Error ? error.message : String(error),
            }),
        });
    }

    /**
     * Check if service is initialized
     */
    isInitialized(): Effect.Effect<boolean> {
        return Effect.sync(() => this.analyzer !== null);
    }

    /**
     * Get the underlying page instance
     */
    getPage(): Effect.Effect<Page, TreeAnalysisNotInitializedError> {
        return Effect.sync(() => this.analyzer?.page ?? null).pipe(
            Effect.flatMap((page) =>
                page
                    ? Effect.succeed(page)
                    : Effect.fail(new TreeAnalysisNotInitializedError({ operation: 'getPage' }))
            )
        );
    }

    /**
     * Analyze accessibility tree of a URL
     */
    analyze(url: string): Effect.Effect<
        TreeAnalysisResult,
        TreeAnalysisNotInitializedError | TreeAnalysisError
    > {
        return Effect.gen(this, function* () {
            if (!this.analyzer) {
                return yield* Effect.fail(new TreeAnalysisNotInitializedError({ operation: 'analyze' }));
            }

            return yield* Effect.tryPromise({
                try: async () => {
                    logger.info(`Analyzing accessibility tree for ${url}...`);
                    const results = await this.analyzer!.analyze(url);

                    logger.info(`Tree analysis complete: ${results.summary.totalIssues} issues found`);
                    return results;
                },
                catch: (error) => new TreeAnalysisError({
                    reason: error instanceof Error ? error.message : String(error),
                }),
            });
        });
    }

    /**
     * Close the service and clean up resources
     */
    close(): Effect.Effect<void> {
        return Effect.promise(async () => {
            if (this.analyzer) {
                await this.analyzer.close();
                this.analyzer = null;
            }
            logger.debug('TreeAnalysisService closed');
        });
    }
}

/**
 * Create a new TreeAnalysisService instance
 */
export function createTreeAnalysisService(): ITreeAnalysisService {
    return new TreeAnalysisService();
}
