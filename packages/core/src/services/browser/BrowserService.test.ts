import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Exit } from 'effect';
import { BrowserService, createBrowserService } from './BrowserService.js';
import { chromium, firefox, webkit } from 'playwright';
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

describe('BrowserService', () => {
    let mockBrowser: any;
    let mockPage: any;
    let service: BrowserService;

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

        (chromium.launch as any).mockResolvedValue(mockBrowser);
        (firefox.launch as any).mockResolvedValue(mockBrowser);
        (webkit.launch as any).mockResolvedValue(mockBrowser);

        service = new BrowserService();
    });

    describe('launch', () => {
        it('should launch chromium browser', async () => {
            await Effect.runPromise(service.launch({ browserType: 'chromium', headless: true }));

            expect(chromium.launch).toHaveBeenCalledWith({ headless: true });

            const isLaunched = await Effect.runPromise(service.isLaunched());
            expect(isLaunched).toBe(true);

            const page = await Effect.runPromise(service.getPage());
            expect(page).toBe(mockPage);

            const browser = await Effect.runPromise(service.getBrowser());
            expect(browser).toBe(mockBrowser);
        });

        it('should launch firefox browser', async () => {
            await Effect.runPromise(service.launch({ browserType: 'firefox', headless: false }));

            expect(firefox.launch).toHaveBeenCalledWith({ headless: false });

            const isLaunched = await Effect.runPromise(service.isLaunched());
            expect(isLaunched).toBe(true);
        });

        it('should launch webkit browser', async () => {
            await Effect.runPromise(service.launch({ browserType: 'webkit', headless: true }));

            expect(webkit.launch).toHaveBeenCalledWith({ headless: true });

            const isLaunched = await Effect.runPromise(service.isLaunched());
            expect(isLaunched).toBe(true);
        });

        it('should fail with BrowserAlreadyLaunchedError if browser already launched', async () => {
            await Effect.runPromise(service.launch({ browserType: 'chromium', headless: true }));

            const exit = await Effect.runPromiseExit(
                service.launch({ browserType: 'chromium', headless: true })
            );

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('BrowserAlreadyLaunchedError');
            }
        });

        it('should fail with BrowserLaunchError on launch failure', async () => {
            (chromium.launch as any).mockRejectedValue(new Error('Failed to launch'));

            const exit = await Effect.runPromiseExit(
                service.launch({ browserType: 'chromium', headless: true })
            );

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('BrowserLaunchError');
            }
        });

        it('should detect missing Playwright browsers', async () => {
            (chromium.launch as any).mockRejectedValue(new Error('No browsers found'));

            const exit = await Effect.runPromiseExit(
                service.launch({ browserType: 'chromium', headless: true })
            );

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('BrowserLaunchError');
            }
        });
    });

    describe('navigate', () => {
        it('should navigate to URL', async () => {
            await Effect.runPromise(service.launch({ browserType: 'chromium', headless: true }));
            await Effect.runPromise(service.navigate('http://localhost:3000'));

            expect(mockPage.goto).toHaveBeenCalledWith('http://localhost:3000', {
                waitUntil: 'domcontentloaded',
                timeout: mockConfig.browser.timeout,
            });
        });

        it('should fail with BrowserNotLaunchedError if browser not launched', async () => {
            const exit = await Effect.runPromiseExit(service.navigate('http://localhost:3000'));

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('BrowserNotLaunchedError');
            }
        });

        it('should use custom navigate options', async () => {
            await Effect.runPromise(service.launch({ browserType: 'chromium', headless: true }));
            await Effect.runPromise(
                service.navigate('http://localhost:3000', {
                    waitUntil: 'domcontentloaded',
                    timeout: 5000,
                })
            );

            expect(mockPage.goto).toHaveBeenCalledWith('http://localhost:3000', {
                waitUntil: 'domcontentloaded',
                timeout: 5000,
            });
        });
    });

    describe('waitForStability', () => {
        it('should return stable when no navigation detected', async () => {
            await Effect.runPromise(service.launch({ browserType: 'chromium', headless: true }));

            // Mock: waitForNavigation rejects (no navigation happened)
            mockPage.waitForNavigation.mockRejectedValue(new Error('Timeout'));

            const result = await Effect.runPromise(service.waitForStability());

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

            await Effect.runPromise(service.launch({ browserType: 'chromium', headless: true }));

            // First call: navigation happens (resolves)
            // Second call: no navigation (rejects with timeout)
            mockPage.waitForNavigation
                .mockResolvedValueOnce(undefined) // Navigation detected
                .mockRejectedValueOnce(new Error('Timeout')); // No more navigation

            const result = await Effect.runPromise(service.waitForStability());

            expect(result.isStable).toBe(true);
            expect(result.navigationCount).toBe(1);
        });

        it('should fail with BrowserNotLaunchedError if browser not launched', async () => {
            const exit = await Effect.runPromiseExit(service.waitForStability());

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('BrowserNotLaunchedError');
            }
        });
    });

    describe('detectFramework', () => {
        it('should return true when React is detected', async () => {
            await Effect.runPromise(service.launch({ browserType: 'chromium', headless: true }));
            mockPage.evaluate.mockResolvedValue(true);

            const result = await Effect.runPromise(service.detectFramework());

            expect(result).toBe(true);
        });

        it('should return false when React is not detected', async () => {
            await Effect.runPromise(service.launch({ browserType: 'chromium', headless: true }));
            mockPage.evaluate.mockResolvedValue(false);

            const result = await Effect.runPromise(service.detectFramework());

            expect(result).toBe(false);
        });

        it('should fail with BrowserNotLaunchedError if browser not launched', async () => {
            const exit = await Effect.runPromiseExit(service.detectFramework());

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('BrowserNotLaunchedError');
            }
        });
    });

    describe('close', () => {
        it('should close browser and page', async () => {
            await Effect.runPromise(service.launch({ browserType: 'chromium', headless: true }));
            await Effect.runPromise(service.close());

            expect(mockPage.close).toHaveBeenCalled();
            expect(mockBrowser.close).toHaveBeenCalled();

            const isLaunched = await Effect.runPromise(service.isLaunched());
            expect(isLaunched).toBe(false);

            const pageExit = await Effect.runPromiseExit(service.getPage());
            expect(Exit.isFailure(pageExit)).toBe(true);

            const browserExit = await Effect.runPromiseExit(service.getBrowser());
            expect(Exit.isFailure(browserExit)).toBe(true);
        });

        it('should handle close when not launched', async () => {
            // Should not throw
            await Effect.runPromise(service.close());

            const isLaunched = await Effect.runPromise(service.isLaunched());
            expect(isLaunched).toBe(false);
        });
    });

    describe('createBrowserService', () => {
        it('should create a new BrowserService instance', () => {
            const service = createBrowserService();
            expect(service).toBeInstanceOf(BrowserService);
        });
    });
});
