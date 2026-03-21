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
import { getComponentBundlePath } from "@aria51/react";

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
            stagehand: z.boolean().optional().default(false).describe("Enable AI-powered tests (keyboard navigation, tree analysis, screen reader). Requires OPENAI_API_KEY."),
            stagehand_model: z.string().optional().describe("AI model for Stagehand tests (default: openai/gpt-4o-mini)"),
        },
    },
    async ({ url, browser, mobile, include_tree, components, disable_rules, exclude, stagehand, stagehand_model }) => {
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
            stagehand: z.boolean().optional().default(false).describe("Enable AI-powered tests (keyboard navigation, tree analysis, screen reader). Requires OPENAI_API_KEY."),
            stagehand_model: z.string().optional().describe("AI model for Stagehand tests (default: openai/gpt-4o-mini)"),
        },
    },
    async ({ urls, browser, mobile, include_tree, components, disable_rules, exclude, stagehand, stagehand_model }) => {
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

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("aria51 MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    exitWithCode(EXIT_CODES.RUNTIME_ERROR);
});
