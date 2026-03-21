/**
 * Lightweight Keyboard Navigation Checks
 *
 * Pure Playwright checks ported from ai-auditor's keyboard-tester.ts.
 * Replaces Stagehand extract() calls with page.evaluate() + computed styles
 * for focus indicator detection.
 *
 * Known limitation: CSS-based heuristic cannot detect background-color changes
 * or custom pseudo-element indicators. Stagehand AI vision handles those when enabled.
 *
 * Tested WCAG criteria: 2.1.1, 2.1.2, 2.4.3, 2.4.7
 */
import type { Page } from 'playwright';
import type { SupplementalTestResult, SupplementalIssue } from '../../types.js';
import { logger } from '../../utils/logger.js';

const MAX_TABS = 50;

interface FocusedElementInfo {
    tag: string;
    role: string;
    name: string;
    selector: string;
    hasIndicator: boolean;
    landmark: string | null;
    isDialog: boolean;
}

/**
 * Run all keyboard navigation checks on the current page.
 * Returns one SupplementalTestResult per WCAG criterion.
 */
export async function checkKeyboardNavigation(page: Page): Promise<SupplementalTestResult[]> {
    const issues = new Map<string, SupplementalIssue[]>();

    // Initialize buckets for each criterion we test
    const criteria = ['2.1.1', '2.1.2', '2.4.3', '2.4.7'];
    for (const id of criteria) {
        issues.set(id, []);
    }

    try {
        // Count total interactive elements for keyboard accessibility check
        const totalInteractive = await page.evaluate(() => {
            return document.querySelectorAll(
                'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"]'
            ).length;
        });

        // Reset focus
        await page.evaluate(() => (document.body as HTMLElement).focus());

        const focusedElements: FocusedElementInfo[] = [];
        let previousSelector = '';
        let sameElementCount = 0;
        let focusTrapDetected = false;
        let focusTrapSelector = '';

        // Tab loop
        for (let i = 0; i < MAX_TABS; i++) {
            await page.keyboard.press('Tab');
            // Brief wait for focus + CSS transitions to settle
            await new Promise(resolve => setTimeout(resolve, 100));

            const focused = await page.evaluate(() => {
                const el = document.activeElement;
                if (!el || el === document.body) return null;

                // Build a reasonable selector
                const buildSelector = (element: Element): string => {
                    if (element.id) return `#${element.id}`;
                    const tag = element.tagName.toLowerCase();
                    const classes = element.className && typeof element.className === 'string'
                        ? '.' + element.className.trim().split(/\s+/).slice(0, 2).join('.')
                        : '';
                    const name = element.getAttribute('name');
                    if (name) return `${tag}[name="${name}"]`;
                    return `${tag}${classes}`;
                };

                // Check focus indicator via computed styles
                const style = window.getComputedStyle(el);
                const hasIndicator =
                    (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') ||
                    (style.boxShadow !== 'none' && style.boxShadow !== '');

                // Determine parent landmark
                let landmark: string | null = null;
                let current: Element | null = el;
                const semanticMap: Record<string, string> = {
                    HEADER: 'banner', NAV: 'navigation', MAIN: 'main',
                    ASIDE: 'complementary', FOOTER: 'contentinfo',
                };
                while (current) {
                    const role = current.getAttribute('role');
                    if (role && ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'form', 'region'].includes(role)) {
                        landmark = role;
                        break;
                    }
                    if (semanticMap[current.tagName]) {
                        landmark = semanticMap[current.tagName];
                        break;
                    }
                    current = current.parentElement;
                }

                // Check if inside a dialog (legitimate focus trap)
                let isDialog = false;
                current = el;
                while (current) {
                    const role = current.getAttribute('role');
                    if (role === 'dialog' || role === 'alertdialog' || current.tagName === 'DIALOG') {
                        isDialog = true;
                        break;
                    }
                    current = current.parentElement;
                }

                return {
                    tag: el.tagName.toLowerCase(),
                    role: el.getAttribute('role') || el.tagName.toLowerCase(),
                    name: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 50) || '',
                    selector: buildSelector(el),
                    hasIndicator,
                    landmark,
                    isDialog,
                };
            });

            if (!focused) continue;

            // Detect focus traps (same element 3+ times in a row, not inside a dialog)
            if (focused.selector === previousSelector) {
                sameElementCount++;
                if (sameElementCount >= 3 && !focused.isDialog) {
                    focusTrapDetected = true;
                    focusTrapSelector = focused.selector;
                    break;
                }
            } else {
                sameElementCount = 0;
            }
            previousSelector = focused.selector;

            focusedElements.push(focused);

            // Detect cycle back to start
            if (focusedElements.length > 2 && focused.selector === focusedElements[0].selector) {
                break;
            }
        }

        // --- Analyze results ---

        // 2.1.1 Keyboard Accessibility
        // If we found significantly fewer focusable elements than interactive elements, flag it
        const uniqueFocused = new Set(focusedElements.map(e => e.selector)).size;
        if (totalInteractive > 0 && uniqueFocused < totalInteractive * 0.5) {
            issues.get('2.1.1')!.push({
                message: `Only ${uniqueFocused} of ${totalInteractive} interactive elements are reachable via keyboard Tab.`,
                severity: 'serious',
                evidence: `${Math.round((uniqueFocused / totalInteractive) * 100)}% keyboard accessible`,
            });
        }

        // 2.1.2 No Keyboard Trap
        if (focusTrapDetected) {
            issues.get('2.1.2')!.push({
                message: `Focus trap detected at ${focusTrapSelector}. Users cannot Tab away from this element.`,
                selector: focusTrapSelector,
                severity: 'critical',
            });
        }

        // 2.4.3 Focus Order — elements outside any landmark
        const outsideLandmarks = focusedElements.filter(el => !el.landmark && !el.isDialog);
        if (outsideLandmarks.length > 0) {
            issues.get('2.4.3')!.push({
                message: `${outsideLandmarks.length} focusable element(s) are outside any landmark region.`,
                severity: 'moderate',
                evidence: outsideLandmarks.slice(0, 5).map(e => e.selector).join(', '),
            });
        }

        // 2.4.7 Focus Visible — elements without visible focus indicator
        const noIndicator = focusedElements.filter(el => !el.hasIndicator);
        if (noIndicator.length > 0) {
            // Report up to 10 elements without focus indicators
            for (const el of noIndicator.slice(0, 10)) {
                issues.get('2.4.7')!.push({
                    message: `${el.role} "${el.name.slice(0, 40)}" has no visible focus indicator (outline or box-shadow).`,
                    selector: el.selector,
                    severity: 'serious',
                });
            }
        }
    } catch (err) {
        logger.warn(`Keyboard navigation check encountered an error: ${err}`);
    }

    // Restore focus
    try {
        await page.evaluate(() => (document.body as HTMLElement).focus());
    } catch {
        // Non-critical
    }

    // Build results
    const results: SupplementalTestResult[] = [];
    for (const [criterionId, criterionIssues] of issues) {
        results.push({
            criterionId,
            status: criterionIssues.length > 0 ? 'fail' : 'pass',
            source: 'playwright-keyboard',
            issues: criterionIssues,
        });
    }

    return results;
}
