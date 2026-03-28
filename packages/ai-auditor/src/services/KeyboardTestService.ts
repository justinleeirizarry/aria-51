/**
 * Keyboard Test Service - Manages Stagehand-based keyboard navigation testing
 *
 * Wraps StagehandKeyboardTester with a cleaner Effect-based interface.
 * All methods return Effects for composability with the Effect ecosystem.
 */
import { Effect } from 'effect';
import type { Page } from 'playwright';
import { StagehandKeyboardTester } from '../stagehand/keyboard-tester.js';
import type { StagehandKeyboardConfig, StagehandKeyboardResults } from '../types.js';
import { logger } from '@aria51/core';
import {
    KeyboardTestInitError,
    KeyboardTestError,
    KeyboardTestNotInitializedError,
} from '../errors.js';
import type { IKeyboardTestService } from './types.js';

/**
 * KeyboardTestService - Clean interface for Stagehand keyboard navigation testing
 *
 * This service wraps StagehandKeyboardTester with Effect-based error handling
 * for composability with the Effect ecosystem.
 */
export class KeyboardTestService implements IKeyboardTestService {
    private tester: StagehandKeyboardTester | null = null;
    private config: StagehandKeyboardConfig = {};

    /**
     * Initialize the keyboard test service
     */
    init(config?: StagehandKeyboardConfig): Effect.Effect<void, KeyboardTestInitError> {
        return Effect.tryPromise({
            try: async () => {
                this.config = config ?? {};

                if (this.config.verbose) {
                    logger.setLevel(0); // DEBUG
                }

                this.tester = new StagehandKeyboardTester(this.config);
                await this.tester.init();

                logger.debug('KeyboardTestService initialized');
            },
            catch: (error) => new KeyboardTestInitError({
                reason: error instanceof Error ? error.message : String(error),
            }),
        });
    }

    /**
     * Check if service is initialized
     */
    isInitialized(): Effect.Effect<boolean> {
        return Effect.sync(() => this.tester !== null);
    }

    /**
     * Get the underlying page instance
     */
    getPage(): Effect.Effect<Page, KeyboardTestNotInitializedError> {
        return Effect.sync(() => this.tester?.page ?? null).pipe(
            Effect.flatMap((page) =>
                page
                    ? Effect.succeed(page)
                    : Effect.fail(new KeyboardTestNotInitializedError({ operation: 'getPage' }))
            )
        );
    }

    /**
     * Run keyboard navigation tests on a URL
     */
    test(url: string): Effect.Effect<
        StagehandKeyboardResults,
        KeyboardTestNotInitializedError | KeyboardTestError
    > {
        return Effect.gen(this, function* () {
            if (!this.tester) {
                return yield* Effect.fail(new KeyboardTestNotInitializedError({ operation: 'test' }));
            }

            return yield* Effect.tryPromise({
                try: async () => {
                    logger.info(`Running keyboard navigation tests on ${url}...`);
                    const results = await this.tester!.test(url);

                    logger.info(`Keyboard tests complete: ${results.summary.totalIssues} issues found`);
                    return results;
                },
                catch: (error) => new KeyboardTestError({
                    operation: 'test',
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
            if (this.tester) {
                await this.tester.close();
                this.tester = null;
            }
            logger.debug('KeyboardTestService closed');
        });
    }
}

/**
 * Create a new KeyboardTestService instance
 */
export function createKeyboardTestService(): IKeyboardTestService {
    return new KeyboardTestService();
}
