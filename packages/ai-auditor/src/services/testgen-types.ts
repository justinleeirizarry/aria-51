/**
 * Test Generation Service Types
 */
import type { Effect } from 'effect';
import type { Page } from 'playwright';
import type { ElementDiscovery } from '../types.js';
import type {
    TestGenNotInitializedError,
    TestGenInitError,
    TestGenNavigationError,
    TestGenDiscoveryError,
} from '../errors.js';

export interface TestGenerationConfig {
    model?: string;
    verbose?: boolean;
}

/**
 * Effect-first Test Generation Service interface
 *
 * All methods return Effects for composability with the Effect ecosystem.
 */
export interface ITestGenerationService {
    /**
     * Initialize the Stagehand scanner
     */
    init(config?: TestGenerationConfig): Effect.Effect<void, TestGenInitError>;

    /**
     * Get the underlying page instance
     */
    getPage(): Effect.Effect<Page, TestGenNotInitializedError>;

    /**
     * Navigate to a URL
     */
    navigateTo(url: string): Effect.Effect<void, TestGenNotInitializedError | TestGenNavigationError>;

    /**
     * Discover interactive elements on the page using AI
     */
    discoverElements(): Effect.Effect<ElementDiscovery[], TestGenNotInitializedError | TestGenDiscoveryError>;

    /**
     * Generate a Playwright test file from discovered elements
     */
    generateTest(url: string, elements: ElementDiscovery[]): Effect.Effect<string>;

    /**
     * Close the scanner and clean up resources
     */
    close(): Effect.Effect<void>;

    /**
     * Check if service is initialized
     */
    isInitialized(): Effect.Effect<boolean>;
}
