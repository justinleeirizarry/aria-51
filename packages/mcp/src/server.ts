#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Effect } from "effect";
import { z } from "zod";
import {
    runScanAsPromise,
    runMultiScanAsPromise,
    AppLayer,
    createResultsProcessorService,
    logger,
    EXIT_CODES,
    exitWithCode,
    updateConfig,
    loadEnvConfig,
    hasEnvConfig,
} from "@aria51/core";
import { getComponentBundlePath } from "@aria51/components";

// Configure logger to use stderr to avoid corrupting JSON-RPC on stdout
logger.setUseStderr(true);

// Load configuration from environment variables
if (hasEnvConfig()) {
    updateConfig(loadEnvConfig());
}

// Create server instance
const server = new McpServer({
    name: "aria51",
    version: "1.0.0",
});

// Register scan tool
server.registerTool(
    "scan_url",
    {
        description: "Scan a URL for accessibility violations",
        inputSchema: {
            url: z.string().url().describe("The URL to scan"),
            browser: z.enum(["chromium", "firefox", "webkit"]).optional().default("chromium").describe("Browser to use for scanning"),
            mobile: z.boolean().optional().default(false).describe("Emulate a mobile device"),
            include_tree: z.boolean().optional().default(false).describe("Include the full accessibility tree in the response (can be large)"),
            components: z.boolean().optional().default(true).describe("Auto-detect and attribute violations to framework components (React, Vue, Svelte, Solid). Set false to disable."),
            disable_rules: z.array(z.string()).optional().describe("Axe rule IDs to disable (e.g. ['color-contrast'])"),
            exclude: z.array(z.string()).optional().describe("CSS selectors to exclude from scanning"),
            tags: z.array(z.string()).optional().describe("Axe-core tags to filter by (e.g. ['wcag2a', 'wcag2aa', 'best-practice'])"),
            stagehand: z.boolean().optional().default(false).describe("Enable AI-powered tests (keyboard navigation, tree analysis, screen reader). Requires OPENAI_API_KEY."),
            stagehand_model: z.string().optional().describe("AI model for Stagehand tests (default: openai/gpt-4o-mini)"),
        },
    },
    async ({ url, browser, mobile, include_tree, components, disable_rules, exclude, tags, stagehand, stagehand_model }) => {
        try {
            logger.info(`Starting scan for ${url} using ${browser}${stagehand ? ' with Stagehand AI tests' : ''}`);

            const { results } = await runScanAsPromise({
                url,
                browser: browser as "chromium" | "firefox" | "webkit",
                headless: true,
                includeKeyboardTests: true,
                componentBundlePath: components !== false ? getComponentBundlePath() : undefined,
                mobile,
                disableRules: disable_rules,
                exclude,
                tags,
                stagehand,
                stagehandModel: stagehand_model,
            }, AppLayer);

            const processor = createResultsProcessorService();
            const content = Effect.runSync(processor.formatForMCP(results, { includeTree: include_tree }));

            return {
                content,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Scan failed: ${errorMessage}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Scan failed: ${errorMessage}`,
                    },
                ],
                isError: true,
            };
        }
    }
);

// Register multi-URL scan tool
server.registerTool(
    "scan_urls",
    {
        description: "Scan multiple URLs for accessibility violations",
        inputSchema: {
            urls: z.array(z.string().url()).min(1).describe("The URLs to scan"),
            browser: z.enum(["chromium", "firefox", "webkit"]).optional().default("chromium").describe("Browser to use for scanning"),
            mobile: z.boolean().optional().default(false).describe("Emulate a mobile device"),
            include_tree: z.boolean().optional().default(false).describe("Include the full accessibility tree in the response (can be large)"),
            components: z.boolean().optional().default(true).describe("Auto-detect and attribute violations to framework components (React, Vue, Svelte, Solid). Set false to disable."),
            disable_rules: z.array(z.string()).optional().describe("Axe rule IDs to disable (e.g. ['color-contrast'])"),
            exclude: z.array(z.string()).optional().describe("CSS selectors to exclude from scanning"),
            tags: z.array(z.string()).optional().describe("Axe-core tags to filter by (e.g. ['wcag2a', 'wcag2aa', 'best-practice'])"),
            stagehand: z.boolean().optional().default(false).describe("Enable AI-powered tests (keyboard navigation, tree analysis, screen reader). Requires OPENAI_API_KEY."),
            stagehand_model: z.string().optional().describe("AI model for Stagehand tests (default: openai/gpt-4o-mini)"),
        },
    },
    async ({ urls, browser, mobile, include_tree, components, disable_rules, exclude, tags, stagehand, stagehand_model }) => {
        try {
            logger.info(`Starting multi-page scan for ${urls.length} URLs using ${browser}${stagehand ? ' with Stagehand AI tests' : ''}`);

            const scanResults = await runMultiScanAsPromise(
                urls,
                {
                    browser: browser as "chromium" | "firefox" | "webkit",
                    headless: true,
                    includeKeyboardTests: true,
                    componentBundlePath: components !== false ? getComponentBundlePath() : undefined,
                    mobile,
                    disableRules: disable_rules,
                    exclude,
                    tags,
                    stagehand,
                    stagehandModel: stagehand_model,
                },
                AppLayer,
            );

            const processor = createResultsProcessorService();
            const allContent: Array<{ type: "text"; text: string }> = [];

            for (let i = 0; i < scanResults.length; i++) {
                const { results } = scanResults[i];
                const content = Effect.runSync(processor.formatForMCP(results, { includeTree: include_tree }));
                if (urls.length > 1) {
                    allContent.push({ type: "text" as const, text: `\n--- Results for ${urls[i]} ---\n` });
                }
                allContent.push(...content);
            }

            return { content: allContent };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Multi-page scan failed: ${errorMessage}`);
            return {
                content: [{ type: "text", text: `Scan failed: ${errorMessage}` }],
                isError: true,
            };
        }
    }
);

// Register accessibility tree tool
server.registerTool(
    "get_accessibility_tree",
    {
        description: "Get the accessibility tree for a URL. Returns the page's semantic structure including headings, landmarks, ARIA roles, and interactive elements. Lightweight — does not run a full accessibility scan. Works on CSP-restricted sites.",
        inputSchema: {
            url: z.string().url().describe("The URL to analyze"),
            browser: z.enum(["chromium", "firefox", "webkit"]).optional().default("chromium").describe("Browser to use"),
        },
    },
    async ({ url, browser }) => {
        try {
            logger.info(`Getting accessibility tree for ${url}`);
            const { chromium, firefox, webkit } = await import("playwright");
            const browsers = { chromium, firefox, webkit };
            const browserInstance = await browsers[browser as keyof typeof browsers].launch({ headless: true });
            const page = await browserInstance.newPage();
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
            const snapshot = await page.accessibility.snapshot();
            await browserInstance.close();

            return {
                content: [{
                    type: "text",
                    text: `## Accessibility Tree for ${url}\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``,
                }],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: `Failed to get accessibility tree: ${errorMessage}` }],
                isError: true,
            };
        }
    }
);

// Register explain violation tool
server.registerTool(
    "explain_violation",
    {
        description: "Explain an axe-core accessibility rule — what WCAG criteria it maps to, what it means, and how to fix it. Use this to understand a specific violation without running a scan.",
        inputSchema: {
            rule_id: z.string().describe("The axe-core rule ID (e.g., 'color-contrast', 'image-alt', 'link-name')"),
        },
    },
    async ({ rule_id }) => {
        const {
            getWcagCriteriaForViolation,
            AXE_WCAG_MAP,
        } = await import("@aria51/core");

        const mapping = AXE_WCAG_MAP[rule_id];
        if (!mapping) {
            return {
                content: [{ type: "text", text: `Unknown rule ID: "${rule_id}". This is not a recognized axe-core rule.` }],
                isError: true,
            };
        }

        const criteria = getWcagCriteriaForViolation(rule_id);
        const lines: string[] = [
            `## ${rule_id}`,
            ``,
            `**Axe Rule:** https://dequeuniversity.com/rules/axe/4.8/${rule_id}`,
            `**WCAG Criteria:** ${mapping.criteria.join(", ")}`,
            mapping.techniques ? `**Techniques:** ${mapping.techniques.join(", ")}` : '',
            ``,
            `### Mapped WCAG Criteria`,
        ].filter(Boolean);

        for (const c of criteria) {
            lines.push(`- **${c.id} ${c.title}** (Level ${c.level}, ${c.principle})`);
            lines.push(`  ${c.description}`);
            lines.push(`  [W3C Understanding](${c.w3cUrl})`);
        }

        return {
            content: [{ type: "text", text: lines.join("\n") }],
        };
    }
);

// Register WCAG criteria listing tool
server.registerTool(
    "list_wcag_criteria",
    {
        description: "List WCAG 2.2 success criteria, optionally filtered by conformance level (A, AA, AAA) or principle (Perceivable, Operable, Understandable, Robust). Use this to look up specific WCAG requirements without relying on training data.",
        inputSchema: {
            level: z.enum(["A", "AA", "AAA"]).optional().describe("Filter by conformance level"),
            principle: z.enum(["Perceivable", "Operable", "Understandable", "Robust"]).optional().describe("Filter by WCAG principle"),
            search: z.string().optional().describe("Search criteria by title or description (case-insensitive)"),
        },
    },
    async ({ level, principle, search }) => {
        const { getAllCriteria } = await import("@aria51/core");

        let criteria = getAllCriteria();
        if (level) criteria = criteria.filter((c: any) => c.level === level);
        if (principle) criteria = criteria.filter((c: any) => c.principle === principle);
        if (search) {
            const q = search.toLowerCase();
            criteria = criteria.filter((c: any) =>
                c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
            );
        }

        if (criteria.length === 0) {
            return { content: [{ type: "text", text: "No criteria matched the filters." }] };
        }

        const lines = [`## WCAG 2.2 Criteria (${criteria.length} results)\n`];
        for (const c of criteria) {
            lines.push(`- **${c.id} ${c.title}** (Level ${c.level}, ${c.principle})`);
            lines.push(`  ${c.description}`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
    }
);

// Register agent audit tool
server.registerTool(
    "run_agent",
    {
        description: "Run an autonomous AI accessibility audit on a website. The agent crawls pages, scans for violations, verifies findings against axe-core, and generates a prioritized remediation plan. More thorough than scan_url but takes longer (1-3 minutes). Requires ANTHROPIC_API_KEY.",
        inputSchema: {
            url: z.string().url().describe("The target URL to audit"),
            max_pages: z.number().optional().default(5).describe("Maximum pages to scan (default: 5)"),
            max_steps: z.number().optional().default(10).describe("Maximum agent steps (default: 10)"),
            specialists: z.boolean().optional().default(false).describe("Use multi-specialist mode — 4 parallel auditors for deeper coverage"),
            wcag_level: z.enum(["A", "AA", "AAA"]).optional().default("AA").describe("Target WCAG conformance level"),
            model: z.string().optional().describe("LLM model to use (default: claude-sonnet-4-6)"),
        },
    },
    async ({ url, max_pages, max_steps, specialists, wcag_level, model }) => {
        try {
            logger.info(`Starting agent audit for ${url} (max ${max_pages} pages, ${max_steps} steps${specialists ? ', multi-specialist' : ''})`);
            const { runAgent } = await import("@aria51/agent");

            const report = await runAgent({
                targetUrl: url,
                maxPages: max_pages,
                maxSteps: max_steps,
                specialists,
                wcagLevel: wcag_level as "A" | "AA" | "AAA",
                model: model || "claude-sonnet-4-6",
            });

            const lines: string[] = [
                `## Agent Audit Report: ${url}`,
                ``,
                `- **Pages scanned:** ${report.pagesScanned}`,
                `- **Total findings:** ${report.totalFindings}`,
                `- **Duration:** ${(report.scanDurationMs / 1000).toFixed(1)}s`,
                `- **WCAG Level:** ${report.wcagLevel}`,
                ``,
            ];

            if (report.totalFindings > 0) {
                const c = report.findingsByConfidence;
                const s = report.findingsBySeverity;
                lines.push(`### Confidence: ${c.confirmed} confirmed, ${c.corroborated} corroborated, ${c['ai-only']} ai-only`);
                lines.push(`### Severity: ${s.critical} critical, ${s.serious} serious, ${s.moderate} moderate, ${s.minor} minor`);
                lines.push(``);
                lines.push(`### Findings`);
                for (const f of report.findings) {
                    lines.push(`- **[${f.confidence}] ${f.criterion?.id || '?'} (${f.impact}):** ${f.description}`);
                }
            }

            if (report.remediationPlan) {
                lines.push(``, `### Remediation Plan (${report.remediationPlan.totalIssues} issues, ${report.remediationPlan.estimatedEffort})`);
                for (const phase of report.remediationPlan.phases) {
                    lines.push(`- **Phase ${phase.priority}: ${phase.title}** (${phase.items.length} items)`);
                }
            }

            if (report.agentSummary) {
                lines.push(``, `### Agent Summary`, ``, report.agentSummary.slice(0, 2000));
            }

            return {
                content: [{ type: "text", text: lines.join("\n") }],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Agent audit failed: ${errorMessage}`);
            return {
                content: [{ type: "text", text: `Agent audit failed: ${errorMessage}` }],
                isError: true,
            };
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("aria51 MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    exitWithCode(EXIT_CODES.RUNTIME_ERROR);
});
