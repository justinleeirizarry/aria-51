# Contributing to aria-51

## Local Development Setup

```bash
# Clone and install
git clone https://github.com/justinirizarry/aria-51.git
cd aria-51
pnpm install

# Install Playwright browsers
npx playwright install chromium

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Monorepo Structure

| Package | Purpose |
|---------|---------|
| `@aria51/core` | Scanning engine — axe-core, WCAG 2.2 checks, keyboard tests |
| `@aria51/components` | Component attribution (React, Vue, Svelte, Solid) |
| `@aria51/ai-auditor` | AI-powered testing via Stagehand/Browserbase |
| `@aria51/agent` | Autonomous auditing agent powered by Claude |
| `@aria51/cli` | Terminal interface (`aria51` command) |
| `@aria51/mcp` | MCP server for AI assistants |

Dependencies flow: `core` -> `components`, `ai-auditor` -> `agent` -> `cli`, `mcp`

## Development Workflow

```bash
# Watch mode (all packages)
pnpm dev

# Build a single package
pnpm --filter @aria51/core build

# Run tests for a single package
pnpm --filter @aria51/core test

# Run the CLI
pnpm start https://some-site.com

# Run the CLI with agent mode
pnpm start https://some-site.com --agent
```

## Adding a New WCAG 2.2 Check

1. Create a new file in `packages/core/src/scanner/wcag22/your-check.ts`
2. Export a function that takes a Playwright `Page` and returns violations
3. Register it in `packages/core/src/scanner/wcag22/index.ts`
4. Add the WCAG criterion mapping in `packages/core/src/data/axe-wcag-map.ts` if it overlaps with an axe rule
5. Add tests in `packages/core/src/scanner/wcag22/your-check.test.ts`

## Adding a New Agent Tool

1. Create `packages/agent/src/tools/your-tool.ts` following the pattern in existing tools
2. Export a `createYourTool(session: AuditSession): AgentToolDef` function
3. Register it in `packages/agent/src/agent/tool-registry.ts`
4. The tool will automatically be available to both the Anthropic and AI SDK providers

## Adding a New MCP Tool

1. Add a `server.registerTool()` call in `packages/mcp/src/server.ts`
2. Use Zod schemas for input validation with `.describe()` on every parameter
3. Return `{ content: [{ type: "text", text: "..." }] }` for success
4. Return `{ content: [...], isError: true }` for errors

## Testing

- **Unit tests**: `packages/*/src/**/*.test.ts` — run with `pnpm test`
- **Integration tests**: `test/integration/*.test.ts` — test full scan flows with Playwright
- **Agent smoke test**: `npx tsx packages/agent/scripts/smoke-test.ts` — requires `ANTHROPIC_API_KEY`

## Environment Variables

| Variable | Required For |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Agent mode, `run_agent` MCP tool |
| `OPENAI_API_KEY` | Stagehand AI tests |
| `BROWSERBASE_API_KEY` | Cloud browser (Stagehand) |
| `BROWSERBASE_PROJECT_ID` | Cloud browser (Stagehand) |

## Build Notes

- Each package cleans `dist/` before building (`rm -rf dist && tsc`)
- Root `pnpm build` runs sequentially (`--workspace-concurrency=1`) to respect dependency order
- The scanner bundle (`packages/core/dist/scanner-bundle.js`) is built with esbuild as an IIFE
- The `.npmrc` prevents `@anthropic-ai/sdk` from being hoisted to avoid version conflicts

## Pull Requests

- Ensure `pnpm build` passes
- Ensure `pnpm test` passes (632+ tests)
- Keep changes focused — one feature or fix per PR
- Include a description of what changed and why
