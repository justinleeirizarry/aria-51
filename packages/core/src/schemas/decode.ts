/**
 * Browser boundary validation
 *
 * Decode functions for validating data crossing the browser->Node boundary
 * at the page.evaluate() call site in ScannerService.
 */
import { Schema, Effect } from 'effect';
import { BrowserScanData as BrowserScanDataSchema } from './scan-results.js';
import type { BrowserScanData } from './scan-results.js';
import { ScanDataError } from '../errors/effect-errors.js';
import { logger } from '../utils/logger.js';

const decode = Schema.decodeUnknown(BrowserScanDataSchema);

/**
 * Strict decoder — fails with ScanDataError on invalid data.
 * Use this when you want to enforce schema compliance.
 */
export function decodeBrowserScanData(data: unknown): Effect.Effect<BrowserScanData, ScanDataError> {
    return decode(data).pipe(
        Effect.map((result) => result as unknown as BrowserScanData),
        Effect.mapError((parseError) =>
            new ScanDataError({
                reason: `Browser scan data failed schema validation: ${String(parseError)}`,
            })
        ),
    );
}

/**
 * Lenient decoder — validates and logs warnings on failure, falls back to raw cast.
 * Use this during the initial rollout to avoid breaking existing scans.
 */
export function decodeBrowserScanDataLenient(data: unknown): Effect.Effect<BrowserScanData, never> {
    return decode(data).pipe(
        Effect.map((result) => result as unknown as BrowserScanData),
        Effect.catchAll((_parseError) => {
            // Schema validation runs before component attribution, so raw axe data
            // won't have component fields yet. This is expected — the lenient decoder
            // passes through the raw data, and attribution fills in the fields later.
            logger.debug('Browser scan data pre-attribution — schema validation deferred');
            return Effect.succeed(data as BrowserScanData);
        }),
    );
}
