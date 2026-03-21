/**
 * @aria51/react
 *
 * React plugin for the Accessibility Toolkit. Provides component attribution
 * for accessibility violations by traversing the React Fiber tree.
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

