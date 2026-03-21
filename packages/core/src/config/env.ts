/**
 * Environment variable configuration loading
 *
 * Loads configuration from environment variables with the prefix ARIA51_
 * Environment variables take precedence over config file settings.
 */

import type { DeepPartial } from '../utils/deep-merge.js';
import type { ScannerConfig } from './defaults.js';

/**
 * Environment variable prefix for all config options
 */
const ENV_PREFIX = 'ARIA51_';

/**
 * Mapping of environment variables to config paths
 * Keys are env var names (without prefix), values are { path, type }
 */
const ENV_VAR_MAP = {
    // Browser config
    BROWSER_HEADLESS: { path: ['browser', 'headless'], type: 'boolean' },
    BROWSER_TIMEOUT: { path: ['browser', 'timeout'], type: 'number' },
    BROWSER_STABILIZATION_DELAY: { path: ['browser', 'stabilizationDelay'], type: 'number' },
    BROWSER_MAX_NAVIGATION_WAITS: { path: ['browser', 'maxNavigationWaits'], type: 'number' },
    BROWSER_NAVIGATION_CHECK_INTERVAL: { path: ['browser', 'navigationCheckInterval'], type: 'number' },
    BROWSER_NETWORK_IDLE_TIMEOUT: { path: ['browser', 'networkIdleTimeout'], type: 'number' },
    BROWSER_POST_NAVIGATION_DELAY: { path: ['browser', 'postNavigationDelay'], type: 'number' },

    // Scan config
    SCAN_MAX_RETRIES: { path: ['scan', 'maxRetries'], type: 'number' },
    SCAN_RETRY_DELAY_BASE: { path: ['scan', 'retryDelayBase'], type: 'number' },
    SCAN_MAX_ELEMENTS_TO_CHECK: { path: ['scan', 'maxElementsToCheck'], type: 'number' },
} as const;

/**
 * Type for the value types we can parse
 */
type ValueType = 'boolean' | 'number' | 'string';

/**
 * Parse a string value to the specified type
 */
function parseValue(value: string, type: ValueType): boolean | number | string | null {
    switch (type) {
        case 'boolean':
            if (value.toLowerCase() === 'true' || value === '1') return true;
            if (value.toLowerCase() === 'false' || value === '0') return false;
            return null;
        case 'number': {
            const num = parseInt(value, 10);
            return isNaN(num) ? null : num;
        }
        case 'string':
            return value;
        default:
            return null;
    }
}

/**
 * Set a value at a nested path in an object
 */
function setNestedValue(
    obj: Record<string, any>,
    path: readonly string[],
    value: unknown
): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (!(key in current)) {
            current[key] = {};
        }
        current = current[key];
    }
    current[path[path.length - 1]] = value;
}

/**
 * Load configuration from environment variables
 *
 * Reads all ARIA51_* environment variables and returns a partial config
 * object that can be merged with the base config.
 *
 * @returns Partial config object with values from environment variables
 */
export function loadEnvConfig(): DeepPartial<ScannerConfig> {
    const config: Record<string, any> = {};

    for (const [envName, { path, type }] of Object.entries(ENV_VAR_MAP)) {
        const fullEnvName = `${ENV_PREFIX}${envName}`;
        const envValue = process.env[fullEnvName];

        if (envValue !== undefined && envValue !== '') {
            const parsedValue = parseValue(envValue, type);
            if (parsedValue !== null) {
                setNestedValue(config, path, parsedValue);
            }
        }
    }

    return config as DeepPartial<ScannerConfig>;
}

/**
 * Check if any config environment variables are set
 *
 * @returns true if at least one ARIA51_* env var is set
 */
export function hasEnvConfig(): boolean {
    for (const envName of Object.keys(ENV_VAR_MAP)) {
        const fullEnvName = `${ENV_PREFIX}${envName}`;
        const envValue = process.env[fullEnvName];
        if (envValue !== undefined && envValue !== '') {
            return true;
        }
    }
    return false;
}

/**
 * Get a list of all supported environment variable names
 *
 * @returns Array of full environment variable names
 */
export function getSupportedEnvVars(): string[] {
    return Object.keys(ENV_VAR_MAP).map((name) => `${ENV_PREFIX}${name}`);
}

/**
 * Get documentation for all environment variables
 *
 * @returns Object mapping env var names to descriptions
 */
export function getEnvVarDocs(): Record<string, { description: string; type: string; default?: string }> {
    return {
        [`${ENV_PREFIX}BROWSER_HEADLESS`]: {
            description: 'Run browser in headless mode',
            type: 'boolean',
            default: 'true',
        },
        [`${ENV_PREFIX}BROWSER_TIMEOUT`]: {
            description: 'Navigation timeout in milliseconds',
            type: 'number',
            default: '30000',
        },
        [`${ENV_PREFIX}BROWSER_STABILIZATION_DELAY`]: {
            description: 'Delay after page load before scanning (ms)',
            type: 'number',
            default: '3000',
        },
        [`${ENV_PREFIX}BROWSER_MAX_NAVIGATION_WAITS`]: {
            description: 'Maximum navigation waits during stability check',
            type: 'number',
            default: '3',
        },
        [`${ENV_PREFIX}BROWSER_NAVIGATION_CHECK_INTERVAL`]: {
            description: 'Interval between navigation checks (ms)',
            type: 'number',
            default: '1000',
        },
        [`${ENV_PREFIX}BROWSER_NETWORK_IDLE_TIMEOUT`]: {
            description: 'Timeout for network idle state (ms)',
            type: 'number',
            default: '5000',
        },
        [`${ENV_PREFIX}BROWSER_POST_NAVIGATION_DELAY`]: {
            description: 'Delay after navigation before stability check (ms)',
            type: 'number',
            default: '2000',
        },
        [`${ENV_PREFIX}SCAN_MAX_RETRIES`]: {
            description: 'Maximum retry attempts for failed scans',
            type: 'number',
            default: '3',
        },
        [`${ENV_PREFIX}SCAN_RETRY_DELAY_BASE`]: {
            description: 'Base delay between retries (ms)',
            type: 'number',
            default: '2000',
        },
        [`${ENV_PREFIX}SCAN_MAX_ELEMENTS_TO_CHECK`]: {
            description: 'Maximum elements to check for React detection',
            type: 'number',
            default: '100',
        },
    };
}
