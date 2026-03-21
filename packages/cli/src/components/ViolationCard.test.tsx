import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { ViolationCard } from './ViolationCard.js';
import type { AttributedViolation } from '@aria51/core';

// Mock the core package suggestions module
vi.mock('@aria51/core', async () => {
    const actual = await vi.importActual('@aria51/core');
    return {
        ...actual,
    };
});

describe('ViolationCard Component', () => {
    const createMockViolation = (overrides?: Partial<AttributedViolation>): AttributedViolation => ({
        id: 'button-name',
        impact: 'serious',
        description: 'Buttons must have discernible text',
        help: 'Ensure buttons have discernible text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/button-name',
        tags: ['wcag2a', 'wcag412', 'section508'],
        nodes: [
            {
                component: 'SubmitButton',
                componentPath: ['App', 'Form', 'SubmitButton'],
                userComponentPath: ['Form', 'SubmitButton'],
                componentType: 'component',
                html: '<button class="submit-btn"></button>',
                htmlSnippet: '<button class="submit-btn">',
                cssSelector: '.submit-btn',
                target: ['.submit-btn'],
                failureSummary: 'Fix any of the following: Button has no text',
                isFrameworkComponent: false,
            },
        ],
        ...overrides,
    });

    it('renders violation id and impact', () => {
        const violation = createMockViolation();
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('button-name');
        expect(output).toContain('SERIOUS');
    });

    it('renders different impact levels with correct labels', () => {
        const impacts: Array<'critical' | 'serious' | 'moderate' | 'minor'> = [
            'critical',
            'serious',
            'moderate',
            'minor',
        ];

        for (const impact of impacts) {
            const violation = createMockViolation({ impact });
            const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
            const output = lastFrame() || '';
            expect(output).toContain(impact.toUpperCase());
        }
    });

    it('renders WCAG tags', () => {
        const violation = createMockViolation({
            tags: ['wcag2a', 'wcag21aa', 'best-practice'],
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('wcag2a');
        expect(output).toContain('wcag21aa');
        expect(output).toContain('best-practice');
    });

    it('renders violation description', () => {
        const violation = createMockViolation({
            description: 'Images must have alternate text',
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('Images must have alternate text');
    });

    it('renders help URL', () => {
        const violation = createMockViolation({
            helpUrl: 'https://example.com/help',
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('https://example.com/help');
        expect(output).toContain('Docs:');
    });

    it('renders instance count', () => {
        const violation = createMockViolation({
            nodes: [
                {
                    component: 'Button1',
                    componentPath: ['App', 'Button1'],
                    userComponentPath: ['Button1'],
                    componentType: 'component',
                    html: '<button></button>',
                    htmlSnippet: '<button>',
                    cssSelector: '.btn1',
                    target: ['.btn1'],
                    failureSummary: 'Missing text',
                    isFrameworkComponent: false,
                },
                {
                    component: 'Button2',
                    componentPath: ['App', 'Button2'],
                    userComponentPath: ['Button2'],
                    componentType: 'component',
                    html: '<button></button>',
                    htmlSnippet: '<button>',
                    cssSelector: '.btn2',
                    target: ['.btn2'],
                    failureSummary: 'Missing text',
                    isFrameworkComponent: false,
                },
            ],
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('2 instances');
    });

    it('renders singular instance when only one', () => {
        const violation = createMockViolation();
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('1 instance');
        expect(output).not.toContain('1 instances');
    });

    it('renders component name from userComponentPath', () => {
        const violation = createMockViolation({
            nodes: [
                {
                    component: 'x',
                    componentPath: ['App', 'Framework', 'MyButton'],
                    userComponentPath: ['MyButton'],
                    componentType: 'component',
                    html: '<button></button>',
                    htmlSnippet: '<button>',
                    cssSelector: '.my-btn',
                    target: ['.my-btn'],
                    failureSummary: 'Missing text',
                    isFrameworkComponent: false,
                },
            ],
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('MyButton');
    });

    it('renders fix suggestion when available', () => {
        const violation = createMockViolation({
            fixSuggestion: {
                summary: 'Add an aria-label attribute',
                details: 'The button needs accessible text',
                userImpact: 'Screen reader users cannot identify the button',
            },
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('How to Fix');
        expect(output).toContain('Add an aria-label attribute');
    });

    it('renders user impact when available', () => {
        const violation = createMockViolation({
            fixSuggestion: {
                summary: 'Add alt text',
                details: 'Images need descriptions',
                userImpact: 'Blind users cannot understand the image',
            },
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('Impact:');
        expect(output).toContain('Blind users cannot understand the image');
    });

    it('renders CSS selector for each instance', () => {
        const violation = createMockViolation({
            nodes: [
                {
                    component: 'TestComponent',
                    componentPath: ['TestComponent'],
                    userComponentPath: ['TestComponent'],
                    componentType: 'component',
                    html: '<div></div>',
                    htmlSnippet: '<div>',
                    cssSelector: '#unique-selector',
                    target: ['#unique-selector'],
                    failureSummary: 'Missing role',
                    isFrameworkComponent: false,
                },
            ],
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('#unique-selector');
    });

    it('renders violation index', () => {
        const violation = createMockViolation();
        const { lastFrame } = render(<ViolationCard violation={violation} index={5} />);
        const output = lastFrame() || '';

        expect(output).toContain('5.');
    });

    it('handles violations without helpUrl gracefully', () => {
        const violation = createMockViolation({
            helpUrl: '',
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        // Should still render without crashing
        expect(output).toContain('button-name');
    });

    it('filters out minified and anonymous component names', () => {
        const violation = createMockViolation({
            nodes: [
                {
                    component: 'x',
                    componentPath: ['x', '__internal', 'Anonymous', 'RealComponent'],
                    userComponentPath: ['RealComponent'],
                    componentType: 'component',
                    html: '<button></button>',
                    htmlSnippet: '<button>',
                    cssSelector: '.btn',
                    target: ['.btn'],
                    failureSummary: 'Missing text',
                    isFrameworkComponent: false,
                },
            ],
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        expect(output).toContain('RealComponent');
        expect(output).not.toContain('Anonymous');
        expect(output).not.toContain('__internal');
    });

    it('limits displayed WCAG tags to 4', () => {
        const violation = createMockViolation({
            tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
        });
        const { lastFrame } = render(<ViolationCard violation={violation} index={1} />);
        const output = lastFrame() || '';

        // Should show at most 4 WCAG-related tags
        const wcagMatches = output.match(/\[wcag/g) || [];
        expect(wcagMatches.length).toBeLessThanOrEqual(4);
    });
});
