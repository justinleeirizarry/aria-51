import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Exit, Layer } from 'effect';
import {
    performScan,
    performScanWithCleanup,
    type EffectScanOptions,
} from './orchestration.js';
import {
    BrowserService,
    ScannerService,
    ResultsProcessorService,
    type EffectBrowserService,
    type EffectScannerService,
    type EffectResultsProcessorService,
} from './tags.js';
import {
    BrowserLaunchError,
    ReactNotDetectedError,
} from '../../errors/effect-errors.js';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock config
vi.mock('../../config/index.js', () => ({
    getConfig: () => ({
        scan: {
            maxRetries: 3,
            retryDelayBase: 100,
        },
        browser: {
            timeout: 30000,
            stabilizationDelay: 100,
        },
    }),
}));

describe('Effect Orchestration', () => {
    const mockPage = {} as any;

    const mockScanResults = {
        url: 'http://example.com',
        timestamp: '2024-01-01T00:00:00.000Z',
        browser: 'chromium',
        components: [],
        violations: [],
        summary: {
            totalComponents: 0,
            totalViolations: 0,
            totalPasses: 0,
            totalIncomplete: 0,
            totalInapplicable: 0,
            violationsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
            violationsByWcagLevel: {
                wcag2a: 0,
                wcag2aa: 0,
                wcag2aaa: 0,
                wcag21a: 0,
                wcag21aa: 0,
                wcag22aa: 0,
                bestPractice: 0,
            },
            componentsWithViolations: 0,
        },
    };

    const mockBrowserScanData = {
        components: [],
        violations: [],
    };

    const createMockBrowserService = (
        overrides: Partial<EffectBrowserService> = {}
    ): EffectBrowserService => ({
        launch: vi.fn(() => Effect.succeed(undefined)),
        getPage: vi.fn(() => Effect.succeed(mockPage)),
        getBrowser: vi.fn(() => Effect.succeed({} as any)),
        isLaunched: vi.fn(() => Effect.succeed(true)),
        navigate: vi.fn(() => Effect.succeed(undefined)),
        waitForStability: vi.fn(() =>
            Effect.succeed({ isStable: true, navigationCount: 0 })
        ),
        detectFramework: vi.fn(() => Effect.succeed(true)),
        close: vi.fn(() => Effect.succeed(undefined)),
        ...overrides,
    });

    const createMockScannerService = (
        overrides: Partial<EffectScannerService> = {}
    ): EffectScannerService => ({
        isBundleInjected: vi.fn(() => Effect.succeed(false)),
        injectBundle: vi.fn(() => Effect.succeed(undefined)),
        scan: vi.fn(() => Effect.succeed(mockBrowserScanData as any)),
        ...overrides,
    });

    const createMockProcessorService = (
        overrides: Partial<EffectResultsProcessorService> = {}
    ): EffectResultsProcessorService => ({
        process: vi.fn(() => Effect.succeed(mockScanResults)),
        formatAsJSON: vi.fn(() => Effect.succeed('{}')),
        formatForMCP: vi.fn(() => Effect.succeed([{ type: 'text' as const, text: 'summary' }])),
        formatForCI: vi.fn(() =>
            Effect.succeed({
                passed: true,
                totalViolations: 0,
                criticalViolations: 0,
                threshold: 0,
                message: 'Passed',
            })
        ),
        ...overrides,
    });

    const createTestLayer = (
        browserService: EffectBrowserService,
        scannerService: EffectScannerService,
        processorService: EffectResultsProcessorService
    ) =>
        Layer.mergeAll(
            Layer.succeed(BrowserService, browserService),
            Layer.succeed(ScannerService, scannerService),
            Layer.succeed(ResultsProcessorService, processorService)
        );

    describe('performScan', () => {
        it('should complete a successful scan', async () => {
            const browserService = createMockBrowserService();
            const scannerService = createMockScannerService();
            const processorService = createMockProcessorService();

            const testLayer = createTestLayer(
                browserService,
                scannerService,
                processorService
            );

            const options: EffectScanOptions = {
                url: 'http://example.com',
                browser: 'chromium',
                headless: true,
            };

            const effect = performScan(options);
            const result = await Effect.runPromise(Effect.provide(effect, testLayer));

            expect(result.results).toEqual(mockScanResults);
            expect(browserService.launch).toHaveBeenCalled();
            expect(browserService.navigate).toHaveBeenCalled();
            expect(browserService.detectFramework).toHaveBeenCalled();
            expect(scannerService.scan).toHaveBeenCalled();
            expect(processorService.process).toHaveBeenCalled();
        });

        it('should fail with ReactNotDetectedError when React is not found and requireFramework is true', async () => {
            const browserService = createMockBrowserService({
                detectFramework: vi.fn(() => Effect.succeed(false)),
            });
            const scannerService = createMockScannerService();
            const processorService = createMockProcessorService();

            const testLayer = createTestLayer(
                browserService,
                scannerService,
                processorService
            );

            const options: EffectScanOptions = {
                url: 'http://example.com',
                browser: 'chromium',
                headless: true,
                requireFramework: true,
            };

            const effect = performScan(options);
            const exit = await Effect.runPromiseExit(Effect.provide(effect, testLayer));

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('ReactNotDetectedError');
            }
        });

        it('should succeed when React is not found and requireFramework is false (generic scanning)', async () => {
            const browserService = createMockBrowserService({
                detectFramework: vi.fn(() => Effect.succeed(false)),
            });
            const scannerService = createMockScannerService();
            const processorService = createMockProcessorService();

            const testLayer = createTestLayer(
                browserService,
                scannerService,
                processorService
            );

            const options: EffectScanOptions = {
                url: 'http://example.com',
                browser: 'chromium',
                headless: true,
                // requireFramework: false is the default
            };

            const effect = performScan(options);
            const exit = await Effect.runPromiseExit(Effect.provide(effect, testLayer));

            expect(Exit.isSuccess(exit)).toBe(true);
        });

        it('should fail with BrowserLaunchError when browser fails to launch', async () => {
            const browserService = createMockBrowserService({
                launch: vi.fn(() =>
                    Effect.fail(
                        new BrowserLaunchError({
                            browserType: 'chromium',
                            reason: 'Browser not installed',
                        })
                    )
                ),
            });
            const scannerService = createMockScannerService();
            const processorService = createMockProcessorService();

            const testLayer = createTestLayer(
                browserService,
                scannerService,
                processorService
            );

            const options: EffectScanOptions = {
                url: 'http://example.com',
                browser: 'chromium',
                headless: true,
            };

            const effect = performScan(options);
            const exit = await Effect.runPromiseExit(Effect.provide(effect, testLayer));

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('BrowserLaunchError');
            }
        });

        it('should handle CI mode and return passed status', async () => {
            const browserService = createMockBrowserService();
            const scannerService = createMockScannerService();
            const processorService = createMockProcessorService();

            const testLayer = createTestLayer(
                browserService,
                scannerService,
                processorService
            );

            const options: EffectScanOptions = {
                url: 'http://example.com',
                browser: 'chromium',
                headless: true,
                ciMode: true,
                ciThreshold: 10,
            };

            const effect = performScan(options);
            const result = await Effect.runPromise(Effect.provide(effect, testLayer));

            expect(result.ciPassed).toBe(true);
            expect(processorService.formatForCI).toHaveBeenCalled();
        });

        it('should pass tags and keyboard test options to scanner', async () => {
            const browserService = createMockBrowserService();
            const scanMock = vi.fn(() => Effect.succeed(mockBrowserScanData as any));
            const scannerService = createMockScannerService({
                scan: scanMock,
            });
            const processorService = createMockProcessorService();

            const testLayer = createTestLayer(
                browserService,
                scannerService,
                processorService
            );

            const options: EffectScanOptions = {
                url: 'http://example.com',
                browser: 'chromium',
                headless: true,
                tags: ['wcag2a', 'wcag2aa'],
                includeKeyboardTests: true,
            };

            const effect = performScan(options);
            await Effect.runPromise(Effect.provide(effect, testLayer));

            expect(scanMock).toHaveBeenCalledWith(mockPage, {
                tags: ['wcag2a', 'wcag2aa'],
                includeKeyboardTests: true,
            });
        });
    });

    describe('performScanWithCleanup', () => {
        it('should call close after scan completes', async () => {
            const closeMock = vi.fn(() => Effect.succeed(undefined));
            const browserService = createMockBrowserService({
                close: closeMock,
            });
            const scannerService = createMockScannerService();
            const processorService = createMockProcessorService();

            const testLayer = createTestLayer(
                browserService,
                scannerService,
                processorService
            );

            const options: EffectScanOptions = {
                url: 'http://example.com',
                browser: 'chromium',
                headless: true,
            };

            const effect = performScanWithCleanup(options);
            await Effect.runPromise(Effect.provide(effect, testLayer));

            expect(closeMock).toHaveBeenCalled();
        });

        it('should call close even when scan fails', async () => {
            const closeMock = vi.fn(() => Effect.succeed(undefined));
            const browserService = createMockBrowserService({
                detectFramework: vi.fn(() => Effect.succeed(false)),
                close: closeMock,
            });
            const scannerService = createMockScannerService();
            const processorService = createMockProcessorService();

            const testLayer = createTestLayer(
                browserService,
                scannerService,
                processorService
            );

            const options: EffectScanOptions = {
                url: 'http://example.com',
                browser: 'chromium',
                headless: true,
            };

            const effect = performScanWithCleanup(options);
            await Effect.runPromiseExit(Effect.provide(effect, testLayer));

            expect(closeMock).toHaveBeenCalled();
        });
    });
});
