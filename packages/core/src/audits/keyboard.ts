/**
 * Keyboard Audit
 *
 * Pure function that tests keyboard navigation on a page using Playwright.
 * No session state, no agent dependency — just URL in, results out.
 */
import { chromium } from 'playwright';
import type { KeyboardAuditResult, KeyboardAuditOptions, TabOrderEntry, AuditIssue } from './types.js';

export async function auditKeyboard(
    url: string,
    options: KeyboardAuditOptions = {}
): Promise<KeyboardAuditResult> {
    const { maxTabs = 50, headless = true, page: externalPage } = options;
    const browser = externalPage ? null : await chromium.launch({ headless });

    try {
        const page = externalPage || await browser!.newPage({ bypassCSP: true });
        if (!externalPage) {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const tabOrder: TabOrderEntry[] = [];
        const issues: AuditIssue[] = [];

        await page.evaluate(() => document.body.focus());

        let previousSelector = '';
        let sameCount = 0;
        let trapped = false;

        for (let i = 0; i < maxTabs; i++) {
            await page.keyboard.press('Tab');
            await new Promise(resolve => setTimeout(resolve, 80));

            const info = await page.evaluate(() => {
                const el = document.activeElement;
                if (!el || el === document.body) return null;

                const styles = window.getComputedStyle(el);
                const outline = styles.outline;
                const boxShadow = styles.boxShadow;
                const hasOutline = outline !== 'none' && outline !== '' && !outline.includes('0px');
                const hasBoxShadow = boxShadow !== 'none' && boxShadow !== '';
                const hasFocusStyle = hasOutline || hasBoxShadow;

                const tag = el.tagName.toLowerCase();
                const id = el.id ? `#${el.id}` : '';
                const cls = el.className && typeof el.className === 'string'
                    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
                    : '';
                const selector = `${tag}${id}${cls}`.slice(0, 80);

                return {
                    tag,
                    role: el.getAttribute('role') || el.tagName.toLowerCase(),
                    name: el.getAttribute('aria-label')
                        || el.getAttribute('aria-labelledby')
                        || (el as HTMLElement).innerText?.slice(0, 50)
                        || el.getAttribute('title')
                        || '',
                    selector,
                    hasFocusStyle,
                };
            });

            if (!info) continue;

            if (info.selector === previousSelector) {
                sameCount++;
                if (sameCount >= 3) {
                    issues.push({ severity: 'critical', wcag: '2.1.2', message: `Focus trap detected at ${info.selector} — focus cannot escape this element` });
                    trapped = true;
                    break;
                }
            } else {
                sameCount = 0;
            }
            previousSelector = info.selector;

            tabOrder.push({ index: i + 1, ...info });

            if (tabOrder.length > 2 && info.selector === tabOrder[0].selector) break;
        }

        const noFocusIndicator = tabOrder.filter(e => !e.hasFocusStyle);
        if (noFocusIndicator.length > 0) {
            issues.push({
                severity: 'serious',
                wcag: '2.4.7',
                message: `${noFocusIndicator.length} element(s) lack visible focus indicators: ${noFocusIndicator.slice(0, 5).map(e => e.selector).join(', ')}`,
            });
        }

        const firstElement = tabOrder[0];
        const hasSkipLink = !!firstElement && (
            firstElement.name.toLowerCase().includes('skip') ||
            firstElement.name.toLowerCase().includes('main content')
        );
        if (!hasSkipLink) {
            issues.push({ severity: 'moderate', wcag: '2.4.1', message: 'No skip link found as first focusable element' });
        }

        const totalInteractive = await page.evaluate(() =>
            document.querySelectorAll('a[href], button, input, select, textarea, [tabindex], [role="button"], [role="link"]').length
        );
        if (totalInteractive > 0 && tabOrder.length < totalInteractive * 0.5) {
            issues.push({
                severity: 'serious',
                wcag: '2.1.1',
                message: `Only ${tabOrder.length} of ${totalInteractive} interactive elements are reachable via Tab`,
            });
        }

        return {
            url,
            timestamp: new Date().toISOString(),
            tabStops: tabOrder.length,
            totalInteractive,
            focusTrapDetected: trapped,
            hasSkipLink,
            elementsWithoutFocusIndicator: noFocusIndicator.length,
            tabOrder,
            issues,
        };
    } finally {
        if (browser) await browser.close();
    }
}
