/**
 * Tests for environment variable configuration loading
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadEnvConfig, hasEnvConfig, getSupportedEnvVars, getEnvVarDocs } from './env.js';

describe('Environment Variable Configuration', () => {
    // Store original env vars
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Clear all ARIA51_* env vars before each test
        for (const key of Object.keys(process.env)) {
            if (key.startsWith('ARIA51_')) {
                delete process.env[key];
            }
        }
    });

    afterEach(() => {
        // Restore original env vars
        process.env = { ...originalEnv };
    });

    describe('loadEnvConfig', () => {
        it('should return empty object when no env vars are set', () => {
            const config = loadEnvConfig();
            expect(config).toEqual({});
        });

        it('should parse boolean env vars', () => {
            process.env.ARIA51_BROWSER_HEADLESS = 'false';

            const config = loadEnvConfig();
            expect(config.browser?.headless).toBe(false);
        });

        it('should parse boolean "true" value', () => {
            process.env.ARIA51_BROWSER_HEADLESS = 'true';

            const config = loadEnvConfig();
            expect(config.browser?.headless).toBe(true);
        });

        it('should parse boolean "1" as true', () => {
            process.env.ARIA51_BROWSER_HEADLESS = '1';

            const config = loadEnvConfig();
            expect(config.browser?.headless).toBe(true);
        });

        it('should parse boolean "0" as false', () => {
            process.env.ARIA51_BROWSER_HEADLESS = '0';

            const config = loadEnvConfig();
            expect(config.browser?.headless).toBe(false);
        });

        it('should parse number env vars', () => {
            process.env.ARIA51_BROWSER_TIMEOUT = '60000';

            const config = loadEnvConfig();
            expect(config.browser?.timeout).toBe(60000);
        });

        it('should handle multiple env vars', () => {
            process.env.ARIA51_BROWSER_HEADLESS = 'false';
            process.env.ARIA51_BROWSER_TIMEOUT = '45000';
            process.env.ARIA51_SCAN_MAX_RETRIES = '5';

            const config = loadEnvConfig();

            expect(config.browser?.headless).toBe(false);
            expect(config.browser?.timeout).toBe(45000);
            expect(config.scan?.maxRetries).toBe(5);
        });

        it('should ignore invalid boolean values', () => {
            process.env.ARIA51_BROWSER_HEADLESS = 'invalid';

            const config = loadEnvConfig();
            expect(config.browser?.headless).toBeUndefined();
        });

        it('should ignore invalid number values', () => {
            process.env.ARIA51_BROWSER_TIMEOUT = 'not-a-number';

            const config = loadEnvConfig();
            expect(config.browser?.timeout).toBeUndefined();
        });

        it('should ignore empty string values', () => {
            process.env.ARIA51_BROWSER_TIMEOUT = '';

            const config = loadEnvConfig();
            expect(config.browser?.timeout).toBeUndefined();
        });

        it('should load all browser config options', () => {
            process.env.ARIA51_BROWSER_HEADLESS = 'false';
            process.env.ARIA51_BROWSER_TIMEOUT = '60000';
            process.env.ARIA51_BROWSER_STABILIZATION_DELAY = '5000';
            process.env.ARIA51_BROWSER_MAX_NAVIGATION_WAITS = '5';
            process.env.ARIA51_BROWSER_NAVIGATION_CHECK_INTERVAL = '2000';
            process.env.ARIA51_BROWSER_NETWORK_IDLE_TIMEOUT = '10000';
            process.env.ARIA51_BROWSER_POST_NAVIGATION_DELAY = '3000';

            const config = loadEnvConfig();

            expect(config.browser).toEqual({
                headless: false,
                timeout: 60000,
                stabilizationDelay: 5000,
                maxNavigationWaits: 5,
                navigationCheckInterval: 2000,
                networkIdleTimeout: 10000,
                postNavigationDelay: 3000,
            });
        });

        it('should load all scan config options', () => {
            process.env.ARIA51_SCAN_MAX_RETRIES = '5';
            process.env.ARIA51_SCAN_RETRY_DELAY_BASE = '3000';
            process.env.ARIA51_SCAN_MAX_ELEMENTS_TO_CHECK = '200';

            const config = loadEnvConfig();

            expect(config.scan).toEqual({
                maxRetries: 5,
                retryDelayBase: 3000,
                maxElementsToCheck: 200,
            });
        });

    });

    describe('hasEnvConfig', () => {
        it('should return false when no env vars are set', () => {
            expect(hasEnvConfig()).toBe(false);
        });

        it('should return true when at least one env var is set', () => {
            process.env.ARIA51_BROWSER_HEADLESS = 'true';
            expect(hasEnvConfig()).toBe(true);
        });

        it('should return false for empty string values', () => {
            process.env.ARIA51_BROWSER_HEADLESS = '';
            expect(hasEnvConfig()).toBe(false);
        });

        it('should detect any supported env var', () => {
            process.env.ARIA51_SCAN_MAX_RETRIES = '5';
            expect(hasEnvConfig()).toBe(true);
        });
    });

    describe('getSupportedEnvVars', () => {
        it('should return array of env var names', () => {
            const vars = getSupportedEnvVars();

            expect(vars).toBeInstanceOf(Array);
            expect(vars.length).toBeGreaterThan(0);
        });

        it('should include expected env vars', () => {
            const vars = getSupportedEnvVars();

            expect(vars).toContain('ARIA51_BROWSER_HEADLESS');
            expect(vars).toContain('ARIA51_BROWSER_TIMEOUT');
            expect(vars).toContain('ARIA51_SCAN_MAX_RETRIES');
        });

        it('should have correct prefix on all vars', () => {
            const vars = getSupportedEnvVars();

            for (const v of vars) {
                expect(v).toMatch(/^ARIA51_/);
            }
        });
    });

    describe('getEnvVarDocs', () => {
        it('should return documentation object', () => {
            const docs = getEnvVarDocs();

            expect(typeof docs).toBe('object');
            expect(Object.keys(docs).length).toBeGreaterThan(0);
        });

        it('should have description for each var', () => {
            const docs = getEnvVarDocs();

            for (const [key, value] of Object.entries(docs)) {
                expect(value).toHaveProperty('description');
                expect(typeof value.description).toBe('string');
                expect(value.description.length).toBeGreaterThan(0);
            }
        });

        it('should have type for each var', () => {
            const docs = getEnvVarDocs();

            for (const [key, value] of Object.entries(docs)) {
                expect(value).toHaveProperty('type');
                expect(['boolean', 'number', 'string']).toContain(value.type);
            }
        });

        it('should have default for most vars', () => {
            const docs = getEnvVarDocs();

            // Most should have defaults
            const withDefaults = Object.values(docs).filter((d) => d.default);
            expect(withDefaults.length).toBeGreaterThan(5);
        });

        it('should match supported env vars', () => {
            const docs = getEnvVarDocs();
            const supported = getSupportedEnvVars();

            const docKeys = Object.keys(docs);
            expect(docKeys.sort()).toEqual(supported.sort());
        });
    });

    describe('Integration with config loading', () => {
        it('should produce config compatible with deep merge', () => {
            process.env.ARIA51_BROWSER_TIMEOUT = '60000';

            const config = loadEnvConfig();

            // Should be usable with updateConfig
            // Verify it has the right shape - use generic assertion for type flexibility
            expect(config.browser?.timeout).toBe(60000);
        });
    });
});
