# aria-51

Accessibility testing platform that combines axe-core with keyboard navigation testing, WCAG 2.2 checks, screen reader simulation, and an optional AI agent for full compliance audits. Works as a CLI, MCP server, or library.

See the [full introduction](docs/introduction.md) for a detailed walkthrough of the architecture.

## Quick Start

```bash
# Install dependencies and build
pnpm install && pnpm build

# Scan a URL
pnpm start https://your-site.com

# Quiet mode — compact summary
pnpm start https://your-site.com -- --quiet

# Focused audits (no API keys needed)
pnpm start https://your-site.com -- --audit-keyboard
pnpm start https://your-site.com -- --audit-structure
pnpm start https://your-site.com -- --audit-screen-reader

# Autonomous agent audit
pnpm start https://your-site.com -- --agent

# Export JSON report
pnpm start https://your-site.com -- --output report.json

# CI mode — exit code 1 if violations exceed threshold
pnpm start https://your-site.com -- --ci --threshold 0
```

## Packages

| Package | Description |
| ------- | ----------- |
| [`@aria51/core`](packages/core) | Scanning engine: axe-core, keyboard tests, 34 WCAG 2.2 checks, focused audits |
| [`@aria51/components`](packages/components) | Auto-detected component attribution (React, Vue, Svelte, Solid, Preact) |
| [`@aria51/ai-auditor`](packages/ai-auditor) | AI-enhanced deep analysis via Stagehand |
| [`@aria51/agent`](packages/agent) | Autonomous auditing agent with verification, multi-specialist mode, and remediation plans |
| [`@aria51/cli`](packages/cli) | Terminal interface. Binary: `aria51` |
| [`@aria51/mcp`](packages/mcp) | MCP server with 9 tools for AI assistant integration |
| [`@aria51/web`](packages/web) | Web dashboard (Hono, port 3847) |

## CLI

```bash
# Basic scan
aria51 https://your-site.com

# Multiple URLs
aria51 https://your-site.com https://your-site.com/about

# Browser options
aria51 https://your-site.com --browser firefox
aria51 https://your-site.com --mobile
aria51 https://your-site.com --headless=false

# Focused audits — test specific accessibility dimensions
aria51 https://your-site.com --audit-keyboard       # Tab order, focus traps, skip links
aria51 https://your-site.com --audit-structure       # Landmarks, headings, form labels
aria51 https://your-site.com --audit-screen-reader   # Alt text, ARIA, lang, labels

# AI-enhanced deep analysis (requires OPENAI_API_KEY)
aria51 https://your-site.com --audit-keyboard --deep

# Agent mode (defaults to gpt-4o-mini, use --agent-model claude-sonnet-4-6 for best results)
aria51 https://your-site.com --agent
aria51 https://your-site.com --agent --specialists    # Multi-specialist mode
aria51 https://your-site.com --agent --max-pages 20

# Filtering
aria51 https://your-site.com --tags wcag2aa
aria51 https://your-site.com --disable-rules color-contrast
aria51 https://your-site.com --exclude ".cookie-banner,.modal"

# Component attribution is auto-detected; disable with:
aria51 https://your-site.com --no-components
```

## MCP Server

The MCP server exposes 9 tools for integration with AI coding assistants (Claude Code, Cursor, etc.):

| Tool | Description |
| ---- | ----------- |
| `scan_url` | Scan a URL for accessibility violations |
| `scan_urls` | Batch scan multiple URLs |
| `get_accessibility_tree` | Get page semantic structure (works on CSP-restricted sites) |
| `explain_violation` | Explain an axe-core rule and how to fix it |
| `list_wcag_criteria` | Look up WCAG 2.2 criteria by level, principle, or keyword |
| `test_keyboard` | Test keyboard navigation (tab order, focus traps, indicators) |
| `analyze_structure` | Analyze landmarks, headings, form labels |
| `test_screen_reader` | Simulate screen reader navigation |
| `run_agent` | Run autonomous AI audit with remediation plan |

```bash
# Start the MCP server
node packages/mcp/bin/mcp-server.js
```

## Development

```bash
# Watch mode (all packages)
pnpm dev

# Run tests
pnpm test

# Test with coverage
pnpm test:coverage

# Build/test a specific package
pnpm --filter @aria51/core build
pnpm --filter @aria51/core test
```

## Requirements

- Node.js 18+
- pnpm 8+
- Playwright browsers (`npx playwright install chromium`)

## Documentation

- [Introduction](docs/introduction.md) — Architecture and how the pieces fit together
- [Agent](packages/agent/docs/introduction.md) — The autonomous auditing agent
- [WCAG 2.2 Reference](docs/WCAG-2.2.md) — All 86 success criteria
- [Effect Architecture](docs/effect-service-breakdown.md) — Core scanning engine internals
