/**
 * WCAG 2.4.10 Section Headings - Level AAA
 *
 * Section headings are used to organize the content.
 *
 * Heuristic: check that content sections (article, section, main, aside)
 * start with a heading element. Also check for long text blocks without
 * heading structure.
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

export function checkSectionHeadings(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];

    // Check content sections for headings
    const sections = document.querySelectorAll('section, article, aside, main');

    for (const section of sections) {
        if (!isElementVisible(section)) continue;

        // Check if section has at least one heading child
        const heading = section.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
        if (!heading) {
            // Only flag if the section has substantial content
            const text = section.textContent || '';
            if (text.trim().length < 100) continue;

            violations.push({
                id: 'section-headings',
                criterion: '2.4.10 Section Headings',
                level: 'AAA',
                element: section.tagName.toLowerCase(),
                selector: getSelector(section),
                html: getHtmlSnippet(section),
                impact: 'moderate',
                description: `<${section.tagName.toLowerCase()}> element contains content but has no heading to describe the section`,
                details: {
                    type: 'missing-section-heading',
                    sectionTag: section.tagName.toLowerCase(),
                    contentLength: text.trim().length,
                },
            });
        }
    }

    return violations;
}

export function getSectionHeadingsInfo(): Array<{
    selector: string;
    sectionTag: string;
}> {
    return checkSectionHeadings().map(v => ({
        selector: v.selector,
        sectionTag: v.details.sectionTag as string,
    }));
}
