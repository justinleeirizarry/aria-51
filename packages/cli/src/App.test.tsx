/**
 * Integration tests for App.tsx orchestration logic
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Effect } from 'effect';
import App from './App.js';

// Mock functions - defined at module level for hoisting
const mockRunScanAsPromise = vi.hoisted(() => vi.fn());
const mockGenerateAndExport = vi.hoisted(() => vi.fn());
const mockTestGenService = vi.hoisted(() => ({
    init: vi.fn(),
    navigateTo: vi.fn(),
    discoverElements: vi.fn(),
    generateTest: vi.fn(),
    close: vi.fn(),
}));

vi.mock('@aria51/core', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as object,
        runScanAsPromise: mockRunScanAsPromise,
        AppLayer: {},
        generateAndExport: mockGenerateAndExport,
    };
});

vi.mock('@aria51/ai-auditor', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as object,
        createTestGenerationService: vi.fn(() => mockTestGenService),
    };
});

vi.mock(import('fs/promises'), async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        default: actual.default ?? actual,
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
    };
});

import type { ScanResults } from '@aria51/core';
import type { TestGenerationResults } from '@aria51/ai-auditor';

describe('App Component', () => {
    // Store original process.exitCode
    let originalExitCode: typeof process.exitCode;

    beforeEach(() => {
        vi.resetAllMocks();
        originalExitCode = process.exitCode;
        process.exitCode = undefined;
        // Reset test generation service mocks to return Effects
        mockTestGenService.init.mockReturnValue(Effect.succeed(undefined));
        mockTestGenService.navigateTo.mockReturnValue(Effect.succeed(undefined));
        mockTestGenService.discoverElements.mockReturnValue(Effect.succeed([]));
        mockTestGenService.generateTest.mockReturnValue(Effect.succeed('// test content'));
        mockTestGenService.close.mockReturnValue(Effect.succeed(undefined));
    });

    afterEach(() => {
        process.exitCode = originalExitCode as number | undefined;
    });

    const createMockScanResults = (violationCount: number = 0): ScanResults => ({
        url: 'http://example.com',
        timestamp: new Date().toISOString(),
        browser: 'chromium',
        components: [{ name: 'App', type: 'component', path: ['App'] }],
        violations: Array(violationCount).fill(null).map((_, i) => ({
            id: `violation-${i}`,
            impact: 'serious' as const,
            description: `Violation ${i}`,
            help: 'Fix it',
            helpUrl: 'http://example.com',
            tags: ['wcag2aa'],
            nodes: [{
                component: 'Button',
                componentPath: ['App', 'Button'],
                userComponentPath: ['Button'],
                componentType: 'component' as const,
                html: '<button></button>',
                htmlSnippet: '<button>',
                cssSelector: 'button',
                target: ['button'],
                failureSummary: 'Missing label',
                isFrameworkComponent: false
            }]
        })),
        summary: {
            totalComponents: 1,
            totalViolations: violationCount,
            totalPasses: 10,
            totalIncomplete: 0,
            totalInapplicable: 5,
            violationsBySeverity: {
                critical: 0,
                serious: violationCount,
                moderate: 0,
                minor: 0
            },
            componentsWithViolations: violationCount > 0 ? 1 : 0
        }
    });

    const createMockTestGenResults = (success: boolean = true): TestGenerationResults => ({
        url: 'http://example.com',
        timestamp: new Date().toISOString(),
        outputFile: 'test.spec.ts',
        elementsDiscovered: 5,
        elements: [
            { selector: '#btn', description: 'Submit button', type: 'button' }
        ],
        success,
        error: success ? undefined : 'Test generation failed'
    });

    // Helper to create mock performScan response
    const createMockScanResponse = (results: ScanResults, ciPassed?: boolean) => ({
        results,
        ciPassed,
    });

    describe('Scan Mode', () => {
        it('should call runScanAsPromise with correct options', async () => {
            const mockResults = createMockScanResults(0);
            mockRunScanAsPromise.mockResolvedValue(createMockScanResponse(mockResults));

            const { lastFrame, unmount } = render(
                <App
                    mode="scan"
                    url="http://localhost:3000"
                    browser="chromium"
                    ci={false}
                    threshold={0}
                    headless={true}
                    tags={['wcag2a', 'wcag2aa']}
                    keyboardNav={true}
                />
            );

            // Wait for async scan to complete
            await vi.waitFor(() => {
                expect(mockRunScanAsPromise).toHaveBeenCalled();
            }, { timeout: 1000 });

            expect(mockRunScanAsPromise).toHaveBeenCalledWith({
                url: 'http://localhost:3000',
                browser: 'chromium',
                headless: true,
                tags: ['wcag2a', 'wcag2aa'],
                includeKeyboardTests: true,
                outputFile: undefined,
                ciMode: false,
                ciThreshold: 0,
                componentBundlePath: undefined,
            }, expect.anything());

            unmount();
        });

        it('should pass componentBundlePath when components prop is true', async () => {
            const mockResults = createMockScanResults(0);
            mockRunScanAsPromise.mockResolvedValue(createMockScanResponse(mockResults));

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://localhost:3000"
                    browser="chromium"
                    ci={false}
                    threshold={0}
                    headless={true}
                    components={true}
                />
            );

            await vi.waitFor(() => {
                expect(mockRunScanAsPromise).toHaveBeenCalled();
            }, { timeout: 1000 });

            expect(mockRunScanAsPromise).toHaveBeenCalledWith(
                expect.objectContaining({
                    componentBundlePath: expect.stringContaining('component-bundle.js'),
                }),
                expect.anything()
            );

            unmount();
        });

        it('should complete scan and receive results', async () => {
            const mockResults = createMockScanResults(2);
            mockRunScanAsPromise.mockResolvedValue(createMockScanResponse(mockResults));

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="chromium"
                    ci={false}
                    threshold={0}
                    headless={true}
                />
            );

            await vi.waitFor(() => {
                expect(mockRunScanAsPromise).toHaveBeenCalled();
            }, { timeout: 1000 });

            unmount();
        });

        it('should handle scan errors gracefully', async () => {
            mockRunScanAsPromise.mockRejectedValue(new Error('Network error'));

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="chromium"
                    ci={true}
                    threshold={0}
                    headless={true}
                />
            );

            await vi.waitFor(() => {
                expect(process.exitCode).toBe(1);
            }, { timeout: 2000 });

            unmount();
        });
    });

    describe('CI Mode', () => {
        it('should set exit code 1 when violations exceed threshold', async () => {
            const mockResults = createMockScanResults(5);
            mockRunScanAsPromise.mockResolvedValue(createMockScanResponse(mockResults, false));

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="chromium"
                    ci={true}
                    threshold={2}
                    headless={true}
                />
            );

            await vi.waitFor(() => {
                expect(process.exitCode).toBe(1);
            }, { timeout: 2000 });

            unmount();
        });

        it('should set exit code 0 when violations are within threshold', async () => {
            const mockResults = createMockScanResults(2);
            mockRunScanAsPromise.mockResolvedValue(createMockScanResponse(mockResults, true));

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="chromium"
                    ci={true}
                    threshold={5}
                    headless={true}
                />
            );

            await vi.waitFor(() => {
                expect(process.exitCode).toBe(0);
            }, { timeout: 2000 });

            unmount();
        });

        it('should set exit code 1 on scan error in CI mode', async () => {
            mockRunScanAsPromise.mockRejectedValue(new Error('Scan failed'));

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="chromium"
                    ci={true}
                    threshold={0}
                    headless={true}
                />
            );

            await vi.waitFor(() => {
                expect(process.exitCode).toBe(1);
            }, { timeout: 2000 });

            unmount();
        });
    });

    describe('Output File', () => {
        it('should pass output file to performScan when specified', async () => {
            const mockResults = createMockScanResults(1);
            mockRunScanAsPromise.mockResolvedValue({ results: mockResults, outputFile: 'report.json' });

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="chromium"
                    ci={false}
                    threshold={0}
                    headless={true}
                    output="report.json"
                />
            );

            await vi.waitFor(() => {
                expect(mockRunScanAsPromise).toHaveBeenCalledWith(
                    expect.objectContaining({ outputFile: 'report.json' }),
                    expect.anything()
                );
            }, { timeout: 2000 });

            unmount();
        });

        it('should pass nested output path to performScan', async () => {
            const mockResults = createMockScanResults(0);
            mockRunScanAsPromise.mockResolvedValue({ results: mockResults, outputFile: 'reports/a11y/report.json' });

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="chromium"
                    ci={false}
                    threshold={0}
                    headless={true}
                    output="reports/a11y/report.json"
                />
            );

            await vi.waitFor(() => {
                expect(mockRunScanAsPromise).toHaveBeenCalledWith(
                    expect.objectContaining({ outputFile: 'reports/a11y/report.json' }),
                    expect.anything()
                );
            }, { timeout: 2000 });

            unmount();
        });
    });

    describe('AI Prompt Generation', () => {
        it('should generate AI prompt when --ai flag is set', async () => {
            const mockResults = createMockScanResults(3);
            mockRunScanAsPromise.mockResolvedValue(createMockScanResponse(mockResults));
            mockGenerateAndExport.mockReturnValue('a11y-prompt.md');

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="chromium"
                    ci={false}
                    threshold={0}
                    headless={true}
                    ai={true}
                />
            );

            await vi.waitFor(() => {
                expect(mockGenerateAndExport).toHaveBeenCalledWith(
                    expect.objectContaining({
                        violations: expect.any(Array),
                        summary: expect.any(Object)
                    }),
                    expect.objectContaining({
                        template: 'fix-all',
                        format: 'md'
                    })
                );
            }, { timeout: 2000 });

            unmount();
        });
    });

    describe('Test Generation Mode', () => {
        it('should call test generation service with correct options', async () => {
            mockTestGenService.discoverElements.mockReturnValue(Effect.succeed([
                { selector: '#btn', description: 'Submit button', type: 'button' }
            ]));

            const { unmount } = render(
                <App
                    mode="generate-test"
                    url="http://example.com"
                    browser="chromium"
                    ci={false}
                    threshold={0}
                    headless={true}
                    generateTest={true}
                    testFile="tests/a11y.spec.ts"
                    stagehandModel="openai/gpt-4o"
                    stagehandVerbose={true}
                />
            );

            await vi.waitFor(() => {
                expect(mockTestGenService.init).toHaveBeenCalledWith({
                    model: 'openai/gpt-4o',
                    verbose: true
                });
                expect(mockTestGenService.navigateTo).toHaveBeenCalledWith('http://example.com');
                expect(mockTestGenService.discoverElements).toHaveBeenCalled();
                expect(mockTestGenService.generateTest).toHaveBeenCalledWith(
                    'http://example.com',
                    expect.any(Array)
                );
            }, { timeout: 2000 });

            unmount();
        });

        it('should handle test generation errors', async () => {
            mockTestGenService.discoverElements.mockReturnValue(Effect.fail(new Error('Stagehand failed')));

            const { unmount } = render(
                <App
                    mode="generate-test"
                    url="http://example.com"
                    browser="chromium"
                    ci={false}
                    threshold={0}
                    headless={true}
                    generateTest={true}
                    testFile="test.spec.ts"
                />
            );

            await vi.waitFor(() => {
                expect(process.exitCode).toBe(1);
            }, { timeout: 2000 });

            unmount();
        });

        it('should display test generation results on success', async () => {
            mockTestGenService.discoverElements.mockReturnValue(Effect.succeed([
                { selector: '#btn', description: 'Submit button', type: 'button' }
            ]));

            const { lastFrame, unmount } = render(
                <App
                    mode="generate-test"
                    url="http://example.com"
                    browser="chromium"
                    ci={false}
                    threshold={0}
                    headless={true}
                    generateTest={true}
                    testFile="test.spec.ts"
                />
            );

            await vi.waitFor(() => {
                const frame = lastFrame();
                // Should show success or file path
                expect(frame).toBeDefined();
            }, { timeout: 2000 });

            unmount();
        });
    });

    describe('Browser Options', () => {
        it('should support firefox browser', async () => {
            const mockResults = createMockScanResults(0);
            mockRunScanAsPromise.mockResolvedValue(createMockScanResponse(mockResults));

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="firefox"
                    ci={false}
                    threshold={0}
                    headless={true}
                />
            );

            await vi.waitFor(() => {
                expect(mockRunScanAsPromise).toHaveBeenCalledWith(
                    expect.objectContaining({ browser: 'firefox' }),
                    expect.anything()
                );
            }, { timeout: 2000 });

            unmount();
        });

        it('should support webkit browser', async () => {
            const mockResults = createMockScanResults(0);
            mockRunScanAsPromise.mockResolvedValue(createMockScanResponse(mockResults));

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="webkit"
                    ci={false}
                    threshold={0}
                    headless={true}
                />
            );

            await vi.waitFor(() => {
                expect(mockRunScanAsPromise).toHaveBeenCalledWith(
                    expect.objectContaining({ browser: 'webkit' }),
                    expect.anything()
                );
            }, { timeout: 2000 });

            unmount();
        });

        it('should pass headless=false when specified', async () => {
            const mockResults = createMockScanResults(0);
            mockRunScanAsPromise.mockResolvedValue(createMockScanResponse(mockResults));

            const { unmount } = render(
                <App
                    mode="scan"
                    url="http://example.com"
                    browser="chromium"
                    ci={false}
                    threshold={0}
                    headless={false}
                />
            );

            await vi.waitFor(() => {
                expect(mockRunScanAsPromise).toHaveBeenCalledWith(
                    expect.objectContaining({ headless: false }),
                    expect.anything()
                );
            }, { timeout: 2000 });

            unmount();
        });
    });
});
