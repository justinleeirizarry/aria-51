/**
 * WCAG 1.4.13 Content on Hover or Focus - Level AA
 *
 * Where receiving and then removing pointer hover or keyboard focus triggers additional
 * content to become visible and then hidden, the following are true:
 * - Dismissible: A mechanism is available to dismiss the additional content without
 *   moving pointer hover or keyboard focus (e.g., Escape key)
 * - Hoverable: If pointer hover can trigger the additional content, then the pointer
 *   can be moved over the additional content without the additional content disappearing
 * - Persistent: The additional content remains visible until the hover or focus trigger
 *   is removed, the user dismisses it, or its information is no longer valid
 *
 * This check uses Playwright's Page object to interact with elements and test
 * tooltip/popover behavior programmatically.
 */

import type { Page } from 'playwright';

interface HoverFocusViolation {
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

interface HoverTriggerCandidate {
    triggerSelector: string;
    triggerTagName: string;
    triggerHtml: string;
    contentSelector: string;
    contentType: string;
}

const MAX_VIOLATIONS = 10;

/**
 * Check WCAG 1.4.13 Content on Hover or Focus by finding elements that
 * show additional content on hover/focus and testing dismissibility,
 * hoverability, and persistence.
 */
export async function checkHoverFocusContent(page: Page): Promise<HoverFocusViolation[]> {
    const violations: HoverFocusViolation[] = [];

    // Step 1: Find candidate elements that may show content on hover
    const candidates = await findHoverTriggerCandidates(page);

    // Step 2: Test each candidate
    for (const candidate of candidates) {
        if (violations.length >= MAX_VIOLATIONS) break;

        try {
            const result = await testHoverContent(page, candidate);
            if (result) {
                violations.push(result);
            }
        } catch {
            // Resilient: skip elements that cause errors during interaction
            continue;
        }
    }

    return violations;
}

/**
 * Find elements that are likely to show additional content on hover.
 * Looks for common tooltip, popover, and dropdown patterns.
 */
async function findHoverTriggerCandidates(page: Page): Promise<HoverTriggerCandidate[]> {
    return page.evaluate(() => {
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

        const candidates: HoverTriggerCandidate[] = [];
        const seen = new Set<Element>();

        // Pattern 1: Elements with aria-describedby or aria-labelledby pointing to hidden content
        const ariaRefs = document.querySelectorAll('[aria-describedby], [aria-labelledby]');
        for (const trigger of ariaRefs) {
            if (candidates.length >= 30) break;
            const refId = trigger.getAttribute('aria-describedby') || trigger.getAttribute('aria-labelledby');
            if (!refId) continue;
            const content = document.getElementById(refId);
            if (!content) continue;
            const style = window.getComputedStyle(content);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                if (!seen.has(trigger)) {
                    seen.add(trigger);
                    candidates.push({
                        triggerSelector: getSelector(trigger),
                        triggerTagName: trigger.tagName.toLowerCase(),
                        triggerHtml: getHtmlSnippet(trigger),
                        contentSelector: '#' + CSS.escape(refId),
                        contentType: 'aria-referenced',
                    });
                }
            }
        }

        // Pattern 2: Elements with common tooltip/popover class patterns as siblings or children
        const tooltipPatterns = /tooltip|popover|dropdown-menu|hover-content|flyout/i;
        const hiddenContent = document.querySelectorAll('[class*="tooltip"], [class*="popover"], [class*="dropdown-menu"], [class*="hover-content"], [class*="flyout"], [role="tooltip"]');
        for (const content of hiddenContent) {
            if (candidates.length >= 30) break;
            const style = window.getComputedStyle(content);
            const isHidden = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' ||
                content.getAttribute('aria-hidden') === 'true';
            if (!isHidden) continue;

            // Find the likely trigger: previous sibling, parent, or element with matching aria-controls
            let trigger: Element | null = null;

            // Check for aria-controls reference
            const contentId = content.id;
            if (contentId) {
                trigger = document.querySelector(`[aria-controls="${CSS.escape(contentId)}"]`);
            }

            // Check previous sibling
            if (!trigger && content.previousElementSibling) {
                trigger = content.previousElementSibling;
            }

            // Check parent
            if (!trigger && content.parentElement && content.parentElement !== document.body) {
                trigger = content.parentElement;
            }

            if (trigger && !seen.has(trigger)) {
                seen.add(trigger);
                candidates.push({
                    triggerSelector: getSelector(trigger),
                    triggerTagName: trigger.tagName.toLowerCase(),
                    triggerHtml: getHtmlSnippet(trigger),
                    contentSelector: getSelector(content),
                    contentType: tooltipPatterns.test(content.className) ? 'tooltip/popover' : 'role-tooltip',
                });
            }
        }

        // Pattern 3: Elements with [title] attribute (custom tooltips, not native browser ones)
        // Native [title] tooltips are exempt, but elements that have both [title] AND
        // custom tooltip markup are worth checking
        const titledElements = document.querySelectorAll('[title][aria-describedby], [title][data-tooltip], [title][data-tip]');
        for (const el of titledElements) {
            if (candidates.length >= 30) break;
            if (seen.has(el)) continue;
            seen.add(el);
            candidates.push({
                triggerSelector: getSelector(el),
                triggerTagName: el.tagName.toLowerCase(),
                triggerHtml: getHtmlSnippet(el),
                contentSelector: getSelector(el),
                contentType: 'title-with-custom-tooltip',
            });
        }

        return candidates;
    });
}

/**
 * Test a single hover trigger candidate for WCAG 1.4.13 compliance.
 * Returns a violation if the content fails dismissibility, hoverability, or persistence.
 */
async function testHoverContent(
    page: Page,
    candidate: HoverTriggerCandidate
): Promise<HoverFocusViolation | null> {
    const issues: string[] = [];
    const details: Record<string, any> = {
        contentType: candidate.contentType,
        triggerSelector: candidate.triggerSelector,
        contentSelector: candidate.contentSelector,
    };

    // Hover over the trigger element
    const triggerEl = await page.$(candidate.triggerSelector);
    if (!triggerEl) return null;

    await triggerEl.hover();
    // Small delay for hover content to appear
    await page.waitForTimeout(300);

    // Check if content became visible after hover
    const contentVisible = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' &&
            el.getAttribute('aria-hidden') !== 'true';
    }, candidate.contentSelector);

    if (!contentVisible) {
        // Content didn't appear on hover; not a violation of this criterion
        // Move mouse away to clean up
        await page.mouse.move(0, 0);
        return null;
    }

    details.contentAppearedOnHover = true;

    // Test 1: Dismissible - Can Escape key dismiss the content?
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const dismissedByEscape = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return true;
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' ||
            el.getAttribute('aria-hidden') === 'true';
    }, candidate.contentSelector);

    details.dismissibleByEscape = dismissedByEscape;
    if (!dismissedByEscape) {
        issues.push('Content is not dismissible via Escape key');
    }

    // Re-hover to test hoverability and persistence
    await triggerEl.hover();
    await page.waitForTimeout(300);

    // Test 2: Hoverable - Can the pointer move to the additional content?
    const contentBox = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height };
    }, candidate.contentSelector);

    if (contentBox && contentBox.width > 0 && contentBox.height > 0) {
        // Move pointer to the content element
        await page.mouse.move(contentBox.x, contentBox.y);
        await page.waitForTimeout(200);

        const stillVisibleOnContentHover = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        }, candidate.contentSelector);

        details.hoverableContent = stillVisibleOnContentHover;
        if (!stillVisibleOnContentHover) {
            issues.push('Content disappears when pointer moves to it (not hoverable)');
        }
    }

    // Test 3: Persistent - Check that content doesn't auto-dismiss with a timeout
    // Re-hover the trigger
    await triggerEl.hover();
    await page.waitForTimeout(300);

    // Wait a bit and check if content auto-dismisses
    await page.waitForTimeout(2000);

    const stillVisibleAfterWait = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }, candidate.contentSelector);

    details.persistentWhileHovered = stillVisibleAfterWait;
    if (!stillVisibleAfterWait) {
        issues.push('Content disappears automatically while still hovered (not persistent)');
    }

    // Clean up: move mouse away
    await page.mouse.move(0, 0);

    if (issues.length === 0) {
        return null;
    }

    return {
        id: 'hover-focus-content',
        criterion: '1.4.13 Content on Hover or Focus',
        level: 'AA',
        element: candidate.triggerTagName,
        selector: candidate.triggerSelector,
        html: candidate.triggerHtml,
        impact: issues.length >= 2 ? 'critical' : issues.some(i => i.includes('not dismissible')) ? 'serious' : 'moderate',
        description: issues.join('; '),
        details,
    };
}
