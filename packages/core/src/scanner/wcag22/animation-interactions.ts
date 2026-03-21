/**
 * WCAG 2.3.3 Animation from Interactions - Level AAA
 *
 * Motion animation triggered by interaction can be disabled, unless the
 * animation is essential to the functionality or the information being conveyed.
 *
 * Also covers 2.3.1 Three Flashes or Below Threshold (Level A) heuristic:
 * detect animations with very fast durations that could cause flashing.
 *
 * Heuristic: check if page uses CSS animations/transitions without
 * respecting prefers-reduced-motion media query.
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

export function checkAnimationInteractions(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];

    // Check if any stylesheets use prefers-reduced-motion
    let hasReducedMotionQuery = false;
    try {
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules) {
                    if (rule instanceof CSSMediaRule && rule.conditionText?.includes('prefers-reduced-motion')) {
                        hasReducedMotionQuery = true;
                        break;
                    }
                }
            } catch {
                // Cross-origin stylesheet, skip
            }
            if (hasReducedMotionQuery) break;
        }
    } catch {
        // Can't access stylesheets
    }

    // Find elements with CSS animations or transitions
    const allElements = document.querySelectorAll('*');
    let animatedCount = 0;
    const MAX_REPORT = 5;

    for (const el of allElements) {
        if (!isElementVisible(el)) continue;

        const style = window.getComputedStyle(el);
        const animName = style.animationName;
        const animDuration = style.animationDuration;
        const transitionProp = style.transitionProperty;
        const transitionDuration = style.transitionDuration;

        const hasAnimation = animName && animName !== 'none';
        const hasTransition = transitionProp && transitionProp !== 'none' && transitionProp !== 'all'
            && transitionDuration !== '0s';

        if (!hasAnimation && !hasTransition) continue;

        animatedCount++;

        // 2.3.1: Check for very fast animations that could cause flashing
        if (hasAnimation) {
            const durationMs = parseFloat(animDuration) * (animDuration.includes('ms') ? 1 : 1000);
            if (durationMs > 0 && durationMs < 333) { // 3 flashes per second = 333ms
                if (violations.filter(v => v.criterion.includes('2.3.1')).length < MAX_REPORT) {
                    violations.push({
                        id: 'three-flashes',
                        criterion: '2.3.1 Three Flashes or Below Threshold',
                        level: 'A',
                        element: el.tagName.toLowerCase(),
                        selector: getSelector(el),
                        html: getHtmlSnippet(el),
                        impact: 'serious',
                        description: `Animation "${animName}" has duration ${durationMs.toFixed(0)}ms which could cause flashing above 3Hz threshold`,
                        details: {
                            type: 'fast-animation',
                            animationName: animName,
                            durationMs: Math.round(durationMs),
                        },
                    });
                }
            }
        }
    }

    // 2.3.3: If page has animations but no prefers-reduced-motion support
    if (animatedCount > 0 && !hasReducedMotionQuery) {
        violations.push({
            id: 'animation-interactions',
            criterion: '2.3.3 Animation from Interactions',
            level: 'AAA',
            element: 'html',
            selector: 'html',
            html: '<html>',
            impact: 'moderate',
            description: `Page has ${animatedCount} animated element(s) but does not use @media (prefers-reduced-motion) to allow disabling animations`,
            details: {
                type: 'no-reduced-motion',
                animatedElementCount: animatedCount,
                hasReducedMotionQuery: false,
            },
        });
    }

    return violations;
}

export function getAnimationInteractionsInfo(): Array<{
    type: string;
    detail: string;
}> {
    return checkAnimationInteractions().map(v => ({
        type: v.details.type as string,
        detail: v.description,
    }));
}
