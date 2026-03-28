import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Exit, Layer } from 'effect';
import {
    BrowserService,
    ScannerService,
    ResultsProcessorService,
} from './tags.js';
import {
    BrowserServiceManual,
    ScannerServiceLive,
    ResultsProcessorServiceLive,
} from './layers.js';
import {
    BrowserNotLaunchedError,
    ScanDataError,
} from '../../errors/effect-errors.js';

// Mock the browser service to return Effects like the real implementation
vi.mock('../browser/index.js', async () => {
    const { Effect } = await import('effect');
    const { BrowserNotLaunchedError } = await import('../../errors/effect-errors.js');
    return {
        createBrowserService: vi.fn(() => ({
            launch: vi.fn(() => Effect.succeed(undefined)),
            getPage: vi.fn(() => Effect.fail(new BrowserNotLaunchedError({ operation: 'getPage' }))),
            getBrowser: vi.fn(() => Effect.fail(new BrowserNotLaunchedError({ operation: 'getBrowser' }))),
            isLaunched: vi.fn(() => Effect.succeed(false)),
            navigate: vi.fn(() => Effect.succeed(undefined)),
            waitForStability: vi.fn(() => Effect.succeed({ isStable: true, navigationCount: 0 })),
            detectFramework: vi.fn(() => Effect.succeed(true)),
            close: vi.fn(() => Effect.succeed(undefined)),
        })),
    };
});

// Mock the scanner to return Effects like the real implementation
vi.mock('../scanner/index.js', async () => {
    const { Effect } = await import('effect');
    return {
        createScannerService: vi.fn(() => ({
            isBundleInjected: vi.fn(() => Effect.succeed(false)),
            injectBundle: vi.fn(() => Effect.succeed(undefined)),
            scan: vi.fn(() =>
                Effect.succeed({
                    components: [],
                    violations: [],
                })
            ),
        })),
    };
});

// Mock the processor to return Effects like the real implementation
vi.mock('../processor/index.js', async () => {
    const { Effect } = await import('effect');
    return {
        createResultsProcessorService: vi.fn(() => ({
            process: vi.fn(() => Effect.succeed({
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
                    violationsByWcagLevel: { A: 0, AA: 0, AAA: 0 },
                    componentsWithViolations: 0,
                },
            })),
            formatAsJSON: vi.fn(() => Effect.succeed('{}')),
            formatForMCP: vi.fn(() => Effect.succeed([{ type: 'text', text: 'summary' }])),
            formatForCI: vi.fn(() => Effect.succeed({ passed: true, totalViolations: 0, criticalViolations: 0, threshold: 0, message: 'Passed' })),
        })),
    };
});

describe('Effect Service Layers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('BrowserServiceManual', () => {
        it('should provide BrowserService', async () => {
            const effect = Effect.gen(function* () {
                const browser = yield* BrowserService;
                return yield* browser.isLaunched();
            });

            const result = await Effect.runPromise(
                Effect.provide(effect, BrowserServiceManual)
            );

            expect(result).toBe(false);
        });

        it('should fail getPage when browser not launched', async () => {
            const effect = Effect.gen(function* () {
                const browser = yield* BrowserService;
                return yield* browser.getPage();
            });

            const exit = await Effect.runPromiseExit(
                Effect.provide(effect, BrowserServiceManual)
            );

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('BrowserNotLaunchedError');
            }
        });
    });

    describe('ScannerServiceLive', () => {
        it('should provide ScannerService', async () => {
            const mockPage = {} as any;

            const effect = Effect.gen(function* () {
                const scanner = yield* ScannerService;
                return yield* scanner.isBundleInjected(mockPage);
            });

            const result = await Effect.runPromise(
                Effect.provide(effect, ScannerServiceLive)
            );

            expect(result).toBe(false);
        });

        it('should scan successfully', async () => {
            const mockPage = {} as any;

            const effect = Effect.gen(function* () {
                const scanner = yield* ScannerService;
                return yield* scanner.scan(mockPage);
            });

            const result = await Effect.runPromise(
                Effect.provide(effect, ScannerServiceLive)
            );

            expect(result).toEqual({
                components: [],
                violations: [],
            });
        });
    });

    describe('ResultsProcessorServiceLive', () => {
        it('should provide ResultsProcessorService', async () => {
            const effect = Effect.gen(function* () {
                const processor = yield* ResultsProcessorService;
                return yield* processor.process(
                    { components: [], violations: [] } as any,
                    { url: 'http://example.com', browser: 'chromium' }
                );
            });

            const result = await Effect.runPromise(
                Effect.provide(effect, ResultsProcessorServiceLive)
            );

            expect(result.url).toBe('http://example.com');
        });

        it('should format as JSON', async () => {
            const effect = Effect.gen(function* () {
                const processor = yield* ResultsProcessorService;
                const results = yield* processor.process(
                    { components: [], violations: [] } as any,
                    { url: 'http://example.com', browser: 'chromium' }
                );
                return yield* processor.formatAsJSON(results);
            });

            const result = await Effect.runPromise(
                Effect.provide(effect, ResultsProcessorServiceLive)
            );

            expect(result).toBe('{}');
        });

        it('should format for CI', async () => {
            const effect = Effect.gen(function* () {
                const processor = yield* ResultsProcessorService;
                const results = yield* processor.process(
                    { components: [], violations: [] } as any,
                    { url: 'http://example.com', browser: 'chromium' }
                );
                return yield* processor.formatForCI(results, 0);
            });

            const result = await Effect.runPromise(
                Effect.provide(effect, ResultsProcessorServiceLive)
            );

            expect(result.passed).toBe(true);
        });
    });

    describe('Layer composition', () => {
        it('should compose multiple layers', async () => {
            const composedLayer = Layer.mergeAll(
                BrowserServiceManual,
                ScannerServiceLive,
                ResultsProcessorServiceLive
            );

            const effect = Effect.gen(function* () {
                const browser = yield* BrowserService;
                const scanner = yield* ScannerService;
                const processor = yield* ResultsProcessorService;

                const isLaunched = yield* browser.isLaunched();
                const isBundleInjected = yield* scanner.isBundleInjected({} as any);

                return { isLaunched, isBundleInjected };
            });

            const result = await Effect.runPromise(Effect.provide(effect, composedLayer));

            expect(result.isLaunched).toBe(false);
            expect(result.isBundleInjected).toBe(false);
        });
    });
});
