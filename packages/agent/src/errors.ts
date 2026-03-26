/**
 * Agent Harness Errors
 *
 * Effect-compatible TaggedError definitions following @aria51/core conventions.
 */
import { Data } from 'effect';

export class AgentMaxStepsError extends Data.TaggedError('AgentMaxStepsError')<{
    readonly steps: number;
}> {}

export class AgentToolExecutionError extends Data.TaggedError('AgentToolExecutionError')<{
    readonly tool: string;
    readonly reason: string;
}> {}

export class AgentApiError extends Data.TaggedError('AgentApiError')<{
    readonly reason: string;
    readonly statusCode?: number;
}> {}

export class CrawlPlanError extends Data.TaggedError('CrawlPlanError')<{
    readonly url: string;
    readonly reason: string;
}> {}

export class SessionNotFoundError extends Data.TaggedError('SessionNotFoundError')<{
    readonly sessionId: string;
}> {}

export class SessionSerializationError extends Data.TaggedError('SessionSerializationError')<{
    readonly reason: string;
}> {}

export class VerificationError extends Data.TaggedError('VerificationError')<{
    readonly reason: string;
}> {}

/** Union of all agent errors */
export type AgentErrors =
    | AgentMaxStepsError
    | AgentToolExecutionError
    | AgentApiError
    | CrawlPlanError
    | SessionNotFoundError
    | SessionSerializationError
    | VerificationError;
