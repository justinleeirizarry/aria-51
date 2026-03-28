/**
 * Stagehand Accessibility Tree Analyzer
 *
 * Uses Stagehand's extract() API to analyze the accessibility tree
 * and identify structural issues.
 */
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
    TreeAnalysisConfig,
    TreeAnalysisResult,
    TreeIssue,
    TreeIssueType,
    A11yTreeNode,
    WcagCriterionInfo,
} from "../types.js";
import { logger, getCriterionById } from "@aria51/core";
import {
    TREE_ISSUE_WCAG_MAP,
    isValidRole,
    roleRequiresName,
    isFormControlRole,
} from "./a11y-tree-rules.js";

// Zod schemas for structured extraction
const A11yTreeNodeSchema: z.ZodType<A11yTreeNode> = z.lazy(() => z.object({
    role: z.string().describe('ARIA role of the element'),
    name: z.string().optional().describe('Accessible name'),
    description: z.string().optional().describe('Accessible description'),
    selector: z.string().describe('CSS selector to locate this element'),
    checked: z.boolean().optional(),
    disabled: z.boolean().optional(),
    expanded: z.boolean().optional(),
    focused: z.boolean().optional(),
    required: z.boolean().optional(),
    selected: z.boolean().optional(),
    hidden: z.boolean().optional(),
    level: z.number().optional().describe('Heading level (1-6)'),
    children: z.array(z.lazy(() => A11yTreeNodeSchema)).optional(),
})) as z.ZodType<A11yTreeNode>;

const TreeStatsSchema = z.object({
    landmarks: z.array(z.object({
        role: z.string(),
        name: z.string().optional(),
        selector: z.string(),
    })),
    headings: z.array(z.object({
        level: z.number(),
        text: z.string(),
        selector: z.string(),
    })),
    formControls: z.array(z.object({
        role: z.string(),
        label: z.string().optional(),
        selector: z.string(),
    })),
    interactiveElements: z.array(z.object({
        role: z.string(),
        name: z.string().optional(),
        selector: z.string(),
    })),
});

/**
 * Get WCAG criteria for a tree issue type
 */
function getWcagCriteriaForIssue(issueType: TreeIssueType): WcagCriterionInfo[] {
    const criteriaIds = TREE_ISSUE_WCAG_MAP[issueType] || [];
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

export class StagehandTreeAnalyzer {
    private stagehand: Stagehand | null = null;
    private config: TreeAnalysisConfig;

    constructor(config: TreeAnalysisConfig = {}) {
        this.config = {
            verbose: false,
            model: 'gpt-4o-mini',
            includeFullTree: false,
            ...config,
        };
    }

    get page() {
        if (!this.stagehand) return null;
        // @ts-ignore - Stagehand exposes page
        return this.stagehand.page || this.stagehand.context?.pages()[0] || null;
    }

    async init(): Promise<void> {
        logger.debug('Initializing Stagehand tree analyzer...');

        try {
            const options = {
                env: "LOCAL" as const,
                modelName: this.config.model || "gpt-4o-mini",
                verbose: (this.config.verbose ? 2 : 0) as 0 | 2,
                headless: true,
            };

            this.stagehand = new Stagehand(options);
            await this.stagehand.init();
            logger.debug('Stagehand tree analyzer initialized');
        } catch (error) {
            logger.error(`Failed to initialize Stagehand: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    async analyze(url: string): Promise<TreeAnalysisResult> {
        if (!this.stagehand) {
            throw new Error("Stagehand not initialized");
        }

        logger.debug(`Analyzing accessibility tree for ${url}...`);

        const page = this.page;
        if (!page) {
            throw new Error("Page not available");
        }

        // Navigate to the URL
        await page.goto(url, { waitUntil: 'networkidle' });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract accessibility tree structure
        logger.debug('Extracting accessibility tree...');
        const tree = await this.extractTree();

        // Extract tree statistics
        logger.debug('Extracting tree statistics...');
        const stats = await this.extractStats();

        // Analyze for issues
        logger.debug('Analyzing for accessibility issues...');
        const issues = await this.analyzeIssues(tree, stats);

        // Build summary
        const summary = {
            totalIssues: issues.length,
            bySeverity: issues.reduce((acc, issue) => {
                acc[issue.severity] = (acc[issue.severity] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
        };

        return {
            url,
            timestamp: new Date().toISOString(),
            tree: this.config.includeFullTree ? tree : { role: 'document', selector: 'html' },
            stats: {
                landmarks: stats.landmarks.length,
                headings: stats.headings.length,
                formControls: stats.formControls.length,
                interactiveElements: stats.interactiveElements.length,
                totalNodes: this.countNodes(tree),
            },
            issues,
            summary,
        };
    }

    /**
     * Extract the accessibility tree structure
     */
    private async extractTree(): Promise<A11yTreeNode> {
        try {
            const tree = await this.stagehand!.extract(
                `Extract the accessibility tree structure of the page.
                For each element, provide:
                - role: The ARIA role (button, link, heading, etc.)
                - name: The accessible name
                - selector: A CSS selector to locate it
                - Any state properties (checked, disabled, expanded, etc.)
                - children: Nested children elements
                Focus on semantic elements (headings, landmarks, interactive elements, form controls).
                Limit depth to 5 levels and skip purely decorative elements.`,
                A11yTreeNodeSchema
            );

            return tree || { role: 'document', selector: 'html' };
        } catch (error) {
            logger.debug(`Failed to extract tree: ${error}`);
            return { role: 'document', selector: 'html' };
        }
    }

    /**
     * Extract accessibility tree statistics
     */
    private async extractStats(): Promise<z.infer<typeof TreeStatsSchema>> {
        try {
            const stats = await this.stagehand!.extract(
                `Analyze the page and provide:
                1. landmarks: All ARIA landmark regions (banner, main, navigation, complementary, contentinfo, search, form, region)
                2. headings: All headings (h1-h6) with their level and text content
                3. formControls: All form controls (inputs, buttons, selects, textareas) with their labels
                4. interactiveElements: All interactive elements (buttons, links, checkboxes, etc.) with their accessible names`,
                TreeStatsSchema
            );

            return stats || {
                landmarks: [],
                headings: [],
                formControls: [],
                interactiveElements: [],
            };
        } catch (error) {
            logger.debug(`Failed to extract stats: ${error}`);
            return {
                landmarks: [],
                headings: [],
                formControls: [],
                interactiveElements: [],
            };
        }
    }

    /**
     * Analyze the tree for accessibility issues
     */
    private async analyzeIssues(
        tree: A11yTreeNode,
        stats: z.infer<typeof TreeStatsSchema>
    ): Promise<TreeIssue[]> {
        const issues: TreeIssue[] = [];

        // Check for missing landmarks
        const requiredLandmarks = ['main'];
        for (const required of requiredLandmarks) {
            if (!stats.landmarks.some(l => l.role === required)) {
                issues.push({
                    type: 'missing-landmark',
                    node: { role: 'document', selector: 'html' },
                    message: `Page is missing a ${required} landmark`,
                    wcagCriteria: getWcagCriteriaForIssue('missing-landmark'),
                    severity: 'serious',
                });
            }
        }

        // Check heading structure
        issues.push(...this.checkHeadingStructure(stats.headings));

        // Check for missing names on interactive elements
        for (const element of stats.interactiveElements) {
            if (!element.name && roleRequiresName(element.role)) {
                issues.push({
                    type: 'missing-name',
                    node: {
                        role: element.role,
                        selector: element.selector,
                    },
                    message: `Interactive element with role "${element.role}" is missing an accessible name`,
                    wcagCriteria: getWcagCriteriaForIssue('missing-name'),
                    severity: 'critical',
                });
            }
        }

        // Check for form controls without labels
        for (const control of stats.formControls) {
            if (!control.label && isFormControlRole(control.role)) {
                issues.push({
                    type: 'orphaned-control',
                    node: {
                        role: control.role,
                        selector: control.selector,
                    },
                    message: `Form control with role "${control.role}" is missing a label`,
                    wcagCriteria: getWcagCriteriaForIssue('orphaned-control'),
                    severity: 'critical',
                });
            }
        }

        // Check for invalid roles in the tree
        issues.push(...this.checkInvalidRoles(tree));

        // Check for focusable hidden elements
        issues.push(...await this.checkFocusableHidden());

        // Check for duplicate IDs
        issues.push(...await this.checkDuplicateIds());

        return issues;
    }

    /**
     * Check heading structure for skipped levels
     */
    private checkHeadingStructure(
        headings: Array<{ level: number; text: string; selector: string }>
    ): TreeIssue[] {
        const issues: TreeIssue[] = [];

        if (headings.length === 0) {
            issues.push({
                type: 'heading-skip',
                node: { role: 'document', selector: 'html' },
                message: 'Page has no headings',
                wcagCriteria: getWcagCriteriaForIssue('heading-skip'),
                severity: 'moderate',
            });
            return issues;
        }

        // Check if first heading is h1
        if (headings[0]?.level !== 1) {
            issues.push({
                type: 'heading-skip',
                node: {
                    role: 'heading',
                    selector: headings[0]?.selector || 'unknown',
                },
                message: `Page does not start with an h1 (starts with h${headings[0]?.level})`,
                wcagCriteria: getWcagCriteriaForIssue('heading-skip'),
                severity: 'moderate',
            });
        }

        // Check for skipped levels
        let previousLevel = 0;
        for (const heading of headings) {
            if (heading.level > previousLevel + 1 && previousLevel > 0) {
                issues.push({
                    type: 'heading-skip',
                    node: {
                        role: 'heading',
                        name: heading.text,
                        selector: heading.selector,
                    },
                    message: `Heading level skipped: h${previousLevel} to h${heading.level}`,
                    wcagCriteria: getWcagCriteriaForIssue('heading-skip'),
                    severity: 'moderate',
                });
            }
            previousLevel = heading.level;
        }

        return issues;
    }

    /**
     * Recursively check for invalid roles in the tree
     */
    private checkInvalidRoles(node: A11yTreeNode, issues: TreeIssue[] = []): TreeIssue[] {
        if (node.role && !isValidRole(node.role)) {
            issues.push({
                type: 'invalid-role',
                node: {
                    role: node.role,
                    name: node.name,
                    selector: node.selector,
                },
                message: `Invalid ARIA role: "${node.role}"`,
                wcagCriteria: getWcagCriteriaForIssue('invalid-role'),
                severity: 'serious',
            });
        }

        if (node.children) {
            for (const child of node.children) {
                this.checkInvalidRoles(child, issues);
            }
        }

        return issues;
    }

    /**
     * Check for focusable elements that are hidden
     */
    private async checkFocusableHidden(): Promise<TreeIssue[]> {
        const issues: TreeIssue[] = [];
        const page = this.page!;

        try {
            const hiddenFocusable = await page.evaluate(() => {
                const results: Array<{ selector: string; role: string }> = [];
                const focusable = document.querySelectorAll(
                    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );

                for (const el of focusable) {
                    const style = window.getComputedStyle(el);
                    const isHidden = style.display === 'none' ||
                        style.visibility === 'hidden' ||
                        el.hasAttribute('hidden') ||
                        el.getAttribute('aria-hidden') === 'true';

                    // Check if hidden but still focusable (not tabindex=-1)
                    const tabindex = el.getAttribute('tabindex');
                    if (isHidden && tabindex !== '-1') {
                        // Generate a simple selector
                        let selector = el.tagName.toLowerCase();
                        if (el.id) selector += `#${el.id}`;
                        else if (el.className) selector += `.${el.className.split(' ')[0]}`;

                        results.push({
                            selector,
                            role: el.getAttribute('role') || el.tagName.toLowerCase(),
                        });
                    }
                }

                return results;
            });

            for (const element of hiddenFocusable) {
                issues.push({
                    type: 'focusable-hidden',
                    node: {
                        role: element.role,
                        selector: element.selector,
                    },
                    message: `Hidden element is still focusable: ${element.selector}`,
                    wcagCriteria: getWcagCriteriaForIssue('focusable-hidden'),
                    severity: 'serious',
                });
            }
        } catch (error) {
            logger.debug(`Failed to check focusable hidden: ${error}`);
        }

        return issues;
    }

    /**
     * Check for duplicate IDs
     */
    private async checkDuplicateIds(): Promise<TreeIssue[]> {
        const issues: TreeIssue[] = [];
        const page = this.page!;

        try {
            const duplicates = await page.evaluate(() => {
                const ids = new Map<string, number>();
                const elements = document.querySelectorAll('[id]');

                for (const el of elements) {
                    const id = el.id;
                    if (id) {
                        ids.set(id, (ids.get(id) || 0) + 1);
                    }
                }

                return Array.from(ids.entries())
                    .filter(([, count]) => count > 1)
                    .map(([id, count]) => ({ id, count }));
            });

            for (const dup of duplicates) {
                issues.push({
                    type: 'duplicate-id',
                    node: {
                        role: 'generic',
                        selector: `#${dup.id}`,
                    },
                    message: `Duplicate ID "${dup.id}" found ${dup.count} times`,
                    wcagCriteria: getWcagCriteriaForIssue('duplicate-id'),
                    severity: 'moderate',
                });
            }
        } catch (error) {
            logger.debug(`Failed to check duplicate IDs: ${error}`);
        }

        return issues;
    }

    /**
     * Count total nodes in the tree
     */
    private countNodes(node: A11yTreeNode): number {
        let count = 1;
        if (node.children) {
            for (const child of node.children) {
                count += this.countNodes(child);
            }
        }
        return count;
    }

    async close(): Promise<void> {
        if (this.stagehand) {
            await this.stagehand.close();
            this.stagehand = null;
        }
        logger.debug('Stagehand tree analyzer closed');
    }
}
