/**
 * Orchestration Service - Types
 *
 * The orchestration service has been migrated to Effect-based implementation.
 * Use runScanAsPromise from services/effect for scan operations.
 */
export type {
    BrowserType,
    BaseScanOptions,
    ScanOperationResult,
    ScanProgressStep,
} from './types.js';
