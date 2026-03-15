/**
 * @accessibility-toolkit/react
 *
 * React plugin for the Accessibility Toolkit. Provides component attribution
 * for accessibility violations by traversing the React Fiber tree.
 *
 * @example
 * ```typescript
 * import { scan } from '@accessibility-toolkit/core';
 * import { ReactPlugin } from '@accessibility-toolkit/react';
 *
 * const results = await scan({
 *   url: 'https://my-react-app.com',
 *   plugins: [ReactPlugin]
 * });
 * ```
 */

// =============================================================================
// Plugin Export
// =============================================================================

export { ReactPlugin, getComponentBundlePath, default } from './plugin.js';

// =============================================================================
// Types
// =============================================================================

export type {
    SourceLocation,
    ComponentInfo,
    ReactScanData,
    AttributedCheck,
    AttributedViolationNode,
    AttributedViolation,
    AttributedPass,
    AttributedIncomplete,
} from './types.js';

// =============================================================================
// Fiber Utilities (for advanced use cases)
// =============================================================================

export {
    findReactRoot,
    traverseFiberTree,
    buildDomToComponentMap,
    findComponentForElement,
    enrichComponentsWithSource,
} from './fiber/traversal.js';

export {
    getComponentName,
    type FiberNode,
} from './fiber/component-resolver.js';

export {
    isFrameworkComponent,
    filterUserComponents,
} from './fiber/framework-filter.js';

// =============================================================================
// Attribution Utilities (for advanced use cases)
// =============================================================================

export {
    attributeViolationsToComponents,
    attributePassesToComponents,
    attributeIncompleteToComponents,
} from './attribution/index.js';

export {
    generateCssSelector,
    extractHtmlSnippet,
    cleanFilePath,
} from './attribution/utils.js';
