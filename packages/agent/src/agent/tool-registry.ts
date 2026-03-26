/**
 * Tool Registry
 *
 * Creates all agent tools and provides them as a registry
 * for the AI SDK generateText call.
 */
import type { AuditSession } from '../types.js';
import { createCrawlPlannerTool } from '../tools/crawl-planner.js';
import { createScanPageTool } from '../tools/scan-page.js';
import { createScanBatchTool } from '../tools/scan-batch.js';
import { createReadStateTool } from '../tools/read-state.js';
import { createVerifyFindingsTool } from '../tools/verify-findings.js';
import { createDiffReportTool } from '../tools/diff-report.js';
import { createGenerateRemediationTool } from '../tools/generate-remediation.js';

/**
 * Create all agent tools bound to the given session.
 */
export function createToolRegistry(session: AuditSession) {
    return {
        plan_crawl: createCrawlPlannerTool(session),
        scan_page: createScanPageTool(session),
        scan_batch: createScanBatchTool(session),
        read_state: createReadStateTool(session),
        verify_findings: createVerifyFindingsTool(session),
        diff_report: createDiffReportTool(session),
        generate_remediation: createGenerateRemediationTool(session),
    };
}
