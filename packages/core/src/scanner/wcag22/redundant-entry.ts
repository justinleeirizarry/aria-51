/**
 * WCAG 3.3.7 Redundant Entry - Level A
 *
 * Information previously entered by or provided to the user that is required
 * to be entered again in the same process is either auto-populated or available
 * for the user to select.
 *
 * Heuristic: in multi-step forms, detect repeated input fields (same name/type/label)
 * that require re-entry without autocomplete or pre-population.
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

/** Get a normalized identity for an input based on name, type, label, and autocomplete */
function getInputIdentity(input: Element): string | null {
    const name = (input.getAttribute('name') || '').toLowerCase();
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();

    // Get associated label text
    const id = input.getAttribute('id');
    const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
    const labelText = (labelEl?.textContent || '').toLowerCase().trim();

    // Common confirmation field patterns — these are intentional duplicates, not redundant entry
    const confirmPatterns = ['confirm', 'verify', 'repeat', 'retype', 're-enter', 'reenter'];
    if (confirmPatterns.some(p => name.includes(p) || ariaLabel.includes(p) || labelText.includes(p))) {
        return null; // Skip confirmation fields
    }

    // Build identity from most specific to least
    if (autocomplete && autocomplete !== 'off' && autocomplete !== 'on') return `autocomplete:${autocomplete}`;
    if (name) return `name:${name}`;
    if (ariaLabel) return `label:${ariaLabel}`;
    if (labelText) return `label:${labelText}`;
    return `type:${type}`;
}

export function checkRedundantEntry(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];

    // Look for multi-step form patterns
    const forms = document.querySelectorAll('form');
    const allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"])');

    // Check for duplicate input identities across the page
    const inputMap = new Map<string, Element[]>();

    for (const input of allInputs) {
        if (!isElementVisible(input)) continue;

        const identity = getInputIdentity(input);
        if (!identity) continue;

        const existing = inputMap.get(identity) || [];
        existing.push(input);
        inputMap.set(identity, existing);
    }

    // Flag inputs that appear more than once (potential redundant entry)
    for (const [identity, inputs] of inputMap) {
        if (inputs.length <= 1) continue;
        if (identity.startsWith('type:')) continue; // Too generic to be meaningful

        // Check if any have autocomplete set (which would auto-populate)
        const withoutAutocomplete = inputs.filter(i => {
            const ac = i.getAttribute('autocomplete');
            return !ac || ac === 'off' || ac === 'on';
        });

        if (withoutAutocomplete.length > 1) {
            // Only report the second occurrence
            const el = withoutAutocomplete[1];
            violations.push({
                id: 'redundant-entry',
                criterion: '3.3.7 Redundant Entry',
                level: 'A',
                element: el.tagName.toLowerCase(),
                selector: getSelector(el),
                html: getHtmlSnippet(el),
                impact: 'moderate',
                description: `Input "${identity.split(':')[1]}" appears ${inputs.length} times on the page without autocomplete to pre-populate`,
                details: {
                    type: 'duplicate-input',
                    identity: identity.split(':')[1],
                    occurrences: inputs.length,
                    hasAutocomplete: false,
                },
            });
        }
    }

    return violations;
}

export function getRedundantEntryInfo(): Array<{
    selector: string;
    identity: string;
    occurrences: number;
}> {
    return checkRedundantEntry().map(v => ({
        selector: v.selector,
        identity: v.details.identity as string,
        occurrences: v.details.occurrences as number,
    }));
}
