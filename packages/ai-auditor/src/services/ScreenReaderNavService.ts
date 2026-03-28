/**
 * Screen Reader Navigation Service
 *
 * Wraps ScreenReaderNavigator with an Effect-based interface for
 * composability with the Effect ecosystem.
 */
import { Effect } from 'effect';
import type { Page } from 'playwright';
import { ScreenReaderNavigator } from '../stagehand/screen-reader-navigator.js';
import type { ScreenReaderNavigatorConfig, ScreenReaderNavigationResults } from '../types.js';
import { logger } from '@aria51/core';
import {
    EffectScreenReaderNavInitError,
    EffectScreenReaderNavError,
    EffectScreenReaderNavNotInitializedError,
} from '../errors.js';
import type { IScreenReaderNavService } from './types.js';

/**
 * ScreenReaderNavService - Clean interface for simulated screen reader navigation
 */
export class ScreenReaderNavService implements IScreenReaderNavService {
    private navigator: ScreenReaderNavigator | null = null;
    private config: ScreenReaderNavigatorConfig = {};

    /**
     * Initialize the screen reader navigation service
     */
    init(config?: ScreenReaderNavigatorConfig): Effect.Effect<void, EffectScreenReaderNavInitError> {
        return Effect.tryPromise({
            try: async () => {
                this.config = config ?? {};

                if (this.config.verbose) {
                    logger.setLevel(0); // DEBUG
                }

                this.navigator = new ScreenReaderNavigator(this.config);
                await this.navigator.init();

                logger.debug('ScreenReaderNavService initialized');
            },
            catch: (error) => new EffectScreenReaderNavInitError({
                reason: error instanceof Error ? error.message : String(error),
            }),
        });
    }

    /**
     * Check if service is initialized
     */
    isInitialized(): Effect.Effect<boolean> {
        return Effect.sync(() => this.navigator !== null);
    }

    /**
     * Get the underlying page instance
     */
    getPage(): Effect.Effect<Page, EffectScreenReaderNavNotInitializedError> {
        return Effect.sync(() => this.navigator?.page ?? null).pipe(
            Effect.flatMap((page) =>
                page
                    ? Effect.succeed(page)
                    : Effect.fail(new EffectScreenReaderNavNotInitializedError({ operation: 'getPage' }))
            )
        );
    }

    /**
     * Run screen reader navigation test on a URL
     */
    navigate(url: string): Effect.Effect<
        ScreenReaderNavigationResults,
        EffectScreenReaderNavNotInitializedError | EffectScreenReaderNavError
    > {
        return Effect.gen(this, function* () {
            if (!this.navigator) {
                return yield* Effect.fail(new EffectScreenReaderNavNotInitializedError({ operation: 'navigate' }));
            }

            return yield* Effect.tryPromise({
                try: async () => {
                    logger.info(`Running screen reader navigation for ${url}...`);
                    const results = await this.navigator!.navigate(url);

                    logger.info(`Navigation complete: ${results.summary.totalIssues} issues found`);
                    return results;
                },
                catch: (error) => new EffectScreenReaderNavError({
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
            if (this.navigator) {
                await this.navigator.close();
                this.navigator = null;
            }
            logger.debug('ScreenReaderNavService closed');
        });
    }
}

/**
 * Create a new ScreenReaderNavService instance
 */
export function createScreenReaderNavService(): IScreenReaderNavService {
    return new ScreenReaderNavService();
}
