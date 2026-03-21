/**
 * Timing & Interaction Enhancement Checks
 *
 * Heuristic checks for timing, keyboard (enhanced), flash, location,
 * focus (enhanced), target size (enhanced), and concurrent input criteria.
 *
 * Tested criteria:
 * - 2.1.3 Keyboard (No Exception) (AAA)
 * - 2.2.3 No Timing (AAA)
 * - 2.2.4 Interruptions (AAA)
 * - 2.2.5 Re-authenticating (AAA)
 * - 2.2.6 Timeouts (AAA)
 * - 2.3.2 Three Flashes (AAA)
 * - 2.4.8 Location (AAA)
 * - 2.4.12 Focus Not Obscured (Enhanced) (AAA)
 * - 2.5.5 Target Size (Enhanced) (AAA)
 * - 2.5.6 Concurrent Input Mechanisms (AAA)
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

export function checkTimingAndInteraction(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];

    // --- 2.1.3 Keyboard (No Exception) ---
    // Check for elements with mouse-only handlers and no keyboard equivalent
    const mouseOnlyElements = document.querySelectorAll('[onmouseover]:not([onfocus]), [ondblclick]:not([onkeypress]):not([onkeydown])');
    for (const el of mouseOnlyElements) {
        if (!isElementVisible(el)) continue;
        const handler = el.hasAttribute('onmouseover') ? 'onmouseover' : 'ondblclick';
        violations.push({
            id: 'keyboard-no-exception',
            criterion: '2.1.3 Keyboard (No Exception)',
            level: 'AAA',
            element: el.tagName.toLowerCase(),
            selector: getSelector(el),
            html: getHtmlSnippet(el),
            impact: 'serious',
            description: `Element has ${handler} without keyboard equivalent handler`,
            details: { type: 'mouse-only-handler', handler },
        });
    }

    // --- 2.2.3 No Timing ---
    // Check for meta refresh (auto-redirect with timeout)
    const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
    if (metaRefresh) {
        const content = metaRefresh.getAttribute('content') || '';
        violations.push({
            id: 'no-timing',
            criterion: '2.2.3 No Timing',
            level: 'AAA',
            element: 'meta',
            selector: 'meta[http-equiv="refresh"]',
            html: getHtmlSnippet(metaRefresh),
            impact: 'serious',
            description: `Page has meta refresh (content="${content}") which imposes a time limit`,
            details: { type: 'meta-refresh', content },
        });
    }

    // Check for countdown/timer patterns in the DOM
    const timerElements = document.querySelectorAll('[class*="timer"], [class*="countdown"], [data-countdown], [data-timer], [role="timer"]');
    for (const el of timerElements) {
        if (!isElementVisible(el)) continue;
        violations.push({
            id: 'no-timing',
            criterion: '2.2.3 No Timing',
            level: 'AAA',
            element: el.tagName.toLowerCase(),
            selector: getSelector(el),
            html: getHtmlSnippet(el),
            impact: 'moderate',
            description: 'Timer or countdown element detected — content should not impose time limits',
            details: { type: 'countdown-element' },
        });
    }

    // --- 2.2.4 Interruptions ---
    // Check for elements that may auto-update or interrupt
    const liveRegions = document.querySelectorAll('[aria-live="assertive"]');
    for (const el of liveRegions) {
        if (!isElementVisible(el)) continue;
        violations.push({
            id: 'interruptions',
            criterion: '2.2.4 Interruptions',
            level: 'AAA',
            element: el.tagName.toLowerCase(),
            selector: getSelector(el),
            html: getHtmlSnippet(el),
            impact: 'moderate',
            description: 'Assertive live region found — interruptions should be suppressible by the user',
            details: { type: 'assertive-live-region' },
        });
    }

    // --- 2.2.5 Re-authenticating ---
    // Check if login forms preserve user data (look for hidden fields or session indicators)
    const loginForms = document.querySelectorAll('form[action*="login"], form[action*="signin"], form[action*="auth"]');
    for (const form of loginForms) {
        if (!isElementVisible(form)) continue;
        violations.push({
            id: 're-authenticating',
            criterion: '2.2.5 Re-authenticating',
            level: 'AAA',
            element: 'form',
            selector: getSelector(form),
            html: getHtmlSnippet(form),
            impact: 'moderate',
            description: 'Authentication form found — if session expires, user data should be preserved after re-authentication',
            details: { type: 'auth-form-review' },
        });
    }

    // --- 2.2.6 Timeouts ---
    // Check for session timeout indicators
    const timeoutIndicators = document.querySelectorAll('[class*="session"], [class*="timeout"], [data-timeout], [data-session-timeout]');
    for (const el of timeoutIndicators) {
        violations.push({
            id: 'timeouts',
            criterion: '2.2.6 Timeouts',
            level: 'AAA',
            element: el.tagName.toLowerCase(),
            selector: getSelector(el),
            html: getHtmlSnippet(el),
            impact: 'moderate',
            description: 'Session timeout indicator found — users must be warned of data loss due to inactivity',
            details: { type: 'session-timeout' },
        });
    }

    // --- 2.3.2 Three Flashes (AAA — stricter than 2.3.1) ---
    // Check for elements with very fast blinking animations
    const blinkElements = document.querySelectorAll('[class*="blink"], [class*="flash"], [style*="blink"]');
    for (const el of blinkElements) {
        if (!isElementVisible(el)) continue;
        violations.push({
            id: 'three-flashes-absolute',
            criterion: '2.3.2 Three Flashes',
            level: 'AAA',
            element: el.tagName.toLowerCase(),
            selector: getSelector(el),
            html: getHtmlSnippet(el),
            impact: 'critical',
            description: 'Element uses blink/flash styling — no content should flash more than 3 times per second',
            details: { type: 'blink-or-flash-class' },
        });
    }

    // --- 2.4.8 Location ---
    // Check for breadcrumbs or current-page indicators in navigation
    const hasBreadcrumb = !!document.querySelector(
        'nav[aria-label*="breadcrumb" i], [role="navigation"][aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs, [class*="breadcrumb"], ol[role="list"][aria-label*="breadcrumb" i]'
    );
    const hasActiveNav = !!document.querySelector(
        'nav [aria-current="page"], nav [aria-current="true"], nav .active, nav [class*="current"], nav [class*="active"]'
    );
    if (!hasBreadcrumb && !hasActiveNav) {
        violations.push({
            id: 'location',
            criterion: '2.4.8 Location',
            level: 'AAA',
            element: 'html',
            selector: 'html',
            html: '<html>',
            impact: 'moderate',
            description: 'No breadcrumb navigation or active page indicator found — users should be able to determine their location within a set of pages',
            details: {
                type: 'missing-location-indicator',
                hasBreadcrumb,
                hasActiveNav,
            },
        });
    }

    // --- 2.4.12 Focus Not Obscured (Enhanced — AAA, stricter than 2.4.11) ---
    // Check for any sticky/fixed elements that could fully obscure focus
    const stickyFixed = document.querySelectorAll('[style*="position: fixed"], [style*="position: sticky"]');
    const computedSticky: Element[] = [];
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
        const pos = window.getComputedStyle(el).position;
        if ((pos === 'fixed' || pos === 'sticky') && isElementVisible(el)) {
            computedSticky.push(el);
        }
    }
    if (computedSticky.length > 0) {
        for (const el of computedSticky.slice(0, 5)) {
            const rect = el.getBoundingClientRect();
            // Only flag elements covering significant area
            if (rect.width > 200 && rect.height > 40) {
                violations.push({
                    id: 'focus-not-obscured-enhanced',
                    criterion: '2.4.12 Focus Not Obscured (Enhanced)',
                    level: 'AAA',
                    element: el.tagName.toLowerCase(),
                    selector: getSelector(el),
                    html: getHtmlSnippet(el),
                    impact: 'moderate',
                    description: `Fixed/sticky element (${Math.round(rect.width)}×${Math.round(rect.height)}px) could fully obscure focused elements — no part of the focus indicator should be hidden`,
                    details: {
                        type: 'fixed-sticky-overlay',
                        position: window.getComputedStyle(el).position,
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                    },
                });
            }
        }
    }

    // --- 2.5.5 Target Size (Enhanced — AAA, 44×44px minimum) ---
    const interactiveSelectors = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"]';
    const interactiveElements = document.querySelectorAll(interactiveSelectors);
    let smallTargetCount = 0;
    for (const el of interactiveElements) {
        if (!isElementVisible(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
            // Skip inline links within text (they have exceptions)
            if (el.tagName === 'A' && el.closest('p, li, td, th, dd, blockquote')) continue;
            smallTargetCount++;
        }
    }
    if (smallTargetCount > 0) {
        violations.push({
            id: 'target-size-enhanced',
            criterion: '2.5.5 Target Size (Enhanced)',
            level: 'AAA',
            element: 'html',
            selector: 'html',
            html: '<html>',
            impact: 'moderate',
            description: `${smallTargetCount} interactive element(s) are smaller than 44×44px enhanced target size`,
            details: {
                type: 'small-target-enhanced',
                count: smallTargetCount,
                requiredSize: '44x44',
            },
        });
    }

    // --- 2.5.6 Concurrent Input Mechanisms ---
    // Check for CSS or attributes that restrict input modality
    const touchOnly = document.querySelectorAll('[style*="pointer-events: none"]');
    for (const el of touchOnly) {
        if (!isElementVisible(el)) continue;
        // Check if this blocks keyboard/mouse while allowing touch
        violations.push({
            id: 'concurrent-input',
            criterion: '2.5.6 Concurrent Input Mechanisms',
            level: 'AAA',
            element: el.tagName.toLowerCase(),
            selector: getSelector(el),
            html: getHtmlSnippet(el),
            impact: 'moderate',
            description: 'Element has pointer-events: none — ensure users can switch between input mechanisms (touch, keyboard, mouse)',
            details: { type: 'restricted-pointer-events' },
        });
    }

    // Check for touch-action: none which restricts touch input
    for (const el of allElements) {
        if (!isElementVisible(el)) continue;
        const ta = window.getComputedStyle(el).touchAction;
        if (ta === 'none') {
            violations.push({
                id: 'concurrent-input',
                criterion: '2.5.6 Concurrent Input Mechanisms',
                level: 'AAA',
                element: el.tagName.toLowerCase(),
                selector: getSelector(el),
                html: getHtmlSnippet(el),
                impact: 'moderate',
                description: 'Element has touch-action: none — ensure alternative input mechanisms are available',
                details: { type: 'restricted-touch-action' },
            });
            break; // Only report first instance
        }
    }

    return violations;
}

export function getTimingAndInteractionInfo(): Array<{
    criterion: string;
    type: string;
    detail: string;
}> {
    return checkTimingAndInteraction().map(v => ({
        criterion: v.criterion,
        type: v.details.type as string,
        detail: v.description,
    }));
}
