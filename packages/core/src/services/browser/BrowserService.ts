/**
 * Browser Service - Manages browser lifecycle and page operations
 *
 * Extracts browser-related logic from launcher.ts into a reusable service.
 * All methods return Effects for composability with the Effect ecosystem.
 */
import { Effect } from 'effect';
import { execSync } from 'child_process';
import { chromium, firefox, webkit, type Browser, type Page } from 'playwright';
import { getConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import {
    BrowserLaunchError,
    BrowserNotLaunchedError,
    BrowserAlreadyLaunchedError,
    NavigationError,
} from '../../errors/effect-errors.js';
import { detectFramework as detectFrameworkOnPage } from '../effect/browser-resource.js';
import type {
    BrowserServiceConfig,
    NavigateOptions,
    StabilityCheckResult,
    IBrowserService,
} from './types.js';

/**
 * Check if an error indicates Playwright browsers are not installed.
 */
export function isBrowserNotInstalledError(errorMessage: string): boolean {
    return (
        errorMessage.includes('No browsers found') ||
        errorMessage.includes('browser executable path') ||
        errorMessage.includes('Failed to find') ||
        errorMessage.includes('not installed') ||
        errorMessage.includes("Executable doesn't exist")
    );
}

/**
 * Auto-install a Playwright browser. Returns true on success.
 */
export function autoInstallBrowser(browserType: string): boolean {
    try {
        logger.info(`${browserType} not found. Installing...`);
        execSync(`npx playwright install ${browserType}`, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 120_000,
        });
        logger.info(`${browserType} installed successfully.`);
        return true;
    } catch {
        return false;
    }
}

/**
 * BrowserService - Centralized browser lifecycle management
 *
 * This service encapsulates all browser-related operations:
 * - Browser launching (chromium, firefox, webkit)
 * - Page creation and navigation
 * - Stability checking (waiting for SPAs to settle)
 * - React detection
 * - Cleanup
 *
 * All methods return Effects for composability with the Effect ecosystem.
 */
export class BrowserService implements IBrowserService {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private config: BrowserServiceConfig | null = null;

    /**
     * Launch a browser with the specified configuration
     */
    launch(config: BrowserServiceConfig): Effect.Effect<void, BrowserLaunchError | BrowserAlreadyLaunchedError> {
        return Effect.gen(this, function* () {
            if (this.browser) {
                return yield* Effect.fail(new BrowserAlreadyLaunchedError({}));
            }

            this.config = config;
            yield* this._tryLaunch(config, true);
        });
    }

    /**
     * Attempt to launch the browser. On "not installed" errors, auto-installs and retries once.
     */
    private _tryLaunch(
        config: BrowserServiceConfig,
        allowAutoInstall: boolean,
    ): Effect.Effect<void, BrowserLaunchError> {
        return Effect.tryPromise({
            try: async () => {
                const launchOptions = { headless: config.headless };

                switch (config.browserType) {
                    case 'chromium':
                        this.browser = await chromium.launch(launchOptions);
                        break;
                    case 'firefox':
                        this.browser = await firefox.launch(launchOptions);
                        break;
                    case 'webkit':
                        this.browser = await webkit.launch(launchOptions);
                        break;
                    default:
                        throw new Error(`Unsupported browser type: ${config.browserType}`);
                }

                this.page = await this.browser.newPage({
                    bypassCSP: true,
                    ...(config.viewport ? { viewport: config.viewport } : {}),
                    ...(config.isMobile !== undefined ? { isMobile: config.isMobile } : {}),
                    ...(config.hasTouch !== undefined ? { hasTouch: config.hasTouch } : {}),
                });
                logger.debug(`Browser ${config.browserType} launched successfully`);
            },
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
                        return this._tryLaunch(config, false);
                    }
                    return Effect.fail(new BrowserLaunchError({
                        browserType: err.browserType,
                        reason: `Auto-install failed. Run manually: npx playwright install ${config.browserType}`,
                    }));
                },
            ),
        );
    }

    /**
     * Get the current page instance
     */
    getPage(): Effect.Effect<Page, BrowserNotLaunchedError> {
        return Effect.sync(() => this.page).pipe(
            Effect.flatMap((page) =>
                page
                    ? Effect.succeed(page)
                    : Effect.fail(new BrowserNotLaunchedError({ operation: 'getPage' }))
            )
        );
    }

    /**
     * Get the current browser instance
     */
    getBrowser(): Effect.Effect<Browser, BrowserNotLaunchedError> {
        return Effect.sync(() => this.browser).pipe(
            Effect.flatMap((browser) =>
                browser
                    ? Effect.succeed(browser)
                    : Effect.fail(new BrowserNotLaunchedError({ operation: 'getBrowser' }))
            )
        );
    }

    /**
     * Check if browser is launched
     */
    isLaunched(): Effect.Effect<boolean> {
        return Effect.sync(() => this.browser !== null && this.page !== null);
    }

    /**
     * Navigate to a URL
     */
    navigate(url: string, options?: NavigateOptions): Effect.Effect<void, BrowserNotLaunchedError | NavigationError> {
        return Effect.gen(this, function* () {
            const page = yield* this.getPage();

            const globalConfig = getConfig();
            const timeout = options?.timeout ?? this.config?.timeout ?? globalConfig.browser.timeout;
            const waitUntil = options?.waitUntil ?? 'domcontentloaded';

            yield* Effect.tryPromise({
                try: async () => {
                    await page.goto(url, { waitUntil, timeout });
                    logger.debug(`Navigated to ${url}`);

                    // Initial stabilization delay
                    const stabilizationDelay = this.config?.stabilizationDelay ?? globalConfig.browser.stabilizationDelay;
                    await page.waitForTimeout(stabilizationDelay);
                },
                catch: (error) => new NavigationError({
                    url,
                    reason: error instanceof Error ? error.message : String(error),
                }),
            });
        });
    }

    /**
     * Wait for the page to stabilize (especially important for SPAs like Next.js)
     *
     * This monitors for client-side navigations and waits until the page
     * appears stable (no more navigations happening).
     */
    waitForStability(): Effect.Effect<StabilityCheckResult, BrowserNotLaunchedError> {
        return Effect.gen(this, function* () {
            const page = yield* this.getPage();

            return yield* Effect.promise(() => this._waitForStabilityAsync(page));
        });
    }

    /**
     * Internal async implementation of stability check
     */
    private async _waitForStabilityAsync(page: Page): Promise<StabilityCheckResult> {
        const globalConfig = getConfig();
        const maxNavigationWaits = this.config?.maxNavigationWaits ?? globalConfig.browser.maxNavigationWaits;
        const navigationCheckInterval = this.config?.navigationCheckInterval ?? globalConfig.browser.navigationCheckInterval;
        const networkIdleTimeout = this.config?.networkIdleTimeout ?? globalConfig.browser.networkIdleTimeout;
        const postNavigationDelay = this.config?.postNavigationDelay ?? globalConfig.browser.postNavigationDelay;

        let isStable = false;
        let navigationCount = 0;
        let lastError: Error | undefined;

        while (!isStable && navigationCount < maxNavigationWaits) {
            try {
                // Wait for network to be completely idle
                try {
                    await page.waitForLoadState('networkidle', { timeout: networkIdleTimeout });
                } catch {
                    // Network idle timeout could mean slow network or infinite loaders
                    logger.debug('Network idle timeout - may indicate slow network or infinite loaders');
                }

                // Extra wait to ensure React has settled
                await page.waitForTimeout(postNavigationDelay);

                // Check if page is truly stable by monitoring for a period
                try {
                    await page.waitForNavigation({ timeout: navigationCheckInterval });
                    // Navigation happened, increment counter and retry
                    navigationCount++;
                    logger.warn(`Navigation detected (${navigationCount}/${maxNavigationWaits}), waiting for stabilization...`);
                } catch {
                    // No navigation in the check interval, we're stable
                    isStable = true;
                    logger.debug('No navigation detected - page appears stable');
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                logger.debug(`Stability check iteration ${navigationCount} failed: ${lastError.message}`);
                navigationCount++;
            }
        }

        if (!isStable && navigationCount >= maxNavigationWaits) {
            logger.warn(`Page did not stabilize after ${navigationCount} navigation checks. Proceeding anyway...`);
            logger.debug(`Last error: ${lastError?.message || 'Unknown'}`);
        } else if (isStable) {
            logger.debug('Page appears stable, proceeding...');
        }

        return { isStable, navigationCount, lastError };
    }

    /**
     * Detect if a supported framework is present on the page
     */
    detectFramework(): Effect.Effect<boolean, BrowserNotLaunchedError> {
        return Effect.gen(this, function* () {
            const page = yield* this.getPage();
            return yield* detectFrameworkOnPage(page);
        });
    }

    /**
     * Close the browser and clean up resources
     */
    close(): Effect.Effect<void> {
        return Effect.promise(async () => {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            this.config = null;
            logger.debug('Browser closed');
        });
    }
}

/**
 * Create a new BrowserService instance
 */
export function createBrowserService(): IBrowserService {
    return new BrowserService();
}
