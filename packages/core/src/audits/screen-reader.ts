/**
 * Screen Reader Audit
 *
 * Pure function that simulates screen reader navigation using Playwright.
 */
import { chromium } from 'playwright';
import type { ScreenReaderAuditResult, ScreenReaderAuditOptions, AuditIssue } from './types.js';

export async function auditScreenReader(
    url: string,
    options: ScreenReaderAuditOptions = {}
): Promise<ScreenReaderAuditResult> {
    const { headless = true, page: externalPage } = options;
    const browser = externalPage ? null : await chromium.launch({ headless });

    try {
        const page = externalPage || await browser!.newPage({ bypassCSP: true });
        if (!externalPage) {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const issues: AuditIssue[] = [];

        const title = await page.title();
        if (!title || title.trim() === '') {
            issues.push({ severity: 'serious', wcag: '2.4.2', message: 'Page has no title. Screen readers announce the title when the page loads.' });
        }

        const lang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
        if (!lang) {
            issues.push({ severity: 'serious', wcag: '3.1.1', message: 'Page has no lang attribute on <html>. Screen readers cannot determine the correct pronunciation language.' });
        }

        const imageData = await page.evaluate(() => {
            const imgs = document.querySelectorAll('img');
            let total = 0, missingAlt = 0;
            const missingSrcs: string[] = [];
            imgs.forEach(img => {
                total++;
                const alt = img.getAttribute('alt');
                const role = img.getAttribute('role');
                const isDecorative = role === 'presentation' || role === 'none' || alt === '';
                if (alt === null && !isDecorative) {
                    missingAlt++;
                    missingSrcs.push(img.src.split('/').pop()?.slice(0, 40) || '');
                }
            });
            return { total, missingAlt, missingSrcs };
        });
        if (imageData.missingAlt > 0) {
            issues.push({
                severity: 'critical', wcag: '1.1.1',
                message: `${imageData.missingAlt} image(s) have no alt attribute. Screen readers will announce the filename: ${imageData.missingSrcs.slice(0, 3).join(', ')}`,
            });
        }

        const linkData = await page.evaluate(() => {
            let total = 0, noName = 0, vague = 0;
            document.querySelectorAll('a[href]').forEach(a => {
                total++;
                const el = a as HTMLAnchorElement;
                const name = el.innerText?.trim() || el.getAttribute('aria-label') || el.querySelector('img')?.getAttribute('alt') || '';
                if (!name) noName++;
                else if (/^(click here|read more|learn more|here|more|link)$/i.test(name)) vague++;
            });
            return { total, noName, vague };
        });
        if (linkData.noName > 0) {
            issues.push({ severity: 'critical', wcag: '2.4.4', message: `${linkData.noName} link(s) have no accessible name. Screen readers will announce "link" with no context.` });
        }
        if (linkData.vague > 0) {
            issues.push({ severity: 'serious', wcag: '2.4.4', message: `${linkData.vague} link(s) use non-descriptive text like "click here" or "read more". Screen reader users navigating by links lose context.` });
        }

        const buttonData = await page.evaluate(() => {
            let total = 0, noName = 0;
            document.querySelectorAll('button, [role="button"]').forEach(el => {
                total++;
                const name = (el as HTMLElement).innerText?.trim() || el.getAttribute('aria-label') || el.getAttribute('title') || '';
                if (!name) noName++;
            });
            return { total, noName };
        });
        if (buttonData.noName > 0) {
            issues.push({ severity: 'critical', wcag: '4.1.2', message: `${buttonData.noName} button(s) have no accessible name. Screen readers will announce "button" with no context.` });
        }

        const formData = await page.evaluate(() => {
            let total = 0, unlabeled = 0;
            document.querySelectorAll('input, select, textarea').forEach(el => {
                const input = el as HTMLInputElement;
                if (input.type === 'hidden') return;
                total++;
                const id = input.id;
                const label = id ? document.querySelector(`label[for="${id}"]`) : null;
                const hasLabel = !!(label || input.getAttribute('aria-label') || input.getAttribute('aria-labelledby') || input.getAttribute('title'));
                if (!hasLabel) unlabeled++;
            });
            return { total, unlabeled };
        });
        if (formData.unlabeled > 0) {
            issues.push({ severity: 'critical', wcag: '3.3.2', message: `${formData.unlabeled} form input(s) have no label. Screen readers cannot describe these inputs.` });
        }

        const liveRegions = await page.evaluate(() =>
            document.querySelectorAll('[aria-live], [role="alert"], [role="status"], [role="log"]').length
        );

        return {
            url,
            timestamp: new Date().toISOString(),
            title: title || '',
            lang,
            images: { total: imageData.total, missingAlt: imageData.missingAlt },
            links: { total: linkData.total, noName: linkData.noName, vague: linkData.vague },
            buttons: { total: buttonData.total, noName: buttonData.noName },
            formInputs: { total: formData.total, unlabeled: formData.unlabeled },
            liveRegions,
            issues,
        };
    } finally {
        if (browser) await browser.close();
    }
}
