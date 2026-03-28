/**
 * Test Generation Mode Handler
 */
import { Effect } from 'effect';
import { EXIT_CODES, setExitCode } from '@aria51/core';
import { createTestGenerationService } from '@aria51/ai-auditor';

export interface TestGenOptions {
    url: string;
    outputFile: string;
    model?: string;
    verbose: boolean;
}

export async function runTestGenMode(opts: TestGenOptions): Promise<void> {
    const service = createTestGenerationService();
    try {
        await Effect.runPromise(service.init({ model: opts.model, verbose: opts.verbose }));
        await Effect.runPromise(service.navigateTo(opts.url));
        const elements = await Effect.runPromise(service.discoverElements());
        const testContent = await Effect.runPromise(service.generateTest(opts.url, elements));

        const fs = await import('fs/promises');
        const path = await import('path');
        const dir = path.dirname(opts.outputFile);
        if (dir !== '.') {
            await fs.mkdir(dir, { recursive: true }).catch(() => {});
        }
        await fs.writeFile(opts.outputFile, testContent);

        console.log(JSON.stringify({
            url: opts.url,
            timestamp: new Date().toISOString(),
            outputFile: opts.outputFile,
            elementsDiscovered: elements.length,
            elements,
            success: true,
        }, null, 2));
        setExitCode(EXIT_CODES.SUCCESS);
    } catch (error) {
        console.log(JSON.stringify({
            url: opts.url,
            timestamp: new Date().toISOString(),
            outputFile: opts.outputFile,
            elementsDiscovered: 0,
            elements: [],
            success: false,
            error: error instanceof Error ? error.message : String(error),
        }, null, 2));
        setExitCode(EXIT_CODES.RUNTIME_ERROR);
    } finally {
        await Effect.runPromise(service.close());
    }
}
