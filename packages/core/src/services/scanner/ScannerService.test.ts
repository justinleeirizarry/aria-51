import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Exit } from 'effect';
import { ScannerService, createScannerService } from './ScannerService.js';
import * as configModule from '../../config/index.js';

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

// Mock retry util
vi.mock('../../utils/retry.js', () => ({
    withRetry: vi.fn(async (fn) => fn()),
}));

describe('ScannerService', () => {
    let mockPage: any;
    let service: ScannerService;

    const mockConfig = {
        scan: {
            maxRetries: 1,
            retryDelayBase: 100,
        },
    };

    beforeEach(() => {
        vi.resetAllMocks();

        // Setup default config mock
        (configModule.getConfig as any).mockReturnValue(mockConfig);

        // Setup mock page
        mockPage = {
            evaluate: vi.fn(),
            addScriptTag: vi.fn(),
        };

        service = new ScannerService('/mock/path/scanner-bundle.js');
    });

    describe('isBundleInjected', () => {
        it('should return true when bundle is injected', async () => {
            mockPage.evaluate.mockResolvedValue(true);

            const result = await Effect.runPromise(service.isBundleInjected(mockPage));

            expect(result).toBe(true);
        });

        it('should return false when bundle is not injected', async () => {
            mockPage.evaluate.mockResolvedValue(false);

            const result = await Effect.runPromise(service.isBundleInjected(mockPage));

            expect(result).toBe(false);
        });
    });

    describe('injectBundle', () => {
        it('should inject bundle when not already injected', async () => {
            // First check: not injected
            mockPage.evaluate.mockResolvedValueOnce(false);
            // Script tag added successfully
            mockPage.addScriptTag.mockResolvedValueOnce(undefined);
            // Verification check: now injected
            mockPage.evaluate.mockResolvedValueOnce(true);

            await Effect.runPromise(service.injectBundle(mockPage));

            expect(mockPage.addScriptTag).toHaveBeenCalledWith({
                path: '/mock/path/scanner-bundle.js',
            });
        });

        it('should skip injection if already injected', async () => {
            mockPage.evaluate.mockResolvedValue(true);

            await Effect.runPromise(service.injectBundle(mockPage));

            expect(mockPage.addScriptTag).not.toHaveBeenCalled();
        });

        it('should fail with ScannerInjectionError on injection failure', async () => {
            mockPage.evaluate.mockResolvedValueOnce(false);
            mockPage.addScriptTag.mockRejectedValue(new Error('File not found'));

            const exit = await Effect.runPromiseExit(service.injectBundle(mockPage));

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('ScannerInjectionError');
                expect(exit.cause.error.reason).toContain('Failed to inject scanner bundle');
            }
        });

        it('should fail with ScannerInjectionError if bundle fails to load in context', async () => {
            // First check: not injected
            mockPage.evaluate.mockResolvedValueOnce(false);
            // Script tag added successfully
            mockPage.addScriptTag.mockResolvedValue(undefined);
            // Verification check: still not injected
            mockPage.evaluate.mockResolvedValueOnce(false);

            const exit = await Effect.runPromiseExit(service.injectBundle(mockPage));

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('ScannerInjectionError');
                expect(exit.cause.error.reason).toContain('Scanner bundle failed to load');
            }
        });
    });

    describe('scan', () => {
        it('should return scan data', async () => {
            const mockScanData = {
                components: [{ name: 'TestComponent', type: 'component', path: [] }],
                violations: [],
                accessibilityTree: { children: [] },
            };

            // Bundle check: already injected
            mockPage.evaluate.mockResolvedValueOnce(true);
            // Scan execution
            mockPage.evaluate.mockResolvedValueOnce(mockScanData);

            const result = await Effect.runPromise(service.scan(mockPage));

            expect(result).toEqual(mockScanData);
        });

        it('should pass tags to scan', async () => {
            const mockScanData = {
                components: [],
                violations: [],
            };

            mockPage.evaluate.mockResolvedValueOnce(true); // Bundle check
            mockPage.evaluate.mockResolvedValueOnce(mockScanData); // Scan

            await Effect.runPromise(service.scan(mockPage, { tags: ['wcag2a', 'wcag2aa'] }));

            // Second evaluate call should be the scan
            expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
        });

        it('should pass includeKeyboardTests to scan', async () => {
            const mockScanData = {
                components: [],
                violations: [],
            };

            mockPage.evaluate.mockResolvedValueOnce(true); // Bundle check
            mockPage.evaluate.mockResolvedValueOnce(mockScanData); // Scan

            await Effect.runPromise(service.scan(mockPage, { includeKeyboardTests: true }));

            expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
        });

        it('should fail with ScanDataError when no scan data returned', async () => {
            mockPage.evaluate.mockResolvedValueOnce(true); // Bundle check
            mockPage.evaluate.mockResolvedValueOnce(null); // Scan returns null

            const exit = await Effect.runPromiseExit(service.scan(mockPage));

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
                expect(exit.cause.error._tag).toBe('ScanDataError');
                expect(exit.cause.error.reason).toContain('No scan data returned from browser');
            }
        });

        it('should handle invalid component data', async () => {
            const invalidData = {
                components: 'not an array',
                violations: [],
            };

            mockPage.evaluate.mockResolvedValueOnce(true); // Bundle check
            mockPage.evaluate.mockResolvedValueOnce(invalidData); // Scan

            const result = await Effect.runPromise(service.scan(mockPage));

            expect(result.components).toEqual([]);
        });

        it('should handle invalid violations data', async () => {
            const invalidData = {
                components: [],
                violations: 'not an array',
            };

            mockPage.evaluate.mockResolvedValueOnce(true); // Bundle check
            mockPage.evaluate.mockResolvedValueOnce(invalidData); // Scan

            const result = await Effect.runPromise(service.scan(mockPage));

            expect(result.violations).toEqual([]);
        });
    });

    describe('createScannerService', () => {
        it('should create a new ScannerService instance', () => {
            const service = createScannerService();
            expect(service).toBeInstanceOf(ScannerService);
        });

        it('should accept custom bundle path', () => {
            const service = createScannerService('/custom/path.js');
            expect(service).toBeInstanceOf(ScannerService);
        });
    });
});
