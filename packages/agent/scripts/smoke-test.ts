#!/usr/bin/env npx tsx
import 'dotenv/config';
/**
 * Smoke Test — Run the agent against the W3C BAD (Before and After Demo)
 *
 * This is an intentionally inaccessible website maintained by W3C
 * for testing accessibility tools.
 *
 * Usage:
 *   npx tsx packages/agent/scripts/smoke-test.ts
 *
 * Requires:
 *   - ANTHROPIC_API_KEY environment variable
 *   - Playwright browsers installed (npx playwright install chromium)
 */
import { runAgent } from '../src/index.js';

const TARGET = 'https://www.w3.org/WAI/demos/bad/before/home.html';

console.log('='.repeat(60));
console.log(`@aria51/agent Smoke Test`);
console.log(`Target: ${TARGET}`);
console.log(`Provider: anthropic (claude-opus-4-6)`);
console.log(`Mode: single pass, 1 page max, 10 steps max`);
console.log('='.repeat(60));
console.log('');

const startTime = Date.now();

try {
    const report = await runAgent({
        targetUrl: TARGET,
        maxPages: 1,
        maxSteps: 10,
        onEvent: (event) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            switch (event.type) {
                case 'thinking':
                    console.log(`[${elapsed}s] 💭 ${event.message}`);
                    break;
                case 'tool_call':
                    console.log(`[${elapsed}s] 🔧 ${event.tool}(${JSON.stringify(event.input).slice(0, 100)})`);
                    break;
                case 'step_complete':
                    console.log(`[${elapsed}s] ✓ Step ${event.stepIndex} complete (${event.toolCalls} tool calls)`);
                    break;
                case 'specialist_complete':
                    console.log(`[${elapsed}s] 🔍 Specialist ${event.specialistId}: ${event.findings} findings`);
                    break;
                case 'merge_complete':
                    console.log(`[${elapsed}s] 🔗 Merged: ${event.totalFindings} findings (${event.deduplicatedCount} deduplicated)`);
                    break;
                case 'complete':
                    console.log(`[${elapsed}s] ✅ Complete!`);
                    break;
            }
        },
    });

    console.log('\n' + '='.repeat(60));
    console.log('AUDIT REPORT');
    console.log('='.repeat(60));
    console.log(`Session: ${report.sessionId}`);
    console.log(`URL: ${report.url}`);
    console.log(`WCAG Level: ${report.wcagLevel}`);
    console.log(`Pages Scanned: ${report.pagesScanned}`);
    console.log(`Total Findings: ${report.totalFindings}`);
    console.log(`Duration: ${(report.scanDurationMs / 1000).toFixed(1)}s`);

    console.log('\nFindings by Confidence:');
    for (const [level, count] of Object.entries(report.findingsByConfidence)) {
        if (count > 0) console.log(`  ${level}: ${count}`);
    }

    console.log('\nFindings by Severity:');
    for (const [level, count] of Object.entries(report.findingsBySeverity)) {
        if (count > 0) console.log(`  ${level}: ${count}`);
    }

    if (report.findings.length > 0) {
        console.log('\nTop Findings:');
        for (const f of report.findings.slice(0, 10)) {
            console.log(`  [${f.confidence}] ${f.criterion.id} (${f.impact}): ${f.description}`);
        }
    }

    if (report.remediationPlan) {
        console.log(`\nRemediation Plan: ${report.remediationPlan.totalIssues} issues, ${report.remediationPlan.estimatedEffort} effort`);
        for (const phase of report.remediationPlan.phases) {
            console.log(`  Phase ${phase.priority}: ${phase.title} (${phase.items.length} items)`);
        }
    }

    console.log('\nAgent Summary (first 500 chars):');
    console.log(report.agentSummary.slice(0, 500));

} catch (error) {
    console.error('\n❌ SMOKE TEST FAILED');
    console.error(error);
    process.exit(1);
}
