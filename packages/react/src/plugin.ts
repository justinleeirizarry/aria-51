/**
 * React Plugin for Accessibility Toolkit
 *
 * Provides React component attribution for accessibility violations
 * by traversing the React Fiber tree and mapping DOM elements to components.
 */

import type { Page } from 'playwright';
import type { FrameworkPlugin, FrameworkScanData, AttributedViolation } from '@aria51/core';
import type { AxeViolation } from '@aria51/core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the absolute path to the component attribution bundle
 *
 * Use this to pass the bundle path to the core scanner for automatic
 * component attribution when a supported framework is detected.
 */
export function getComponentBundlePath(): string {
    return join(__dirname, '../dist/react-bundle.js');
}

/**
 * Load the React bundle for injection into the page
 */
async function loadReactBundle(): Promise<string> {
    const bundlePath = getComponentBundlePath();
    return readFileSync(bundlePath, 'utf-8');
}

/**
 * React Plugin - implements FrameworkPlugin interface
 *
 * Use this plugin to add React component attribution to accessibility scans.
 *
 * @example
 * ```typescript
 * import { scan } from '@aria51/core';
 * import { ReactPlugin } from '@aria51/react';
 *
 * const results = await scan({
 *   url: 'https://my-react-app.com',
 *   plugins: [ReactPlugin]
 * });
 *
 * // Results now include component attribution
 * for (const violation of results.violations) {
 *   for (const node of violation.nodes) {
 *     console.log(`Component: ${node.component}`);
 *     console.log(`Path: ${node.componentPath.join(' > ')}`);
 *   }
 * }
 * ```
 */
export const ReactPlugin: FrameworkPlugin = {
    name: 'react',

    /**
     * Detect if React is present on the page
     */
    async detect(page: Page): Promise<boolean> {
        return page.evaluate(() => {
            // Helper function to check if element has React fiber
            function hasReactFiber(element: Element): boolean {
                const keys = Object.keys(element);
                return keys.some(
                    (key) =>
                        key.startsWith('__reactFiber') ||
                        key.startsWith('__reactProps') ||
                        key.startsWith('__reactInternalInstance')
                );
            }

            // 1. Fast path: Check DevTools hook first (most reliable)
            if (typeof window !== 'undefined' && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
                if (hook.getFiberRoots && hook.getFiberRoots(1)?.size > 0) {
                    return true;
                }
            }

            // 2. Check common React root containers
            const rootSelectors = ['#root', '#app', '#__next', '[data-reactroot]', '[data-reactid]'];
            for (const selector of rootSelectors) {
                const element = document.querySelector(selector);
                if (element && hasReactFiber(element)) {
                    return true;
                }
            }

            // 3. Sample random elements
            const allElements = document.querySelectorAll('*');
            const sampleSize = Math.min(100, allElements.length);
            const step = Math.max(1, Math.floor(allElements.length / sampleSize));

            for (let i = 0; i < allElements.length; i += step) {
                if (hasReactFiber(allElements[i])) {
                    return true;
                }
            }

            return false;
        });
    },

    /**
     * Scan the page for React components
     */
    async scan(page: Page): Promise<FrameworkScanData> {
        // Inject the React-specific bundle
        const bundlePath = join(__dirname, '../dist/react-bundle.js');
        await page.addScriptTag({ path: bundlePath });

        // Execute the scan in the browser context
        const result = await page.evaluate(() => {
            return (window as any).Aria51ReactPlugin.scan();
        });

        // Convert the serialized map back to a Map
        const domToComponentMap = new Map();
        // Note: The map is serialized as an array of entries during page.evaluate
        // We store it as metadata for now since we can't transfer DOM references

        return {
            components: result.components,
            domToComponentMap,
            metadata: {
                totalComponents: result.components.length,
                hasReactRoot: true,
            },
        };
    },

    /**
     * Attribute violations to React components
     *
     * Note: This runs in Node.js context after the scan, so we need to
     * re-query the page or use the metadata collected during scan.
     */
    attributeViolations(
        violations: AxeViolation[],
        data: FrameworkScanData
    ): AttributedViolation[] {
        // This would typically be done in the browser context during scan
        // For now, we return violations with placeholder attribution
        // The actual attribution happens in the browser bundle
        return violations.map(violation => ({
            id: violation.id,
            impact: violation.impact,
            description: violation.description,
            help: violation.help,
            helpUrl: violation.helpUrl,
            tags: violation.tags || [],
            nodes: violation.nodes.map(node => ({
                component: null,
                componentPath: [],
                userComponentPath: [],
                componentType: null,
                html: node.html,
                htmlSnippet: node.html.substring(0, 100),
                cssSelector: node.target[0] || '',
                target: node.target,
                failureSummary: node.failureSummary || '',
                isFrameworkComponent: false,
            })),
        }));
    },
};

export default ReactPlugin;
