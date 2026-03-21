/**
 * Supplemental test results from AI-powered services (Stagehand)
 *
 * These results supplement the main axe-core + wcag22 scan with
 * keyboard testing, tree analysis, and screen reader navigation findings.
 */
import { Schema } from 'effect';
import type { Mutable } from './primitives.js';

export const SupplementalIssue = Schema.Struct({
    message: Schema.String,
    selector: Schema.optional(Schema.String),
    severity: Schema.Literal('critical', 'serious', 'moderate', 'minor'),
    evidence: Schema.optional(Schema.String),
});
export type SupplementalIssue = Mutable<typeof SupplementalIssue.Type>;

export const SupplementalTestResult = Schema.Struct({
    criterionId: Schema.String,
    status: Schema.Literal('pass', 'fail', 'manual-review'),
    source: Schema.String,
    issues: Schema.Array(SupplementalIssue),
});
export type SupplementalTestResult = Mutable<typeof SupplementalTestResult.Type>;
