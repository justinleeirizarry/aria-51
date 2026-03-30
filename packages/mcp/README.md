# @aria51/mcp

[Model Context Protocol](https://modelcontextprotocol.io) server for aria-51. Exposes 10 accessibility testing tools for AI assistants like Claude Code and Cursor. No API keys required for core functionality.

## Install

```bash
npm install -g @aria51/mcp
```

## Configure

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "aria51": {
      "command": "npx",
      "args": ["-y", "@aria51/mcp"]
    }
  }
}
```

### Cursor / Windsurf

Add `aria51-mcp` as an MCP command in your editor's MCP settings.

## Tools

| Tool | Description |
|------|-------------|
| `scan_url` | Scan a URL for accessibility violations |
| `scan_urls` | Batch scan multiple URLs |
| `get_accessibility_tree` | Get page semantic structure (works on CSP-restricted sites) |
| `explain_violation` | Explain an axe-core rule and how to fix it |
| `list_wcag_criteria` | Look up WCAG 2.2 criteria by level, principle, or keyword |
| `test_keyboard` | Test keyboard navigation (tab order, focus traps, indicators) |
| `analyze_structure` | Analyze landmarks, headings, form labels |
| `test_screen_reader` | Simulate screen reader navigation |
| `discover_pages` | Find all pages on a site via sitemap + link crawling |
| `run_full_audit` | Complete WCAG compliance audit with remediation plan |

All tools work without API keys. Optional `deep` mode for AI-enhanced analysis requires `OPENAI_API_KEY`.

## License

MIT
