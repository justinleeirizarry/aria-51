/**
 * Test Generation Service - Manages AI-driven test generation
 *
 * Wraps StagehandScanner and TestGenerator with a cleaner interface.
 * All methods return Effects for composability with the Effect ecosystem.
 */
import { Effect } from 'effect';
import type { Page } from 'playwright';
import { StagehandScanner } from '../stagehand/scanner.js';
import { TestGenerator } from '../stagehand/test-generator.js';
import type { ElementDiscovery } from '../types.js';
import { logger } from '@aria51/core';
import {
    TestGenNotInitializedError,
    TestGenInitError,
    TestGenNavigationError,
    TestGenDiscoveryError,
} from '../errors.js';
import type { TestGenerationConfig, ITestGenerationService } from './testgen-types.js';

/**
 * TestGenerationService - Clean interface for AI-driven test generation
 *
 * This service wraps:
 * - StagehandScanner for element discovery
 * - TestGenerator for Playwright test file generation
 *
 * All methods return Effects for composability with the Effect ecosystem.
 */
export class TestGenerationService implements ITestGenerationService {
    private scanner: StagehandScanner | null = null;
    private generator: TestGenerator;
    private config: TestGenerationConfig = {};

    constructor() {
        this.generator = new TestGenerator();
    }

    /**
     * Initialize the Stagehand scanner
     */
    init(config?: TestGenerationConfig): Effect.Effect<void, TestGenInitError> {
        return Effect.tryPromise({
            try: async () => {
                this.config = config ?? {};

                if (this.config.verbose) {
                    logger.setLevel(0); // DEBUG
                }

                this.scanner = new StagehandScanner({
                    enabled: true,
                    model: this.config.model,
                    verbose: this.config.verbose,
                });

                logger.info('Initializing Stagehand for test generation...');
            },
            catch: (error) => new TestGenInitError({
                reason: error instanceof Error ? error.message : String(error),
            }),
        });
    }

    /**
     * Check if service is initialized
     */
    isInitialized(): Effect.Effect<boolean> {
        return Effect.sync(() => this.scanner !== null);
    }

    /**
     * Get the underlying page instance
     */
    getPage(): Effect.Effect<Page, TestGenNotInitializedError> {
        return Effect.sync(() => this.scanner?.page ?? null).pipe(
            Effect.flatMap((page) =>
                page
                    ? Effect.succeed(page)
                    : Effect.fail(new TestGenNotInitializedError({ operation: 'getPage' }))
            )
        );
    }

    /**
     * Navigate to a URL (initializes Stagehand if needed)
     */
    navigateTo(url: string): Effect.Effect<void, TestGenNotInitializedError | TestGenNavigationError> {
        return Effect.gen(this, function* () {
            if (!this.scanner) {
                return yield* Effect.fail(new TestGenNotInitializedError({ operation: 'navigateTo' }));
            }

            yield* Effect.tryPromise({
                try: async () => {
                    // Initialize Stagehand with the URL
                    await this.scanner!.init(url);

                    const page = this.scanner!.page;
                    if (!page) {
                        throw new Error('Page unavailable after initialization');
                    }

                    logger.info(`Navigating to ${url}...`);
                    await page.goto(url, { waitUntil: 'networkidle' });

                    // Wait for page to settle
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                },
                catch: (error) => new TestGenNavigationError({
                    url,
                    reason: error instanceof Error ? error.message : String(error),
                }),
            });
        });
    }

    /**
     * Discover interactive elements on the page using AI
     */
    discoverElements(): Effect.Effect<ElementDiscovery[], TestGenNotInitializedError | TestGenDiscoveryError> {
        return Effect.gen(this, function* () {
            if (!this.scanner) {
                return yield* Effect.fail(new TestGenNotInitializedError({ operation: 'discoverElements' }));
            }

            return yield* Effect.tryPromise({
                try: async () => {
                    logger.info('Discovering interactive elements...');
                    const elements = await this.scanner!.discoverElements();

                    if (elements.length === 0) {
                        logger.warn('No interactive elements discovered');
                    } else {
                        logger.info(`Discovered ${elements.length} interactive elements`);
                    }

                    return elements;
                },
                catch: (error) => new TestGenDiscoveryError({
                    reason: error instanceof Error ? error.message : String(error),
                }),
            });
        });
    }

    /**
     * Generate a Playwright test file from discovered elements
     */
    generateTest(url: string, elements: ElementDiscovery[]): Effect.Effect<string> {
        return Effect.sync(() => {
            logger.info('Generating Playwright test file...');
            return this.generator.generateTest(url, elements);
        });
    }

    /**
     * Close the scanner and clean up resources
     */
    close(): Effect.Effect<void> {
        return Effect.promise(async () => {
            if (this.scanner) {
                await this.scanner.close();
                this.scanner = null;
            }
            logger.debug('TestGenerationService closed');
        });
    }
}

/**
 * Create a new TestGenerationService instance
 */
export function createTestGenerationService(): ITestGenerationService {
    return new TestGenerationService();
}
