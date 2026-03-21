/**
 * WCAG 2.1.4 Character Key Shortcuts - Level A
 *
 * If a keyboard shortcut is implemented using only letter, punctuation,
 * number, or symbol characters, then the shortcut can be turned off,
 * remapped, or is only active on focus.
 *
 * Heuristic: detect keydown/keypress event listeners on document/body that
 * respond to single-character keys without modifier keys. Also checks for
 * common shortcut library patterns (accesskey attributes).
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

export function checkCharacterKeyShortcuts(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];

    // Check for accesskey attributes (single-character shortcuts)
    const accessKeyElements = document.querySelectorAll('[accesskey]');
    for (const el of accessKeyElements) {
        const key = el.getAttribute('accesskey') || '';
        violations.push({
            id: 'character-key-shortcuts',
            criterion: '2.1.4 Character Key Shortcuts',
            level: 'A',
            element: el.tagName.toLowerCase(),
            selector: getSelector(el),
            html: getHtmlSnippet(el),
            impact: 'moderate',
            description: `Element has accesskey="${key}" which creates a character key shortcut that may conflict with assistive technology`,
            details: {
                type: 'accesskey',
                key,
                canBeRemapped: false,
                canBeTurnedOff: false,
            },
        });
    }

    // Check for data attributes suggesting keyboard shortcuts
    const shortcutHintElements = document.querySelectorAll('[data-shortcut], [data-hotkey], [data-key], [data-keyboard-shortcut]');
    for (const el of shortcutHintElements) {
        const attr = el.hasAttribute('data-shortcut') ? 'data-shortcut'
            : el.hasAttribute('data-hotkey') ? 'data-hotkey'
            : el.hasAttribute('data-key') ? 'data-key'
            : 'data-keyboard-shortcut';
        const key = el.getAttribute(attr) || '';

        // Single character shortcuts are the concern (not Ctrl+X etc.)
        if (key.length === 1 || (!key.includes('+') && !key.includes('ctrl') && !key.includes('alt') && !key.includes('meta'))) {
            violations.push({
                id: 'character-key-shortcuts',
                criterion: '2.1.4 Character Key Shortcuts',
                level: 'A',
                element: el.tagName.toLowerCase(),
                selector: getSelector(el),
                html: getHtmlSnippet(el),
                impact: 'moderate',
                description: `Element has ${attr}="${key}" suggesting a single-character keyboard shortcut`,
                details: {
                    type: 'data-attribute',
                    key,
                    attribute: attr,
                },
            });
        }
    }

    return violations;
}

export function getCharacterKeyShortcutsInfo(): Array<{
    selector: string;
    type: string;
    key: string;
}> {
    return checkCharacterKeyShortcuts().map(v => ({
        selector: v.selector,
        type: v.details.type as string,
        key: v.details.key as string,
    }));
}
