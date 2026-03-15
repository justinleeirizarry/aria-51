/**
 * React Fiber tree traversal and source enrichment via element-source
 */

import { resolveSource } from 'element-source';
import { getComponentName, type FiberNode } from './component-resolver.js';
import { cleanFilePath } from '../attribution/utils.js';
import type { ComponentInfo } from '../types.js';

/**
 * React DevTools global hook interface
 */
interface ReactDevToolsHook {
    getFiberRoots?: (rendererId: number) => Set<FiberRoot>;
    renderers?: Map<number, unknown>;
}

/**
 * React Fiber Root container
 */
interface FiberRoot {
    current: FiberNode;
}

/**
 * Element with potential React fiber internal properties
 */
interface ElementWithFiber extends Element {
    [key: string]: FiberNode | FiberRoot | unknown;
}

/**
 * Find the React root fiber node
 */
export function findReactRoot(): FiberNode | null {
    // Try to find root via React DevTools hook
    const hook = (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevToolsHook }).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook && hook.getFiberRoots) {
        const roots = hook.getFiberRoots(1);
        if (roots && roots.size > 0) {
            const rootFiber = Array.from(roots)[0] as FiberRoot;
            return rootFiber.current;
        }
    }

    // Fallback: find via DOM - check all elements for fiber keys
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
        const fiberKey = Object.keys(element).find(key =>
            key.startsWith('__reactFiber') ||
            key.startsWith('__reactInternalInstance') ||
            key.startsWith('_reactRootContainer')
        );

        if (fiberKey) {
            const fiber = (element as ElementWithFiber)[fiberKey] as FiberNode;
            let current: FiberNode | null = fiber;
            while (current && current.return) {
                current = current.return;
            }
            if (current) return current;
        }
    }

    // Check the root container specifically
    const rootElement = document.getElementById('root') || document.getElementById('app');
    if (rootElement) {
        const containerKeys = Object.keys(rootElement);
        for (const key of containerKeys) {
            if (key.startsWith('__react') || key.startsWith('_react')) {
                const value = (rootElement as unknown as ElementWithFiber)[key];
                if (value && typeof value === 'object') {
                    const fiberValue = value as FiberNode | FiberRoot;
                    if ('current' in fiberValue && fiberValue.current) return fiberValue.current;
                    if ('return' in fiberValue && fiberValue.return) {
                        let current: FiberNode | null = fiberValue as FiberNode;
                        while (current && current.return) current = current.return;
                        return current;
                    }
                }
            }
        }
    }

    return null;
}

// Maximum fibers to traverse (prevents infinite loops in corrupted trees)
const MAX_FIBER_COUNT = 50000;

/**
 * Traverse the fiber tree and collect component information
 */
export function traverseFiberTree(
    fiber: FiberNode | null,
    components: ComponentInfo[] = [],
    path: string[] = [],
    visited: WeakSet<object> = new WeakSet(),
    count: { value: number } = { value: 0 }
): ComponentInfo[] {
    if (!fiber) return components;

    // Prevent infinite loops
    if (visited.has(fiber)) return components;
    visited.add(fiber);

    // Limit total traversal
    count.value++;
    if (count.value > MAX_FIBER_COUNT) {
        console.warn('[react-a11y-scanner] Max fiber count reached, stopping traversal');
        return components;
    }

    const name = getComponentName(fiber);

    if (name && name !== 'Anonymous' && !name.startsWith('_')) {
        const fiberType = typeof fiber.type === 'string' ? 'host' : 'component';

        const componentInfo: ComponentInfo = {
            name,
            type: fiberType,
            domNode: fiber.stateNode instanceof Element ? fiber.stateNode : null,
            path: [...path, name],
        };

        components.push(componentInfo);
    }

    // Traverse children
    const newPath = name ? [...path, name] : path;
    if (fiber.child) {
        traverseFiberTree(fiber.child, components, newPath, visited, count);
    }

    // Traverse siblings
    if (fiber.sibling) {
        traverseFiberTree(fiber.sibling, components, path, visited, count);
    }

    return components;
}

/**
 * Enrich components with source location data from element-source
 */
export async function enrichComponentsWithSource(components: ComponentInfo[]): Promise<void> {
    for (const component of components) {
        if (component.domNode) {
            try {
                const source = await resolveSource(component.domNode);
                if (source) {
                    component.source = { ...source, filePath: cleanFilePath(source.filePath) };
                }
            } catch {
                // element-source may fail for some elements; skip silently
            }
        }
    }
}

/**
 * Build a map of DOM elements to their React components
 */
export function buildDomToComponentMap(components: ComponentInfo[]): Map<Element, ComponentInfo> {
    const map = new Map<Element, ComponentInfo>();

    for (const component of components) {
        if (component.domNode) {
            map.set(component.domNode, component);
        }
    }

    return map;
}

/**
 * Find the React component for a given DOM element
 * Walks up the DOM tree if the element itself isn't mapped
 */
export function findComponentForElement(
    element: Element | null,
    domToComponentMap: Map<Element, ComponentInfo>
): ComponentInfo | null {
    if (!element) return null;

    // Check if this element is directly mapped
    if (domToComponentMap.has(element)) {
        return domToComponentMap.get(element)!;
    }

    // Walk up the DOM tree to find the nearest parent component
    let current = element.parentElement;
    while (current) {
        if (domToComponentMap.has(current)) {
            return domToComponentMap.get(current)!;
        }
        current = current.parentElement;
    }

    return null;
}
