# Issue: Converge Stagehand and Core Audit Implementations

## Problem

Two parallel implementations of keyboard testing, structure analysis, and screen reader simulation exist:

**Core audits** (`packages/core/src/audits/`) — Playwright DOM APIs. Fast (2-3s), free, deterministic. Check what's *programmatically there*.

**Stagehand audits** (`packages/ai-auditor/src/stagehand/`) — Playwright + LLM vision. Slow (30-60s), needs OpenAI + Browserbase keys, non-deterministic. Check what's *perceptually there*.

Both are wired into different surfaces with no connection between them:
- Core audits → MCP tools, CLI `--audit-*` flags, agent tools
- Stagehand audits → CLI `--stagehand-*` flags only

This creates maintenance burden, user confusion, and prevents the agent from accessing deeper analysis when it needs it.

## Where they diverge

| Check | Core (DOM) | Stagehand (Vision + AI) |
|-------|-----------|------------------------|
| Focus indicator | `outline !== 'none'` in CSS | "Is this indicator actually visible against the background?" |
| Skip link | First focusable element text includes "skip" | Finds hidden skip links, tests if target exists and works |
| Alt text | Present vs missing (binary) | Meaningful vs decorative vs unhelpful (judgment) |
| Heading hierarchy | Level numbers — h1→h3 = skip | "Does this hierarchy make sense for the content?" |
| Link purpose | Regex match on "click here", "read more" | "Can a user understand where this link goes in context?" |
| Form labels | `<label for>` or `aria-label` exists | "Does this label actually describe what to enter?" |
| Keyboard traps | Same element focused 3+ times | Navigates complex widgets, detects subtle traps in modals/menus |

Core catches the 80% that's mechanically detectable. Stagehand catches the 20% that requires judgment. Neither is wrong — they test different things.

## Proposed solution: Tiered audits

Core audits become **tier 1** — always available, always fast. Stagehand becomes **tier 2** — an enhancement layer that takes core results and adds AI judgment.

### API design

```typescript
// Tier 1: always available, no API keys
import { auditKeyboard } from '@aria51/core';
const result = await auditKeyboard(url);
// → KeyboardAuditResult { tabOrder, issues, focusTrapDetected, ... }

// Tier 2: enriches tier 1 with AI judgment, needs OPENAI_API_KEY
import { auditKeyboardDeep } from '@aria51/core';
const result = await auditKeyboardDeep(url, { model: 'gpt-4o-mini' });
// → KeyboardAuditResult & { deepAnalysis: DeepKeyboardAnalysis }
```

The deep version calls the core version first, then passes the results + a browser page to Stagehand for visual verification and contextual judgment. Same return type extended, not a separate type.

### Surface integration

**MCP tools:**
```
test_keyboard(url)                    → tier 1 (default)
test_keyboard(url, deep: true)        → tier 2 (if API keys available)
```

**CLI:**
```
aria51 <url> --audit-keyboard         → tier 1
aria51 <url> --audit-keyboard --deep  → tier 2
```

**Agent:**
The agent calls `test_keyboard` (tier 1) by default. If results are ambiguous (e.g., focus indicator detected via CSS but low confidence), it can call `test_keyboard_deep` to escalate. This is the "human auditor" pattern — start with automated checks, dig deeper when something looks off.

### What this replaces

The current Stagehand-specific CLI flags (`--stagehand-keyboard`, `--stagehand-tree`, `--wcag-audit`) would eventually be replaced by `--audit-keyboard --deep`, `--audit-structure --deep`, etc. The Stagehand services in `ai-auditor` would be refactored into enhancement functions that take core audit results as input rather than reimplementing the checks from scratch.

## Files involved

### Extract Stagehand judgment logic
- `packages/ai-auditor/src/stagehand/keyboard-tester.ts` → extract `testFocusIndicators()` visual check, `testSkipLinks()` functional test
- `packages/ai-auditor/src/stagehand/screen-reader-navigator.ts` → extract landmark quality checks, heading semantic analysis
- `packages/ai-auditor/src/stagehand/a11y-tree-analyzer.ts` → extract ARIA role validation, duplicate ID detection

### Create deep audit layer in core
- `packages/core/src/audits/keyboard-deep.ts` — `auditKeyboardDeep()` wraps `auditKeyboard()` + Stagehand enhancements
- `packages/core/src/audits/structure-deep.ts` — same pattern
- `packages/core/src/audits/screen-reader-deep.ts` — same pattern

### Update surfaces
- `packages/mcp/src/server.ts` — add `deep` parameter to judgment tools
- `packages/cli/src/modes/audit.ts` — add `--deep` flag handling
- `packages/agent/src/tools/` — add deep variants or auto-escalation logic

### Deprecate
- `packages/cli/src/modes/stagehand.ts` — eventually replaced by `--audit-* --deep`
- Direct Stagehand CLI flags (`--stagehand-keyboard`, `--stagehand-tree`)

## Non-goals

- Don't remove Stagehand entirely — its AI vision capabilities (focus indicator verification, content quality judgment) are genuinely useful
- Don't make tier 2 required — the tool must work fully without OpenAI/Browserbase keys
- Don't change the `@aria51/ai-auditor` package API for now — the WcagAuditService and other services can stay as-is until the convergence is done

## Priority

Not blocking release. The current dual-implementation works — it's just not elegant. This is a refactoring project for after the initial share, once real usage patterns show which Stagehand capabilities people actually want.
