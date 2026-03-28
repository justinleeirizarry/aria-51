# aria-51

aria-51 is an accessibility testing platform. It scans websites for WCAG violations using axe-core, keyboard tests, and 34 custom WCAG 2.2 checks — then optionally uses AI to verify findings, attribute them to React components, and generate prioritized remediation plans.

The platform is a monorepo with seven packages that layer on top of each other:

```
Interfaces            CLI  ·  Web Dashboard  ·  MCP (MCP)
                         │         │              │
AI Layer              Agent (autonomous auditing)
                      AI Auditor (Stagehand/Browserbase)
                         │
Framework Plugins     React (component attribution)
                         │
Foundation            Core (axe-core + keyboard tests + WCAG 2.2 checks)
```

You can use it as a CLI tool, a web dashboard, a MCP integration, an autonomous AI agent, or a Node.js library — depending on what you need.

## The scanning engine

Everything starts with `@aria51/core`. It's a framework-agnostic scanning engine that:

- Runs **axe-core** for automated WCAG violation detection
- Tests **keyboard navigation** (tab order, focus traps, skip links)
- Executes **34 custom WCAG 2.2 checks** that axe-core doesn't cover (reflow, hover/focus content, authentication, dragging, animation interactions, and more)
- Runs **multi-page consistency checks** when scanning multiple URLs (consistent navigation, consistent identification)
- Generates **contextual fix suggestions** for each violation

Under the hood, it uses Playwright for browser automation and the Effect library for composable error handling and resource management. A scan produces a `ScanResults` object with violations, passes, incomplete checks, keyboard test results, WCAG 2.2 results, and an optional accessibility tree.

```typescript
import { runScanAsPromise, AppLayer } from '@aria51/core';

const { results } = await runScanAsPromise({
    url: 'https://your-site.com',
    browser: 'chromium',
    headless: true,
    includeKeyboardTests: true,
}, AppLayer);

console.log(`${results.summary.totalViolations} violations found`);
```

## Interfaces

There are three ways to run scans without writing code:

### CLI

The `aria51` command gives you a terminal UI built with Ink (React for the terminal).

```bash
# Scan a URL
pnpm start https://your-site.com

# With React component attribution
pnpm start https://your-site.com -- --react

# Export JSON report
pnpm start https://your-site.com -- --output report.json

# CI mode with threshold
pnpm start https://your-site.com -- --ci --threshold 0

# Mobile viewport
pnpm start https://your-site.com -- --mobile
```

### Web dashboard

A browser-based interface on `localhost:3847` with a scan form, results display, and AI prompt generation.

```bash
cd packages/web
pnpm dev
# Open http://localhost:3847
```

### MCP (MCP)

An MCP server that exposes `scan_url` and `scan_urls` tools for MCP. Claude can scan websites and discuss the results in conversation.

```json
{
    "mcpServers": {
        "aria51": {
            "command": "node",
            "args": ["path/to/packages/mcp/bin/mcp-server.js"]
        }
    }
}
```

## AI-powered features

aria-51 has two layers of AI integration, each solving a different problem.

### AI Auditor

`@aria51/ai-auditor` uses Stagehand and Browserbase for AI-driven testing that goes beyond what static analysis can catch:

- **Keyboard navigation testing** — An AI agent navigates your site by keyboard and reports issues with tab order, focus management, and keyboard traps
- **Accessibility tree analysis** — Inspects the browser's accessibility tree for structural issues (missing landmarks, invalid ARIA, heading hierarchy problems)
- **Screen reader simulation** — Simulates screen reader navigation patterns and reports issues with reading order and announcements
- **WCAG compliance auditing** — An AI agent systematically checks WCAG criteria that require human judgment
- **Test generation** — Discovers interactive elements and generates accessibility test cases

These tests are optional — enable them with the `stagehand` flag on any scan.

### Autonomous Agent

`@aria51/agent` is a full agent harness that autonomously audits websites end-to-end. You give it a URL; it gives you back a verified audit report with a prioritized fix plan.

```typescript
import { runAgent } from '@aria51/agent';

const report = await runAgent({
    targetUrl: 'https://your-site.com',
});

console.log(report.agentSummary);       // Markdown audit report
console.log(report.totalFindings);       // Number of verified findings
console.log(report.remediationPlan);     // Phased fix plan
```

The agent:

1. **Plans** a crawl strategy (sitemap or link discovery)
2. **Scans** pages using the core scanning engine
3. **Verifies** its findings by cross-referencing AI observations against axe-core's deterministic results — every finding gets a confidence level (confirmed, corroborated, ai-only, or contradicted)
4. **Generates** a prioritized remediation plan grouped into immediate, short-term, and long-term phases

For comprehensive audits, the agent supports **multi-specialist mode** — four specialist auditors (keyboard, visual, forms, structure) audit independently through different lenses and their findings are merged and deduplicated. Confidence comes from cross-referencing with axe-core, not vote counting.

The agent defaults to Claude (Sonnet 4.6) via the native Anthropic SDK, with automatic model fallback on overload. It also supports any LLM via the Vercel AI SDK — OpenAI, Google, Ollama, or anything else with tool calling support.

See the [agent introduction](../packages/agent/docs/introduction.md) for the full breakdown.

## Component attribution

The core engine reports violations against DOM elements. The component attribution system maps those violations back to your framework's components — with source file locations.

```
Without attribution:
  color-contrast violation on <button class="btn-primary">

With attribution:
  color-contrast violation on <Button> in src/components/Button.tsx:42
  Component path: App > Layout > Header > Button
```

This is built on a generic `FrameworkPlugin` interface that supports any UI framework. The plugin system uses [element-source](https://github.com/AidenYBai/element-source) which works with React, Vue, Svelte, and Solid. Each framework plugin provides detection (is this framework on the page?), scanning (traverse the component tree), and attribution (map DOM violations to components).

`@aria51/react` is the first plugin implementation — it traverses the React Fiber tree to resolve components. The architecture is ready for Vue, Svelte, and Solid plugins.

## Packages

| Package | What it does | Depends on |
|---|---|---|
| [`@aria51/core`](../packages/core) | Scanning engine: axe-core, keyboard tests, WCAG 2.2 checks, fix suggestions | — |
| [`@aria51/components`](../packages/components) | Component attribution via element-source (React, Preact, Vue, Svelte, Solid) | core |
| [`@aria51/ai-auditor`](../packages/ai-auditor) | Stagehand/Browserbase AI testing: keyboard nav, tree analysis, screen reader, WCAG audit | core |
| [`@aria51/agent`](../packages/agent) | Autonomous auditing agent: planning, scanning, verification, multi-specialist coordination, remediation | core, ai-auditor |
| [`@aria51/cli`](../packages/cli) | Terminal UI (Ink). Binary: `aria51` | core, react, ai-auditor |
| [`@aria51/web`](../packages/web) | Web dashboard (Hono). Port 3847 | core, react, ai-auditor |
| [`@aria51/mcp`](../packages/mcp) | MCP server for MCP. Tools: `scan_url`, `scan_urls` | core, react, ai-auditor |

### Dependency diagram

```
@aria51/core ─────────────────────────────────────────────┐
    │                                                      │
    ├── @aria51/react                                      │
    │                                                      │
    ├── @aria51/ai-auditor                                 │
    │       │                                              │
    │       ├── @aria51/agent (autonomous auditing)        │
    │       │                                              │
    │       ├── @aria51/cli   (terminal UI)      ──────────┤
    │       ├── @aria51/web   (web dashboard)    ──────────┤
    │       └── @aria51/mcp   (MCP)   ──────────┘
    │
    └── (all interface packages also depend on core + react)
```

## Quick start

### Prerequisites

- Node.js 18+
- pnpm 8+

### Install and build

```bash
git clone <repo-url>
cd aria-51
pnpm install
pnpm build
```

### Scan from the terminal

```bash
pnpm start https://your-site.com
```

### Run the autonomous agent

```typescript
import { runAgent } from '@aria51/agent';

const report = await runAgent({
    targetUrl: 'https://your-site.com',
    wcagLevel: 'AA',
    maxPages: 10,
    onEvent: (e) => console.log(e.type, e),
});
```

### Add to MCP

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
    "mcpServers": {
        "aria51": {
            "command": "node",
            "args": ["/absolute/path/to/aria-51/packages/mcp/bin/mcp-server.js"]
        }
    }
}
```

#### Claude Code

Add to your project's `.claude/settings.json` or global `~/.claude/settings.json`:

```json
{
    "mcpServers": {
        "aria51": {
            "command": "node",
            "args": ["/absolute/path/to/aria-51/packages/mcp/bin/mcp-server.js"]
        }
    }
}
```

After adding, restart Claude Desktop or Claude Code. Then ask: *"Scan https://your-site.com for accessibility issues"*

## Configuration

aria-51 supports configuration via config files, environment variables, or runtime options.

**Config file** (auto-discovered by cosmiconfig):

```typescript
// aria51.config.ts
export default {
    browser: 'chromium',
    headless: true,
    includeKeyboardTests: true,
    mobile: false,
    disableRules: [],
    exclude: [],
};
```

**Environment variables** (prefixed with `ARIA51_`):

```bash
ARIA51_BROWSER=firefox
ARIA51_HEADLESS=false
ANTHROPIC_API_KEY=sk-ant-...     # For agent and AI features
OPENAI_API_KEY=sk-...            # For Stagehand AI testing
BROWSERBASE_API_KEY=...          # For Browserbase cloud browsers
BROWSERBASE_PROJECT_ID=...
```

## Development

```bash
# Watch mode (all packages)
pnpm dev

# Run tests
pnpm test

# Test with coverage
pnpm test:coverage

# Build all packages
pnpm build

# Build a single package
pnpm --filter @aria51/core build
```

## What's next

- [Agent Introduction](../packages/agent/docs/introduction.md) — Deep dive into the autonomous auditing agent
- [WCAG 2.2 Reference](./WCAG-2.2.md) — All 86 success criteria with implementation guidance
- [Effect Service Architecture](./effect-service-breakdown.md) — How the core scanning engine is structured
