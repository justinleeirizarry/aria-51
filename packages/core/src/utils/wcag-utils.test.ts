import { describe, it, expect } from 'vitest';
import {
    countViolationsByWcagLevel,
    addWcag22ToLevelCounts,
    getWcagLevel,
    WcagLevelBreakdown,
} from './wcag-utils.js';
import type { AttributedViolation, WCAG22Results } from '../types.js';

describe('wcag-utils', () => {
    describe('countViolationsByWcagLevel', () => {
        it('counts violations by WCAG level tags', () => {
            const violations: AttributedViolation[] = [
                {
                    id: 'color-contrast',
                    impact: 'serious',
                    description: 'Elements must have sufficient color contrast',
                    help: 'Elements must have sufficient color contrast',
                    helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/color-contrast',
                    tags: ['wcag2aa', 'wcag143'],
                    nodes: [
                        { component: 'Button', componentPath: [], userComponentPath: [], componentType: 'component', html: '<button>', htmlSnippet: '<button>', cssSelector: 'button', target: ['button'], failureSummary: 'Fix contrast', isFrameworkComponent: false },
                        { component: 'Button', componentPath: [], userComponentPath: [], componentType: 'component', html: '<button>', htmlSnippet: '<button>', cssSelector: 'button', target: ['button'], failureSummary: 'Fix contrast', isFrameworkComponent: false },
                    ],
                },
                {
                    id: 'image-alt',
                    impact: 'critical',
                    description: 'Images must have alt text',
                    help: 'Images must have alt text',
                    helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/image-alt',
                    tags: ['wcag2a', 'wcag111'],
                    nodes: [
                        { component: 'Image', componentPath: [], userComponentPath: [], componentType: 'component', html: '<img>', htmlSnippet: '<img>', cssSelector: 'img', target: ['img'], failureSummary: 'Add alt', isFrameworkComponent: false },
                    ],
                },
                {
                    id: 'best-practice-rule',
                    impact: 'minor',
                    description: 'Best practice',
                    help: 'Follow best practices',
                    helpUrl: 'https://example.com',
                    tags: ['best-practice'],
                    nodes: [
                        { component: null, componentPath: [], userComponentPath: [], componentType: null, html: '<div>', htmlSnippet: '<div>', cssSelector: 'div', target: ['div'], failureSummary: 'Consider fixing', isFrameworkComponent: false },
                    ],
                },
            ];

            const result = countViolationsByWcagLevel(violations);

            expect(result.wcag2a).toBe(1);
            expect(result.wcag2aa).toBe(2);
            expect(result.wcag2aaa).toBe(0);
            expect(result.bestPractice).toBe(1);
        });

        it('handles violations with multiple WCAG tags', () => {
            const violations: AttributedViolation[] = [
                {
                    id: 'focus-visible',
                    impact: 'serious',
                    description: 'Focus visible',
                    help: 'Focus must be visible',
                    helpUrl: 'https://example.com',
                    tags: ['wcag2a', 'wcag21aa'], // Both WCAG 2.0 and 2.1
                    nodes: [
                        { component: 'Button', componentPath: [], userComponentPath: [], componentType: 'component', html: '<button>', htmlSnippet: '<button>', cssSelector: 'button', target: ['button'], failureSummary: 'Fix focus', isFrameworkComponent: false },
                    ],
                },
            ];

            const result = countViolationsByWcagLevel(violations);

            expect(result.wcag2a).toBe(1);
            expect(result.wcag21aa).toBe(1);
        });

        it('returns zeros for empty violations array', () => {
            const result = countViolationsByWcagLevel([]);

            expect(result.wcag2a).toBe(0);
            expect(result.wcag2aa).toBe(0);
            expect(result.wcag2aaa).toBe(0);
            expect(result.wcag21a).toBe(0);
            expect(result.wcag21aa).toBe(0);
            expect(result.wcag22aa).toBe(0);
            expect(result.bestPractice).toBe(0);
        });

        it('handles violations without tags', () => {
            const violations: AttributedViolation[] = [
                {
                    id: 'unknown-rule',
                    impact: 'minor',
                    description: 'Unknown rule',
                    help: 'Unknown',
                    helpUrl: 'https://example.com',
                    tags: [],
                    nodes: [
                        { component: null, componentPath: [], userComponentPath: [], componentType: null, html: '<div>', htmlSnippet: '<div>', cssSelector: 'div', target: ['div'], failureSummary: 'Unknown', isFrameworkComponent: false },
                    ],
                },
            ];

            const result = countViolationsByWcagLevel(violations);

            expect(result.wcag2a).toBe(0);
            expect(result.wcag2aa).toBe(0);
            expect(result.bestPractice).toBe(0);
        });
    });

    describe('addWcag22ToLevelCounts', () => {
        it('adds WCAG 2.2 AA violations to counts', () => {
            const counts: WcagLevelBreakdown = {
                wcag2a: 0,
                wcag2aa: 0,
                wcag2aaa: 0,
                wcag21a: 0,
                wcag21aa: 0,
                wcag22aa: 5,
                bestPractice: 0,
            };

            const wcag22: WCAG22Results = {
                targetSize: [
                    { id: '1', criterion: '2.5.8', level: 'AA', element: 'button', selector: 'button', html: '<button>', impact: 'serious', description: 'Target too small', details: {} },
                ],
                focusObscured: [
                    { id: '2', criterion: '2.4.11', level: 'AA', element: 'input', selector: 'input', html: '<input>', impact: 'serious', description: 'Focus obscured', details: {} },
                    { id: '3', criterion: '2.4.11', level: 'AA', element: 'button', selector: 'button', html: '<button>', impact: 'serious', description: 'Focus obscured', details: {} },
                ],
                focusAppearance: [
                    { id: '4', criterion: '2.4.13', level: 'AAA', element: 'link', selector: 'a', html: '<a>', impact: 'moderate', description: 'Focus appearance', details: {} },
                ],
                dragging: [],
                authentication: [
                    { id: '5', criterion: '3.3.8', level: 'AA', element: 'form', selector: 'form', html: '<form>', impact: 'serious', description: 'Auth issue', details: {} },
                ],
                statusMessages: [],
                errorIdentification: [],
                errorSuggestion: [],
                meaningfulSequence: [],
                reflow: [],
                hoverFocusContent: [],
                summary: {
                    totalViolations: 5,
                    byLevel: { A: 0, AA: 4, AAA: 1 },
                    byCriterion: {},
                },
            };

            addWcag22ToLevelCounts(counts, wcag22);

            // 5 existing + 1 (targetSize) + 2 (focusObscured) + 0 (dragging) + 1 (authentication) = 9
            expect(counts.wcag22aa).toBe(9);
            // Focus Appearance is AAA
            expect(counts.wcag2aaa).toBe(1);
        });

        it('handles empty WCAG 2.2 results', () => {
            const counts: WcagLevelBreakdown = {
                wcag2a: 1,
                wcag2aa: 2,
                wcag2aaa: 0,
                wcag21a: 0,
                wcag21aa: 0,
                wcag22aa: 0,
                bestPractice: 0,
            };

            const wcag22: WCAG22Results = {
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
                summary: {
                    totalViolations: 0,
                    byLevel: { A: 0, AA: 0, AAA: 0 },
                    byCriterion: {},
                },
            };

            addWcag22ToLevelCounts(counts, wcag22);

            expect(counts.wcag2a).toBe(1);
            expect(counts.wcag2aa).toBe(2);
            expect(counts.wcag22aa).toBe(0);
            expect(counts.wcag2aaa).toBe(0);
        });
    });

    describe('getWcagLevel', () => {
        it('returns AAA for AAA-level tags', () => {
            expect(getWcagLevel(['wcag2aaa'])).toBe('AAA');
            expect(getWcagLevel(['wcag21aaa'])).toBe('AAA');
            expect(getWcagLevel(['wcag22aaa'])).toBe('AAA');
        });

        it('returns AA for AA-level tags', () => {
            expect(getWcagLevel(['wcag2aa'])).toBe('AA');
            expect(getWcagLevel(['wcag21aa'])).toBe('AA');
            expect(getWcagLevel(['wcag22aa'])).toBe('AA');
        });

        it('returns A for A-level tags', () => {
            expect(getWcagLevel(['wcag2a'])).toBe('A');
            expect(getWcagLevel(['wcag21a'])).toBe('A');
            expect(getWcagLevel(['wcag22a'])).toBe('A');
        });

        it('returns unknown for non-WCAG tags', () => {
            expect(getWcagLevel(['best-practice'])).toBe('unknown');
            expect(getWcagLevel(['cat.color'])).toBe('unknown');
            expect(getWcagLevel([])).toBe('unknown');
        });

        it('returns the highest level when multiple are present', () => {
            // AAA takes precedence
            expect(getWcagLevel(['wcag2a', 'wcag2aaa'])).toBe('AAA');
            expect(getWcagLevel(['wcag2aa', 'wcag2aaa'])).toBe('AAA');

            // AA takes precedence over A
            expect(getWcagLevel(['wcag2a', 'wcag2aa'])).toBe('AA');
        });
    });
});
