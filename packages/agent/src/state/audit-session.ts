/**
 * Audit Session Lifecycle
 *
 * Creates and manages audit session state.
 */
import { randomUUID } from 'crypto';
import type { AgentConfig, AuditSession, AuditSnapshot } from '../types.js';

/**
 * Create a new audit session
 */
export const createAuditSession = (config: AgentConfig): AuditSession => ({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config,
    status: 'planning',
    crawlPlan: null,
    scannedUrls: [],
    pendingUrls: [],
    scanResults: {},
    previousSnapshots: [],
    findings: [],
    remediationPlan: null,
    stepCount: 0,
    toolCallCount: 0,
});

/**
 * Create a snapshot of the current session state for diffing
 */
export const createSnapshot = (session: AuditSession): AuditSnapshot => ({
    sessionId: session.id,
    timestamp: new Date().toISOString(),
    findings: [...session.findings],
    pagesScanned: session.scannedUrls.length,
});
