# Effect Service Architecture Reference

This document describes the Effect service system as currently implemented across the monorepo. All services use the [Effect](https://effect.website) library for dependency injection, typed errors, and resource management.

---

## Service Overview

| Service | Package | Pattern | Layer |
|---------|---------|---------|-------|
| **BrowserService** | `core` | `Layer.scoped` + `Effect.addFinalizer` | `BrowserServiceLive` (scoped), `BrowserServiceManual` (non-scoped) |
| **ScannerService** | `core` | `Layer.succeed` | `ScannerServiceLive` |
| **ResultsProcessorService** | `core` | `Layer.succeed` | `ResultsProcessorServiceLive` |
| **TestGenerationService** | `ai-auditor` | Class with Effect methods | (not yet layered) |
| **KeyboardTestService** | `ai-auditor` | Class with Effect methods | (not yet layered) |
| **TreeAnalysisService** | `ai-auditor` | Class with Effect methods | (not yet layered) |
| **WcagAuditService** | `ai-auditor` | Class with Effect methods | (not yet layered) |
| **Orchestration** | `core` | Pure `Effect.gen` functions | N/A (consumes services) |

---

## Infrastructure

### Effect Tags (`packages/core/src/services/effect/tags.ts`)

Service interfaces are defined as `Context.Tag` subclasses for type-safe dependency injection.

```typescript
// Tags use the class-based Context.Tag pattern (not Context.GenericTag)
export class BrowserService extends Context.Tag('BrowserService')<
    BrowserService,
    EffectBrowserService
>() {}

export class ScannerService extends Context.Tag('ScannerService')<
    ScannerService,
    EffectScannerService
>() {}

export class ResultsProcessorService extends Context.Tag('ResultsProcessorService')<
    ResultsProcessorService,
    EffectResultsProcessorService
>() {}
```

The tag file also exports a convenience type alias:

```typescript
export type ScanWorkflowServices = BrowserService | ScannerService | ResultsProcessorService;
```

### Layers (`packages/core/src/services/effect/layers.ts`)

Layers provide the actual implementations of the service interfaces.

```typescript
// Scoped: browser auto-closes when scope ends
export const BrowserServiceLive = Layer.scoped(
    BrowserService,
    Effect.gen(function* () {
        const instance = createBrowserService();
        yield* Effect.addFinalizer(() =>
            Effect.catchAll(instance.close(), () => Effect.void)
        );
        return instance as EffectBrowserService;
    })
);

// Simple pass-through layers (no resources to manage)
export const ScannerServiceLive = Layer.succeed(
    ScannerService,
    createScannerService() as EffectScannerService
);

export const ResultsProcessorServiceLive = Layer.succeed(
    ResultsProcessorService,
    createResultsProcessorService() as EffectResultsProcessorService
);

// Non-scoped: caller manages browser lifecycle manually
export const BrowserServiceManual = Layer.succeed(
    BrowserService,
    createBrowserService() as EffectBrowserService
);
```

### App Layers (`packages/core/src/services/effect/app-layer.ts`)

Pre-composed layers for common use cases.

```typescript
// Standard scan workflow — browser auto-closes when Effect scope ends
export const AppLayer = Layer.mergeAll(
    BrowserServiceLive,
    ScannerServiceLive,
    ResultsProcessorServiceLive
);

// Manual lifecycle — caller controls when browser opens/closes
export const AppLayerManual = Layer.mergeAll(
    BrowserServiceManual,
    ScannerServiceLive,
    ResultsProcessorServiceLive
);

// For unit tests — mock the browser, get scanner + processor for free
export const CoreServicesLayer = Layer.mergeAll(
    ScannerServiceLive,
    ResultsProcessorServiceLive
);
```

### Browser Resource (`packages/core/src/services/effect/browser-resource.ts`)

Low-level `acquireRelease` resource management for the browser, plus standalone page helper functions.

```typescript
// Scoped browser resource — auto-closes on scope end
export const makeBrowserResource = (
    config: BrowserServiceConfig
): Effect.Effect<BrowserResource, BrowserLaunchError, Scope.Scope> =>
    Effect.acquireRelease(
        Effect.tryPromise({
            try: () => launchBrowser(config),
            catch: (error) => new BrowserLaunchError({ ... }),
        }),
        (resource) => Effect.promise(() => closeBrowser(resource))
    );

// Standalone helper functions (don't require BrowserService tag)
export const navigateTo = (page, url, options?) => ...
export const waitForPageStability = (page, options?) => ...
export const detectReact = (page) => ...

// High-level convenience: run an effect with a browser
export const withBrowser = <A, E, R>(
    config: BrowserServiceConfig,
    use: (resource: BrowserResource) => Effect.Effect<A, E, R>
): Effect.Effect<A, E | BrowserLaunchError, R> =>
    Effect.scoped(makeBrowserResource(config).pipe(Effect.flatMap(use)));
```

### Retry Utilities (`packages/core/src/utils/effect-retry.ts`)

```typescript
export const createRetrySchedule = (config: EffectRetryConfig) => {
    const baseDelay = Duration.millis(config.delayMs);
    const delaySchedule = config.backoff === 'exponential'
        ? Schedule.exponential(baseDelay, 2)
        : Schedule.linear(baseDelay);
    return pipe(Schedule.recurs(config.maxRetries), Schedule.intersect(delaySchedule));
};
```

### Configuration

Configuration uses a plain functional API (`getConfig()`, `updateConfig()`), **not** an Effect service. Services call `getConfig()` directly when they need config values.

---

## Core Services (`packages/core/`)

### 1. BrowserService

**File**: `packages/core/src/services/browser/BrowserService.ts`

Manages browser lifecycle and page operations. All methods return `Effect.Effect`.

**Interface** (from `tags.ts`):

```typescript
export interface EffectBrowserService {
    readonly launch: (config: BrowserServiceConfig) =>
        Effect.Effect<void, BrowserLaunchError | BrowserAlreadyLaunchedError>;
    readonly getPage: () => Effect.Effect<Page, BrowserNotLaunchedError>;
    readonly getBrowser: () => Effect.Effect<Browser, BrowserNotLaunchedError>;
    readonly isLaunched: () => Effect.Effect<boolean>;
    readonly navigate: (url: string, options?: NavigateOptions) =>
        Effect.Effect<void, BrowserNotLaunchedError | NavigationError>;
    readonly waitForStability: () => Effect.Effect<StabilityCheckResult, BrowserNotLaunchedError>;
    readonly detectReact: () => Effect.Effect<boolean, BrowserNotLaunchedError>;
    readonly close: () => Effect.Effect<void>;
}
```

**Implementation**: A class (`BrowserService`) with mutable state (`browser`, `page`, `config`). Uses `Effect.gen(this, ...)` for generator syntax with `this` binding. The class implements `IBrowserService`.

**Layer**: `BrowserServiceLive` uses `Layer.scoped` with `Effect.addFinalizer` to auto-close the browser when the Effect scope ends. `BrowserServiceManual` uses `Layer.succeed` for manual lifecycle control.

### 2. ScannerService

**File**: `packages/core/src/services/scanner/ScannerService.ts`

Handles injecting the scanner bundle (`scanner-bundle.js`) into pages and executing scans.

**Interface** (from `tags.ts`):

```typescript
export interface EffectScannerService {
    readonly isBundleInjected: (page: Page) => Effect.Effect<boolean>;
    readonly injectBundle: (page: Page) => Effect.Effect<void, ScannerInjectionError>;
    readonly scan: (page: Page, options?: ScanExecutionOptions) =>
        Effect.Effect<BrowserScanData, ScannerInjectionError | ScanDataError>;
}
```

**Implementation**: A class (`ScannerService`) that stores the bundle path. Uses `Effect.tryPromise` for Playwright interactions. Navigation is temporarily blocked during scan via `history.pushState`/`replaceState` overrides.

**Retry**: Retry logic is **not** in this service. It is handled at the orchestration layer using `Effect.retry(retrySchedule)`.

**Layer**: `ScannerServiceLive` uses `Layer.succeed` (no resources to manage).

### 3. ResultsProcessorService

**File**: `packages/core/src/services/processor/ResultsProcessorService.ts`

Handles all results transformation and formatting. All methods are synchronous data transformations wrapped in `Effect.sync`.

**Interface** (from `tags.ts`):

```typescript
export interface EffectResultsProcessorService {
    readonly process: (data: BrowserScanData, metadata: ScanMetadata) => Effect.Effect<ScanResults>;
    readonly formatAsJSON: (results: ScanResults, pretty?: boolean) => Effect.Effect<string>;
    readonly formatForMCP: (results: ScanResults, options?: MCPFormatOptions) => Effect.Effect<MCPToolContent[]>;
    readonly formatForCI: (results: ScanResults, threshold: number) => Effect.Effect<CIResult>;
}
```

**Implementation**: A class (`ResultsProcessorService`) with pure methods. All return `Effect.sync(...)`. Enriches violations with WCAG criterion data, handles circular references in JSON serialization, and checks CI thresholds.

**Layer**: `ResultsProcessorServiceLive` uses `Layer.succeed` (no resources, no effects needed).

---

## Orchestration (`packages/core/src/services/effect/orchestration.ts`)

Orchestration is **not** a class or service. It is a module of pure Effect functions that compose the core services.

### Functions

**`performScan(options)`** — Main scan workflow using `Effect.gen`:
1. Launches browser via `BrowserService`
2. Navigates to URL and waits for stability
3. Checks for React (fails only if `requireReact` is set)
4. Runs scan via `ScannerService` with `Effect.retry(retrySchedule)`
5. Optionally injects React plugin bundle and attributes violations
6. Processes results via `ResultsProcessorService`
7. Handles CI mode and file output

```typescript
export const performScan = (
    options: EffectScanOptions
): Effect.Effect<
    EffectScanResult,
    PerformScanError,
    BrowserService | ScannerService | ResultsProcessorService
> => Effect.gen(function* () { ... });
```

**`performScanWithCleanup(options)`** — Wraps `performScan` with `Effect.ensuring(browser.close())` for use with `AppLayerManual`.

```typescript
export const performScanWithCleanup = (options) =>
    Effect.gen(function* () {
        const browser = yield* BrowserService;
        return yield* pipe(
            performScan(options),
            Effect.ensuring(browser.close())
        );
    });
```

**`runScanAsPromise(options, layer)`** — Promise adapter for non-Effect callers (CLI, MCP). Runs `performScan` with `Effect.scoped`, converts `Exit` to Promise, and wraps typed Effect errors in `ScanError` for standard `error.message` access.

```typescript
export const runScanAsPromise = (
    options: EffectScanOptions,
    layer: Layer.Layer<BrowserService | ScannerService | ResultsProcessorService>
): Promise<EffectScanResult> => { ... };
```

### Usage Patterns

```typescript
// With scoped layer (auto-cleanup)
const result = yield* pipe(
    performScan(options),
    Effect.provide(AppLayer),
    Effect.scoped
);

// With manual layer (explicit cleanup)
const result = yield* pipe(
    performScanWithCleanup(options),
    Effect.provide(AppLayerManual)
);

// Promise bridge for non-Effect code
const result = await runScanAsPromise(options, AppLayer);
```

---

## AI Auditor Services (`packages/ai-auditor/`)

These services live in the `ai-auditor` package and wrap Stagehand/Browserbase functionality. They follow the same pattern: classes with Effect-returning methods, but they do **not** yet use Effect tags or layers for dependency injection.

### 4. TestGenerationService

**File**: `packages/ai-auditor/src/services/TestGenerationService.ts`

AI-driven test generation wrapping `StagehandScanner` and `TestGenerator`.

**Methods** (all return `Effect.Effect`):
- `init(config?)` — Initializes Stagehand scanner
- `isInitialized()` — Check if service is ready
- `getPage()` — Get Playwright page instance
- `navigateTo(url)` — Navigate via Stagehand
- `discoverElements()` — AI-driven element discovery
- `generateTest(url, elements)` — Pure test file generation (`Effect.sync`)
- `close()` — Clean up Stagehand resources

**Error types**: `TestGenInitError`, `TestGenNotInitializedError`, `TestGenNavigationError`, `TestGenDiscoveryError`

### 5. KeyboardTestService

**File**: `packages/ai-auditor/src/services/KeyboardTestService.ts`

Stagehand-based keyboard navigation testing wrapping `StagehandKeyboardTester`.

**Methods**: `init(config?)`, `isInitialized()`, `getPage()`, `test(url)`, `close()`

**Error types**: `KeyboardTestInitError`, `KeyboardTestError`, `KeyboardTestNotInitializedError`

### 6. TreeAnalysisService

**File**: `packages/ai-auditor/src/services/TreeAnalysisService.ts`

Stagehand-based accessibility tree analysis wrapping `StagehandTreeAnalyzer`.

**Methods**: `init(config?)`, `isInitialized()`, `getPage()`, `analyze(url)`, `close()`

**Error types**: `TreeAnalysisInitError`, `TreeAnalysisError`, `TreeAnalysisNotInitializedError`

### 7. WcagAuditService

**File**: `packages/ai-auditor/src/services/WcagAuditService.ts`

Stagehand-based WCAG compliance auditing wrapping `StagehandWcagAuditAgent`.

**Methods**: `init(options?)`, `isInitialized()`, `getPage()`, `audit(url)`, `close()`

**Error types**: `WcagAuditInitError`, `WcagAuditError`, `WcagAuditNotInitializedError`

---

## Error System

The codebase uses a dual error system: Effect `Data.TaggedError` types for typed error channels, plus a legacy `ScanError` class for the Promise boundary.

### Effect Errors (`packages/core/src/errors/effect-errors.ts`)

All Effect error classes use the `Effect` prefix naming convention and extend `Data.TaggedError`:

```typescript
export class BrowserLaunchError extends Data.TaggedError('BrowserLaunchError')<{
    readonly browserType: string;
    readonly reason?: string;
}> {}
```

**Browser errors** (`BrowserErrors` union):
| Class | Tag | Fields |
|-------|-----|--------|
| `BrowserLaunchError` | `BrowserLaunchError` | `browserType`, `reason?` |
| `BrowserNotLaunchedError` | `BrowserNotLaunchedError` | `operation` |
| `BrowserAlreadyLaunchedError` | `BrowserAlreadyLaunchedError` | (none) |
| `NavigationTimeoutError` | `NavigationTimeoutError` | `url`, `timeout` |
| `NavigationError` | `NavigationError` | `url`, `reason?` |
| `ContextDestroyedError` | `ContextDestroyedError` | `message?` |

**Scan errors** (`ScanErrors` union):
| Class | Tag | Fields |
|-------|-----|--------|
| `ReactNotDetectedError` | `ReactNotDetectedError` | `url` |
| `ScannerInjectionError` | `ScannerInjectionError` | `reason` |
| `MaxRetriesExceededError` | `MaxRetriesExceededError` | `attempts`, `lastError?` |
| `ScanDataError` | `ScanDataError` | `reason` |

**Validation errors** (`ValidationErrors` union):
| Class | Tag | Fields |
|-------|-----|--------|
| `ConfigurationError` | `ConfigurationError` | `message`, `invalidField?` |
| `InvalidUrlError` | `InvalidUrlError` | `url`, `reason?` |

**Infrastructure errors**:
| Class | Tag | Fields |
|-------|-----|--------|
| `FileSystemError` | `FileSystemError` | `operation`, `path`, `reason?` |
| `ServiceStateError` | `ServiceStateError` | `service`, `expectedState`, `actualState` |

**Workflow union**: `ScanWorkflowErrors = BrowserErrors | ScanErrors | ValidationErrors | ServiceStateError | FileSystemError`

**Orchestration union**: `PerformScanError = BrowserErrors | ScanErrors | ReactNotDetectedError | FileSystemError`

### AI Auditor Errors (`packages/ai-auditor/src/errors.ts`)

Same `Effect` prefix convention. Four error groups with union types:

- `TestGenErrors` — `TestGenNotInitializedError`, `TestGenInitError`, `TestGenNavigationError`, `TestGenDiscoveryError`
- `KeyboardTestErrors` — `KeyboardTestInitError`, `KeyboardTestError`, `KeyboardTestNotInitializedError`
- `TreeAnalysisErrors` — `TreeAnalysisInitError`, `TreeAnalysisError`, `TreeAnalysisNotInitializedError`
- `WcagAuditErrors` — `WcagAuditInitError`, `WcagAuditError`, `WcagAuditNotInitializedError`
- `StagehandErrors` — Union of all four groups

### ScanError Bridge (`packages/core/src/errors/scan-error.ts`)

`ScanError` is a standard `Error` subclass thrown by `runScanAsPromise` when the Effect workflow fails. It bridges typed Effect errors to standard `error.message` for non-Effect callers.

```typescript
export class ScanError extends Error {
    readonly tag: string;      // e.g. "NavigationError"
    readonly details: Record<string, unknown>;
}
```

`formatTaggedError()` converts any tagged error into a human-readable string, handling all error types with specific formatting per tag.

---

## Effect Patterns Quick Reference

| Pattern | Use When | Example in Codebase |
|---------|----------|---------------------|
| `Context.Tag` (class-based) | Defining service interfaces | `tags.ts` — `BrowserService`, `ScannerService`, `ResultsProcessorService` |
| `Layer.succeed` | Services with no resources or lifecycle | `ScannerServiceLive`, `ResultsProcessorServiceLive`, `BrowserServiceManual` |
| `Layer.scoped` + `Effect.addFinalizer` | Services with resources to clean up | `BrowserServiceLive` |
| `Effect.acquireRelease` | Low-level resource management | `makeBrowserResource` in `browser-resource.ts` |
| `Effect.gen` | Async sequencing and service composition | All service methods, `performScan` |
| `Effect.sync` | Wrapping synchronous code | `ResultsProcessorService` methods |
| `Effect.tryPromise` | Wrapping Promise-based APIs | Playwright calls in `BrowserService`, `ScannerService` |
| `Effect.retry` + `Schedule` | Retry with backoff | `performScan` retry of `scanner.scan()` |
| `Effect.ensuring` | Guaranteed cleanup for non-scoped resources | `performScanWithCleanup` |
| `Effect.catchAll` | Recovering from non-fatal errors | React attribution fallback in orchestration |
| `Data.TaggedError` | Typed errors in the error channel | All `Effect*Error` classes |
| `Effect.scoped` | Running a scoped effect to completion | `runScanAsPromise` |
| `Layer.mergeAll` | Composing multiple layers | `AppLayer`, `AppLayerManual`, `CoreServicesLayer` |
