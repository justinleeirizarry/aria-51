import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Exit } from 'effect';
import * as playwrightModule from 'playwright';
import {
    makeBrowserResource,
    navigateTo,
    waitForPageStability,
    detectFramework,
    withBrowser,
} from './browser-resource.js';
import * as configModule from '../../config/index.js';

// Mock Playwright
vi.mock('playwright', () => ({
    chromium: { launch: vi.fn() },
    firefox: { launch: vi.fn() },
    webkit: { launch: vi.fn() },
}));

// Mock Config
vi.mock('../../config/index.js', () => ({
    getConfig: vi.fn(),
}));

// Mock Logger to silence output during tests
vi.mock('../../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('browser-resource', () => {
    let mockBrowser: any;
    let mockPage: any;

    const mockConfig = {
        browser: {
            timeout: 1000,
            stabilizationDelay: 100,
            networkIdleTimeout: 1000,
            maxNavigationWaits: 1,
            postNavigationDelay: 100,
            navigationCheckInterval: 100,
        },
        scan: {
            maxRetries: 1,
            retryDelayBase: 100,
        },
    };

    beforeEach(() => {
        vi.resetAllMocks();

        // Setup default config mock
        (configModule.getConfig as any).mockReturnValue(mockConfig);

        // Setup Playwright mocks
        mockPage = {
            goto: vi.fn(),
            waitForTimeout: vi.fn(),
            evaluate: vi.fn(),
            waitForLoadState: vi.fn(),
            waitForNavigation: vi.fn().mockRejectedValue(new Error('Timeout')),
            close: vi.fn(),
        };

        mockBrowser = {
            newPage: vi.fn().mockResolvedValue(mockPage),
            close: vi.fn(),
        };

        (playwrightModule.chromium.launch as any).mockResolvedValue(mockBrowser);
        (playwrightModule.firefox.launch as any).mockResolvedValue(mockBrowser);
        (playwrightModule.webkit.launch as any).mockResolvedValue(mockBrowser);
    });

    describe('makeBrowserResource', () => {
        it('should create a browser resource with chromium', async () => {
            const effect = Effect.scoped(
                Effect.gen(function* () {
                    const resource = yield* makeBrowserResource({
                        browserType: 'chromium',
                        headless: true,
                    });
                    return resource.browserType;
                })
            );

            const result = await Effect.runPromise(effect);

            expect(result).toBe('chromium');
            expect(playwrightModule.chromium.launch).toHaveBeenCalledWith({ headless: true });
        });

        it('should create a browser resource with firefox', async () => {
            const effect = Effect.scoped(
                Effect.gen(function* () {
                    const resource = yield* makeBrowserResource({
                        browserType: 'firefox',
                        headless: false,
                    });
                    return resource.browserType;
                })
            );

            const result = await Effect.runPromise(effect);

            expect(result).toBe('firefox');
            expect(playwrightModule.firefox.launch).toHaveBeenCalledWith({ headless: false });
        });

        it('should acquire browser resource and provide page and browser', async () => {
            const effect = Effect.scoped(
                Effect.gen(function* () {
                    const resource = yield* makeBrowserResource({
                        browserType: 'chromium',
                        headless: true,
                    });
                    // Verify the resource has page and browser
                    return {
                        hasPage: resource.page === mockPage,
                        hasBrowser: resource.browser === mockBrowser,
                        browserType: resource.browserType,
                    };
                })
            );

            const result = await Effect.runPromise(effect);

            expect(result.hasPage).toBe(true);
            expect(result.hasBrowser).toBe(true);
            expect(result.browserType).toBe('chromium');
        });

        it('should fail with BrowserLaunchError on launch failure', async () => {
            (playwrightModule.chromium.launch as any).mockRejectedValue(
                new Error('Failed to launch')
            );

            const effect = Effect.scoped(
                makeBrowserResource({
                    browserType: 'chromium',
                    headless: true,
                })
            );

            const exit = await Effect.runPromiseExit(effect);

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('BrowserLaunchError');
            }
        });

        it('should detect missing Playwright browsers', async () => {
            (playwrightModule.chromium.launch as any).mockRejectedValue(
                new Error('No browsers found')
            );

            const effect = Effect.scoped(
                makeBrowserResource({
                    browserType: 'chromium',
                    headless: true,
                })
            );

            const exit = await Effect.runPromiseExit(effect);

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('BrowserLaunchError');
            }
        });
    });

    describe('navigateTo', () => {
        it('should navigate to URL', async () => {
            const effect = navigateTo(mockPage, 'http://example.com');

            await Effect.runPromise(effect);

            expect(mockPage.goto).toHaveBeenCalledWith('http://example.com', {
                waitUntil: 'networkidle',
                timeout: mockConfig.browser.timeout,
            });
        });

        it('should use custom options', async () => {
            const effect = navigateTo(mockPage, 'http://example.com', {
                timeout: 5000,
                waitUntil: 'domcontentloaded',
            });

            await Effect.runPromise(effect);

            expect(mockPage.goto).toHaveBeenCalledWith('http://example.com', {
                waitUntil: 'domcontentloaded',
                timeout: 5000,
            });
        });

        it('should fail with NavigationTimeoutError on timeout', async () => {
            mockPage.goto.mockRejectedValue(new Error('Navigation timeout'));

            const effect = navigateTo(mockPage, 'http://example.com');

            const exit = await Effect.runPromiseExit(effect);

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('NavigationTimeoutError');
            }
        });

        it('should fail with NavigationError on other errors', async () => {
            mockPage.goto.mockRejectedValue(new Error('Connection refused'));

            const effect = navigateTo(mockPage, 'http://example.com');

            const exit = await Effect.runPromiseExit(effect);

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('NavigationError');
            }
        });
    });

    describe('waitForPageStability', () => {
        it('should return stable when no navigation detected', async () => {
            mockPage.waitForNavigation.mockRejectedValue(new Error('Timeout'));

            const effect = waitForPageStability(mockPage);

            const result = await Effect.runPromise(effect);

            expect(result.isStable).toBe(true);
            expect(result.navigationCount).toBe(0);
        });

        it('should detect navigation and retry', async () => {
            // Override config to allow more navigation waits
            (configModule.getConfig as any).mockReturnValue({
                ...mockConfig,
                browser: {
                    ...mockConfig.browser,
                    maxNavigationWaits: 3,
                },
            });

            mockPage.waitForNavigation
                .mockResolvedValueOnce(undefined) // Navigation detected
                .mockRejectedValueOnce(new Error('Timeout')); // No more navigation

            const effect = waitForPageStability(mockPage);

            const result = await Effect.runPromise(effect);

            expect(result.isStable).toBe(true);
            expect(result.navigationCount).toBe(1);
        });
    });

    describe('detectFramework', () => {
        it('should return true when React is detected', async () => {
            mockPage.evaluate.mockResolvedValue(true);

            const effect = detectFramework(mockPage);

            const result = await Effect.runPromise(effect);

            expect(result).toBe(true);
        });

        it('should return false when React is not detected', async () => {
            mockPage.evaluate.mockResolvedValue(false);

            const effect = detectFramework(mockPage);

            const result = await Effect.runPromise(effect);

            expect(result).toBe(false);
        });
    });

    describe('withBrowser', () => {
        it('should run effect with browser resource', async () => {
            const effect = withBrowser(
                { browserType: 'chromium', headless: true },
                ({ page, browserType }) =>
                    Effect.succeed({ hasPage: page === mockPage, browserType })
            );

            const result = await Effect.runPromise(effect);

            expect(result.hasPage).toBe(true);
            expect(result.browserType).toBe('chromium');
        });

        it('should propagate failures from the use function', async () => {
            const testError = new Error('Test error');
            const effect = withBrowser(
                { browserType: 'chromium', headless: true },
                () => Effect.fail(testError)
            );

            const exit = await Effect.runPromiseExit(effect);

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error).toBe(testError);
            }
        });
    });
});
