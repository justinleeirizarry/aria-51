import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect } from 'effect';
import { ResultsProcessorService, createResultsProcessorService } from './ResultsProcessorService.js';
import type { BrowserScanData, AttributedViolation } from '../../types.js';

// Mock formatters
vi.mock('../../prompts/formatters.js', () => ({
    formatViolations: vi.fn(() => 'Formatted violations'),
}));

describe('ResultsProcessorService', () => {
    let service: ResultsProcessorService;

    const mockViolation: AttributedViolation = {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must have sufficient color contrast',
        help: 'Color contrast insufficient',
        helpUrl: 'https://example.com',
        tags: ['wcag2aa', 'wcag143'],
        nodes: [
            {
                component: 'Button',
                componentPath: ['App', 'Button'],
                userComponentPath: ['Button'],
                componentType: 'component',
                html: '<button>Click</button>',
                htmlSnippet: '<button>Click</button>',
                cssSelector: 'button.primary',
                target: ['button.primary'],
                failureSummary: 'Color contrast is 2.5:1',
                isFrameworkComponent: false,
            },
        ],
    };

    const mockScanData: BrowserScanData = {
        components: [
            { name: 'App', type: 'component', path: [] },
            { name: 'Button', type: 'component', path: ['App'] },
        ],
        violations: [mockViolation],
        keyboardTests: {
            tabOrder: {
                totalFocusableElements: 5,
                tabOrder: [],
                violations: [],
                visualOrderMismatches: [],
            },
            focusManagement: {
                focusIndicatorIssues: [],
                skipLinksWorking: true,
                skipLinkDetails: '',
                focusRestorationTests: [],
            },
            shortcuts: {
                tests: [],
                customWidgets: [],
            },
            summary: {
                totalIssues: 2,
                criticalIssues: 0,
                seriousIssues: 1,
                moderateIssues: 1,
            },
        },
        accessibilityTree: { children: [] },
    };

    beforeEach(() => {
        service = new ResultsProcessorService();
    });

    describe('process', () => {
        it('should transform raw data into ScanResults', () => {
            const result = Effect.runSync(
                service.process(mockScanData, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            expect(result.url).toBe('http://localhost:3000');
            expect(result.browser).toBe('chromium');
            expect(result.timestamp).toBeDefined();
            expect(result.components).toEqual(mockScanData.components);

            // Violations are enriched with WCAG criteria, so check structure instead of exact equality
            expect(result.violations).toHaveLength(1);
            expect(result.violations[0].id).toBe('color-contrast');
            expect(result.violations[0].impact).toBe('serious');
            expect(result.violations[0].nodes).toEqual(mockViolation.nodes);

            // Verify WCAG criteria enrichment
            expect(result.violations[0].wcagCriteria).toBeDefined();
            expect(result.violations[0].wcagCriteria).toHaveLength(1);
            expect(result.violations[0].wcagCriteria![0].id).toBe('1.4.3');
            expect(result.violations[0].wcagCriteria![0].title).toBe('Contrast (Minimum)');
            expect(result.violations[0].wcagCriteria![0].level).toBe('AA');
        });

        it('should calculate summary correctly', () => {
            const result = Effect.runSync(
                service.process(mockScanData, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            expect(result.summary.totalComponents).toBe(2);
            expect(result.summary.totalViolations).toBe(1);
            expect(result.summary.componentsWithViolations).toBe(1);
            expect(result.summary.violationsBySeverity.serious).toBe(1);
        });

        it('should include keyboard issues in summary', () => {
            const result = Effect.runSync(
                service.process(mockScanData, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            expect(result.summary.keyboardIssues).toBe(2);
        });

        it('should use provided timestamp if available', () => {
            const result = Effect.runSync(
                service.process(mockScanData, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                    timestamp: '2024-01-01T00:00:00.000Z',
                })
            );

            expect(result.timestamp).toBe('2024-01-01T00:00:00.000Z');
        });

        it('should handle multiple violations of same severity', () => {
            const dataWithMultiple: BrowserScanData = {
                ...mockScanData,
                violations: [
                    { ...mockViolation, impact: 'critical' },
                    {
                        ...mockViolation,
                        id: 'image-alt',
                        impact: 'critical',
                        nodes: [
                            { ...mockViolation.nodes[0], component: 'Image' },
                            { ...mockViolation.nodes[0], component: 'Logo' },
                        ],
                    },
                ],
            };

            const result = Effect.runSync(
                service.process(dataWithMultiple, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            expect(result.summary.totalViolations).toBe(3); // 1 + 2 nodes
            expect(result.summary.violationsBySeverity.critical).toBe(3);
            expect(result.summary.componentsWithViolations).toBe(3); // Button, Image, Logo
        });
    });

    describe('formatAsJSON', () => {
        it('should return pretty JSON by default', () => {
            const scanResult = Effect.runSync(
                service.process(mockScanData, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            const json = Effect.runSync(service.formatAsJSON(scanResult));

            expect(json).toContain('\n');
            expect(json).toContain('  ');
        });

        it('should return compact JSON when pretty=false', () => {
            const scanResult = Effect.runSync(
                service.process(mockScanData, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            const json = Effect.runSync(service.formatAsJSON(scanResult, false));

            expect(json).not.toContain('\n');
        });

        it('should handle circular references', () => {
            const circular: any = { a: 1 };
            circular.self = circular;

            const scanResult = Effect.runSync(
                service.process(
                    { ...mockScanData, accessibilityTree: circular },
                    { url: 'http://localhost:3000', browser: 'chromium' }
                )
            );

            // Should not throw
            const json = Effect.runSync(service.formatAsJSON(scanResult));
            expect(json).toContain('[Circular Reference]');
        });
    });

    describe('formatForMCP', () => {
        it('should return MCP-formatted content', () => {
            const scanResult = Effect.runSync(
                service.process(mockScanData, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            const content = Effect.runSync(service.formatForMCP(scanResult));

            expect(content.length).toBeGreaterThanOrEqual(1);
            expect(content[0].type).toBe('text');
            expect(content[0].text).toContain('Scan Complete');
            expect(content[0].text).toContain('axe-core violations');
        });

        it('should include accessibility tree when requested', () => {
            const scanResult = Effect.runSync(
                service.process(mockScanData, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            const content = Effect.runSync(service.formatForMCP(scanResult, { includeTree: true }));

            const treeBlock = content.find(c => c.text.includes('Accessibility Tree'));
            expect(treeBlock).toBeDefined();
        });

        it('should handle zero violations', () => {
            const noViolations: BrowserScanData = {
                ...mockScanData,
                violations: [],
            };

            const scanResult = Effect.runSync(
                service.process(noViolations, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            const content = Effect.runSync(service.formatForMCP(scanResult));

            const allText = content.map(c => c.text).join('\n');
            expect(allText).toContain('No axe-core violations found');
        });
    });

    describe('formatForCI', () => {
        it('should return passed when violations <= threshold', () => {
            const scanResult = Effect.runSync(
                service.process(mockScanData, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            const ci = Effect.runSync(service.formatForCI(scanResult, 5));

            expect(ci.passed).toBe(true);
            expect(ci.totalViolations).toBe(1);
            expect(ci.threshold).toBe(5);
            expect(ci.message).toContain('Passed');
        });

        it('should return failed when violations > threshold', () => {
            const scanResult = Effect.runSync(
                service.process(mockScanData, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            const ci = Effect.runSync(service.formatForCI(scanResult, 0));

            expect(ci.passed).toBe(false);
            expect(ci.message).toContain('Failed');
        });

        it('should include critical violation count', () => {
            const dataWithCritical: BrowserScanData = {
                ...mockScanData,
                violations: [{ ...mockViolation, impact: 'critical' }],
            };

            const scanResult = Effect.runSync(
                service.process(dataWithCritical, {
                    url: 'http://localhost:3000',
                    browser: 'chromium',
                })
            );

            const ci = Effect.runSync(service.formatForCI(scanResult, 5));

            expect(ci.criticalViolations).toBe(1);
        });
    });

    describe('createResultsProcessorService', () => {
        it('should create a new ResultsProcessorService instance', () => {
            const service = createResultsProcessorService();
            expect(service).toBeInstanceOf(ResultsProcessorService);
        });
    });
});
