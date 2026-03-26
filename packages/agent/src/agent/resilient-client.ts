/**
 * Resilient Client
 *
 * Wraps the Anthropic SDK with:
 * - Automatic model fallback (Opus → Sonnet → Haiku)
 * - Retry with exponential backoff for rate limits and transient errors
 * - Overload detection (529) with longer backoff
 * - Event emission for observability
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AgentEvent } from '../types.js';

// =============================================================================
// Fallback Chain
// =============================================================================

const MODEL_FALLBACK_CHAIN: Record<string, string[]> = {
    'claude-opus-4-6': ['claude-sonnet-4-6', 'claude-haiku-4-5'],
    'claude-sonnet-4-6': ['claude-haiku-4-5'],
    'claude-haiku-4-5': [],
    // Legacy models
    'claude-opus-4-5': ['claude-sonnet-4-5', 'claude-haiku-4-5'],
    'claude-sonnet-4-5': ['claude-haiku-4-5'],
};

export interface ResilientClientOptions {
    /** Enable automatic model fallback on 529/rate limit (default: true) */
    enableFallback?: boolean;
    /** Maximum retry attempts per model before falling back (default: 2) */
    maxRetries?: number;
    /** Base delay for exponential backoff in ms (default: 1000) */
    baseDelayMs?: number;
    /** Event emitter for observability */
    onEvent?: (event: AgentEvent) => void;
}

const DEFAULT_OPTIONS: Required<Omit<ResilientClientOptions, 'onEvent'>> = {
    enableFallback: true,
    maxRetries: 2,
    baseDelayMs: 1000,
};

// =============================================================================
// Resilient toolRunner
// =============================================================================

/**
 * Run toolRunner with automatic retry and model fallback.
 *
 * On 429 (rate limit) or 529 (overloaded): retry with exponential backoff,
 * then fall back to the next model in the chain.
 *
 * On 500 (server error): retry once, then fall back.
 *
 * On 400/401/403/404: fail immediately (not retryable).
 */
export async function resilientToolRunner(
    params: Parameters<Anthropic['beta']['messages']['toolRunner']>[0],
    options?: ResilientClientOptions
): Promise<Anthropic.Beta.BetaMessage> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const emit = opts.onEvent || (() => {});
    const enableFallback = opts.enableFallback;

    const models = [params.model];
    if (enableFallback) {
        const fallbacks = MODEL_FALLBACK_CHAIN[params.model] || [];
        models.push(...fallbacks);
    }

    let lastError: unknown;

    for (const model of models) {
        if (model !== params.model) {
            emit({
                type: 'thinking',
                message: `Falling back to model: ${model}`,
            });
        }

        for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
            try {
                const client = new Anthropic();
                return await client.beta.messages.toolRunner({
                    ...params,
                    model,
                    // Haiku doesn't support adaptive thinking — downgrade
                    thinking: supportsAdaptiveThinking(model)
                        ? params.thinking
                        : undefined,
                });
            } catch (error) {
                lastError = error;

                if (!isRetryable(error)) {
                    // 400, 401, 403, 404 — fail immediately
                    throw error;
                }

                const status = getStatusCode(error);
                const isLastAttempt = attempt === opts.maxRetries;

                if (isLastAttempt) {
                    // Exhausted retries for this model — try next
                    emit({
                        type: 'thinking',
                        message: `Model ${model} failed after ${attempt + 1} attempts (HTTP ${status}). ${models.indexOf(model) < models.length - 1 ? 'Trying next model...' : 'No more fallbacks.'}`,
                    });
                    break;
                }

                // Exponential backoff: 1s, 2s, 4s... (longer for 529)
                const backoff = status === 529
                    ? opts.baseDelayMs * Math.pow(3, attempt) // 1s, 3s, 9s for overload
                    : opts.baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s for rate limit

                emit({
                    type: 'thinking',
                    message: `HTTP ${status} from ${model}, retrying in ${Math.round(backoff / 1000)}s (attempt ${attempt + 1}/${opts.maxRetries + 1})...`,
                });

                await sleep(backoff);
            }
        }
    }

    // All models exhausted
    throw lastError;
}

// =============================================================================
// Helpers
// =============================================================================

function isRetryable(error: unknown): boolean {
    const status = getStatusCode(error);
    if (!status) return false;
    // 429 rate limit, 500 server error, 529 overloaded
    return status === 429 || status === 500 || status === 529;
}

function getStatusCode(error: unknown): number | undefined {
    if (error instanceof Anthropic.APIError) {
        return error.status;
    }
    return undefined;
}

function supportsAdaptiveThinking(model: string): boolean {
    // Adaptive thinking is supported on Opus 4.6 and Sonnet 4.6
    return model.includes('opus-4-6') || model.includes('sonnet-4-6');
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
