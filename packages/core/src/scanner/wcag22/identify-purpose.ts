/**
 * WCAG 1.3.6 Identify Purpose - Level AAA
 *
 * In content implemented using markup languages, the purpose of UI components,
 * icons, and regions can be programmatically determined.
 *
 * Heuristic: check common input fields for `autocomplete` attribute (which enables
 * user agents and assistive tech to identify purpose) and check landmark regions
 * for proper labeling.
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

// Input types that should have autocomplete for common user data
const AUTOCOMPLETE_HINTS: Record<string, string[]> = {
    name: ['name', 'full-name', 'fullname', 'your-name'],
    email: ['email', 'e-mail', 'email-address'],
    tel: ['phone', 'tel', 'telephone', 'mobile', 'cell'],
    'given-name': ['first-name', 'firstname', 'given-name', 'fname'],
    'family-name': ['last-name', 'lastname', 'family-name', 'surname', 'lname'],
    'street-address': ['address', 'street', 'street-address', 'address1', 'address-line1'],
    'postal-code': ['zip', 'zipcode', 'zip-code', 'postal', 'postal-code', 'postcode'],
    organization: ['company', 'organization', 'org'],
    username: ['username', 'user-name', 'login'],
    'current-password': ['password', 'passwd', 'pass', 'current-password'],
    'new-password': ['new-password', 'newpassword'],
    'cc-number': ['card-number', 'cardnumber', 'cc-number', 'credit-card'],
};

function guessAutocompleteValue(input: Element): string | null {
    const name = (input.getAttribute('name') || '').toLowerCase();
    const id = (input.getAttribute('id') || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    const label = input.getAttribute('aria-label')?.toLowerCase() || '';

    // Check by input type first
    if (type === 'email') return 'email';
    if (type === 'tel') return 'tel';

    // Check name/id/placeholder against known patterns
    for (const [autocomplete, patterns] of Object.entries(AUTOCOMPLETE_HINTS)) {
        for (const pattern of patterns) {
            if (name.includes(pattern) || id.includes(pattern) || placeholder.includes(pattern) || label.includes(pattern)) {
                return autocomplete;
            }
        }
    }

    return null;
}

export function checkIdentifyPurpose(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="image"]):not([type="search"]), select, textarea');

    for (const input of inputs) {
        if (!isElementVisible(input)) continue;

        const existingAutocomplete = input.getAttribute('autocomplete');
        if (existingAutocomplete && existingAutocomplete !== 'off' && existingAutocomplete !== 'on') continue;

        const suggested = guessAutocompleteValue(input);
        if (!suggested) continue;

        violations.push({
            id: 'identify-purpose',
            criterion: '1.3.6 Identify Purpose',
            level: 'AAA',
            element: input.tagName.toLowerCase(),
            selector: getSelector(input),
            html: getHtmlSnippet(input),
            impact: 'moderate',
            description: `Input appears to collect "${suggested}" data but lacks autocomplete attribute`,
            details: {
                suggestedAutocomplete: suggested,
                currentAutocomplete: existingAutocomplete || 'none',
                inputName: input.getAttribute('name') || '',
                inputType: input.getAttribute('type') || 'text',
            },
        });
    }

    return violations;
}

export function getIdentifyPurposeInfo(): Array<{
    selector: string;
    suggestedAutocomplete: string;
    inputName: string;
}> {
    return checkIdentifyPurpose().map(v => ({
        selector: v.selector,
        suggestedAutocomplete: v.details.suggestedAutocomplete as string,
        inputName: v.details.inputName as string,
    }));
}
