/**
 * Browser Service Types
 */
import type { Effect } from 'effect';
import type { Page, Browser } from 'playwright';
import type { BrowserType } from '../../types.js';
import type {
    BrowserLaunchError,
    BrowserNotLaunchedError,
    BrowserAlreadyLaunchedError,
    NavigationError,
} from '../../errors/effect-errors.js';

// Re-export for convenience
export type { BrowserType };

export interface BrowserServiceConfig {
    browserType: BrowserType;
    headless: boolean;
    timeout?: number;
    stabilizationDelay?: number;
    maxNavigationWaits?: number;
    navigationCheckInterval?: number;
    networkIdleTimeout?: number;
    postNavigationDelay?: number;
    viewport?: { width: number; height: number };
    isMobile?: boolean;
    hasTouch?: boolean;
}

export interface NavigateOptions {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeout?: number;
}

export interface StabilityCheckResult {
    isStable: boolean;
    navigationCount: number;
    lastError?: Error;
}

/**
 * Effect-first Browser Service interface
 *
 * All methods return Effects for composability with the Effect ecosystem.
 */
export interface IBrowserService {
    /**
     * Launch the browser with the given configuration
     */
    launch(config: BrowserServiceConfig): Effect.Effect<void, BrowserLaunchError | BrowserAlreadyLaunchedError>;

    /**
     * Get the current page
     */
    getPage(): Effect.Effect<Page, BrowserNotLaunchedError>;

    /**
     * Get the current browser instance
     */
    getBrowser(): Effect.Effect<Browser, BrowserNotLaunchedError>;

    /**
     * Navigate to a URL
     */
    navigate(url: string, options?: NavigateOptions): Effect.Effect<void, BrowserNotLaunchedError | NavigationError>;

    /**
     * Wait for page stability (network idle)
     */
    waitForStability(): Effect.Effect<StabilityCheckResult, BrowserNotLaunchedError>;

    /**
     * Detect if a supported framework (React, Vue, Svelte, Solid) is present on the page
     */
    detectFramework(): Effect.Effect<boolean, BrowserNotLaunchedError>;

    /**
     * Close the browser
     */
    close(): Effect.Effect<void>;

    /**
     * Check if the browser is currently launched
     */
    isLaunched(): Effect.Effect<boolean>;
}

