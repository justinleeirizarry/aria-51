# @aria51/agent

An autonomous accessibility auditing agent that uses LLMs to plan, scan, verify, and remediate WCAG compliance issues across websites.

## What it does

You give it a URL. It gives you back a verified accessibility audit with a prioritized fix plan.

The agent autonomously:

1. **Discovers pages** on your site via sitemap or link crawling
2. **Scans pages** using axe-core, keyboard tests, and 34 WCAG 2.2 checks
3. **Verifies findings** by cross-referencing its AI observations against deterministic scan results
4. **Generates a remediation plan** with issues grouped into immediate, short-term, and long-term phases

Every finding gets a confidence level based on whether deterministic tools agree with the AI's assessment:

| Confidence | Meaning |
|---|---|
| **confirmed** | axe-core found the same violation |
| **corroborated** | axe-core found related evidence on the same element |
| **ai-only** | only the AI detected it — needs manual review |
| **contradicted** | axe-core passed the related rule — likely a false positive |

This self-verification loop is the core differentiator. The agent doesn't just report what the AI thinks — it grounds every observation in deterministic test results.

## Quick start

```typescript
import { runAgent } from '@aria51/agent';

const report = await runAgent({
  targetUrl: 'https://your-site.com',
});

console.log(`${report.totalFindings} issues found across ${report.pagesScanned} pages`);
console.log(report.agentSummary);
```

That's it. The agent handles crawl planning, browser automation, scanning, verification, and report generation.

## How it works

The agent is built on a tool-use loop. An LLM (Claude by default) receives a system prompt describing its role as an accessibility auditor, along with seven tools it can call. The LLM decides which tools to use, in what order, and how to interpret the results.

```
You provide:                The agent does:              You get back:

  targetUrl ──────→  plan_crawl (discover pages)    ──→  AuditReport
  wcagLevel           scan_page / scan_batch              ├── findings[]
  maxPages             read_state (check progress)        │   ├── confidence
  provider             verify_findings (vs axe-core)      │   ├── criterion
                       generate_remediation               │   └── evidence
                                                          ├── remediationPlan
                                                          └── agentSummary
```

The agent loop runs until the LLM decides it has enough information to produce a final report, or until it hits the `maxSteps` limit.

### Tools

The agent has seven tools, each bound to a shared session that tracks state across the audit:

| Tool | What it does |
|---|---|
| `plan_crawl` | Discovers pages via sitemap.xml or browser-based link extraction. Prioritizes pages by template diversity (homepage, forms, auth, content). |
| `scan_page` | Runs a full accessibility scan on a single URL — axe-core violations, keyboard navigation tests, and WCAG 2.2 custom checks. |
| `scan_batch` | Scans multiple URLs in parallel, respecting a configurable concurrency limit. |
| `read_state` | Lets the agent inspect its own progress — what's been scanned, what's pending, what findings exist so far. |
| `verify_findings` | The self-verification tool. Takes the agent's observations and cross-references each against axe-core's deterministic results to assign confidence levels. |
| `diff_report` | Compares current findings against a previous audit snapshot to track remediation progress over time. |
| `generate_remediation` | Produces a phased remediation plan from verified findings, prioritized by severity, confidence, WCAG level, and estimated effort. |

### Session state

All tools share a single `AuditSession` object that acts as the agent's working memory during an audit. It tracks:

- Crawl plan and pending/scanned URLs
- Full scan results per page (stored by URL)
- Verified findings with confidence levels
- The remediation plan
- Step and tool call counts

The session progresses through states: `planning` → `scanning` → `verifying` → `remediating` → `complete`.

## Providers

The agent defaults to OpenAI's gpt-4o-mini for low cost and easy setup. For best results, use Anthropic's Claude (e.g. `--agent-model claude-sonnet-4-6`) — Claude excels at tool use, and the native Anthropic SDK provides features like automatic retries, model fallback, and extended thinking.

But the agent also supports any LLM that can do tool calling, via the Vercel AI SDK:

```typescript
// Default: Anthropic (recommended)
await runAgent({ targetUrl: 'https://your-site.com' });

// OpenAI
import { openai } from '@ai-sdk/openai';
await runAgent({
  targetUrl: 'https://your-site.com',
  provider: { type: 'ai-sdk', model: openai('gpt-4o') },
});

// Google
import { google } from '@ai-sdk/google';
await runAgent({
  targetUrl: 'https://your-site.com',
  provider: { type: 'ai-sdk', model: google('gemini-2.0-flash') },
});

// Local (Ollama)
import { ollama } from 'ollama-ai-provider';
await runAgent({
  targetUrl: 'https://your-site.com',
  provider: { type: 'ai-sdk', model: ollama('llama3.1') },
});
```

The Anthropic provider includes resilience features that the AI SDK path doesn't:

- **Model fallback**: If Opus is overloaded, automatically falls back to Sonnet, then Haiku
- **Retry with backoff**: Exponential backoff on rate limits (429) and overload (529)
- **Adaptive thinking**: Claude thinks through complex decisions before acting

## Multi-specialist mode

For comprehensive audits, the agent can run multiple specialist auditors in parallel, each focused on a different accessibility domain, then merge and deduplicate their findings.

```typescript
const report = await runAgent({
  targetUrl: 'https://your-site.com',
  specialists: true,
});
```

Four specialists each audit the site through a different lens:

| Specialist | Focus area |
|---|---|
| **Keyboard & Navigation** | Tab order, focus indicators, keyboard traps, skip links |
| **Visual & Content** | Alt text, color contrast, reflow, media captions |
| **Forms & Interaction** | Labels, error messages, validation, autocomplete |
| **Structure & Semantics** | Heading hierarchy, landmarks, ARIA, reading order |

Findings are assigned confidence based on cross-referencing with axe-core and WCAG 2.2 checks. If multiple specialists independently identify the same issue, this is noted in the evidence but does not artificially boost confidence — each specialist covers a distinct WCAG domain, so overlap is the exception, not the rule.

### Lead agent orchestrator

By default, multi-specialist mode uses a lead agent that analyzes the site first, then delegates to specialists with specific instructions. The lead agent:

1. Crawls the site and runs an initial scan
2. Decides which specialists to use based on what it finds (a simple blog might only need 2; a complex e-commerce site gets all 4)
3. Gives each specialist specific instructions ("focus on the checkout flow forms" rather than generic "check forms")
4. Shares the crawl plan so specialists don't waste time re-discovering pages

This is the coordinator-workers pattern — the lead agent plans the work, specialists execute it in parallel, and the merger deduplicates overlapping findings.

## Relationship to the rest of aria-51

`@aria51/agent` sits on top of the existing monorepo packages:

```
@aria51/agent          ← You are here
    │
    │ uses runScanAsPromise() and AXE_WCAG_MAP
    ▼
@aria51/core           ← Scanning engine (axe-core, Playwright, WCAG 2.2 checks)
    │
    │ optional React component attribution
    ▼
@aria51/react          ← React Fiber traversal plugin

Other packages that can consume the agent:
  @aria51/cli          ← Terminal UI (could add `aria51 audit --agent` command)
  @aria51/web          ← Web dashboard (could add agent-powered deep audits)
  @aria51/mcp          ← MCP server (could expose agent as a tool for Claude Desktop)
```

The agent doesn't replace the existing scanning tools — it orchestrates them. `@aria51/core` does the actual accessibility scanning. The agent decides what to scan, in what order, and what the results mean.

## Event streaming

The agent emits events as it works, so you can build real-time UIs or logging:

```typescript
await runAgent({
  targetUrl: 'https://your-site.com',
  onEvent: (event) => {
    switch (event.type) {
      case 'thinking':       // Agent reasoning
      case 'tool_call':      // Tool invocation
      case 'step_complete':  // Loop iteration done
      case 'specialist_complete': // Specialist finished (multi-specialist mode)
      case 'merge_complete':     // Merge stats (multi-specialist mode)
      case 'complete':       // Final report ready
    }
  },
});
```

## What's next

- [Configuration Reference](./configuration.md) — All options with defaults and examples
- [API Reference](./api-reference.md) — Exported functions, types, and interfaces
- [Tools Deep Dive](./tools.md) — How each tool works and what it returns
- [Multi-Specialist Mode](./specialists.md) — The specialist pattern, lenses, and the coordinator
- [Provider Guide](./providers.md) — Using different LLMs and configuring fallback
- [Architecture](./architecture.md) — Internal design decisions and patterns
