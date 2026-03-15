/**
 * Violation attribution - maps axe violations to React components
 * Uses element-source for direct DOM→component lookup when possible
 */

import { resolveElementInfo } from 'element-source';
import type {
    AxeResult,
    AxeViolation,
    AxeCheckResult,
} from '@accessibility-toolkit/core';
import type {
    ComponentInfo,
    AttributedViolation,
    AttributedPass,
    AttributedIncomplete,
    AttributedCheck,
    AttributedViolationNode,
} from '../types.js';
import { findComponentForElement } from '../fiber/traversal.js';
import { filterUserComponents, isFrameworkComponent } from '../fiber/framework-filter.js';
import { generateCssSelector, extractHtmlSnippet, cleanFilePath } from './utils.js';

/**
 * Clean source location file paths
 */
function cleanSource(s: { filePath: string; lineNumber: number | null; columnNumber: number | null; componentName?: string | null }) {
    return { ...s, filePath: cleanFilePath(s.filePath) };
}

/**
 * Try to get component info directly from DOM element using element-source
 */
async function getComponentFromElement(element: Element): Promise<ComponentInfo | null> {
    try {
        const info = await resolveElementInfo(element);
        if (!info?.componentName) return null;

        const path = info.stack
            ?.map(s => s.componentName)
            .filter((n): n is string => typeof n === 'string' && n.length > 0)
            .reverse() ?? [];

        // Build the full source stack with locations at each component level
        const sourceStack = info.stack
            ?.filter(s => s.filePath)
            .map(s => cleanSource({
                filePath: s.filePath,
                lineNumber: s.lineNumber,
                columnNumber: s.columnNumber,
                componentName: s.componentName,
            })) ?? [];

        const source = info.source ? cleanSource(info.source) : undefined;

        return {
            name: info.componentName,
            type: info.tagName === info.componentName ? 'host' : 'component',
            domNode: element,
            path,
            source,
            sourceStack: sourceStack.length > 0 ? sourceStack : undefined,
        };
    } catch {
        return null;
    }
}

/**
 * Convert axe check results to attributed checks with snippets
 */
function convertChecks(checks: AxeCheckResult[] | undefined): AttributedCheck[] | undefined {
    if (!checks || checks.length === 0) return undefined;

    return checks.map(check => ({
        id: check.id,
        impact: check.impact,
        message: check.message,
        relatedNodes: check.relatedNodes?.map(rn => ({
            html: rn.html,
            target: rn.target,
            htmlSnippet: extractHtmlSnippet(rn.html)
        }))
    }));
}

/**
 * Attribute violations to React components
 * Uses element-source for direct DOM→component lookup when possible
 */
export async function attributeViolationsToComponents(
    violations: AxeViolation[],
    domToComponentMap: Map<Element, ComponentInfo>
): Promise<AttributedViolation[]> {
    const attributed: AttributedViolation[] = [];

    for (const violation of violations) {
        const attributedNodes: AttributedViolationNode[] = [];

        for (const node of violation.nodes) {
            const selector = node.target[0];

            let element: Element | null = null;
            let component: ComponentInfo | null = null;

            try {
                element = document.querySelector(selector);

                if (element) {
                    // Try element-source's direct lookup first (more accurate)
                    component = await getComponentFromElement(element);

                    // Fallback to pre-built map if element-source lookup fails
                    if (!component) {
                        component = findComponentForElement(element, domToComponentMap);
                    }
                }
            } catch (error) {
                console.warn(`Could not find element for selector: ${selector}`, error);
            }

            const userPath = component?.path ? filterUserComponents(component.path) : [];
            const isFramework = component ? isFrameworkComponent(component.name) : false;
            const cssSelector = element ? generateCssSelector(element) : node.target[0];
            const htmlSnippet = extractHtmlSnippet(node.html);

            const hasChecks = node.any?.length || node.all?.length || node.none?.length;
            const checks = hasChecks ? {
                any: convertChecks(node.any),
                all: convertChecks(node.all),
                none: convertChecks(node.none)
            } : undefined;

            attributedNodes.push({
                component: component?.name || null,
                componentPath: component?.path || [],
                userComponentPath: userPath,
                componentType: component ? (component.type as 'host' | 'component') : null,
                html: node.html,
                htmlSnippet,
                cssSelector,
                target: node.target,
                failureSummary: node.failureSummary || '',
                isFrameworkComponent: isFramework,
                source: component?.source,
                sourceStack: component?.sourceStack,
                checks,
            });
        }

        attributed.push({
            id: violation.id,
            impact: violation.impact,
            description: violation.description,
            help: violation.help,
            helpUrl: violation.helpUrl,
            tags: violation.tags || [],
            nodes: attributedNodes,
        });
    }

    return attributed;
}

/**
 * Attribute passes to React components (lighter attribution - just component name)
 */
export async function attributePassesToComponents(
    passes: AxeResult[],
    domToComponentMap: Map<Element, ComponentInfo>
): Promise<AttributedPass[]> {
    const results: AttributedPass[] = [];

    for (const pass of passes) {
        const nodes: AttributedPass['nodes'] = [];
        for (const node of pass.nodes) {
            const selector = node.target[0];
            let component: ComponentInfo | null = null;

            try {
                const element = document.querySelector(selector);
                if (element) {
                    component = await getComponentFromElement(element) ||
                        findComponentForElement(element, domToComponentMap);
                }
            } catch {
                // Ignore selector errors
            }

            nodes.push({
                component: component?.name || null,
                html: node.html,
                htmlSnippet: extractHtmlSnippet(node.html),
                target: node.target
            });
        }

        results.push({
            id: pass.id,
            impact: pass.impact,
            description: pass.description,
            help: pass.help,
            helpUrl: pass.helpUrl,
            tags: pass.tags || [],
            nodes,
        });
    }

    return results;
}

/**
 * Attribute incomplete results to React components
 */
export async function attributeIncompleteToComponents(
    incomplete: AxeResult[],
    domToComponentMap: Map<Element, ComponentInfo>
): Promise<AttributedIncomplete[]> {
    const results: AttributedIncomplete[] = [];

    for (const item of incomplete) {
        const nodes: AttributedIncomplete['nodes'] = [];
        for (const node of item.nodes) {
            const selector = node.target[0];
            let component: ComponentInfo | null = null;

            try {
                const element = document.querySelector(selector);
                if (element) {
                    component = await getComponentFromElement(element) ||
                        findComponentForElement(element, domToComponentMap);
                }
            } catch {
                // Ignore selector errors
            }

            const hasChecks = node.any?.length || node.all?.length || node.none?.length;
            const checks = hasChecks ? {
                any: convertChecks(node.any),
                all: convertChecks(node.all),
                none: convertChecks(node.none)
            } : undefined;

            const message = node.any?.[0]?.message || node.all?.[0]?.message || undefined;

            nodes.push({
                component: component?.name || null,
                html: node.html,
                htmlSnippet: extractHtmlSnippet(node.html),
                target: node.target,
                message,
                checks
            });
        }

        results.push({
            id: item.id,
            impact: item.impact,
            description: item.description,
            help: item.help,
            helpUrl: item.helpUrl,
            tags: item.tags || [],
            nodes,
        });
    }

    return results;
}
