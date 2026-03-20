/**
 * WCAG 3.3.3 Error Suggestion - Level AA
 *
 * If an input error is automatically detected and suggestions for correction
 * are known, then the suggestions are provided to the user, unless it would
 * jeopardize the security or purpose of the content.
 */

import type { WCAG22Violation } from './types.js';

type ErrorSuggestionViolation = WCAG22Violation;

/**
 * Get a unique CSS selector for an element
 */
function getSelector(element: Element): string {
    if (element.id) {
        return `#${CSS.escape(element.id)}`;
    }

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();

        if (current.className && typeof current.className === 'string') {
            const classes = current.className.split(/\s+/).filter(c => c.length > 0);
            if (classes.length > 0) {
                selector += '.' + classes.map(c => CSS.escape(c)).join('.');
            }
        }

        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(
                el => el.tagName === current!.tagName
            );
            if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-of-type(${index})`;
            }
        }

        path.unshift(selector);
        current = current.parentElement;
    }

    return path.join(' > ');
}

/**
 * Get truncated HTML snippet
 */
function getHtmlSnippet(element: Element, maxLength: number = 150): string {
    const html = element.outerHTML;
    if (html.length <= maxLength) {
        return html;
    }
    const openingTagEnd = html.indexOf('>') + 1;
    if (openingTagEnd < maxLength) {
        return html.slice(0, maxLength) + '...';
    }
    return html.slice(0, openingTagEnd) + '...';
}

/**
 * Check if element is visible
 */
function isElementVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);

    if (style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0') {
        return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

/**
 * Input types that have a known expected format
 */
const CONSTRAINED_TYPES: Record<string, string> = {
    email: 'e.g. user@example.com',
    url: 'e.g. https://example.com',
    tel: 'e.g. +1 (555) 123-4567',
    number: 'a numeric value',
    date: 'e.g. YYYY-MM-DD',
    time: 'e.g. HH:MM',
    'datetime-local': 'e.g. YYYY-MM-DDTHH:MM',
};

/**
 * Check if an input has an associated suggestion/hint text
 */
function hasSuggestionText(input: Element): boolean {
    // Check aria-describedby for hint text
    const describedbyIds = input.getAttribute('aria-describedby');
    if (describedbyIds) {
        const ids = describedbyIds.split(/\s+/).filter(id => id.length > 0);
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el && el.textContent?.trim()) {
                return true;
            }
        }
    }

    // Check aria-errormessage for suggestion
    const errormessageId = input.getAttribute('aria-errormessage');
    if (errormessageId) {
        const el = document.getElementById(errormessageId);
        if (el && el.textContent?.trim()) {
            return true;
        }
    }

    // Check placeholder for format hint
    const placeholder = input.getAttribute('placeholder');
    if (placeholder && placeholder.trim().length > 0) {
        return true;
    }

    // Check title attribute for format hint
    const title = input.getAttribute('title');
    if (title && title.trim().length > 0) {
        return true;
    }

    // Check for nearby hint/help text within the same field container
    const fieldContainer = input.closest(
        '.form-group, .form-field, .field, fieldset, [role="group"]'
    ) || input.parentElement;

    if (fieldContainer) {
        const hintElements = fieldContainer.querySelectorAll(
            '[class*="hint"], [class*="help"], [class*="suggestion"], [class*="format"], [class*="instruction"]'
        );
        for (const hint of hintElements) {
            if (hint.textContent?.trim()) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Run error suggestion check (WCAG 3.3.3 Level AA)
 */
export function checkErrorSuggestion(): ErrorSuggestionViolation[] {
    const violations: ErrorSuggestionViolation[] = [];

    // Check 1: Constrained input types (email, url, tel, etc.) in error state without format suggestions
    const invalidInputs = document.querySelectorAll(
        'input[aria-invalid="true"]'
    );

    for (const input of invalidInputs) {
        if (!isElementVisible(input)) continue;

        const inputType = (input.getAttribute('type') || 'text').toLowerCase();
        const expectedFormat = CONSTRAINED_TYPES[inputType];

        if (expectedFormat && !hasSuggestionText(input)) {
            violations.push({
                id: 'error-suggestion',
                criterion: '3.3.3 Error Suggestion',
                level: 'AA',
                element: input.tagName.toLowerCase(),
                selector: getSelector(input),
                html: getHtmlSnippet(input),
                impact: 'serious',
                description: `Input type="${inputType}" is in error state but provides no format suggestion (expected: ${expectedFormat})`,
                details: {
                    checkType: 'constrained-type-without-suggestion',
                    inputType,
                    expectedFormat,
                    hasAriaDescribedby: input.hasAttribute('aria-describedby'),
                    hasAriaErrormessage: input.hasAttribute('aria-errormessage'),
                    hasPlaceholder: input.hasAttribute('placeholder'),
                }
            });
        }
    }

    // Check 2: Inputs with pattern attribute in error state without format suggestion
    const patternInputs = document.querySelectorAll(
        'input[pattern][aria-invalid="true"]'
    );

    for (const input of patternInputs) {
        if (!isElementVisible(input)) continue;

        // Skip if already reported in check 1
        const inputType = (input.getAttribute('type') || 'text').toLowerCase();
        if (CONSTRAINED_TYPES[inputType]) continue;

        if (!hasSuggestionText(input)) {
            const pattern = input.getAttribute('pattern') || '';
            violations.push({
                id: 'error-suggestion',
                criterion: '3.3.3 Error Suggestion',
                level: 'AA',
                element: input.tagName.toLowerCase(),
                selector: getSelector(input),
                html: getHtmlSnippet(input),
                impact: 'serious',
                description: `Input with pattern constraint is in error state but provides no format suggestion`,
                details: {
                    checkType: 'pattern-without-suggestion',
                    inputType,
                    pattern,
                    hasAriaDescribedby: input.hasAttribute('aria-describedby'),
                    hasAriaErrormessage: input.hasAttribute('aria-errormessage'),
                    hasTitle: input.hasAttribute('title'),
                }
            });
        }
    }

    // Check 3: Select elements in error state with no suggestion
    const invalidSelects = document.querySelectorAll(
        'select[aria-invalid="true"]'
    );

    for (const select of invalidSelects) {
        if (!isElementVisible(select)) continue;

        if (!hasSuggestionText(select)) {
            violations.push({
                id: 'error-suggestion',
                criterion: '3.3.3 Error Suggestion',
                level: 'AA',
                element: 'select',
                selector: getSelector(select),
                html: getHtmlSnippet(select),
                impact: 'moderate',
                description: 'Select element is in error state but provides no suggestion for valid selection',
                details: {
                    checkType: 'select-without-suggestion',
                    hasAriaDescribedby: select.hasAttribute('aria-describedby'),
                    hasAriaErrormessage: select.hasAttribute('aria-errormessage'),
                    optionCount: select.querySelectorAll('option').length,
                }
            });
        }
    }

    return violations;
}

/**
 * Get diagnostic information about error suggestions on the page
 */
export function getErrorSuggestionInfo(): Array<{
    type: string;
    selector: string;
    hasSuggestion: boolean;
    details: Record<string, any>;
}> {
    const results: Array<{
        type: string;
        selector: string;
        hasSuggestion: boolean;
        details: Record<string, any>;
    }> = [];

    const invalidInputs = document.querySelectorAll(
        'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"]'
    );

    for (const input of invalidInputs) {
        if (!isElementVisible(input)) continue;

        const inputType = (input.getAttribute('type') || input.tagName.toLowerCase()).toLowerCase();

        results.push({
            type: CONSTRAINED_TYPES[inputType] ? 'constrained-input' : 'invalid-input',
            selector: getSelector(input),
            hasSuggestion: hasSuggestionText(input),
            details: {
                inputType,
                pattern: input.getAttribute('pattern'),
                hasAriaDescribedby: input.hasAttribute('aria-describedby'),
                hasAriaErrormessage: input.hasAttribute('aria-errormessage'),
                hasPlaceholder: input.hasAttribute('placeholder'),
                hasTitle: input.hasAttribute('title'),
            }
        });
    }

    return results;
}
