/**
 * Stagehand WCAG Audit Agent
 *
 * Uses Stagehand's agent() API for autonomous WCAG compliance auditing.
 */
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
    WcagAuditOptions,
    WcagAuditResult,
    AuditFinding,
    AuditStatus,
    ImpactLevel,
    WcagCriterionInfo,
    WcagLevel,
} from "../types.js";
import { logger, getCriterionById } from "@aria51/core";
import {
    buildWcagAuditPrompt,
    buildCriteriaList,
    getInitialAnalysisInstruction,
    getFinalSummaryInstruction,
} from "./audit-prompts.js";

// Zod schemas for structured extraction
const AuditFindingSchema = z.object({
    criterionId: z.string().describe('WCAG criterion ID (e.g., "2.4.7")'),
    status: z.enum(['pass', 'fail', 'manual-review']).describe('Finding status'),
    element: z.string().optional().describe('Affected element description'),
    selector: z.string().optional().describe('CSS selector for the element'),
    description: z.string().describe('Description of the finding'),
    impact: z.enum(['critical', 'serious', 'moderate', 'minor']).optional().describe('Impact level'),
    evidence: z.string().optional().describe('Evidence or details'),
});

const AuditFindingsSchema = z.object({
    findings: z.array(AuditFindingSchema),
    pageAnalysis: z.string().optional().describe('Initial page analysis'),
});

const AuditSummarySchema = z.object({
    totalIssues: z.number(),
    critical: z.number(),
    serious: z.number(),
    moderate: z.number(),
    minor: z.number(),
    score: z.number().describe('Overall accessibility score 0-100'),
    topRecommendations: z.array(z.string()),
    summary: z.string().describe('Brief overall summary'),
});

const InitialAnalysisSchema = z.object({
    pageType: z.string(),
    mainElements: z.array(z.string()),
    obviousIssues: z.array(z.string()),
    priorityAreas: z.array(z.string()),
});

export class StagehandWcagAuditAgent {
    private stagehand: Stagehand | null = null;
    private options: WcagAuditOptions;

    constructor(options: WcagAuditOptions) {
        this.options = {
            maxPages: 1,
            maxSteps: 30,
            verbose: false,
            model: 'gpt-4o-mini',
            ...options,
            targetLevel: options.targetLevel || 'AA',
        };
    }

    get page() {
        if (!this.stagehand) return null;
        // @ts-ignore - Stagehand exposes page
        return this.stagehand.page || this.stagehand.context?.pages()[0] || null;
    }

    async init(): Promise<void> {
        logger.debug('Initializing Stagehand WCAG audit agent...');

        try {
            const options = {
                env: "LOCAL" as const,
                modelName: this.options.model || "gpt-4o-mini",
                verbose: (this.options.verbose ? 2 : 0) as 0 | 2,
                headless: true,
            };

            this.stagehand = new Stagehand(options);
            await this.stagehand.init();
            logger.debug('Stagehand WCAG audit agent initialized');
        } catch (error) {
            logger.error(`Failed to initialize Stagehand: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    async audit(url: string): Promise<WcagAuditResult> {
        if (!this.stagehand) {
            throw new Error("Stagehand not initialized");
        }

        logger.debug(`Starting WCAG ${this.options.targetLevel} audit for ${url}...`);

        const page = this.page;
        if (!page) {
            throw new Error("Page not available");
        }

        // Navigate to the URL
        await page.goto(url, { waitUntil: 'networkidle' });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Build the audit prompt
        const criteriaList = buildCriteriaList(
            this.options.targetLevel,
            this.options.criteria
        );
        const systemPrompt = buildWcagAuditPrompt(
            this.options.targetLevel,
            criteriaList
        );

        // Run the audit using the agent
        logger.debug('Running autonomous WCAG audit...');
        const findings = await this.runAuditAgent(systemPrompt);

        // Extract final summary
        logger.debug('Generating audit summary...');
        const summary = await this.extractSummary(findings);

        // Convert findings to result format
        const auditFindings = findings.map(f => this.convertFinding(f));

        return {
            url,
            timestamp: new Date().toISOString(),
            targetLevel: this.options.targetLevel,
            findings: auditFindings,
            summary: {
                passed: auditFindings.filter(f => f.status === 'pass').length,
                failed: auditFindings.filter(f => f.status === 'fail').length,
                manualReview: auditFindings.filter(f => f.status === 'manual-review').length,
                pagesVisited: 1, // Currently single-page audit
                statesChecked: findings.length,
            },
            agentMessage: summary.summary,
        };
    }

    /**
     * Run the audit agent with the given system prompt
     */
    private async runAuditAgent(systemPrompt: string): Promise<z.infer<typeof AuditFindingSchema>[]> {
        const allFindings: z.infer<typeof AuditFindingSchema>[] = [];

        try {
            // Initial page analysis
            const initialAnalysis = await this.stagehand!.extract(
                getInitialAnalysisInstruction(),
                InitialAnalysisSchema
            );

            logger.debug(`Page type: ${initialAnalysis?.pageType || 'unknown'}`);

            // Run the agent to perform the audit
            // Use agent().execute() API
            const agent = this.stagehand!.agent();

            await agent.execute({
                instruction: `${systemPrompt}

Now systematically test the page for WCAG compliance:
1. First, check keyboard navigation - tab through all elements
2. Check focus visibility on each element
3. Examine color contrast of text elements
4. Test form controls and their labels
5. Verify heading structure
6. Check for skip links and landmarks

For each issue found, document it clearly with the criterion ID.`,
                maxSteps: this.options.maxSteps,
            });

            // Extract structured findings from the agent's analysis
            const extractedFindings = await this.stagehand!.extract(
                `Based on the accessibility audit you just performed, list all the findings. For each finding include:
- criterionId: The WCAG criterion ID (e.g., "2.4.7")
- status: "pass", "fail", or "manual-review"
- element: Description of the affected element
- selector: CSS selector if known
- description: What was found
- impact: "critical", "serious", "moderate", or "minor" for failures
- evidence: Any supporting details

Include both passing and failing criteria that were tested.`,
                AuditFindingsSchema
            );

            if (extractedFindings?.findings) {
                allFindings.push(...extractedFindings.findings);
            }
        } catch (error) {
            logger.error(`Audit agent error: ${error instanceof Error ? error.message : String(error)}`);
            // Continue with any findings we have
        }

        return allFindings;
    }

    /**
     * Extract a summary from the findings
     */
    private async extractSummary(
        findings: z.infer<typeof AuditFindingSchema>[]
    ): Promise<z.infer<typeof AuditSummarySchema>> {
        try {
            const summary = await this.stagehand!.extract(
                getFinalSummaryInstruction(),
                AuditSummarySchema
            );

            if (summary) {
                return summary;
            }
        } catch (error) {
            logger.debug(`Failed to extract summary: ${error}`);
        }

        // Calculate from findings if extraction fails
        const failures = findings.filter(f => f.status === 'fail');
        return {
            totalIssues: failures.length,
            critical: failures.filter(f => f.impact === 'critical').length,
            serious: failures.filter(f => f.impact === 'serious').length,
            moderate: failures.filter(f => f.impact === 'moderate').length,
            minor: failures.filter(f => f.impact === 'minor').length,
            score: Math.max(0, 100 - (failures.length * 5)),
            topRecommendations: ['Review failed criteria', 'Fix critical issues first'],
            summary: `Audit completed with ${failures.length} issues found.`,
        };
    }

    /**
     * Convert extracted finding to AuditFinding type
     */
    private convertFinding(finding: z.infer<typeof AuditFindingSchema>): AuditFinding {
        const criterion = getCriterionById(finding.criterionId);

        const wcagInfo: WcagCriterionInfo = criterion
            ? {
                id: criterion.id,
                title: criterion.title,
                level: criterion.level,
                principle: criterion.principle,
                w3cUrl: criterion.w3cUrl,
            }
            : {
                id: finding.criterionId,
                title: 'Unknown Criterion',
                level: 'A' as WcagLevel,
                principle: 'Robust',
                w3cUrl: `https://www.w3.org/WAI/WCAG22/Understanding/`,
            };

        return {
            criterion: wcagInfo,
            status: finding.status as AuditStatus,
            element: finding.element,
            selector: finding.selector,
            description: finding.description,
            impact: finding.impact as ImpactLevel | undefined,
            evidence: finding.evidence,
        };
    }

    async close(): Promise<void> {
        if (this.stagehand) {
            await this.stagehand.close();
            this.stagehand = null;
        }
        logger.debug('Stagehand WCAG audit agent closed');
    }
}
