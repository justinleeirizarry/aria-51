/**
 * WCAG 2.5.1 Pointer Gestures - Level A
 *
 * All functionality that uses multipoint or path-based gestures for operation
 * can be operated with a single pointer without a path-based gesture.
 *
 * Also covers:
 * - 2.5.2 Pointer Cancellation (Level A): activation on up-event, ability to abort
 * - 2.5.4 Motion Actuation (Level A): functionality via device motion has UI alternative
 *
 * Heuristic: detect touch/gesture event listeners and motion APIs.
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

export function checkPointerGestures(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];

    // 2.5.1: Check for elements with gesture-related attributes/patterns
    // Look for touch-action CSS that implies multipoint gestures
    const allElements = document.querySelectorAll('*');
    const gestureElements = new Set<Element>();

    for (const el of allElements) {
        if (!isElementVisible(el)) continue;

        const style = window.getComputedStyle(el);
        const touchAction = style.touchAction;

        // touch-action: pinch-zoom or manipulation suggests gesture handling
        if (touchAction === 'pinch-zoom' || touchAction === 'pan-x pan-y pinch-zoom') {
            gestureElements.add(el);
        }
    }

    // Check for swipe/gesture library indicators
    const swipeElements = document.querySelectorAll(
        '[class*="swipe"], [class*="carousel"], [class*="slider"], [data-swipe], [class*="pinch"], [class*="gesture"]'
    );
    for (const el of swipeElements) {
        if (!isElementVisible(el)) continue;

        // Check if there's a single-pointer alternative (buttons, arrows)
        const hasAlternative = !!el.querySelector(
            'button, [role="button"], .prev, .next, .arrow, [class*="arrow"], [class*="prev"], [class*="next"], [aria-label*="previous"], [aria-label*="next"]'
        );

        if (!hasAlternative) {
            violations.push({
                id: 'pointer-gestures',
                criterion: '2.5.1 Pointer Gestures',
                level: 'A',
                element: el.tagName.toLowerCase(),
                selector: getSelector(el),
                html: getHtmlSnippet(el),
                impact: 'serious',
                description: 'Element appears to use swipe/gesture interaction without visible single-pointer alternative (prev/next buttons)',
                details: {
                    type: 'missing-single-pointer-alternative',
                    pattern: Array.from(el.classList).find(c =>
                        /swipe|carousel|slider|pinch|gesture/i.test(c)
                    ) || 'gesture-element',
                },
            });
        }
    }

    // 2.5.2: Check for mousedown handlers without corresponding click handlers
    // We can detect this by looking for elements with onmousedown but no onclick
    const mousedownElements = document.querySelectorAll('[onmousedown]');
    for (const el of mousedownElements) {
        if (!isElementVisible(el)) continue;
        if (!el.hasAttribute('onclick') && !el.hasAttribute('onmouseup')) {
            violations.push({
                id: 'pointer-cancellation',
                criterion: '2.5.2 Pointer Cancellation',
                level: 'A',
                element: el.tagName.toLowerCase(),
                selector: getSelector(el),
                html: getHtmlSnippet(el),
                impact: 'serious',
                description: 'Element has onmousedown handler without onclick/onmouseup, making accidental activation hard to cancel',
                details: {
                    type: 'down-event-activation',
                    hasOnClick: false,
                    hasOnMouseUp: false,
                },
            });
        }
    }

    // 2.5.4: Check for device motion usage
    // Look for orientation/motion related attributes or meta tags
    const orientationMeta = document.querySelector('meta[name="viewport"][content*="orientation"]');
    if (orientationMeta) {
        // Not a violation per se, but if orientation is locked without UI alternative
    }

    // Check for elements suggesting shake-to-undo or tilt interactions
    const motionElements = document.querySelectorAll('[data-motion], [data-shake], [data-tilt], [class*="shake"], [class*="tilt"]');
    for (const el of motionElements) {
        if (!isElementVisible(el)) continue;
        violations.push({
            id: 'motion-actuation',
            criterion: '2.5.4 Motion Actuation',
            level: 'A',
            element: el.tagName.toLowerCase(),
            selector: getSelector(el),
            html: getHtmlSnippet(el),
            impact: 'serious',
            description: 'Element appears to use device motion for activation without visible UI alternative',
            details: {
                type: 'motion-based-interaction',
                pattern: Array.from(el.classList).find(c => /shake|tilt|motion/i.test(c)) || el.getAttribute('data-motion') || 'motion',
            },
        });
    }

    return violations;
}

export function getPointerGesturesInfo(): Array<{
    selector: string;
    criterion: string;
    type: string;
}> {
    return checkPointerGestures().map(v => ({
        selector: v.selector,
        criterion: v.criterion,
        type: v.details.type as string,
    }));
}
