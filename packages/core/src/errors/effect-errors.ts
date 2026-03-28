/**
 * Domain error types using Data.TaggedError
 *
 * These error types can be used with Effect's typed error channel
 * for exhaustive error handling in Effect workflows.
 */
import { Data } from 'effect';

/**
 * React was not detected on the page
 */
export class ReactNotDetectedError extends Data.TaggedError('ReactNotDetectedError')<{
    readonly url: string;
}> {}

/**
 * Browser launch failed
 */
export class BrowserLaunchError extends Data.TaggedError('BrowserLaunchError')<{
    readonly browserType: string;
    readonly reason?: string;
}> {}

/**
 * Browser is not in the expected state
 */
export class BrowserNotLaunchedError extends Data.TaggedError('BrowserNotLaunchedError')<{
    readonly operation: string;
}> {}

/**
 * Browser is already launched when it shouldn't be
 */
export class BrowserAlreadyLaunchedError extends Data.TaggedError(
    'BrowserAlreadyLaunchedError'
)<Record<string, never>> {}

/**
 * Page navigation timed out
 */
export class NavigationTimeoutError extends Data.TaggedError('NavigationTimeoutError')<{
    readonly url: string;
    readonly timeout: number;
}> {}

/**
 * Page navigation failed
 */
export class NavigationError extends Data.TaggedError('NavigationError')<{
    readonly url: string;
    readonly reason?: string;
}> {}

/**
 * Browser context was destroyed during scan
 */
export class ContextDestroyedError extends Data.TaggedError('ContextDestroyedError')<{
    readonly message?: string;
}> {}

/**
 * Scanner bundle failed to inject or execute
 */
export class ScannerInjectionError extends Data.TaggedError('ScannerInjectionError')<{
    readonly reason: string;
}> {}

/**
 * Scan exceeded maximum retry attempts
 */
export class MaxRetriesExceededError extends Data.TaggedError('MaxRetriesExceededError')<{
    readonly attempts: number;
    readonly lastError?: string;
}> {}

/**
 * Invalid configuration provided
 */
export class ConfigurationError extends Data.TaggedError('ConfigurationError')<{
    readonly message: string;
    readonly invalidField?: string;
}> {}

/**
 * Invalid URL provided
 */
export class InvalidUrlError extends Data.TaggedError('InvalidUrlError')<{
    readonly url: string;
    readonly reason?: string;
}> {}

/**
 * File system operation failed
 */
export class FileSystemError extends Data.TaggedError('FileSystemError')<{
    readonly operation: string;
    readonly path: string;
    readonly reason?: string;
}> {}

/**
 * Service is in an invalid state for the requested operation
 */
export class ServiceStateError extends Data.TaggedError('ServiceStateError')<{
    readonly service: string;
    readonly expectedState: string;
    readonly actualState: string;
}> {}

/**
 * Scan data is invalid or missing
 */
export class ScanDataError extends Data.TaggedError('ScanDataError')<{
    readonly reason: string;
}> {}

/**
 * Union of all browser-related errors
 */
export type BrowserErrors =
    | BrowserLaunchError
    | BrowserNotLaunchedError
    | BrowserAlreadyLaunchedError
    | NavigationTimeoutError
    | NavigationError
    | ContextDestroyedError;

/**
 * Union of all scan-related errors
 */
export type ScanErrors =
    | ReactNotDetectedError
    | ScannerInjectionError
    | MaxRetriesExceededError
    | ScanDataError;

/**
 * Union of all validation errors
 */
export type ValidationErrors = ConfigurationError | InvalidUrlError;

/**
 * Union of all errors for the scan workflow
 */
export type ScanWorkflowErrors =
    | BrowserErrors
    | ScanErrors
    | ValidationErrors
    | ServiceStateError
    | FileSystemError;
