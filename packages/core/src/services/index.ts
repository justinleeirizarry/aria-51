/**
 * Services - Public API
 *
 * This module exports all services for the React A11y Scanner.
 */

// Browser Service
export {
    BrowserService,
    createBrowserService,
    type BrowserServiceConfig,
    type BrowserType,
    type NavigateOptions,
    type StabilityCheckResult,
    type IBrowserService,
} from './browser/index.js';

// Scanner Service
export {
    ScannerService,
    createScannerService,
    type ScanExecutionOptions,
    type IScannerService,
} from './scanner/index.js';

// Results Processor Service
export {
    ResultsProcessorService,
    createResultsProcessorService,
    type ScanMetadata,
    type MCPToolContent,
    type MCPFormatOptions,
    type CIResult,
    type IResultsProcessorService,
} from './processor/index.js';

// Orchestration Types (service migrated to Effect-based implementation)
export type {
    BaseScanOptions,
    ScanOperationResult,
    ScanProgressStep,
} from './orchestration/index.js';
