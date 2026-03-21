/**
 * Language & Error Prevention Checks
 *
 * Heuristic checks for language accessibility and error prevention criteria.
 *
 * Tested criteria:
 * - 3.1.3 Unusual Words (AAA)
 * - 3.1.4 Abbreviations (AAA)
 * - 3.1.5 Reading Level (AAA)
 * - 3.1.6 Pronunciation (AAA)
 * - 3.3.4 Error Prevention (Legal, Financial, Data) (AA)
 * - 3.3.5 Help (AAA)
 * - 3.3.6 Error Prevention (All) (AAA)
 * - 3.3.9 Accessible Authentication (Enhanced) (AAA)
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

export function checkLanguageAndErrorPrevention(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];

    // --- 3.1.3 Unusual Words ---
    // Check for jargon/technical terms without definitions (<dfn>, glossary links)
    const hasDfn = document.querySelectorAll('dfn').length > 0;
    const hasGlossary = !!document.querySelector(
        'a[href*="glossary"], a[href*="definitions"], [class*="glossary"], dl.glossary'
    );
    // Check for content that looks technical but lacks definitions
    const bodyText = document.body?.textContent || '';
    const hasJargon = /\b(e\.g\.|i\.e\.|et al\.|viz\.|cf\.)\b/i.test(bodyText);
    if (hasJargon && !hasDfn && !hasGlossary) {
        violations.push({
            id: 'unusual-words',
            criterion: '3.1.3 Unusual Words',
            level: 'AAA',
            element: 'html',
            selector: 'html',
            html: '<html>',
            impact: 'minor',
            description: 'Page uses technical/jargon terms but has no <dfn> elements or glossary link to define them',
            details: {
                type: 'no-definitions',
                hasDfn,
                hasGlossary,
            },
        });
    }

    // --- 3.1.4 Abbreviations ---
    // Check for abbreviations/acronyms not wrapped in <abbr>
    // Find uppercase letter sequences (potential acronyms) not inside <abbr>
    const abbrElements = document.querySelectorAll('abbr');
    const definedAbbrs = new Set(Array.from(abbrElements).map(el => el.textContent?.trim().toUpperCase()));

    // Look for text nodes with acronyms (3+ uppercase letters)
    const textElements = document.querySelectorAll('p, li, td, th, dd, span, div, h1, h2, h3, h4, h5, h6');
    const undefinedAbbrs = new Set<string>();
    // Common abbreviations that don't need <abbr>
    const commonAbbrs = new Set(['HTML', 'CSS', 'URL', 'API', 'FAQ', 'PDF', 'USA', 'UK', 'ID', 'OK', 'AM', 'PM']);

    for (const el of textElements) {
        const text = el.textContent || '';
        const matches = text.match(/\b[A-Z]{3,}\b/g);
        if (matches) {
            for (const match of matches) {
                if (!definedAbbrs.has(match) && !commonAbbrs.has(match) && !undefinedAbbrs.has(match)) {
                    // Check if this acronym is inside an <abbr> element
                    const isInAbbr = el.closest('abbr') !== null;
                    if (!isInAbbr) {
                        undefinedAbbrs.add(match);
                    }
                }
            }
        }
    }

    if (undefinedAbbrs.size > 0) {
        const examples = Array.from(undefinedAbbrs).slice(0, 5);
        violations.push({
            id: 'abbreviations',
            criterion: '3.1.4 Abbreviations',
            level: 'AAA',
            element: 'html',
            selector: 'html',
            html: '<html>',
            impact: 'minor',
            description: `${undefinedAbbrs.size} abbreviation(s) found without <abbr> expansion: ${examples.join(', ')}`,
            details: {
                type: 'undefined-abbreviations',
                count: undefinedAbbrs.size,
                examples,
            },
        });
    }

    // --- 3.1.5 Reading Level ---
    // Estimate reading level using simple sentence/word length heuristic
    const mainContent = document.querySelector('main') || document.body;
    const contentText = (mainContent?.textContent || '').trim();
    if (contentText.length > 200) {
        const sentences = contentText.split(/[.!?]+/).filter(s => s.trim().length > 5);
        const words = contentText.split(/\s+/).filter(w => w.length > 0);
        if (sentences.length > 5 && words.length > 50) {
            const avgWordsPerSentence = words.length / sentences.length;
            const longWords = words.filter(w => w.replace(/[^a-zA-Z]/g, '').length > 6).length;
            const longWordPct = (longWords / words.length) * 100;

            // Rough approximation: high avg sentence length + many long words = advanced reading
            // Lower secondary education ≈ grade 7-9, roughly avg < 15 words/sentence and < 20% long words
            if (avgWordsPerSentence > 20 || longWordPct > 30) {
                violations.push({
                    id: 'reading-level',
                    criterion: '3.1.5 Reading Level',
                    level: 'AAA',
                    element: mainContent?.tagName.toLowerCase() || 'body',
                    selector: mainContent?.id ? `#${mainContent.id}` : 'main',
                    html: '<main>',
                    impact: 'moderate',
                    description: `Content may exceed lower secondary reading level (avg ${avgWordsPerSentence.toFixed(1)} words/sentence, ${longWordPct.toFixed(0)}% complex words)`,
                    details: {
                        type: 'advanced-reading-level',
                        avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
                        longWordPercentage: Math.round(longWordPct),
                        totalSentences: sentences.length,
                        totalWords: words.length,
                    },
                });
            }
        }
    }

    // --- 3.1.6 Pronunciation ---
    // Check for words that may need pronunciation guidance
    // Look for <ruby> elements (pronunciation markup) — if none exist but there are
    // CJK characters or technical terms, flag it
    const hasRuby = document.querySelectorAll('ruby').length > 0;
    const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(contentText);
    if (hasCJK && !hasRuby) {
        violations.push({
            id: 'pronunciation',
            criterion: '3.1.6 Pronunciation',
            level: 'AAA',
            element: 'html',
            selector: 'html',
            html: '<html>',
            impact: 'minor',
            description: 'Page contains CJK characters without <ruby> pronunciation annotations',
            details: { type: 'cjk-without-ruby' },
        });
    }

    // --- 3.3.4 Error Prevention (Legal, Financial, Data) ---
    // Check forms that handle financial/legal data for confirmation mechanisms
    const sensitiveFormPatterns = [
        'payment', 'checkout', 'purchase', 'order', 'billing',
        'legal', 'contract', 'agreement', 'terms',
        'delete', 'remove', 'cancel-account', 'close-account',
    ];
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
        if (!isElementVisible(form)) continue;

        const formHtml = form.outerHTML.toLowerCase();
        const formText = (form.textContent || '').toLowerCase();
        const action = (form.getAttribute('action') || '').toLowerCase();
        const isSensitive = sensitiveFormPatterns.some(p =>
            formHtml.includes(p) || formText.includes(p) || action.includes(p)
        );

        if (isSensitive) {
            // Check for confirmation step (review page, confirmation checkbox, etc.)
            const hasConfirmation = !!form.querySelector(
                'input[type="checkbox"][name*="confirm"], input[type="checkbox"][name*="agree"], ' +
                '[class*="review"], [class*="confirm"], [class*="summary"]'
            );
            if (!hasConfirmation) {
                violations.push({
                    id: 'error-prevention-legal',
                    criterion: '3.3.4 Error Prevention (Legal, Financial, Data)',
                    level: 'AA',
                    element: 'form',
                    selector: getSelector(form),
                    html: getHtmlSnippet(form),
                    impact: 'serious',
                    description: 'Sensitive form (legal/financial/data) lacks visible confirmation or review mechanism',
                    details: { type: 'missing-confirmation', hasConfirmation },
                });
            }
        }
    }

    // --- 3.3.5 Help ---
    // Check if form fields have contextual help available
    const inputsWithoutHelp = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])'
    );
    let fieldsWithoutHelp = 0;
    for (const input of inputsWithoutHelp) {
        if (!isElementVisible(input)) continue;

        const hasDescribedBy = !!input.getAttribute('aria-describedby');
        const hasHelpText = !!input.parentElement?.querySelector(
            '.help-text, .hint, [class*="help"], [class*="hint"], [class*="description"], small'
        );
        const hasTitle = !!input.getAttribute('title');
        const hasPlaceholder = !!input.getAttribute('placeholder');

        if (!hasDescribedBy && !hasHelpText && !hasTitle && !hasPlaceholder) {
            fieldsWithoutHelp++;
        }
    }
    if (fieldsWithoutHelp > 0 && inputsWithoutHelp.length > 3) {
        violations.push({
            id: 'help',
            criterion: '3.3.5 Help',
            level: 'AAA',
            element: 'html',
            selector: 'html',
            html: '<html>',
            impact: 'moderate',
            description: `${fieldsWithoutHelp} of ${inputsWithoutHelp.length} form field(s) lack contextual help text`,
            details: {
                type: 'missing-contextual-help',
                fieldsWithoutHelp,
                totalFields: inputsWithoutHelp.length,
            },
        });
    }

    // --- 3.3.6 Error Prevention (All) — AAA, stricter version of 3.3.4 ---
    // All forms should allow reversal, checking, or confirmation
    for (const form of forms) {
        if (!isElementVisible(form)) continue;
        // Skip search forms and simple filters
        if (form.querySelector('input[type="search"]') || form.getAttribute('role') === 'search') continue;
        // Skip forms with few inputs (likely search/filter)
        const inputCount = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])').length;
        if (inputCount < 2) continue;

        const hasUndo = !!form.querySelector('[class*="undo"], [class*="reset"], input[type="reset"], button[type="reset"]');
        const hasReview = !!form.querySelector('[class*="review"], [class*="preview"], [class*="confirm"]');
        if (!hasUndo && !hasReview) {
            violations.push({
                id: 'error-prevention-all',
                criterion: '3.3.6 Error Prevention (All)',
                level: 'AAA',
                element: 'form',
                selector: getSelector(form),
                html: getHtmlSnippet(form),
                impact: 'moderate',
                description: 'Form lacks undo, review, or confirmation mechanism before submission',
                details: { type: 'no-reversal-mechanism', inputCount },
            });
        }
    }

    // --- 3.3.9 Accessible Authentication (Enhanced) ---
    // Stricter than 3.3.8 — no cognitive function test at all (not even object recognition)
    const authForms = document.querySelectorAll('form');
    for (const form of authForms) {
        if (!isElementVisible(form)) continue;

        const isAuthForm = !!(
            form.querySelector('input[type="password"], input[autocomplete*="password"]') ||
            (form.getAttribute('action') || '').match(/login|signin|auth/i)
        );
        if (!isAuthForm) continue;

        // Check for any CAPTCHA (image, audio, puzzle, or object recognition)
        const hasCaptcha = !!(
            form.querySelector('[class*="captcha"], [id*="captcha"], [class*="recaptcha"], [class*="hcaptcha"], [class*="turnstile"]') ||
            form.querySelector('iframe[src*="captcha"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]')
        );

        if (hasCaptcha) {
            violations.push({
                id: 'accessible-auth-enhanced',
                criterion: '3.3.9 Accessible Authentication (Enhanced)',
                level: 'AAA',
                element: 'form',
                selector: getSelector(form),
                html: getHtmlSnippet(form),
                impact: 'serious',
                description: 'Authentication form uses CAPTCHA which requires cognitive function — enhanced criterion requires no cognitive test',
                details: { type: 'captcha-cognitive-test' },
            });
        }

        // Check if password field allows paste (copy-paste is essential for password managers)
        const passwordInputs = form.querySelectorAll('input[type="password"]');
        for (const pwd of passwordInputs) {
            if (pwd.hasAttribute('onpaste') && pwd.getAttribute('onpaste')?.includes('return false')) {
                violations.push({
                    id: 'accessible-auth-enhanced',
                    criterion: '3.3.9 Accessible Authentication (Enhanced)',
                    level: 'AAA',
                    element: 'input',
                    selector: getSelector(pwd),
                    html: getHtmlSnippet(pwd),
                    impact: 'critical',
                    description: 'Password field blocks paste — prevents use of password managers',
                    details: { type: 'paste-blocked' },
                });
            }
        }
    }

    return violations;
}

export function getLanguageAndErrorPreventionInfo(): Array<{
    criterion: string;
    type: string;
}> {
    return checkLanguageAndErrorPrevention().map(v => ({
        criterion: v.criterion,
        type: v.details.type as string,
    }));
}
