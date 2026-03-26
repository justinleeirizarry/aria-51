/**
 * Session Store
 *
 * In-memory + optional file-backed persistence for audit sessions.
 * Follows the Effect Context.Tag pattern from @aria51/core.
 */
import { Context, Effect, Data } from 'effect';
import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import type { AuditSession, AuditSnapshot } from '../types.js';
import type { ScanResults } from '@aria51/core';
import { AuditSessionSchema } from './schema.js';
import { SessionNotFoundError, SessionSerializationError } from '../errors.js';

// =============================================================================
// Service Interface
// =============================================================================

export interface ISessionStore {
    /** Get a session by ID */
    readonly get: (sessionId: string) => Effect.Effect<AuditSession, SessionNotFoundError>;
    /** Save/update a session */
    readonly save: (session: AuditSession) => Effect.Effect<void, SessionSerializationError>;
    /** List all session IDs */
    readonly list: () => Effect.Effect<string[]>;
    /** Delete a session */
    readonly remove: (sessionId: string) => Effect.Effect<void>;
    /** Save a snapshot for diff tracking */
    readonly saveSnapshot: (snapshot: AuditSnapshot) => Effect.Effect<void, SessionSerializationError>;
    /** Get snapshots for a session */
    readonly getSnapshots: (sessionId: string) => Effect.Effect<AuditSnapshot[]>;
}

// =============================================================================
// Effect Service Tag
// =============================================================================

export class SessionStore extends Context.Tag('SessionStore')<
    SessionStore,
    ISessionStore
>() {}

// =============================================================================
// In-Memory Implementation
// =============================================================================

export const createMemorySessionStore = (): ISessionStore => {
    const sessions = new Map<string, AuditSession>();
    const snapshots = new Map<string, AuditSnapshot[]>();

    return {
        get: (sessionId) =>
            Effect.sync(() => sessions.get(sessionId)).pipe(
                Effect.flatMap((session) =>
                    session
                        ? Effect.succeed(session)
                        : Effect.fail(new SessionNotFoundError({ sessionId }))
                )
            ),

        save: (session) =>
            Effect.sync(() => {
                sessions.set(session.id, { ...session, updatedAt: new Date().toISOString() });
            }),

        list: () => Effect.sync(() => [...sessions.keys()]),

        remove: (sessionId) =>
            Effect.sync(() => {
                sessions.delete(sessionId);
                snapshots.delete(sessionId);
            }),

        saveSnapshot: (snapshot) =>
            Effect.sync(() => {
                const existing = snapshots.get(snapshot.sessionId) || [];
                existing.push(snapshot);
                snapshots.set(snapshot.sessionId, existing);
            }),

        getSnapshots: (sessionId) =>
            Effect.sync(() => snapshots.get(sessionId) || []),
    };
};

// =============================================================================
// File-Backed Implementation
// =============================================================================

export const createFileSessionStore = (baseDir: string): ISessionStore => {
    const memStore = createMemorySessionStore();

    const sessionPath = (id: string) => join(baseDir, `${id}.json`);
    const snapshotsDir = (id: string) => join(baseDir, 'snapshots', id);

    const ensureDir = (dir: string) =>
        Effect.tryPromise({
            try: () => mkdir(dir, { recursive: true }),
            catch: (err) => new SessionSerializationError({
                reason: `Failed to create directory ${dir}: ${err}`,
            }),
        });

    return {
        get: (sessionId) =>
            memStore.get(sessionId).pipe(
                Effect.catchAll(() =>
                    Effect.tryPromise({
                        try: async () => {
                            const data = await readFile(sessionPath(sessionId), 'utf-8');
                            const parsed = AuditSessionSchema.safeParse(JSON.parse(data));
                            if (!parsed.success) {
                                throw new Error('Invalid session data');
                            }
                            // Reconstruct the session (scanResults stored separately)
                            const session: AuditSession = {
                                ...parsed.data,
                                scanResults: {},
                                // These fields come from types.ts, not from the Zod schema
                            } as AuditSession;
                            // Load scan results from individual files
                            for (const url of parsed.data.scanResultKeys) {
                                const safeKey = encodeURIComponent(url);
                                try {
                                    const resultData = await readFile(
                                        join(baseDir, sessionId, `${safeKey}.json`),
                                        'utf-8'
                                    );
                                    session.scanResults[url] = JSON.parse(resultData);
                                } catch {
                                    // Skip missing results
                                }
                            }
                            return session;
                        },
                        catch: () => new SessionNotFoundError({ sessionId }),
                    })
                )
            ),

        save: (session) =>
            Effect.gen(function* () {
                yield* ensureDir(baseDir);
                yield* ensureDir(join(baseDir, session.id));

                // Save scan results individually
                for (const [url, results] of Object.entries(session.scanResults)) {
                    const safeKey = encodeURIComponent(url);
                    yield* Effect.tryPromise({
                        try: () =>
                            writeFile(
                                join(baseDir, session.id, `${safeKey}.json`),
                                JSON.stringify(results, null, 2)
                            ),
                        catch: (err) =>
                            new SessionSerializationError({
                                reason: `Failed to write scan results for ${url}: ${err}`,
                            }),
                    });
                }

                // Save session metadata (without scan results, just keys)
                const serializable = {
                    ...session,
                    scanResultKeys: Object.keys(session.scanResults),
                    scanResults: undefined,
                };
                yield* Effect.tryPromise({
                    try: () =>
                        writeFile(
                            sessionPath(session.id),
                            JSON.stringify(serializable, null, 2)
                        ),
                    catch: (err) =>
                        new SessionSerializationError({
                            reason: `Failed to write session ${session.id}: ${err}`,
                        }),
                });

                // Also cache in memory
                yield* memStore.save(session);
            }),

        list: () =>
            Effect.tryPromise({
                try: async () => {
                    const files = await readdir(baseDir).catch(() => []);
                    return files
                        .filter((f) => f.endsWith('.json'))
                        .map((f) => f.replace('.json', ''));
                },
                catch: () => new SessionSerializationError({ reason: 'Failed to list sessions' }),
            }).pipe(Effect.catchAll(() => Effect.succeed([] as string[]))),

        remove: (sessionId) => memStore.remove(sessionId),

        saveSnapshot: (snapshot) =>
            Effect.gen(function* () {
                yield* ensureDir(snapshotsDir(snapshot.sessionId));
                yield* Effect.tryPromise({
                    try: () =>
                        writeFile(
                            join(snapshotsDir(snapshot.sessionId), `${snapshot.timestamp}.json`),
                            JSON.stringify(snapshot, null, 2)
                        ),
                    catch: (err) =>
                        new SessionSerializationError({
                            reason: `Failed to write snapshot: ${err}`,
                        }),
                });
                yield* memStore.saveSnapshot(snapshot);
            }),

        getSnapshots: (sessionId) => memStore.getSnapshots(sessionId),
    };
};
