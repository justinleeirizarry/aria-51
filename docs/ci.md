# CI/CD Integration

aria-51 supports CI mode with threshold-based exit codes, making it easy to integrate into your CI/CD pipeline.

## GitHub Actions

```yaml
name: Accessibility
on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install
      - run: npx playwright install chromium

      # Scan your deployed site (or a preview URL)
      - name: Run accessibility scan
        run: |
          npx aria51 ${{ env.SITE_URL }} \
            --ci \
            --threshold 0 \
            --output a11y-report.json
        env:
          SITE_URL: https://your-site.com

      # Upload report as artifact
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: a11y-report
          path: a11y-report.json
```

## CLI Options for CI

| Flag | Description |
|------|-------------|
| `--ci` | Exit with code 1 if violations exceed threshold |
| `--threshold N` | Max allowed violations (default: 0) |
| `--output report.json` | Save JSON report |
| `--disable-rules rule1,rule2` | Skip specific axe rules |
| `--tags wcag2a,wcag2aa` | Only check specific WCAG levels |
| `--quiet` | Minimal output |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (violations within threshold) |
| 1 | Violations exceed threshold |
| 2 | Runtime or validation error |

## Multiple URLs

```bash
npx aria51 https://site.com https://site.com/about https://site.com/contact \
  --ci --threshold 0 --output report.json
```

## Scanning Preview Deployments

For Vercel, Netlify, or similar:

```yaml
      - name: Wait for deployment
        uses: actions/github-script@v7
        id: deploy
        with:
          script: |
            // Get preview URL from your deployment system
            return 'https://preview-url.vercel.app'

      - name: Run accessibility scan
        run: npx aria51 ${{ steps.deploy.outputs.result }} --ci
```
