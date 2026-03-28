/**
 * WCAG Audit Service - Manages Stagehand-based WCAG compliance auditing
 *
 * Wraps StagehandWcagAuditAgent with a cleaner Effect-based interface.
 * All methods return Effects for composability with the Effect ecosystem.
 */
import { Effect } from 'effect';
import type { Page } from 'playwright';
import { StagehandWcagAuditAgent } from '../stagehand/wcag-audit-agent.js';
import type { WcagAuditOptions, WcagAuditResult } from '../types.js';
import { logger } from '@aria51/core';
import {
    WcagAuditInitError,
    WcagAuditError,
    WcagAuditNotInitializedError,
} from '../errors.js';
import type { IWcagAuditService } from './types.js';

/**
 * WcagAuditService - Clean interface for Stagehand WCAG compliance auditing
 *
 * This service wraps StagehandWcagAuditAgent with Effect-based error handling
 * for composability with the Effect ecosystem.
 */
export class WcagAuditService implements IWcagAuditService {
    private agent: StagehandWcagAuditAgent | null = null;
    private options: WcagAuditOptions = { targetLevel: 'AA' };

    /**
     * Initialize the WCAG audit service
     */
    init(options?: WcagAuditOptions): Effect.Effect<void, WcagAuditInitError> {
        return Effect.tryPromise({
            try: async () => {
                this.options = options ?? { targetLevel: 'AA' };

                if (this.options.verbose) {
                    logger.setLevel(0); // DEBUG
                }

                this.agent = new StagehandWcagAuditAgent(this.options);
                await this.agent.init();

                logger.debug(`WcagAuditService initialized (target level: ${this.options.targetLevel})`);
            },
            catch: (error) => new WcagAuditInitError({
                reason: error instanceof Error ? error.message : String(error),
            }),
        });
    }

    /**
     * Check if service is initialized
     */
    isInitialized(): Effect.Effect<boolean> {
        return Effect.sync(() => this.agent !== null);
    }

    /**
     * Get the underlying page instance
     */
    getPage(): Effect.Effect<Page, WcagAuditNotInitializedError> {
        return Effect.sync(() => this.agent?.page ?? null).pipe(
            Effect.flatMap((page) =>
                page
                    ? Effect.succeed(page)
                    : Effect.fail(new WcagAuditNotInitializedError({ operation: 'getPage' }))
            )
        );
    }

    /**
     * Run a WCAG audit on a URL
     */
    audit(url: string): Effect.Effect<
        WcagAuditResult,
        WcagAuditNotInitializedError | WcagAuditError
    > {
        return Effect.gen(this, function* () {
            if (!this.agent) {
                return yield* Effect.fail(new WcagAuditNotInitializedError({ operation: 'audit' }));
            }

            return yield* Effect.tryPromise({
                try: async () => {
                    logger.info(`Running WCAG ${this.options.targetLevel} audit on ${url}...`);
                    const results = await this.agent!.audit(url);

                    logger.info(`WCAG audit complete: ${results.summary.failed} failures, ${results.summary.passed} passes`);
                    return results;
                },
                catch: (error) => new WcagAuditError({
                    operation: 'audit',
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
            if (this.agent) {
                await this.agent.close();
                this.agent = null;
            }
            logger.debug('WcagAuditService closed');
        });
    }
}

/**
 * Create a new WcagAuditService instance
 */
export function createWcagAuditService(): IWcagAuditService {
    return new WcagAuditService();
}
