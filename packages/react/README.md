# a11y.scan

Accessibility scanner with source file attribution. Finds WCAG violations and maps them to the source files and components that caused them.

Works with React, Vue, Svelte, and Solid via [element-source](https://github.com/aidenybai/element-source).

## Quick Start

```bash
# Scan any website
a11y-toolkit https://example.com

# JSON output
a11y-toolkit https://example.com --output report.json

# Generate AI fix prompt
a11y-toolkit https://example.com --ai
```

Component attribution and source file resolution are automatic when a supported framework is detected. Disable with `--no-components`.

## Source File Locations

When your build includes source maps (`productionBrowserSourceMaps: true` in Next.js), violations include the exact source file and line number:

```
SERIOUS  link-name  2 instances
Ensures links have discernible text
FIX: Add accessible text to the link

  components/ui/hover-button.tsx:10 in PageContent
  <a href="mailto:..." class="relative z-10 inline-flex ...">
```

For readable component names, disable name mangling in your bundler:

- **Next.js:** `next build --no-mangling`
- **Vite:** `esbuild: { keepNames: true }`
- **Webpack/Terser:** `terserOptions: { keep_classnames: true, keep_fnames: true }`

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--browser`, `-b` | `chromium`, `firefox`, or `webkit` | `chromium` |
| `--output`, `-o` | JSON output file | - |
| `--ai` | Generate AI fix prompt (markdown) | `false` |
| `--ci` | Exit code 1 if violations exceed threshold | `false` |
| `--threshold` | Max violations in CI mode | `0` |
| `--no-components` | Disable framework component attribution | - |
| `--tags` | axe-core tags filter (e.g. `wcag2a,best-practice`) | - |
| `--disable-rules` | axe rule IDs to skip (e.g. `color-contrast`) | - |
| `--exclude` | CSS selectors to exclude from scanning | - |
| `--quiet`, `-q` | Summary only | `false` |

## Web UI

```bash
pnpm --filter @accessibility-toolkit/web dev
# Open http://localhost:3847
```

Enter a URL, get a full report with source locations, fix suggestions, and a "Copy AI Prompt" button.

## MCP Server

Add to your MCP client config:

```json
{
  "mcpServers": {
    "a11y-scanner": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"]
    }
  }
}
```

Tools: `scan_url`, `scan_urls`. Component attribution is on by default.

## How It Works

1. Launches a browser via Playwright
2. Runs axe-core for WCAG violation detection
3. Detects the frontend framework (React, Vue, Svelte, Solid)
4. Uses [element-source](https://github.com/aidenybai/element-source) to resolve each violation's DOM element back to its source file, line number, and component name
5. Generates actionable output with source locations for AI agents or developers

## Built With

- **[Playwright](https://playwright.dev/)** — Browser automation
- **[axe-core](https://github.com/dequelabs/axe-core)** — Accessibility testing engine
- **[element-source](https://github.com/aidenybai/element-source)** — Source file resolution for React, Vue, Svelte, Solid
- **[Ink](https://github.com/vadimdemedes/ink)** — Terminal UI
- **[Hono](https://hono.dev/)** — Web UI server
