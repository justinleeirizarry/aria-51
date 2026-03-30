# aria-51

aria-51 is an accessibility testing platform. It scans websites for WCAG violations using axe-core, keyboard tests, and 34 custom WCAG 2.2 checks — with a full audit pipeline that discovers pages, runs focused audits, and generates prioritized remediation plans. No API keys needed.

The platform is a monorepo with four packages:

```
Interfaces            CLI  ·  MCP Server
                         │       │
AI Layer              AI Auditor (Stagehand, optional)
                         │
Foundation            Core (axe-core + keyboard tests + WCAG 2.2 checks + full audit pipeline)
```

You can use it as a CLI tool, an MCP integration, or a Node.js library — depending on what you need.

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

### MCP Server

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

- **Keyboard navigation testing** — AI navigates your site by keyboard and reports issues with tab order, focus management, and keyboard traps
- **Accessibility tree analysis** — Inspects the browser's accessibility tree for structural issues (missing landmarks, invalid ARIA, heading hierarchy problems)
- **Screen reader simulation** — Simulates screen reader navigation patterns and reports issues with reading order and announcements
- **Test generation** — Discovers interactive elements and generates accessibility test cases

These tests are optional — enable them with `--deep` on any focused audit.

### Full Audit Pipeline

The core package includes a full audit pipeline that runs a complete WCAG compliance audit — no API key needed:

```typescript
import { runFullAudit } from '@aria51/core';

const result = await runFullAudit({
    url: 'https://your-site.com',
    maxPages: 10,
    wcagLevel: 'AA',
});

console.log(result.findings);          // Verified findings with confidence levels
console.log(result.remediationPlan);   // Phased fix plan
```

The pipeline:

1. **Discovers** pages via sitemap parsing and link crawling
2. **Scans** every page using axe-core with keyboard tests
3. **Runs focused audits** (keyboard, structure, screen reader) on key pages
4. **Generates** a prioritized remediation plan grouped into immediate, short-term, and long-term phases

From the CLI: `aria51 https://your-site.com --full-audit`

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
| [`@aria51/core`](../packages/core) | Scanning engine, focused audits, full audit pipeline, WCAG 2.2 checks, component attribution | — |
| [`@aria51/ai-auditor`](../packages/ai-auditor) | AI-enhanced deep analysis via Stagehand (optional) | core |
| [`@aria51/cli`](../packages/cli) | Terminal UI (Ink). Binary: `aria51` | core, ai-auditor |
| [`@aria51/mcp`](../packages/mcp) | MCP server with 10 tools for AI coding assistants | core, ai-auditor |

### Dependency diagram

```
@aria51/core (scanning, audits, pipeline) ─────────────────┐
    │                                                      │
    ├── @aria51/ai-auditor (optional, --deep mode)         │
    │                                                      │
    ├── @aria51/cli   (terminal UI)      ──────────────────┤
    └── @aria51/mcp   (MCP server)       ──────────────────┘
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

### Run a full audit

```typescript
import { runFullAudit } from '@aria51/core';

const result = await runFullAudit({
    url: 'https://your-site.com',
    wcagLevel: 'AA',
    maxPages: 10,
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
OPENAI_API_KEY=sk-...            # For Stagehand --deep mode (optional)
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

- [WCAG 2.2 Reference](./WCAG-2.2.md) — All 86 success criteria with implementation guidance
- [Effect Service Architecture](./effect-service-breakdown.md) — How the core scanning engine is structured
