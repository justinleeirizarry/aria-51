/**
 * WCAG 1.4.8 Visual Presentation - Level AAA
 *
 * For the visual presentation of blocks of text:
 * - Width is no more than 80 characters or glyphs
 * - Text is not justified (text-align: justify)
 * - Line spacing is at least 1.5× font size, paragraph spacing at least 1.5× line spacing
 * - Text can be resized up to 200% without assistive technology
 *
 * Heuristic: check computed styles of text blocks.
 */

import type { WCAG22Violation } from './types.js';

function getSelector(element: Element): string {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const path: string[] = [];
    let current: Element | null = element;
    while (current && current !== document.body && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();
        if (current.className && typeof current.className === 'string') {
            const classes = current.className.split(/\s+/).filter(c => c.length > 0);
            if (classes.length > 0) selector += '.' + classes.map(c => CSS.escape(c)).join('.');
        }
        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(el => el.tagName === current!.tagName);
            if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        path.unshift(selector);
        current = current.parentElement;
    }
    return path.join(' > ');
}

function getHtmlSnippet(element: Element, maxLength = 150): string {
    const html = element.outerHTML;
    if (html.length <= maxLength) return html;
    const end = html.indexOf('>') + 1;
    return end < maxLength ? html.slice(0, maxLength) + '...' : html.slice(0, end) + '...';
}

function isElementVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

export function checkVisualPresentation(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];
    const seen = new Set<string>();

    // Check block-level text elements
    const textBlocks = document.querySelectorAll('p, blockquote, li, dd, td, th, article, section > div');

    for (const el of textBlocks) {
        if (!isElementVisible(el)) continue;

        // Only check elements with substantial text
        const text = el.textContent || '';
        if (text.trim().length < 50) continue;

        const selector = getSelector(el);
        const style = window.getComputedStyle(el);

        // Check text-align: justify
        if (style.textAlign === 'justify') {
            const key = `${selector}:justify`;
            if (!seen.has(key)) {
                seen.add(key);
                violations.push({
                    id: 'visual-presentation',
                    criterion: '1.4.8 Visual Presentation',
                    level: 'AAA',
                    element: el.tagName.toLowerCase(),
                    selector,
                    html: getHtmlSnippet(el),
                    impact: 'moderate',
                    description: 'Text block uses justified alignment which can create uneven spacing',
                    details: { type: 'justified-text', textAlign: 'justify' },
                });
            }
        }

        // Check line-height (should be at least 1.5)
        const fontSize = parseFloat(style.fontSize);
        const lineHeight = parseFloat(style.lineHeight);
        if (!isNaN(fontSize) && !isNaN(lineHeight) && fontSize > 0) {
            const ratio = lineHeight / fontSize;
            if (ratio < 1.5) {
                const key = `${selector}:line-height`;
                if (!seen.has(key)) {
                    seen.add(key);
                    violations.push({
                        id: 'visual-presentation',
                        criterion: '1.4.8 Visual Presentation',
                        level: 'AAA',
                        element: el.tagName.toLowerCase(),
                        selector,
                        html: getHtmlSnippet(el),
                        impact: 'moderate',
                        description: `Line spacing is ${ratio.toFixed(2)}× font size (should be at least 1.5×)`,
                        details: {
                            type: 'line-spacing',
                            fontSize: fontSize.toFixed(1),
                            lineHeight: lineHeight.toFixed(1),
                            ratio: ratio.toFixed(2),
                        },
                    });
                }
            }
        }

        // Check text block width (should be ≤80 characters ≈ 80ch)
        const rect = el.getBoundingClientRect();
        // Approximate: 1ch ≈ 0.5em for most fonts
        const approxCharsPerLine = rect.width / (fontSize * 0.5);
        if (approxCharsPerLine > 80 && rect.width > 600) {
            const key = `${selector}:width`;
            if (!seen.has(key)) {
                seen.add(key);
                violations.push({
                    id: 'visual-presentation',
                    criterion: '1.4.8 Visual Presentation',
                    level: 'AAA',
                    element: el.tagName.toLowerCase(),
                    selector,
                    html: getHtmlSnippet(el),
                    impact: 'minor',
                    description: `Text block is approximately ${Math.round(approxCharsPerLine)} characters wide (should be ≤80)`,
                    details: {
                        type: 'line-width',
                        widthPx: Math.round(rect.width),
                        approxChars: Math.round(approxCharsPerLine),
                    },
                });
            }
        }
    }

    return violations;
}

export function getVisualPresentationInfo(): Array<{
    selector: string;
    type: string;
    detail: string;
}> {
    return checkVisualPresentation().map(v => ({
        selector: v.selector,
        type: v.details.type as string,
        detail: v.description,
    }));
}
