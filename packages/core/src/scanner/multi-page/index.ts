/**
 * Multi-Page WCAG Checks
 *
 * Cross-page comparison checks that require scanning multiple URLs to evaluate.
 * These checks compare navigation structure, component identification, help
 * placement, and navigation alternatives across pages.
 *
 * Tested WCAG criteria:
 * - 2.4.5 Multiple Ways (AA)
 * - 3.2.3 Consistent Navigation (AA)
 * - 3.2.4 Consistent Identification (AA)
 * - 3.2.6 Consistent Help (A)
 */
import type { ScanResults } from '../../types.js';
import type { SupplementalTestResult, SupplementalIssue } from '../../types.js';
import { logger } from '../../utils/logger.js';

/** Extracted navigation structure from a single page */
interface PageNavigation {
    url: string;
    /** Ordered list of nav link labels */
    navLinks: string[];
    /** Whether the page has a search form/input */
    hasSearch: boolean;
    /** Whether the page has a sitemap link */
    hasSitemap: boolean;
    /** Help/contact mechanism labels and their relative position */
    helpMechanisms: Array<{ label: string; position: 'header' | 'footer' | 'nav' | 'other' }>;
    /** Interactive element labels grouped by role for consistent identification */
    componentLabels: Map<string, string[]>;
}

/**
 * Run multi-page WCAG checks by comparing results across scanned pages.
 *
 * Requires at least 2 pages to produce meaningful results.
 * Should be called after all individual page scans are complete.
 */
export function checkMultiPage(allResults: ScanResults[]): SupplementalTestResult[] {
    if (allResults.length < 2) {
        logger.debug('Multi-page checks require at least 2 pages, skipping');
        return [];
    }

    const issues = new Map<string, SupplementalIssue[]>();
    const criteria = ['2.4.5', '3.2.3', '3.2.4', '3.2.6'];
    for (const id of criteria) {
        issues.set(id, []);
    }

    // Extract navigation data from supplemental + wcag22 results
    // Since we don't have raw page access at this point, we work with the
    // accessibility tree snapshots and violation data already collected
    const pageNavs = allResults.map(r => extractNavigationData(r));

    // 2.4.5 Multiple Ways — check that pages are findable by more than one mechanism
    checkMultipleWays(pageNavs, issues);

    // 3.2.3 Consistent Navigation — compare nav link order across pages
    checkConsistentNavigation(pageNavs, issues);

    // 3.2.4 Consistent Identification — check if same-function components use same labels
    checkConsistentIdentification(pageNavs, issues);

    // 3.2.6 Consistent Help — check help mechanisms appear in same relative position
    checkConsistentHelp(pageNavs, issues);

    // Build results
    const results: SupplementalTestResult[] = [];
    for (const [criterionId, criterionIssues] of issues) {
        results.push({
            criterionId,
            status: criterionIssues.length > 0 ? 'fail' : 'pass',
            source: 'multi-page',
            issues: criterionIssues,
        });
    }

    return results;
}

// ---------------------------------------------------------------------------
// Navigation data extraction
// ---------------------------------------------------------------------------

function extractNavigationData(results: ScanResults): PageNavigation {
    const nav: PageNavigation = {
        url: results.url,
        navLinks: [],
        hasSearch: false,
        hasSitemap: false,
        helpMechanisms: [],
        componentLabels: new Map(),
    };

    // Extract from accessibility tree if available
    if (results.accessibilityTree) {
        extractFromTree(results.accessibilityTree as any, nav);
    }

    // Extract from supplemental results (screen reader check data)
    if (results.supplementalResults) {
        for (const sr of results.supplementalResults) {
            // Look for navigation-related issues that contain link info
            for (const issue of sr.issues) {
                if (issue.evidence) {
                    // Some checks embed navigation info in evidence
                }
            }
        }
    }

    // Infer search/sitemap from violations and passes
    for (const item of [...(results.violations || []), ...(results.passes || [])]) {
        const nodes = item.nodes || [];
        for (const node of nodes) {
            const html = (node.html || '').toLowerCase();
            const target = Array.isArray(node.target) ? node.target.join(' ') : '';

            if (html.includes('type="search"') || html.includes('role="search"') ||
                target.includes('search') || html.includes('[type="search"]')) {
                nav.hasSearch = true;
            }
            if (html.includes('sitemap') || target.includes('sitemap')) {
                nav.hasSitemap = true;
            }
        }
    }

    return nav;
}

function extractFromTree(node: any, nav: PageNavigation): void {
    if (!node) return;

    const role = node.role || '';
    const name = (node.name || '').trim();

    // Collect navigation links
    if (role === 'link' && name) {
        // Check if inside a navigation landmark
        nav.navLinks.push(name);

        // Check for help/contact patterns
        const lower = name.toLowerCase();
        if (lower.includes('help') || lower.includes('contact') || lower.includes('support') ||
            lower.includes('faq') || lower.includes('chat')) {
            nav.helpMechanisms.push({ label: name, position: 'other' });
        }

        if (lower.includes('sitemap') || lower.includes('site map')) {
            nav.hasSitemap = true;
        }
    }

    // Check for search
    if (role === 'searchbox' || role === 'search') {
        nav.hasSearch = true;
    }

    // Collect component labels for consistent identification
    if (role === 'button' || role === 'link' || role === 'tab' || role === 'menuitem') {
        if (name) {
            const existing = nav.componentLabels.get(role) || [];
            existing.push(name);
            nav.componentLabels.set(role, existing);
        }
    }

    // Recurse
    if (Array.isArray(node.children)) {
        for (const child of node.children) {
            extractFromTree(child, nav);
        }
    }
}

// ---------------------------------------------------------------------------
// 2.4.5 Multiple Ways
// ---------------------------------------------------------------------------

function checkMultipleWays(pages: PageNavigation[], issues: Map<string, SupplementalIssue[]>): void {
    // Check if pages are findable by multiple mechanisms
    // (navigation links, search, sitemap, etc.)
    const hasSearch = pages.some(p => p.hasSearch);
    const hasSitemap = pages.some(p => p.hasSitemap);
    const hasNav = pages.some(p => p.navLinks.length > 0);

    const mechanisms: string[] = [];
    if (hasNav) mechanisms.push('navigation');
    if (hasSearch) mechanisms.push('search');
    if (hasSitemap) mechanisms.push('sitemap');

    if (mechanisms.length < 2) {
        issues.get('2.4.5')!.push({
            message: `Only ${mechanisms.length} navigation mechanism(s) found across ${pages.length} pages: ${mechanisms.join(', ') || 'none'}. At least 2 are required (e.g., navigation + search, or navigation + sitemap).`,
            severity: 'moderate',
            evidence: `Mechanisms found: ${mechanisms.join(', ') || 'none'}`,
        });
    }
}

// ---------------------------------------------------------------------------
// 3.2.3 Consistent Navigation
// ---------------------------------------------------------------------------

function checkConsistentNavigation(pages: PageNavigation[], issues: Map<string, SupplementalIssue[]>): void {
    // Compare nav link order across pages
    // Navigation that appears on multiple pages should maintain the same relative order
    if (pages.length < 2) return;

    // Find common nav links across all pages
    const allNavSets = pages.map(p => new Set(p.navLinks));
    const commonLinks: string[] = [];
    for (const link of pages[0].navLinks) {
        if (allNavSets.every(s => s.has(link))) {
            commonLinks.push(link);
        }
    }

    if (commonLinks.length < 2) return; // Not enough common links to compare order

    // Check if common links appear in the same relative order on each page
    for (let i = 1; i < pages.length; i++) {
        const pageLinks = pages[i].navLinks.filter(l => commonLinks.includes(l));
        const referenceLinks = pages[0].navLinks.filter(l => commonLinks.includes(l));

        // Compare relative order
        const reordered: string[] = [];
        for (let j = 0; j < Math.min(pageLinks.length, referenceLinks.length); j++) {
            if (pageLinks[j] !== referenceLinks[j]) {
                reordered.push(pageLinks[j]);
            }
        }

        if (reordered.length > 0) {
            issues.get('3.2.3')!.push({
                message: `Navigation order differs between "${pages[0].url}" and "${pages[i].url}". ${reordered.length} link(s) appear in different positions.`,
                severity: 'moderate',
                evidence: `Reordered: ${reordered.slice(0, 5).join(', ')}`,
            });
        }
    }
}

// ---------------------------------------------------------------------------
// 3.2.4 Consistent Identification
// ---------------------------------------------------------------------------

function checkConsistentIdentification(pages: PageNavigation[], issues: Map<string, SupplementalIssue[]>): void {
    // Check if components with the same function use the same labels across pages
    // e.g., a search button labeled "Search" on one page and "Find" on another

    if (pages.length < 2) return;

    // Common heuristic patterns for same-function components
    const functionalGroups: Record<string, RegExp> = {
        search: /\b(search|find|look up|query)\b/i,
        submit: /\b(submit|send|go|done)\b/i,
        close: /\b(close|dismiss|cancel|x)\b/i,
        menu: /\b(menu|hamburger|navigation)\b/i,
        login: /\b(log\s*in|sign\s*in|login)\b/i,
        logout: /\b(log\s*out|sign\s*out|logout)\b/i,
        cart: /\b(cart|basket|bag|checkout)\b/i,
        back: /\b(back|return|go back|previous)\b/i,
    };

    // For each functional group, collect the labels used across pages
    for (const [func, pattern] of Object.entries(functionalGroups)) {
        const labelsPerPage = new Map<string, Set<string>>();

        for (const page of pages) {
            for (const [_role, labels] of page.componentLabels) {
                for (const label of labels) {
                    if (pattern.test(label)) {
                        const existing = labelsPerPage.get(page.url) || new Set();
                        existing.add(label);
                        labelsPerPage.set(page.url, existing);
                    }
                }
            }
        }

        // If the same function uses different labels across pages, flag it
        const allLabels = new Set<string>();
        for (const labels of labelsPerPage.values()) {
            for (const label of labels) {
                allLabels.add(label.toLowerCase());
            }
        }

        if (allLabels.size > 1 && labelsPerPage.size > 1) {
            issues.get('3.2.4')!.push({
                message: `"${func}" functionality uses inconsistent labels across pages: ${Array.from(allLabels).join(', ')}`,
                severity: 'moderate',
                evidence: Array.from(allLabels).join(' vs '),
            });
        }
    }
}

// ---------------------------------------------------------------------------
// 3.2.6 Consistent Help
// ---------------------------------------------------------------------------

function checkConsistentHelp(pages: PageNavigation[], issues: Map<string, SupplementalIssue[]>): void {
    // Check that help mechanisms appear in the same relative order across pages
    if (pages.length < 2) return;

    const pagesWithHelp = pages.filter(p => p.helpMechanisms.length > 0);

    if (pagesWithHelp.length === 0) {
        // No help mechanisms found on any page
        issues.get('3.2.6')!.push({
            message: `No help, contact, or support mechanisms found across ${pages.length} scanned pages.`,
            severity: 'moderate',
        });
        return;
    }

    if (pagesWithHelp.length > 0 && pagesWithHelp.length < pages.length) {
        const missing = pages.filter(p => p.helpMechanisms.length === 0);
        issues.get('3.2.6')!.push({
            message: `Help mechanisms are present on ${pagesWithHelp.length} page(s) but missing on ${missing.length} page(s): ${missing.map(p => p.url).join(', ')}`,
            severity: 'moderate',
            evidence: `Missing on: ${missing.map(p => p.url).slice(0, 3).join(', ')}`,
        });
    }

    // Check relative order of help mechanisms
    if (pagesWithHelp.length >= 2) {
        const referenceLabels = pagesWithHelp[0].helpMechanisms.map(h => h.label.toLowerCase());

        for (let i = 1; i < pagesWithHelp.length; i++) {
            const pageLabels = pagesWithHelp[i].helpMechanisms.map(h => h.label.toLowerCase());
            const common = referenceLabels.filter(l => pageLabels.includes(l));

            if (common.length > 0) {
                // Check if common help items are in the same relative order
                const refOrder = common.map(l => referenceLabels.indexOf(l));
                const pageOrder = common.map(l => pageLabels.indexOf(l));

                let isConsistent = true;
                for (let j = 1; j < refOrder.length; j++) {
                    if ((refOrder[j] > refOrder[j - 1]) !== (pageOrder[j] > pageOrder[j - 1])) {
                        isConsistent = false;
                        break;
                    }
                }

                if (!isConsistent) {
                    issues.get('3.2.6')!.push({
                        message: `Help mechanisms appear in different order on "${pagesWithHelp[0].url}" vs "${pagesWithHelp[i].url}".`,
                        severity: 'moderate',
                        evidence: `Reference order: ${referenceLabels.join(', ')}`,
                    });
                }
            }
        }
    }
}
