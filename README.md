# aria-51

Accessibility testing platform with scanning, AI auditing, and an autonomous agent. Framework-agnostic core with optional React component attribution.

See the [full introduction](docs/introduction.md) for a detailed walkthrough of the architecture.

## Packages

| Package | Description |
| ------- | ----------- |
| [`@aria51/core`](packages/core) | Scanning engine: axe-core, keyboard tests, WCAG 2.2 checks, fix suggestions |
| [`@aria51/components`](packages/components) | Component attribution via element-source (React, Preact, Vue, Svelte, Solid) |
| [`@aria51/ai-auditor`](packages/ai-auditor) | AI-powered auditing via Stagehand/Browserbase |
| [`@aria51/agent`](packages/agent) | Autonomous auditing agent: planning, verification, multi-specialist coordination, remediation |
| [`@aria51/cli`](packages/cli) | Terminal UI (Ink). Binary: `aria51` |
| [`@aria51/web`](packages/web) | Web dashboard (Hono). Port 3847 |
| [`@aria51/mcp`](packages/mcp) | MCP server for MCP. Tools: `scan_url`, `scan_urls` |

## Quick Start

```bash
# Install dependencies
pnpm install

# Build everything
pnpm build

# Scan a URL
pnpm start https://your-site.com

# With React component attribution
pnpm start https://your-site.com -- --react

# Run the autonomous agent
pnpm tsx packages/agent/scripts/smoke-test.ts
```

## Development

```bash
# Watch mode (all packages)
pnpm dev

# Run tests
pnpm test

# Test with coverage
pnpm test:coverage

# Build a specific package
pnpm --filter @aria51/core build

# Test a specific package
pnpm --filter @aria51/core test
```

## Requirements

- Node.js 18+
- pnpm 8+
- Playwright browsers (`npx playwright install chromium`)

## Documentation

- [Introduction](docs/introduction.md) — What aria-51 is and how the pieces fit together
- [Agent](packages/agent/docs/introduction.md) — The autonomous auditing agent
- [WCAG 2.2 Reference](docs/WCAG-2.2.md) — All 86 success criteria
- [Effect Architecture](docs/effect-service-breakdown.md) — Core scanning engine internals
