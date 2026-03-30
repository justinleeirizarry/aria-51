/**
 * Browser Resource Management with Effect Scope
 *
 * This module provides automatic browser lifecycle management using Effect's
 * acquireRelease pattern. The browser is automatically closed when the scope ends.
 */
import { Effect, Scope } from 'effect';
import { chromium, firefox, webkit, type Browser, type Page } from 'playwright';
import type { BrowserServiceConfig } from '../browser/types.js';
import {
    BrowserLaunchError,
    NavigationError,
    NavigationTimeoutError,
} from '../../errors/effect-errors.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { isBrowserNotInstalledError, autoInstallBrowser } from '../browser/BrowserService.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Browser resource containing both browser and page instances
 */
export interface BrowserResource {
    readonly browser: Browser;
    readonly page: Page;
    readonly browserType: string;
}

// ============================================================================
// Browser Resource Acquisition
// ============================================================================

/**
 * Launch a browser and create a page
 *
 * This is a low-level function that creates the browser resource.
 * Use `makeBrowserResource` for automatic cleanup.
 */
const launchBrowser = async (config: BrowserServiceConfig): Promise<BrowserResource> => {
    const launchOptions = { headless: config.headless };

    let browser: Browser;

    switch (config.browserType) {
        case 'chromium':
            browser = await chromium.launch(launchOptions);
            break;
        case 'firefox':
            browser = await firefox.launch(launchOptions);
            break;
        case 'webkit':
            browser = await webkit.launch(launchOptions);
            break;
        default:
            throw new Error(`Unsupported browser type: ${config.browserType}`);
    }

    const page = await browser.newPage({
        ...(config.viewport ? { viewport: config.viewport } : {}),
        ...(config.isMobile !== undefined ? { isMobile: config.isMobile } : {}),
        ...(config.hasTouch !== undefined ? { hasTouch: config.hasTouch } : {}),
    });
    logger.debug(`Browser ${config.browserType} launched successfully`);

    return { browser, page, browserType: config.browserType };
};

/**
 * Close browser and page resources
 */
const closeBrowser = async (resource: BrowserResource): Promise<void> => {
    try {
        await resource.page.close().catch(() => {});
        await resource.browser.close().catch(() => {});
        logger.debug(`Browser ${resource.browserType} closed`);
    } catch {
        // Ignore close errors - browser may already be closed
    }
};

// ============================================================================
// Effect-based Browser Resource
// ============================================================================

/**
 * Create a scoped browser resource
 *
 * The browser will be automatically closed when the scope ends,
 * whether due to success, failure, or interruption.
 *
 * @example
 * ```ts
 * const program = Effect.scoped(
 *   Effect.gen(function* () {
 *     const { browser, page } = yield* makeBrowserResource({
 *       browserType: 'chromium',
 *       headless: true
 *     });
 *
 *     yield* navigateTo(page, 'http://example.com');
 *     // ... do something with the page
 *     // Browser automatically closes when this scope ends
 *   })
 * );
 * ```
 */
const tryLaunchBrowser = (
    config: BrowserServiceConfig,
    allowAutoInstall: boolean,
): Effect.Effect<BrowserResource, BrowserLaunchError> =>
    Effect.tryPromise({
        try: () => launchBrowser(config),
        catch: (error) => new BrowserLaunchError({
            browserType: config.browserType,
            reason: error instanceof Error ? error.message : String(error),
        }),
    }).pipe(
        Effect.catchIf(
            (err) => allowAutoInstall && !!err.reason && isBrowserNotInstalledError(err.reason),
            (err) => {
                const installed = autoInstallBrowser(config.browserType);
                if (installed) {
                    return tryLaunchBrowser(config, false);
                }
                return Effect.fail(new BrowserLaunchError({
                    browserType: err.browserType,
                    reason: `Auto-install failed. Run manually: npx playwright install ${config.browserType}`,
                }));
            },
        ),
    );

export const makeBrowserResource = (
    config: BrowserServiceConfig
): Effect.Effect<BrowserResource, BrowserLaunchError, Scope.Scope> =>
    Effect.acquireRelease(
        tryLaunchBrowser(config, true),
        // Release: close browser (always runs)
        (resource) => Effect.promise(() => closeBrowser(resource))
    );

// ============================================================================
// Page Navigation Helpers
// ============================================================================

/**
 * Navigate to a URL using the page from a browser resource
 */
export const navigateTo = (
    page: Page,
    url: string,
    options?: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' }
): Effect.Effect<void, NavigationError | NavigationTimeoutError> => {
    const globalConfig = getConfig();
    const timeout = options?.timeout ?? globalConfig.browser.timeout;
    const waitUntil = options?.waitUntil ?? 'networkidle';

    return Effect.tryPromise({
        try: async () => {
            await page.goto(url, { waitUntil, timeout });
            logger.debug(`Navigated to ${url}`);

            // Initial stabilization delay
            const stabilizationDelay = globalConfig.browser.stabilizationDelay;
            await page.waitForTimeout(stabilizationDelay);
        },
        catch: (error) => {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
                return new NavigationTimeoutError({ url, timeout });
            }

            return new NavigationError({ url, reason: errorMessage });
        },
    });
};

/**
 * Wait for page stability (important for SPAs)
 */
export const waitForPageStability = (
    page: Page,
    options?: {
        maxNavigationWaits?: number;
        navigationCheckInterval?: number;
        networkIdleTimeout?: number;
        postNavigationDelay?: number;
    }
): Effect.Effect<{ isStable: boolean; navigationCount: number }> => {
    const globalConfig = getConfig();
    const maxNavigationWaits = options?.maxNavigationWaits ?? globalConfig.browser.maxNavigationWaits;
    const navigationCheckInterval =
        options?.navigationCheckInterval ?? globalConfig.browser.navigationCheckInterval;
    const networkIdleTimeout = options?.networkIdleTimeout ?? globalConfig.browser.networkIdleTimeout;
    const postNavigationDelay = options?.postNavigationDelay ?? globalConfig.browser.postNavigationDelay;

    return Effect.promise(async () => {
        let isStable = false;
        let navigationCount = 0;

        while (!isStable && navigationCount < maxNavigationWaits) {
            try {
                // Wait for network to be completely idle
                try {
                    await page.waitForLoadState('networkidle', { timeout: networkIdleTimeout });
                } catch {
                    logger.debug('Network idle timeout - may indicate slow network or infinite loaders');
                }

                // Extra wait to ensure React has settled
                await page.waitForTimeout(postNavigationDelay);

                // Check if page is truly stable by monitoring for a period
                try {
                    await page.waitForNavigation({ timeout: navigationCheckInterval });
                    navigationCount++;
                    logger.warn(
                        `Navigation detected (${navigationCount}/${maxNavigationWaits}), waiting for stabilization...`
                    );
                } catch {
                    // No navigation in the check interval, we're stable
                    isStable = true;
                    logger.debug('No navigation detected - page appears stable');
                }
            } catch {
                navigationCount++;
            }
        }

        if (!isStable && navigationCount >= maxNavigationWaits) {
            logger.warn(
                `Page did not stabilize after ${navigationCount} navigation checks. Proceeding anyway...`
            );
        } else if (isStable) {
            logger.debug('Page appears stable, proceeding...');
        }

        return { isStable, navigationCount };
    });
};

/**
 * Detect if a supported framework (React, Vue, Svelte, Solid) is present on the page
 */
export const detectFramework = (page: Page): Effect.Effect<boolean> =>
    Effect.promise(() =>
        page.evaluate(() => {
            // Helper function to check if element has React fiber
            function hasReactFiber(element: Element): boolean {
                const keys = Object.keys(element);
                return keys.some(
                    (key) =>
                        key.startsWith('__reactFiber') ||
                        key.startsWith('__reactProps') ||
                        key.startsWith('__reactInternalInstance')
                );
            }

            // 1. Fast path: Check DevTools hook first (most reliable)
            if (typeof window !== 'undefined' && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
                if (hook.getFiberRoots && hook.getFiberRoots(1)?.size > 0) {
                    return true;
                }
            }

            // 2. Check common React root containers
            const rootSelectors = ['#root', '#app', '#__next', '[data-reactroot]', '[data-reactid]'];
            for (const selector of rootSelectors) {
                const element = document.querySelector(selector);
                if (element && hasReactFiber(element)) {
                    return true;
                }
            }

            // 3. Sample random elements
            const allElements = document.querySelectorAll('*');
            const sampleSize = Math.min(100, allElements.length);
            const step = Math.max(1, Math.floor(allElements.length / sampleSize));

            for (let i = 0; i < allElements.length; i += step) {
                if (hasReactFiber(allElements[i])) {
                    return true;
                }
            }

            return false;
        })
    );

// ============================================================================
// High-level Browser Workflow
// ============================================================================

/**
 * Run an effect with a browser, automatically managing lifecycle
 *
 * This is the recommended way to use the browser for simple workflows.
 * The browser is automatically closed when the effect completes.
 *
 * @example
 * ```ts
 * const results = await Effect.runPromise(
 *   withBrowser({ browserType: 'chromium', headless: true }, ({ page }) =>
 *     Effect.gen(function* () {
 *       yield* navigateTo(page, 'http://example.com');
 *       return yield* scanPage(page);
 *     })
 *   )
 * );
 * ```
 */
export const withBrowser = <A, E, R>(
    config: BrowserServiceConfig,
    use: (resource: BrowserResource) => Effect.Effect<A, E, R>
): Effect.Effect<A, E | BrowserLaunchError, R> =>
    Effect.scoped(makeBrowserResource(config).pipe(Effect.flatMap(use)));
