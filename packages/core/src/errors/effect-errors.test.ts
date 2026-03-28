import { describe, it, expect } from 'vitest';
import { Effect, Exit } from 'effect';
import {
    ReactNotDetectedError,
    BrowserLaunchError,
    BrowserNotLaunchedError,
    BrowserAlreadyLaunchedError,
    NavigationTimeoutError,
    NavigationError,
    ContextDestroyedError,
    ScannerInjectionError,
    MaxRetriesExceededError,
    ConfigurationError,
    InvalidUrlError,
    FileSystemError,
    ServiceStateError,
    ScanDataError,
} from './effect-errors.js';

describe('Effect Errors', () => {
    describe('ReactNotDetectedError', () => {
        it('should create error with url', () => {
            const error = new ReactNotDetectedError({ url: 'http://example.com' });
            expect(error._tag).toBe('ReactNotDetectedError');
            expect(error.url).toBe('http://example.com');
        });

        it('should work in Effect error channel', async () => {
            const effect = Effect.fail(
                new ReactNotDetectedError({ url: 'http://example.com' })
            );
            const exit = await Effect.runPromiseExit(effect);

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit)) {
                const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
                expect(error?._tag).toBe('ReactNotDetectedError');
            }
        });
    });

    describe('BrowserLaunchError', () => {
        it('should create error with browserType and optional reason', () => {
            const error = new BrowserLaunchError({
                browserType: 'chromium',
                reason: 'Not installed',
            });
            expect(error._tag).toBe('BrowserLaunchError');
            expect(error.browserType).toBe('chromium');
            expect(error.reason).toBe('Not installed');
        });

        it('should create error without reason', () => {
            const error = new BrowserLaunchError({ browserType: 'firefox' });
            expect(error.reason).toBeUndefined();
        });
    });

    describe('BrowserNotLaunchedError', () => {
        it('should create error with operation', () => {
            const error = new BrowserNotLaunchedError({ operation: 'navigate' });
            expect(error._tag).toBe('BrowserNotLaunchedError');
            expect(error.operation).toBe('navigate');
        });
    });

    describe('BrowserAlreadyLaunchedError', () => {
        it('should create error', () => {
            const error = new BrowserAlreadyLaunchedError({});
            expect(error._tag).toBe('BrowserAlreadyLaunchedError');
        });
    });

    describe('NavigationTimeoutError', () => {
        it('should create error with url and timeout', () => {
            const error = new NavigationTimeoutError({
                url: 'http://example.com',
                timeout: 30000,
            });
            expect(error._tag).toBe('NavigationTimeoutError');
            expect(error.url).toBe('http://example.com');
            expect(error.timeout).toBe(30000);
        });
    });

    describe('NavigationError', () => {
        it('should create error with url and optional reason', () => {
            const error = new NavigationError({
                url: 'http://example.com',
                reason: 'Connection refused',
            });
            expect(error._tag).toBe('NavigationError');
            expect(error.url).toBe('http://example.com');
            expect(error.reason).toBe('Connection refused');
        });
    });

    describe('ContextDestroyedError', () => {
        it('should create error with optional message', () => {
            const error = new ContextDestroyedError({
                message: 'Page was closed',
            });
            expect(error._tag).toBe('ContextDestroyedError');
            expect(error.message).toBe('Page was closed');
        });
    });

    describe('ScannerInjectionError', () => {
        it('should create error with reason', () => {
            const error = new ScannerInjectionError({
                reason: 'Bundle not found',
            });
            expect(error._tag).toBe('ScannerInjectionError');
            expect(error.reason).toBe('Bundle not found');
        });
    });

    describe('MaxRetriesExceededError', () => {
        it('should create error with attempts and optional lastError', () => {
            const error = new MaxRetriesExceededError({
                attempts: 3,
                lastError: 'Connection timeout',
            });
            expect(error._tag).toBe('MaxRetriesExceededError');
            expect(error.attempts).toBe(3);
            expect(error.lastError).toBe('Connection timeout');
        });
    });

    describe('ConfigurationError', () => {
        it('should create error with message and optional field', () => {
            const error = new ConfigurationError({
                message: 'Invalid timeout value',
                invalidField: 'timeout',
            });
            expect(error._tag).toBe('ConfigurationError');
            expect(error.message).toBe('Invalid timeout value');
            expect(error.invalidField).toBe('timeout');
        });
    });

    describe('InvalidUrlError', () => {
        it('should create error with url and optional reason', () => {
            const error = new InvalidUrlError({
                url: 'not-a-url',
                reason: 'Missing protocol',
            });
            expect(error._tag).toBe('InvalidUrlError');
            expect(error.url).toBe('not-a-url');
            expect(error.reason).toBe('Missing protocol');
        });
    });

    describe('FileSystemError', () => {
        it('should create error with operation, path, and optional reason', () => {
            const error = new FileSystemError({
                operation: 'write',
                path: '/tmp/output.json',
                reason: 'Permission denied',
            });
            expect(error._tag).toBe('FileSystemError');
            expect(error.operation).toBe('write');
            expect(error.path).toBe('/tmp/output.json');
            expect(error.reason).toBe('Permission denied');
        });
    });

    describe('ServiceStateError', () => {
        it('should create error with service, expectedState, and actualState', () => {
            const error = new ServiceStateError({
                service: 'BrowserService',
                expectedState: 'launched',
                actualState: 'not launched',
            });
            expect(error._tag).toBe('ServiceStateError');
            expect(error.service).toBe('BrowserService');
            expect(error.expectedState).toBe('launched');
            expect(error.actualState).toBe('not launched');
        });
    });

    describe('ScanDataError', () => {
        it('should create error with reason', () => {
            const error = new ScanDataError({
                reason: 'No scan data returned from browser',
            });
            expect(error._tag).toBe('ScanDataError');
            expect(error.reason).toBe('No scan data returned from browser');
        });
    });

    describe('Error matching with Effect', () => {
        it('should support pattern matching on error types', async () => {
            type AppError = ReactNotDetectedError | BrowserLaunchError;

            const effect: Effect.Effect<string, AppError> = Effect.fail(
                new ReactNotDetectedError({ url: 'http://example.com' })
            );

            const handled = effect.pipe(
                Effect.catchTag('ReactNotDetectedError', (error) =>
                    Effect.succeed(`React not found at ${error.url}`)
                ),
                Effect.catchTag('BrowserLaunchError', (error) =>
                    Effect.succeed(`Failed to launch ${error.browserType}`)
                )
            );

            const result = await Effect.runPromise(handled);
            expect(result).toBe('React not found at http://example.com');
        });
    });
});
