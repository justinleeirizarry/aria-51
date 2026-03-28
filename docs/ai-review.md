# aria-51: AI Agent Review & Remaining Work

## Remaining TODOs

### Should do soon
- **HTML/SARIF export formats** — JSON is fine for machines but humans want HTML reports they can share with stakeholders. SARIF would plug into GitHub code scanning automatically.
- **Web dashboard auth** — `cors('*')` and no auth means anyone on your network can use it as a scanning proxy. Fine for local dev, bad if someone deploys it.
- **Parallel multi-page scanning** — `runMultiScanAsPromise` scans URLs sequentially in a for-loop. Independent URLs should run concurrently with a configurable limit.
- **CSP bypass via Playwright** — the CSP error message is helpful now but a `--bypass-csp` flag using Playwright's `bypassCSP: true` launch option would actually solve the problem.

### Nice to have
- **Auth/login support** — no way to scan behind authentication. A `--cookies` flag or pre-scan login flow would open up most real-world apps.
- **`list_wcag_criteria` MCP tool** — let AI query criteria by level/principle/keyword without relying on training data.
- **Watch mode** — `pnpm dev` watches TypeScript but doesn't rebuild the scanner bundle. Contributors touching browser-side code have to manually rebuild.
- **Agent error event type** — specialist failures are swallowed into `{ type: 'thinking' }` events. A dedicated `{ type: 'error' }` variant would let callers distinguish warnings from failures.
- **Provider type cleanup** — `createAiSdkProvider` takes `model: any` and uses `as any` casts. These will bite when SDK versions drift.
- **Cyclic workspace dependency** — pnpm warns about a cycle between core and ai-auditor on every install. Should be resolved.

### Not worth doing yet
- **Effect-ts in the agent package** — the agent uses raw async/await with try/catch everywhere while core uses Effect. Consistency would be nice but the agent works fine and the migration would be large with no user-facing benefit.
- **Turbo/Nx for build orchestration** — `--workspace-concurrency=1` is a blunt fix. A proper task runner would help at scale, but with 7 packages it's not painful enough to justify the tooling overhead.

---

## Honest Assessment: Using aria-51 as an AI Agent

### What I actually did

I ran the CLI against real sites (react.dev, nodejs.org, anthropic.com, github.com, W3C BAD). I tested the MCP server via JSON-RPC. I ran the agent against W3C BAD with both sonnet and opus. I read most of the codebase. I spawned 4 parallel review agents. I fixed 22 issues across 4 commits.

### What works well

**The core scanner is genuinely good.** It found real, actionable issues on every site I tested. The combination of axe-core + 34 custom WCAG 2.2 checks + keyboard tests + supplemental screen reader checks produces results that are noticeably more comprehensive than just running axe alone. The supplemental checks caught things like "Only 1 of 135 interactive elements are reachable via keyboard Tab" on react.dev — that's the kind of finding that matters.

**The MCP tools are well-designed for AI consumption.** The tool descriptions, parameter names, and `.describe()` annotations are good enough that I could use them without reading docs. The markdown-formatted output is the right format for LLM context — structured enough to parse, readable enough to reason over. The `get_accessibility_tree` tool is especially useful because it's lightweight and works on CSP-restricted sites where the full scanner can't.

**The output formatting is clear and actionable.** Violations include the HTML element, CSS selector, WCAG criteria with links, and failure summaries. A developer can look at the output and know exactly what to fix. The AI prompt generation (`--ai`) produces something I could actually work with to generate fixes.

**The multi-specialist agent architecture is interesting.** Four specialists with different lenses (keyboard, visual, forms, structure) finding issues independently, then deduplicating — the confirmation/corroboration confidence system is a smart way to handle LLM unreliability. The findings that multiple specialists independently identify are more trustworthy.

### What doesn't work well

**The agent was completely broken before I fixed it.** The SDK version hoisting bug meant the entire agent package — the headline AI-native feature — produced zero findings and hallucinated a report instead. This would have been the first thing anyone tried, and it would have looked like the tool doesn't work. The fact that this wasn't caught suggests there's no CI running the smoke test.

**The agent is slow and expensive.** Even with sonnet, a single-page audit takes ~110 seconds and makes multiple Claude API calls. Multi-specialist mode would multiply that by 4-5x. For a tool you'd want to run in CI on every PR, that's too slow and too costly. The core scanner (without the agent) takes 8-15 seconds and produces arguably more reliable results since they're deterministic. The agent's value is in the remediation plan and the natural-language summary — not in finding more issues.

**The Stagehand/Browserbase integration is a dependency liability.** It requires OpenAI and Browserbase API keys, pins `@anthropic-ai/sdk@0.39.0` (which caused the hoisting bug), and adds a significant dependency footprint for features most users won't use. The core scanner's own keyboard and screen reader checks (via Playwright) already cover most of what Stagehand does, without external APIs.

**"0 components" on non-framework sites was a bad default.** Before I fixed it, every scan of a plain HTML site showed "0 components" in the summary and "Unknown" for every violation instance. This made the tool look broken. The component attribution feature is genuinely useful for React/Vue apps, but it shouldn't be visible when it's not applicable.

**The build system was fragile.** Three separate issues: stale dist/ artifacts, non-deterministic build order, and SDK version conflicts. All fixable (and now fixed), but they suggest the project grew organically without CI enforcing these invariants. Anyone cloning the repo and running `pnpm build` would have hit a wall.

**The test suite had stale assertions.** Three tests were failing because the code had been refactored (waitUntil changed, bundle renamed) but the tests weren't updated. The old `@accessibility-toolkit` alias in vitest.config.ts was papering over real import path issues. This isn't unusual for a project in active development, but it means the test suite wasn't actually being run regularly.

### Is it useful?

**Yes, with caveats.**

The core scanner (`@aria51/core` + `@aria51/cli`) is production-ready and genuinely useful. It's more thorough than running axe-core alone, the CLI is well-designed, and the MCP server makes it trivially accessible to AI assistants. If the pitch is "better axe-core with WCAG 2.2 coverage, keyboard testing, and AI-native interfaces" — that's real and differentiated.

The agent is interesting but not the selling point yet. It's slow, expensive, and the core scanner already finds more issues (69 violations on W3C BAD via CLI vs 14 findings via agent). The agent's value is in interpretation and prioritization, not detection. It should be positioned as an optional deep-dive tool, not the primary workflow.

The Stagehand integration adds complexity without proportional value for most users. I'd consider making it a truly optional addon rather than a core package.

### What I'd focus on for launch

1. **Nail the core scanner + CLI + MCP** — these are solid and differentiated. Make sure the first-run experience is flawless.
2. **Get CI running** — GitHub Actions with `pnpm build && pnpm test`. The build/test failures I found would have been caught immediately.
3. **Ship the MCP server as the primary AI integration** — it's simpler, faster, and more reliable than the agent. An AI can call `scan_url` and reason about the results itself. It doesn't need the agent to do that.
4. **Position the agent as "deep audit mode"** — for when you want a comprehensive site-wide audit with remediation planning. Not for CI, not for quick checks.

### On the "AI-native" framing

The MCP tools are genuinely AI-native — they're designed for AI consumption and they work well. But "AI-native" shouldn't mean "requires AI to function." The core value is the scanner itself. The AI layers (agent, MCP, Stagehand) are distribution and UX innovations on top of solid deterministic tooling. That's the right architecture. Don't lose sight of the foundation while chasing the AI angle.
