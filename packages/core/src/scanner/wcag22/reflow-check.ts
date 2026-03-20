/**
 * WCAG 1.4.10 Reflow - Level AA
 *
 * Content can be presented without loss of information or functionality, and without
 * requiring scrolling in two dimensions for:
 * - Vertical scrolling content at a width equivalent to 320 CSS pixels
 * - Horizontal scrolling content at a height equivalent to 256 CSS pixels
 *
 * This check uses Playwright's Page object to resize the viewport and detect
 * horizontal overflow, simulating 1280px at 400% zoom (= 320px effective width).
 */

import type { Page } from 'playwright';

interface ReflowViolation {
    id: string;
    criterion: string;
    level: 'A' | 'AA' | 'AAA';
    element: string;
    selector: string;
    html: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    details: Record<string, any>;
}

interface OverflowingElement {
    tagName: string;
    selector: string;
    html: string;
    scrollWidth: number;
    clientWidth: number;
    overflowX: number;
}

const MAX_VIOLATIONS = 20;
const REFLOW_WIDTH = 320;

/**
 * Check WCAG 1.4.10 Reflow by resizing the viewport to 320px width
 * and detecting elements that cause horizontal overflow.
 */
export async function checkReflow(page: Page): Promise<ReflowViolation[]> {
    const originalViewport = page.viewportSize();

    try {
        // Resize to 320px width (simulates 1280px at 400% zoom)
        await page.setViewportSize({ width: REFLOW_WIDTH, height: originalViewport?.height ?? 768 });

        // Wait for layout to settle after resize
        await page.waitForTimeout(500);

        // Check for horizontal overflow and find overflowing elements
        const overflowingElements = await page.evaluate((maxViolations: number) => {
            function getSelector(el: Element): string {
                if (el.id) return '#' + CSS.escape(el.id);
                const path: string[] = [];
                let current: Element | null = el;
                while (current && current !== document.body && current !== document.documentElement) {
                    let seg = current.tagName.toLowerCase();
                    if (current.className && typeof current.className === 'string') {
                        const classes = current.className.trim().split(/\s+/).filter(c => c.length > 0);
                        if (classes.length > 0) {
                            seg += '.' + classes.map(c => CSS.escape(c)).join('.');
                        }
                    }
                    const parent = current.parentElement;
                    if (parent) {
                        const siblings = Array.from(parent.children).filter(s => s.tagName === current!.tagName);
                        if (siblings.length > 1) {
                            seg += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
                        }
                    }
                    path.unshift(seg);
                    current = current.parentElement;
                }
                return path.join(' > ');
            }

            function getHtmlSnippet(el: Element, maxLen = 150): string {
                const html = el.outerHTML;
                if (html.length <= maxLen) return html;
                const tagEnd = html.indexOf('>') + 1;
                if (tagEnd < maxLen) return html.slice(0, maxLen) + '...';
                return html.slice(0, tagEnd) + '...';
            }

            const viewportWidth = document.documentElement.clientWidth;
            const results: Array<{
                tagName: string;
                selector: string;
                html: string;
                scrollWidth: number;
                clientWidth: number;
                overflowX: number;
            }> = [];

            // Check all elements for horizontal overflow
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                if (results.length >= maxViolations) break;

                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);

                // Skip hidden elements
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                // Skip elements with no dimensions
                if (rect.width === 0 && rect.height === 0) continue;

                const overflowsRight = rect.right > viewportWidth + 1; // 1px tolerance
                const hasScrollOverflow = el.scrollWidth > el.clientWidth + 1;

                if (overflowsRight || hasScrollOverflow) {
                    // Skip if overflow is properly hidden
                    if (style.overflowX === 'hidden' && !overflowsRight) continue;
                    // Skip elements that are clipped by a parent with overflow hidden
                    let clipped = false;
                    let parent = el.parentElement;
                    while (parent && parent !== document.documentElement) {
                        const parentStyle = window.getComputedStyle(parent);
                        if (parentStyle.overflowX === 'hidden') {
                            const parentRect = parent.getBoundingClientRect();
                            if (parentRect.right <= viewportWidth + 1) {
                                clipped = true;
                                break;
                            }
                        }
                        parent = parent.parentElement;
                    }
                    if (clipped) continue;

                    results.push({
                        tagName: el.tagName.toLowerCase(),
                        selector: getSelector(el),
                        html: getHtmlSnippet(el),
                        scrollWidth: el.scrollWidth,
                        clientWidth: el.clientWidth,
                        overflowX: Math.round(Math.max(
                            rect.right - viewportWidth,
                            el.scrollWidth - el.clientWidth
                        ))
                    });
                }
            }

            return results;
        }, MAX_VIOLATIONS);

        // Also check if the page itself has horizontal scrollbar
        const pageHasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        const violations: ReflowViolation[] = [];

        if (pageHasHorizontalScroll && overflowingElements.length === 0) {
            // Page-level overflow but we couldn't pinpoint the element
            const scrollInfo = await page.evaluate(() => ({
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
            }));

            violations.push({
                id: 'reflow',
                criterion: '1.4.10 Reflow',
                level: 'AA',
                element: 'html',
                selector: 'html',
                html: '<html>',
                impact: 'serious',
                description: 'Page requires horizontal scrolling at 320px viewport width (equivalent to 400% zoom at 1280px)',
                details: {
                    viewportWidth: REFLOW_WIDTH,
                    scrollWidth: scrollInfo.scrollWidth,
                    clientWidth: scrollInfo.clientWidth,
                }
            });
        }

        for (const el of overflowingElements) {
            if (violations.length >= MAX_VIOLATIONS) break;

            violations.push({
                id: 'reflow',
                criterion: '1.4.10 Reflow',
                level: 'AA',
                element: el.tagName,
                selector: el.selector,
                html: el.html,
                impact: el.overflowX > 100 ? 'critical' : el.overflowX > 20 ? 'serious' : 'moderate',
                description: `Element causes horizontal overflow of ${el.overflowX}px at 320px viewport width`,
                details: {
                    viewportWidth: REFLOW_WIDTH,
                    scrollWidth: el.scrollWidth,
                    clientWidth: el.clientWidth,
                    overflowAmount: el.overflowX,
                }
            });
        }

        return violations;
    } finally {
        // Always restore original viewport
        if (originalViewport) {
            await page.setViewportSize(originalViewport);
        }
    }
}
