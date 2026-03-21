/**
 * Browser Bundle Tests
 *
 * These tests verify that the browser bundle (scanner-bundle.js) works correctly
 * when injected into a page via Playwright. Since the browser bundle runs in
 * browser context, we need to use Playwright's page.evaluate to test it.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the bundled scanner file
const SCANNER_BUNDLE_PATH = join(__dirname, '../../dist/scanner-bundle.js');

// Path to test fixtures
const TEST_APP_FIXTURE = `file://${join(__dirname, '../../test/fixtures/test-app.html')}`;
const WCAG22_FIXTURE = `file://${join(__dirname, '../../test/fixtures/wcag22-violations.html')}`;

describe('Browser Bundle', () => {
    let browser: Browser;
    let page: Page;
    let scannerBundle: string;

    beforeAll(async () => {
        // Load the scanner bundle content
        scannerBundle = await readFile(SCANNER_BUNDLE_PATH, 'utf-8');

        // Launch browser
        browser = await chromium.launch({ headless: true });
    }, 30000);

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    beforeEach(async () => {
        // Create fresh page for each test
        page = await browser.newPage();
    });

    afterAll(async () => {
        if (page) {
            await page.close();
        }
    });

    describe('Scanner Initialization', () => {
        it('should expose Aria51Scanner on window after injection', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000); // Wait for React to render

            // Inject the scanner bundle
            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            // Check if Aria51Scanner is available
            const hasScanner = await page.evaluate(() => {
                return typeof window.Aria51Scanner !== 'undefined';
            });

            expect(hasScanner).toBe(true);
        }, 30000);

        it('should have scan function on Aria51Scanner', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const hasScanFunction = await page.evaluate(() => {
                return (
                    typeof window.Aria51Scanner !== 'undefined' &&
                    typeof window.Aria51Scanner.scan === 'function'
                );
            });

            expect(hasScanFunction).toBe(true);
        }, 30000);
    });

    describe('Scan Execution', () => {
        it('should return BrowserScanData structure from scan()', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            // Verify structure
            expect(result).toHaveProperty('components');
            expect(result).toHaveProperty('violations');
            expect(result).toHaveProperty('passes');
            expect(result).toHaveProperty('incomplete');
            expect(result).toHaveProperty('inapplicable');

            // Verify arrays
            expect(Array.isArray(result.components)).toBe(true);
            expect(Array.isArray(result.violations)).toBe(true);
            expect(Array.isArray(result.passes)).toBe(true);
        }, 60000);

        it('should return empty components array (generic scanner has no framework detection)', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            // Generic scanner returns empty components - framework plugins provide component data
            expect(result.components).toEqual([]);
        }, 60000);

        it('should detect accessibility violations', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            // Test fixture has intentional violations
            expect(result.violations.length).toBeGreaterThan(0);

            // Check violation structure
            for (const violation of result.violations) {
                expect(violation).toHaveProperty('id');
                expect(violation).toHaveProperty('impact');
                expect(violation).toHaveProperty('description');
                expect(violation).toHaveProperty('help');
                expect(violation).toHaveProperty('helpUrl');
                expect(violation).toHaveProperty('tags');
                expect(violation).toHaveProperty('nodes');
                expect(Array.isArray(violation.nodes)).toBe(true);
            }
        }, 60000);

        it('should detect specific known violations in test fixture', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            const violationIds = result.violations.map((v: any) => v.id);

            // Test fixture has these violations:
            // - image-alt: Missing alt text on images
            // - label: Form inputs without labels
            expect(violationIds).toContain('image-alt');
            expect(violationIds).toContain('label');
        }, 60000);

        it('should return violations with standard axe node structure (no component attribution)', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            // Generic scanner returns raw axe nodes without component attribution
            expect(result.violations.length).toBeGreaterThan(0);

            // Check standard axe node structure
            for (const violation of result.violations) {
                for (const node of violation.nodes) {
                    expect(node).toHaveProperty('html');
                    expect(node).toHaveProperty('target');
                }
            }
        }, 60000);
    });

    describe('Keyboard Tests', () => {
        it('should include keyboard tests when option is enabled', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan({ includeKeyboardTests: true });
            });

            expect(result.keyboardTests).toBeDefined();
            expect(result.keyboardTests).toHaveProperty('tabOrder');
            expect(result.keyboardTests).toHaveProperty('focusManagement');
            expect(result.keyboardTests).toHaveProperty('shortcuts');
            expect(result.keyboardTests).toHaveProperty('summary');
        }, 60000);

        it('should not include keyboard tests when option is disabled', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan({ includeKeyboardTests: false });
            });

            expect(result.keyboardTests).toBeUndefined();
        }, 60000);
    });

    describe('WCAG 2.2 Checks', () => {
        it('should include WCAG 2.2 results', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            // WCAG 2.2 results should be present
            expect(result.wcag22).toBeDefined();
            expect(result.wcag22).toHaveProperty('targetSize');
            expect(result.wcag22).toHaveProperty('focusObscured');
            expect(result.wcag22).toHaveProperty('focusAppearance');
            expect(result.wcag22).toHaveProperty('summary');
        }, 60000);

        it('should detect WCAG 2.2 violations in fixture', async () => {
            await page.goto(WCAG22_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            expect(result.wcag22).toBeDefined();
            expect(result.wcag22!.summary).toHaveProperty('totalViolations');
        }, 60000);
    });

    describe('Tag Filtering', () => {
        it('should filter violations by WCAG tags', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const resultAll = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            const resultFiltered = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan({ tags: ['wcag2a'] });
            });

            // Filtered results should be a subset (or equal)
            expect(resultFiltered.violations.length).toBeLessThanOrEqual(resultAll.violations.length);

            // All filtered violations should have wcag2a tag
            for (const violation of resultFiltered.violations) {
                expect(violation.tags.some((t: string) => t.includes('wcag2a'))).toBe(true);
            }
        }, 60000);
    });

    describe('Accessibility Tree', () => {
        it('should build accessibility tree', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            // Accessibility tree should be present
            expect(result.accessibilityTree).toBeDefined();
        }, 60000);
    });

    describe('Error Handling', () => {
        it('should handle errors gracefully and collect them', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            // Scan should complete even if some parts fail
            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan({ includeKeyboardTests: true });
            });

            // Result should be valid even if errors occurred
            expect(result).toBeDefined();
            expect(result.components).toBeDefined();
            expect(result.violations).toBeDefined();

            // If errors occurred, they should be in the errors array
            if (result.errors) {
                expect(Array.isArray(result.errors)).toBe(true);
                for (const error of result.errors) {
                    expect(error).toHaveProperty('phase');
                    expect(error).toHaveProperty('message');
                    expect(error).toHaveProperty('recoverable');
                }
            }
        }, 60000);

        it('should succeed on non-React pages (generic scanner is framework-agnostic)', async () => {
            // Navigate to a non-React page
            await page.goto('data:text/html,<html><body><h1>No React</h1></body></html>');

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            // Generic scanner should succeed - it doesn't require React
            expect(result).toBeDefined();
            expect(result.components).toEqual([]);
            expect(Array.isArray(result.violations)).toBe(true);
        }, 30000);
    });

    describe('Pass Results', () => {
        it('should include passing rules', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            // Should have some passing rules
            expect(result.passes).toBeDefined();
            expect(result.passes!.length).toBeGreaterThan(0);

            // Check pass structure
            for (const pass of result.passes!) {
                expect(pass).toHaveProperty('id');
                expect(pass).toHaveProperty('description');
                expect(pass).toHaveProperty('help');
                expect(pass).toHaveProperty('helpUrl');
                expect(pass).toHaveProperty('tags');
            }
        }, 60000);
    });

    describe('Incomplete Results', () => {
        it('should include rules needing manual review', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            // Incomplete should be defined (may be empty array)
            expect(result.incomplete).toBeDefined();
            expect(Array.isArray(result.incomplete)).toBe(true);
        }, 60000);
    });

    describe('Inapplicable Results', () => {
        it('should include inapplicable rules', async () => {
            await page.goto(TEST_APP_FIXTURE, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            await page.evaluate((bundle) => {
                const script = document.createElement('script');
                script.textContent = bundle;
                document.head.appendChild(script);
            }, scannerBundle);

            const result = await page.evaluate(async () => {
                return await window.Aria51Scanner!.scan();
            });

            // Inapplicable should be defined
            expect(result.inapplicable).toBeDefined();
            expect(Array.isArray(result.inapplicable)).toBe(true);

            // Check structure if there are inapplicable rules
            if (result.inapplicable!.length > 0) {
                for (const rule of result.inapplicable!) {
                    expect(rule).toHaveProperty('id');
                    expect(rule).toHaveProperty('description');
                }
            }
        }, 60000);
    });
});
