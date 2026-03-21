/**
 * WCAG 1.3.3 Sensory Characteristics - Level A
 *
 * Instructions provided for understanding and operating content do not rely
 * solely on sensory characteristics of components such as shape, color,
 * size, visual location, orientation, or sound.
 *
 * Heuristic: scan visible text content for phrases that rely on sensory cues
 * (e.g., "click the green button", "see the sidebar on the left").
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

// Patterns that indicate reliance on sensory characteristics
const SENSORY_PATTERNS = [
    // Shape-based
    { regex: /\b(click|press|tap|select|hit)\s+(the\s+)?(round|square|circular|triangular|arrow)\b/i, type: 'shape' },
    // Color-based
    { regex: /\b(click|press|tap|select)\s+(the\s+)?(red|green|blue|yellow|orange|purple|pink|white|black|gray|grey)\s+(button|link|icon|area|box|circle)\b/i, type: 'color' },
    { regex: /\b(the\s+)?(red|green|blue|yellow|orange|purple)\s+(text|item|section|area)\b/i, type: 'color' },
    { regex: /\bhighlighted\s+in\s+(red|green|blue|yellow|orange)\b/i, type: 'color' },
    { regex: /\bmarked\s+(in\s+)?(red|green|blue|yellow)\b/i, type: 'color' },
    // Location-based
    { regex: /\b(click|see|use|find)\s+(the\s+)?(button|link|menu|option|icon)\s+(on\s+the\s+)?(left|right|above|below|top|bottom)\b/i, type: 'location' },
    { regex: /\bin\s+the\s+(left|right|top|bottom)\s+(sidebar|column|panel|corner)\b/i, type: 'location' },
    // Size-based
    { regex: /\b(the\s+)?(big|large|small|bigger|smaller)\s+(button|icon|link)\b/i, type: 'size' },
];

export function checkSensoryCharacteristics(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];
    const seen = new Set<string>();

    // Check text-bearing elements (p, li, span, label, td, th, div with direct text)
    const textElements = document.querySelectorAll('p, li, span, label, td, th, figcaption, dt, dd, blockquote');

    for (const el of textElements) {
        if (!isElementVisible(el)) continue;

        // Only check direct text content to avoid duplicates from nesting
        const text = el.textContent || '';
        if (text.length < 10 || text.length > 500) continue;

        for (const pattern of SENSORY_PATTERNS) {
            const match = text.match(pattern.regex);
            if (match) {
                const selector = getSelector(el);
                const key = `${selector}:${pattern.type}`;
                if (seen.has(key)) continue;
                seen.add(key);

                violations.push({
                    id: 'sensory-characteristics',
                    criterion: '1.3.3 Sensory Characteristics',
                    level: 'A',
                    element: el.tagName.toLowerCase(),
                    selector,
                    html: getHtmlSnippet(el),
                    impact: 'moderate',
                    description: `Text may rely on ${pattern.type} to convey instructions: "${match[0]}"`,
                    details: {
                        type: pattern.type,
                        matchedText: match[0],
                        fullText: text.slice(0, 100),
                    },
                });
                break; // One violation per element
            }
        }
    }

    return violations;
}

export function getSensoryCharacteristicsInfo(): Array<{
    selector: string;
    type: string;
    matchedText: string;
}> {
    return checkSensoryCharacteristics().map(v => ({
        selector: v.selector,
        type: v.details.type as string,
        matchedText: v.details.matchedText as string,
    }));
}
