/**
 * Effect Schema tests
 *
 * Tests for:
 * 1. Roundtrip validation — existing test fixtures decode successfully
 * 2. Rejection — invalid data is caught by schemas
 * 3. Decoder functions — strict and lenient decoders work correctly
 */
import { describe, it, expect } from 'vitest';
import { Schema, Effect } from 'effect';
import {
    ImpactLevel,
    SeverityLevel,
    WcagLevel,
    WcagPrinciple,
    BrowserType,
    WcagCriterionId,
    WcagCriterionInfo,
    AxeCheckResult,
    AxeNodeResult,
    AxeResult,
    AxeViolation,
    RelatedNode,
    AttributedCheck,
    FixSuggestion,
    AttributedViolation,
    AttributedPass,
    AttributedIncomplete,
    InapplicableRule,
    WCAG22ViolationId,
    WCAG22ViolationSummary,
    WCAG22Results,
    TargetSizeViolation,
    FocusObscuredViolation,
    KeyboardTestResults,
    ComponentInfo,
    BrowserScanData,
    ScanResults,
    ScanError,
} from './index.js';
import { decodeBrowserScanData, decodeBrowserScanDataLenient } from './decode.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const validViolationNode = {
    component: 'Button',
    componentPath: ['App', 'Form', 'Button'],
    userComponentPath: ['App', 'Form', 'Button'],
    componentType: 'component' as const,
    html: '<button>Click</button>',
    htmlSnippet: '<button>Click</button>',
    cssSelector: 'button.submit',
    target: ['button.submit'],
    failureSummary: 'Fix all of the following: Element has no accessible name',
    isFrameworkComponent: false,
};

const validAttributedViolation = {
    id: 'button-name',
    impact: 'serious' as const,
    description: 'Buttons must have discernible text',
    help: 'Buttons must have discernible text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/button-name',
    tags: ['wcag2a', 'wcag412', 'section508'],
    nodes: [validViolationNode],
};

const validBrowserScanData = {
    components: [],
    violations: [validAttributedViolation],
    passes: [{
        id: 'color-contrast',
        impact: null,
        description: 'Text has sufficient color contrast',
        help: 'Elements must have sufficient color contrast',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/color-contrast',
        tags: ['wcag2aa', 'wcag143'],
        nodes: [{
            component: null,
            html: '<p>Hello</p>',
            htmlSnippet: '<p>Hello</p>',
            target: ['p'],
        }],
    }],
    incomplete: [],
};

// ============================================================================
// Primitive Schema Tests
// ============================================================================

describe('Primitive Schemas', () => {
    it('accepts valid impact levels', () => {
        const decode = Schema.decodeUnknownSync(ImpactLevel);
        expect(decode('critical')).toBe('critical');
        expect(decode('serious')).toBe('serious');
        expect(decode('moderate')).toBe('moderate');
        expect(decode('minor')).toBe('minor');
    });

    it('rejects invalid impact levels', () => {
        const decode = Schema.decodeUnknownSync(ImpactLevel);
        expect(() => decode('high')).toThrow();
        expect(() => decode('')).toThrow();
        expect(() => decode(42)).toThrow();
    });

    it('accepts valid WCAG levels', () => {
        const decode = Schema.decodeUnknownSync(WcagLevel);
        expect(decode('A')).toBe('A');
        expect(decode('AA')).toBe('AA');
        expect(decode('AAA')).toBe('AAA');
    });

    it('rejects invalid WCAG levels', () => {
        const decode = Schema.decodeUnknownSync(WcagLevel);
        expect(() => decode('AAAA')).toThrow();
        expect(() => decode('a')).toThrow();
    });

    it('accepts valid severity levels', () => {
        const decode = Schema.decodeUnknownSync(SeverityLevel);
        expect(decode('critical')).toBe('critical');
        expect(decode('serious')).toBe('serious');
        expect(decode('moderate')).toBe('moderate');
    });

    it('rejects minor as a severity level', () => {
        const decode = Schema.decodeUnknownSync(SeverityLevel);
        expect(() => decode('minor')).toThrow();
    });

    it('accepts valid WCAG principles', () => {
        const decode = Schema.decodeUnknownSync(WcagPrinciple);
        expect(decode('Perceivable')).toBe('Perceivable');
        expect(decode('Operable')).toBe('Operable');
        expect(decode('Understandable')).toBe('Understandable');
        expect(decode('Robust')).toBe('Robust');
    });

    it('accepts valid browser types', () => {
        const decode = Schema.decodeUnknownSync(BrowserType);
        expect(decode('chromium')).toBe('chromium');
        expect(decode('firefox')).toBe('firefox');
        expect(decode('webkit')).toBe('webkit');
    });
});

// ============================================================================
// WCAG Schema Tests
// ============================================================================

describe('WCAG Schemas', () => {
    it('accepts valid WCAG criterion IDs', () => {
        const decode = Schema.decodeUnknownSync(WcagCriterionId);
        expect(decode('1.1.1')).toBe('1.1.1');
        expect(decode('1.4.3')).toBe('1.4.3');
        expect(decode('4.1.3')).toBe('4.1.3');
        expect(decode('2.5.8')).toBe('2.5.8');
    });

    it('rejects invalid WCAG criterion IDs', () => {
        const decode = Schema.decodeUnknownSync(WcagCriterionId);
        expect(() => decode('9.9.9')).toThrow();
        expect(() => decode('foo')).toThrow();
        expect(() => decode('')).toThrow();
    });

    it('accepts valid WcagCriterionInfo', () => {
        const decode = Schema.decodeUnknownSync(WcagCriterionInfo);
        const result = decode({
            id: '1.4.3',
            title: 'Contrast (Minimum)',
            level: 'AA',
            principle: 'Perceivable',
            w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
        });
        expect(result.id).toBe('1.4.3');
        expect(result.level).toBe('AA');
    });

    it('rejects WcagCriterionInfo with invalid criterion ID', () => {
        const decode = Schema.decodeUnknownSync(WcagCriterionInfo);
        expect(() => decode({
            id: '99.99.99',
            title: 'Fake',
            level: 'AA',
            principle: 'Perceivable',
            w3cUrl: 'https://example.com',
        })).toThrow();
    });
});

// ============================================================================
// Axe Schema Tests
// ============================================================================

describe('Axe Schemas', () => {
    it('accepts valid AxeCheckResult', () => {
        const decode = Schema.decodeUnknownSync(AxeCheckResult);
        const result = decode({
            id: 'color-contrast',
            impact: 'serious',
            message: 'Element has insufficient color contrast',
        });
        expect(result.id).toBe('color-contrast');
        expect(result.impact).toBe('serious');
    });

    it('accepts AxeCheckResult with null impact', () => {
        const decode = Schema.decodeUnknownSync(AxeCheckResult);
        const result = decode({
            id: 'has-visible-text',
            impact: null,
            message: 'Element has visible text',
        });
        expect(result.impact).toBeNull();
    });

    it('accepts valid AxeViolation (requires non-null impact)', () => {
        const decode = Schema.decodeUnknownSync(AxeViolation);
        const result = decode({
            id: 'button-name',
            impact: 'critical',
            description: 'Buttons must have discernible text',
            help: 'Help text',
            helpUrl: 'https://example.com',
            tags: ['wcag2a'],
            nodes: [{
                html: '<button></button>',
                target: ['button'],
            }],
        });
        expect(result.impact).toBe('critical');
    });

    it('rejects AxeViolation with null impact', () => {
        const decode = Schema.decodeUnknownSync(AxeViolation);
        expect(() => decode({
            id: 'button-name',
            impact: null,
            description: 'desc',
            help: 'help',
            helpUrl: 'url',
            tags: [],
            nodes: [],
        })).toThrow();
    });
});

// ============================================================================
// Violation Schema Tests
// ============================================================================

describe('Violation Schemas', () => {
    it('accepts valid AttributedViolation', () => {
        const decode = Schema.decodeUnknownSync(AttributedViolation);
        const result = decode(validAttributedViolation);
        expect(result.id).toBe('button-name');
        expect(result.impact).toBe('serious');
        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].component).toBe('Button');
    });

    it('rejects AttributedViolation with missing nodes', () => {
        const decode = Schema.decodeUnknownSync(AttributedViolation);
        expect(() => decode({
            ...validAttributedViolation,
            nodes: undefined,
        })).toThrow();
    });

    it('rejects AttributedViolation with invalid impact', () => {
        const decode = Schema.decodeUnknownSync(AttributedViolation);
        expect(() => decode({
            ...validAttributedViolation,
            impact: 'high',
        })).toThrow();
    });

    it('accepts valid AttributedPass', () => {
        const decode = Schema.decodeUnknownSync(AttributedPass);
        const result = decode({
            id: 'color-contrast',
            impact: null,
            description: 'Elements must have sufficient color contrast',
            help: 'help',
            helpUrl: 'https://example.com',
            tags: ['wcag2aa'],
            nodes: [{
                component: null,
                html: '<p>Text</p>',
                htmlSnippet: '<p>Text</p>',
                target: ['p'],
            }],
        });
        expect(result.id).toBe('color-contrast');
        expect(result.impact).toBeNull();
    });

    it('accepts valid FixSuggestion', () => {
        const decode = Schema.decodeUnknownSync(FixSuggestion);
        const result = decode({
            summary: 'Add an aria-label',
            details: 'The button needs an accessible name',
            wcagCriteria: '4.1.2 Name, Role, Value',
            wcagLevel: 'A',
            priority: 'high',
        });
        expect(result.summary).toBe('Add an aria-label');
        expect(result.priority).toBe('high');
    });

    it('accepts valid InapplicableRule', () => {
        const decode = Schema.decodeUnknownSync(InapplicableRule);
        const result = decode({
            id: 'video-caption',
            description: 'Video elements must have captions',
            help: 'help',
            helpUrl: 'https://example.com',
            tags: ['wcag2a'],
        });
        expect(result.id).toBe('video-caption');
    });
});

// ============================================================================
// WCAG 2.2 Violation Schema Tests
// ============================================================================

describe('WCAG 2.2 Schemas', () => {
    it('accepts valid WCAG 2.2 violation IDs', () => {
        const decode = Schema.decodeUnknownSync(WCAG22ViolationId);
        expect(decode('target-size')).toBe('target-size');
        expect(decode('focus-obscured')).toBe('focus-obscured');
        expect(decode('dragging-movement')).toBe('dragging-movement');
    });

    it('accepts valid TargetSizeViolation', () => {
        const decode = Schema.decodeUnknownSync(TargetSizeViolation);
        const result = decode({
            id: 'target-size',
            criterion: '2.5.8',
            level: 'AA',
            element: 'button',
            selector: 'button.small',
            html: '<button class="small">X</button>',
            impact: 'serious',
            description: 'Target too small',
            details: {
                actualSize: { width: 16, height: 16 },
                requiredSize: { width: 24, height: 24 },
                shortfall: { width: 8, height: 8 },
            },
        });
        expect(result.id).toBe('target-size');
        expect(result.details.actualSize.width).toBe(16);
    });

    it('accepts valid WCAG22ViolationSummary', () => {
        const decode = Schema.decodeUnknownSync(WCAG22ViolationSummary);
        const result = decode({
            id: 'target-size',
            criterion: '2.5.8',
            level: 'AA',
            element: 'button',
            selector: 'button.small',
            html: '<button>X</button>',
            impact: 'moderate',
            description: 'Target too small',
            details: { someKey: 'someValue' },
        });
        expect(result.id).toBe('target-size');
    });

    it('accepts valid WCAG22Results', () => {
        const decode = Schema.decodeUnknownSync(WCAG22Results);
        const result = decode({
            targetSize: [],
            focusObscured: [],
            focusAppearance: [],
            dragging: [],
            authentication: [],
            statusMessages: [],
            errorIdentification: [],
            errorSuggestion: [],
            meaningfulSequence: [],
            reflow: [],
            hoverFocusContent: [],
            sensoryCharacteristics: [],
            identifyPurpose: [],
            visualPresentation: [],
            characterKeyShortcuts: [],
            animationInteractions: [],
            threeFlashes: [],
            sectionHeadings: [],
            pointerGestures: [],
            pointerCancellation: [],
            motionActuation: [],
            onFocus: [],
            onInput: [],
            redundantEntry: [],
            mediaAudioDescription: [],
            mediaLiveCaptions: [],
            mediaSignLanguage: [],
            mediaExtendedAudioDescription: [],
            mediaAlternative: [],
            mediaLiveAudio: [],
            mediaBackgroundAudio: [],
            imagesOfText: [],
            keyboardNoException: [],
            noTiming: [],
            interruptions: [],
            reAuthenticating: [],
            timeouts: [],
            threeFlashesAbsolute: [],
            location: [],
            focusNotObscuredEnhanced: [],
            targetSizeEnhanced: [],
            concurrentInput: [],
            unusualWords: [],
            abbreviations: [],
            readingLevel: [],
            pronunciation: [],
            errorPreventionLegal: [],
            help: [],
            errorPreventionAll: [],
            accessibleAuthEnhanced: [],
            summary: {
                totalViolations: 0,
                byLevel: { A: 0, AA: 0, AAA: 0 },
                byCriterion: {},
            },
        });
        expect(result.summary.totalViolations).toBe(0);
    });
});

// ============================================================================
// Keyboard Schema Tests
// ============================================================================

describe('KeyboardTestResults Schema', () => {
    const validKeyboardResults = {
        tabOrder: {
            totalFocusableElements: 5,
            tabOrder: [{
                selector: 'input#name',
                tabIndex: 0,
                position: { x: 100, y: 200 },
            }],
            violations: [{
                type: 'tab-trap' as const,
                element: 'div.modal',
                details: 'Focus cannot leave the modal',
                severity: 'critical' as const,
            }],
            visualOrderMismatches: [],
        },
        focusManagement: {
            focusIndicatorIssues: [],
            skipLinksWorking: true,
            skipLinkDetails: 'Skip link found and functional',
            focusRestorationTests: [],
        },
        shortcuts: {
            tests: [],
            customWidgets: [],
        },
        summary: {
            totalIssues: 1,
            criticalIssues: 1,
            seriousIssues: 0,
            moderateIssues: 0,
        },
    };

    it('accepts valid keyboard test results', () => {
        const decode = Schema.decodeUnknownSync(KeyboardTestResults);
        const result = decode(validKeyboardResults);
        expect(result.tabOrder.totalFocusableElements).toBe(5);
        expect(result.tabOrder.violations[0].type).toBe('tab-trap');
    });
});

// ============================================================================
// Scan Results Schema Tests
// ============================================================================

describe('Scan Results Schemas', () => {
    it('accepts valid ComponentInfo', () => {
        const decode = Schema.decodeUnknownSync(ComponentInfo);
        const result = decode({
            name: 'Button',
            type: 'component',
            path: ['App', 'Form', 'Button'],
        });
        expect(result.name).toBe('Button');
        expect(result.path).toEqual(['App', 'Form', 'Button']);
    });

    it('accepts valid ScanError', () => {
        const decode = Schema.decodeUnknownSync(ScanError);
        const result = decode({
            phase: 'axe-scan',
            message: 'Scan timed out',
            recoverable: true,
        });
        expect(result.phase).toBe('axe-scan');
    });

    it('rejects ScanError with invalid phase', () => {
        const decode = Schema.decodeUnknownSync(ScanError);
        expect(() => decode({
            phase: 'unknown-phase',
            message: 'error',
            recoverable: true,
        })).toThrow();
    });

    it('accepts valid BrowserScanData', () => {
        const decode = Schema.decodeUnknownSync(BrowserScanData);
        const result = decode(validBrowserScanData);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].id).toBe('button-name');
    });

    it('accepts valid ScanResults', () => {
        const decode = Schema.decodeUnknownSync(ScanResults);
        const result = decode({
            url: 'https://example.com',
            timestamp: '2024-01-01T00:00:00Z',
            browser: 'chromium',
            components: [],
            violations: [validAttributedViolation],
            summary: {
                totalComponents: 0,
                totalViolations: 1,
                totalPasses: 0,
                totalIncomplete: 0,
                totalInapplicable: 0,
                violationsBySeverity: {
                    critical: 0,
                    serious: 1,
                    moderate: 0,
                    minor: 0,
                },
                componentsWithViolations: 0,
            },
        });
        expect(result.url).toBe('https://example.com');
        expect(result.violations).toHaveLength(1);
    });
});

// ============================================================================
// Decode Function Tests
// ============================================================================

describe('Decode Functions', () => {
    it('decodeBrowserScanData succeeds with valid data', async () => {
        const result = await Effect.runPromise(decodeBrowserScanData(validBrowserScanData));
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].id).toBe('button-name');
    });

    it('decodeBrowserScanData fails with invalid data', async () => {
        await expect(
            Effect.runPromise(decodeBrowserScanData({ invalid: true }))
        ).rejects.toThrow();
    });

    it('decodeBrowserScanData fails with invalid impact level', async () => {
        const invalidData = {
            ...validBrowserScanData,
            violations: [{
                ...validAttributedViolation,
                impact: 'high', // invalid
            }],
        };
        await expect(
            Effect.runPromise(decodeBrowserScanData(invalidData))
        ).rejects.toThrow();
    });

    it('decodeBrowserScanDataLenient falls back on invalid data', async () => {
        const invalidData = { components: 'not-array', violations: null };
        // Should not throw — falls back to raw cast
        const result = await Effect.runPromise(decodeBrowserScanDataLenient(invalidData));
        expect(result).toBeDefined();
    });

    it('decodeBrowserScanDataLenient succeeds with valid data', async () => {
        const result = await Effect.runPromise(decodeBrowserScanDataLenient(validBrowserScanData));
        expect(result.violations).toHaveLength(1);
    });
});

// ============================================================================
// Type Compatibility Tests
// ============================================================================

describe('Type Compatibility', () => {
    it('schema-derived types are assignable to expected shapes', () => {
        // These are compile-time checks. If this file compiles, types are compatible.
        const violation: AttributedViolation = {
            id: 'test',
            impact: 'serious',
            description: 'desc',
            help: 'help',
            helpUrl: 'url',
            tags: ['wcag2a'],
            nodes: [{
                component: null,
                componentPath: [],
                userComponentPath: [],
                componentType: null,
                html: '<div></div>',
                htmlSnippet: '<div></div>',
                cssSelector: 'div',
                target: ['div'],
                failureSummary: 'Fix this',
                isFrameworkComponent: false,
            }],
        };

        // Mutable arrays — should be assignable
        violation.tags.push('best-practice');
        violation.nodes[0].componentPath.push('Child');
        expect(violation.tags).toContain('best-practice');

        // Mutable properties — should be assignable
        violation.id = 'updated';
        expect(violation.id).toBe('updated');
    });
});
