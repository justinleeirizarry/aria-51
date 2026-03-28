/**
 * Stagehand Keyboard Navigation Tester
 *
 * Uses Stagehand's extract() API to test keyboard navigation
 * patterns and identify accessibility issues related to keyboard use.
 */
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
    StagehandKeyboardConfig,
    StagehandKeyboardIssue,
    StagehandKeyboardResults,
    TabOrderEntry,
    WcagCriterionInfo,
} from "../types.js";
import { logger, getCriterionById } from "@aria51/core";

// WCAG criteria relevant to keyboard accessibility
const KEYBOARD_WCAG_CRITERIA = {
    keyboard: '2.1.1',        // Keyboard
    noKeyboardTrap: '2.1.2',  // No Keyboard Trap
    focusOrder: '2.4.3',      // Focus Order
    focusVisible: '2.4.7',    // Focus Visible
    focusNotObscured: '2.4.11', // Focus Not Obscured (Minimum)
    bypassBlocks: '2.4.1',    // Bypass Blocks (skip links)
    characterKeyShortcuts: '2.1.4', // Character Key Shortcuts
};

/**
 * Get WCAG criteria info for a keyboard issue type
 */
function getWcagCriteriaForIssue(issueType: StagehandKeyboardIssue['type']): WcagCriterionInfo[] {
    const criteriaIds: string[] = [];

    switch (issueType) {
        case 'focus-trap':
            criteriaIds.push(KEYBOARD_WCAG_CRITERIA.noKeyboardTrap);
            break;
        case 'no-focus-indicator':
            criteriaIds.push(KEYBOARD_WCAG_CRITERIA.focusVisible);
            break;
        case 'tab-order-violation':
            criteriaIds.push(KEYBOARD_WCAG_CRITERIA.focusOrder);
            break;
        case 'keyboard-inaccessible':
            criteriaIds.push(KEYBOARD_WCAG_CRITERIA.keyboard);
            break;
        case 'skip-link-broken':
            criteriaIds.push(KEYBOARD_WCAG_CRITERIA.bypassBlocks);
            break;
        case 'shortcut-conflict':
            criteriaIds.push(KEYBOARD_WCAG_CRITERIA.characterKeyShortcuts);
            break;
    }

    return criteriaIds
        .map(id => getCriterionById(id))
        .filter((c): c is NonNullable<typeof c> => c !== undefined)
        .map(c => ({
            id: c.id,
            title: c.title,
            level: c.level,
            principle: c.principle,
            w3cUrl: c.w3cUrl,
        }));
}

// Zod schemas for structured extraction
const FocusedElementSchema = z.object({
    selector: z.string().describe('CSS selector for the focused element'),
    role: z.string().describe('ARIA role or tag name of the element'),
    description: z.string().describe('Brief description of what the element does'),
    hasFocusIndicator: z.boolean().describe('Whether the element has a visible focus indicator'),
});

const TabOrderSchema = z.object({
    elements: z.array(FocusedElementSchema).describe('Elements in tab order'),
    possibleFocusTrap: z.boolean().describe('Whether a focus trap was detected'),
    focusTrapElement: z.string().optional().describe('Selector of element causing focus trap'),
});

const InteractiveElementsSchema = z.object({
    elements: z.array(z.object({
        selector: z.string(),
        description: z.string(),
        isKeyboardAccessible: z.boolean().describe('Whether element can be activated with keyboard'),
        role: z.string().optional(),
    })),
    totalCount: z.number(),
});

const SkipLinkSchema = z.object({
    exists: z.boolean().describe('Whether a skip link exists'),
    selector: z.string().optional().describe('Selector of the skip link'),
    targetExists: z.boolean().optional().describe('Whether the skip link target exists'),
    works: z.boolean().optional().describe('Whether the skip link works correctly'),
});

export class StagehandKeyboardTester {
    private stagehand: Stagehand | null = null;
    private config: StagehandKeyboardConfig;

    constructor(config: StagehandKeyboardConfig = {}) {
        this.config = {
            maxTabPresses: 100,
            testShortcuts: true,
            testSkipLinks: true,
            verbose: false,
            model: 'gpt-4o-mini',
            ...config,
        };
    }

    get page() {
        if (!this.stagehand) return null;
        // @ts-ignore - Stagehand exposes page
        return this.stagehand.page || this.stagehand.context?.pages()[0] || null;
    }

    async init(): Promise<void> {
        logger.info('Initializing Stagehand keyboard tester...');

        try {
            const options = {
                env: "LOCAL" as const,
                modelName: this.config.model || "gpt-4o-mini",
                verbose: (this.config.verbose ? 2 : 0) as 0 | 2,
                headless: true,
            };

            this.stagehand = new Stagehand(options);
            await this.stagehand.init();
            logger.debug('Stagehand keyboard tester initialized');
        } catch (error) {
            logger.error(`Failed to initialize Stagehand: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    async test(url: string): Promise<StagehandKeyboardResults> {
        if (!this.stagehand) {
            throw new Error("Stagehand not initialized");
        }

        logger.debug(`Testing keyboard navigation for ${url}...`);

        const page = this.page;
        if (!page) {
            throw new Error("Page not available");
        }

        // Navigate to the URL
        await page.goto(url, { waitUntil: 'networkidle' });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const issues: StagehandKeyboardIssue[] = [];
        const tabOrder: TabOrderEntry[] = [];

        // Test tab navigation
        logger.debug('Testing tab navigation...');
        const tabResults = await this.testTabNavigation();
        tabOrder.push(...tabResults.tabOrder);
        issues.push(...tabResults.issues);

        // Test focus indicators
        logger.debug('Testing focus indicators...');
        const focusIssues = await this.testFocusIndicators(tabResults.tabOrder);
        issues.push(...focusIssues);

        // Test skip links
        if (this.config.testSkipLinks) {
            logger.debug('Testing skip links...');
            const skipLinkIssues = await this.testSkipLinks();
            issues.push(...skipLinkIssues);
        }

        // Test focus traps
        logger.debug('Testing for focus traps...');
        const focusTrapIssues = await this.testFocusTraps();
        issues.push(...focusTrapIssues);

        // Get coverage statistics
        logger.debug('Calculating keyboard accessibility coverage...');
        const coverage = await this.calculateCoverage();

        // Build summary
        const summary = {
            totalIssues: issues.length,
            focusTraps: issues.filter(i => i.type === 'focus-trap').length,
            missingIndicators: issues.filter(i => i.type === 'no-focus-indicator').length,
            inaccessibleElements: issues.filter(i => i.type === 'keyboard-inaccessible').length,
        };

        return {
            url,
            timestamp: new Date().toISOString(),
            tabOrder,
            issues,
            coverage,
            summary,
        };
    }

    /**
     * Test tab navigation order and collect focusable elements
     */
    private async testTabNavigation(): Promise<{
        tabOrder: TabOrderEntry[];
        issues: StagehandKeyboardIssue[];
    }> {
        const tabOrder: TabOrderEntry[] = [];
        const issues: StagehandKeyboardIssue[] = [];
        const page = this.page!;
        const maxTabs = this.config.maxTabPresses || 100;

        // Start from the body
        await page.evaluate(() => document.body.focus());

        let previousSelector = '';
        let sameElementCount = 0;

        for (let i = 0; i < maxTabs; i++) {
            // Press Tab
            await page.keyboard.press('Tab');
            await new Promise(resolve => setTimeout(resolve, 100));

            // Extract information about the focused element using Stagehand
            try {
                const focusedInfo = await this.stagehand!.extract(
                    'Describe the currently focused element. What is its CSS selector, ARIA role, what does it do, and does it have a visible focus indicator (outline, border, or other visual change)?',
                    FocusedElementSchema
                );

                if (!focusedInfo) continue;

                // Check for potential focus trap (same element focused repeatedly)
                if (focusedInfo.selector === previousSelector) {
                    sameElementCount++;
                    if (sameElementCount >= 3) {
                        issues.push({
                            type: 'focus-trap',
                            element: {
                                description: focusedInfo.description,
                                selector: focusedInfo.selector,
                                role: focusedInfo.role,
                            },
                            message: `Focus appears trapped on element: ${focusedInfo.description}`,
                            wcagCriteria: getWcagCriteriaForIssue('focus-trap'),
                            severity: 'critical',
                            reproduction: [
                                '1. Navigate to the page',
                                '2. Press Tab repeatedly',
                                `3. Focus becomes trapped at ${focusedInfo.selector}`,
                            ],
                        });
                        break; // Stop if trapped
                    }
                } else {
                    sameElementCount = 0;
                }
                previousSelector = focusedInfo.selector;

                tabOrder.push({
                    index: i + 1,
                    element: focusedInfo.description,
                    selector: focusedInfo.selector,
                    role: focusedInfo.role,
                    hasFocusIndicator: focusedInfo.hasFocusIndicator,
                });

                // Check if we've cycled back to start
                if (tabOrder.length > 2 && focusedInfo.selector === tabOrder[0].selector) {
                    logger.debug(`Tab order complete, found ${tabOrder.length} elements`);
                    break;
                }
            } catch (error) {
                logger.debug(`Failed to extract focus info at tab ${i}: ${error}`);
            }
        }

        return { tabOrder, issues };
    }

    /**
     * Test focus indicators for elements in the tab order
     */
    private async testFocusIndicators(tabOrder: TabOrderEntry[]): Promise<StagehandKeyboardIssue[]> {
        const issues: StagehandKeyboardIssue[] = [];

        for (const entry of tabOrder) {
            if (!entry.hasFocusIndicator) {
                issues.push({
                    type: 'no-focus-indicator',
                    element: {
                        description: entry.element,
                        selector: entry.selector,
                        role: entry.role,
                    },
                    message: `Element lacks visible focus indicator: ${entry.element}`,
                    wcagCriteria: getWcagCriteriaForIssue('no-focus-indicator'),
                    severity: 'serious',
                    reproduction: [
                        '1. Navigate to the page',
                        '2. Press Tab to focus the element',
                        `3. Element at ${entry.selector} has no visible focus indicator`,
                    ],
                });
            }
        }

        return issues;
    }

    /**
     * Test skip link functionality
     */
    private async testSkipLinks(): Promise<StagehandKeyboardIssue[]> {
        const issues: StagehandKeyboardIssue[] = [];

        try {
            // Use Stagehand to find skip links
            const skipLinkInfo = await this.stagehand!.extract(
                'Look for a "skip to main content" or "skip to content" link, usually at the top of the page (may be hidden until focused). Does it exist? If so, what is its selector and does it have a valid target?',
                SkipLinkSchema
            );

            if (!skipLinkInfo?.exists) {
                issues.push({
                    type: 'skip-link-broken',
                    element: {
                        description: 'Skip link',
                        selector: 'body',
                    },
                    message: 'No skip link found on the page',
                    wcagCriteria: getWcagCriteriaForIssue('skip-link-broken'),
                    severity: 'moderate',
                    reproduction: [
                        '1. Navigate to the page',
                        '2. Press Tab once',
                        '3. No skip link appears',
                    ],
                });
            } else if (skipLinkInfo.exists && skipLinkInfo.works === false) {
                issues.push({
                    type: 'skip-link-broken',
                    element: {
                        description: 'Skip link',
                        selector: skipLinkInfo.selector || 'unknown',
                    },
                    message: 'Skip link exists but does not work correctly',
                    wcagCriteria: getWcagCriteriaForIssue('skip-link-broken'),
                    severity: 'serious',
                    reproduction: [
                        '1. Navigate to the page',
                        '2. Press Tab to focus skip link',
                        '3. Press Enter to activate',
                        '4. Focus does not move to main content',
                    ],
                });
            }
        } catch (error) {
            logger.debug(`Failed to test skip links: ${error}`);
        }

        return issues;
    }

    /**
     * Test for focus traps by simulating tab navigation
     */
    private async testFocusTraps(): Promise<StagehandKeyboardIssue[]> {
        const issues: StagehandKeyboardIssue[] = [];
        const page = this.page!;

        try {
            // Use Stagehand's extract to test tab behavior in modals/dialogs
            const tabTestResult = await this.stagehand!.extract(
                'Look for any modal dialogs, dropdown menus, or other interactive widgets currently visible. If any exist, describe if they properly trap focus (focus should stay within the widget until dismissed).',
                TabOrderSchema
            );

            if (tabTestResult?.possibleFocusTrap && tabTestResult.focusTrapElement) {
                // Determine if this is a proper focus trap (modal) or an improper one
                const isModal = await page.evaluate((selector: string) => {
                    const el = document.querySelector(selector);
                    if (!el) return false;
                    const role = el.getAttribute('role');
                    return role === 'dialog' || role === 'alertdialog' || el.tagName === 'DIALOG';
                }, tabTestResult.focusTrapElement);

                if (!isModal) {
                    issues.push({
                        type: 'focus-trap',
                        element: {
                            description: 'Focus trap detected',
                            selector: tabTestResult.focusTrapElement,
                        },
                        message: `Improper focus trap detected at ${tabTestResult.focusTrapElement}`,
                        wcagCriteria: getWcagCriteriaForIssue('focus-trap'),
                        severity: 'critical',
                        reproduction: [
                            '1. Navigate to the page',
                            '2. Tab into the element',
                            '3. Cannot tab out without using mouse',
                        ],
                    });
                }
            }
        } catch (error) {
            logger.debug(`Failed to test focus traps: ${error}`);
        }

        return issues;
    }

    /**
     * Calculate keyboard accessibility coverage
     */
    private async calculateCoverage(): Promise<StagehandKeyboardResults['coverage']> {
        try {
            const interactiveElements = await this.stagehand!.extract(
                'Find all interactive elements on the page (buttons, links, inputs, etc.). For each, determine if it can be accessed and activated using only the keyboard.',
                InteractiveElementsSchema
            );

            if (!interactiveElements) {
                return {
                    totalInteractive: 0,
                    keyboardAccessible: 0,
                    percentAccessible: 0,
                };
            }

            const total = interactiveElements.totalCount;
            const accessible = interactiveElements.elements.filter((e: { isKeyboardAccessible: boolean }) => e.isKeyboardAccessible).length;

            return {
                totalInteractive: total,
                keyboardAccessible: accessible,
                percentAccessible: total > 0 ? Math.round((accessible / total) * 100) : 100,
            };
        } catch (error) {
            logger.debug(`Failed to calculate coverage: ${error}`);
            return {
                totalInteractive: 0,
                keyboardAccessible: 0,
                percentAccessible: 0,
            };
        }
    }

    async close(): Promise<void> {
        if (this.stagehand) {
            await this.stagehand.close();
            this.stagehand = null;
        }
        logger.debug('Stagehand keyboard tester closed');
    }
}
