# @aria51/cli

Terminal interface for aria-51 accessibility testing. Supports single and multi-URL scanning, focused audits, full WCAG compliance audits, AI-enhanced deep analysis, and Playwright test generation.

## Install

```bash
npm install -g @aria51/cli
```

Requires Playwright browsers:

```bash
npx playwright install chromium
```

## Usage

```bash
# Basic scan
aria51 https://example.com

# Multiple URLs
aria51 https://example.com https://example.com/about

# Quiet mode — compact summary
aria51 https://example.com --quiet

# Export JSON report
aria51 https://example.com --output report.json

# CI mode — exit 1 if violations exceed threshold
aria51 https://example.com --ci --threshold 0
```

### Focused audits

No API keys required:

```bash
aria51 https://example.com --audit-keyboard        # Tab order, focus traps, skip links
aria51 https://example.com --audit-structure        # Landmarks, headings, form labels
aria51 https://example.com --audit-screen-reader    # Alt text, ARIA, lang, labels
```

Add `--deep` for AI-enhanced analysis (requires `OPENAI_API_KEY`):

```bash
aria51 https://example.com --audit-keyboard --deep
```

### Full audit

Complete multi-page WCAG compliance audit — no API key needed:

```bash
aria51 https://example.com --full-audit
aria51 https://example.com --full-audit --max-pages 20
```

Discovers pages via sitemap + link crawling, scans with axe-core, runs focused audits on key pages, generates a prioritized remediation plan.

### Test generation

Generate Playwright accessibility tests:

```bash
aria51 https://example.com --generate-test
aria51 https://example.com --generate-test --test-file tests/a11y.spec.ts
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--browser, -b` | chromium, firefox, or webkit | chromium |
| `--headless` | Run headless | true |
| `--mobile` | Mobile viewport emulation | false |
| `--quiet, -q` | Compact summary output | false |
| `--output, -o` | JSON output file path | — |
| `--ci` | CI mode (exit code on violations) | false |
| `--threshold` | Max violations for CI pass | 0 |
| `--full-audit` | Run complete WCAG compliance audit | false |
| `--max-pages` | Max pages for full audit | 10 |
| `--no-components` | Disable component attribution | — |
| `--tags` | Comma-separated axe-core tags | — |
| `--disable-rules` | Comma-separated axe rules to skip | — |
| `--exclude` | CSS selectors to exclude | — |

## Environment variables

| Variable | Required for | Description |
|----------|-------------|-------------|
| `OPENAI_API_KEY` | `--deep`, `--generate-test` | Stagehand AI features (optional) |

## License

MIT
