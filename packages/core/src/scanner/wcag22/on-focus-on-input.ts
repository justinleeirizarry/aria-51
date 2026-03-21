/**
 * WCAG 3.2.1 On Focus - Level A
 * WCAG 3.2.2 On Input - Level A
 *
 * 3.2.1: When any UI component receives focus, it does not initiate a change of context.
 * 3.2.2: Changing the setting of any UI component does not automatically cause a change
 *        of context unless the user has been advised of the behavior.
 *
 * Heuristic: detect inline onfocus/onblur handlers that navigate or submit,
 * and onchange handlers on selects that navigate without warning.
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

// Patterns that suggest context changes
const CONTEXT_CHANGE_PATTERNS = [
    /window\.location/i,
    /location\.href/i,
    /location\.assign/i,
    /location\.replace/i,
    /document\.location/i,
    /\.navigate\(/i,
    /\.submit\(\)/i,
    /window\.open\(/i,
    /\.redirect/i,
];

function hasContextChangeCode(code: string): boolean {
    return CONTEXT_CHANGE_PATTERNS.some(pattern => pattern.test(code));
}

export function checkOnFocusOnInput(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];

    // 3.2.1: Check onfocus/onblur handlers for context changes
    const focusElements = document.querySelectorAll('[onfocus], [onblur]');
    for (const el of focusElements) {
        const onfocus = el.getAttribute('onfocus') || '';
        const onblur = el.getAttribute('onblur') || '';

        if (hasContextChangeCode(onfocus)) {
            violations.push({
                id: 'on-focus',
                criterion: '3.2.1 On Focus',
                level: 'A',
                element: el.tagName.toLowerCase(),
                selector: getSelector(el),
                html: getHtmlSnippet(el),
                impact: 'critical',
                description: 'Element has onfocus handler that appears to change context (navigate or submit)',
                details: {
                    type: 'focus-context-change',
                    handler: 'onfocus',
                    code: onfocus.slice(0, 100),
                },
            });
        }

        if (hasContextChangeCode(onblur)) {
            violations.push({
                id: 'on-focus',
                criterion: '3.2.1 On Focus',
                level: 'A',
                element: el.tagName.toLowerCase(),
                selector: getSelector(el),
                html: getHtmlSnippet(el),
                impact: 'critical',
                description: 'Element has onblur handler that appears to change context (navigate or submit)',
                details: {
                    type: 'blur-context-change',
                    handler: 'onblur',
                    code: onblur.slice(0, 100),
                },
            });
        }
    }

    // 3.2.2: Check select elements with onchange that navigate
    const selectElements = document.querySelectorAll('select[onchange]');
    for (const select of selectElements) {
        const onchange = select.getAttribute('onchange') || '';

        if (hasContextChangeCode(onchange)) {
            // Check if there's a submit button nearby (making it an advised behavior)
            const form = select.closest('form');
            const hasSubmitButton = form?.querySelector('button[type="submit"], input[type="submit"], button:not([type])');

            if (!hasSubmitButton) {
                violations.push({
                    id: 'on-input',
                    criterion: '3.2.2 On Input',
                    level: 'A',
                    element: 'select',
                    selector: getSelector(select),
                    html: getHtmlSnippet(select),
                    impact: 'serious',
                    description: 'Select element changes context on input without a submit button to advise the user',
                    details: {
                        type: 'select-auto-navigate',
                        code: onchange.slice(0, 100),
                        hasSubmitButton: false,
                    },
                });
            }
        }
    }

    // Also check for auto-submitting forms (forms that submit on input change)
    const autoSubmitForms = document.querySelectorAll('form[onchange]');
    for (const form of autoSubmitForms) {
        const onchange = form.getAttribute('onchange') || '';
        if (/\.submit\(\)/i.test(onchange)) {
            const hasSubmitButton = form.querySelector('button[type="submit"], input[type="submit"]');
            if (!hasSubmitButton) {
                violations.push({
                    id: 'on-input',
                    criterion: '3.2.2 On Input',
                    level: 'A',
                    element: 'form',
                    selector: getSelector(form),
                    html: getHtmlSnippet(form),
                    impact: 'serious',
                    description: 'Form auto-submits on input change without a visible submit button',
                    details: {
                        type: 'form-auto-submit',
                        code: onchange.slice(0, 100),
                    },
                });
            }
        }
    }

    return violations;
}

export function getOnFocusOnInputInfo(): Array<{
    selector: string;
    criterion: string;
    type: string;
}> {
    return checkOnFocusOnInput().map(v => ({
        selector: v.selector,
        criterion: v.criterion,
        type: v.details.type as string,
    }));
}
