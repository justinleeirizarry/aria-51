import type { Context } from 'hono';
import { runScanAsPromise, AppLayer } from '@aria51/core';
import { getComponentBundlePath } from '@aria51/react';

export const scanHandler = async (c: Context) => {
    const body = await c.req.json();
    const { url, components = true, stagehand = false, stagehandModel } = body as { url: string; components?: boolean; stagehand?: boolean; stagehandModel?: string };

    if (!url) {
        return c.json({ error: 'URL is required' }, 400);
    }

    // SSE streaming response for progress updates
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };

            runScanAsPromise({
                url,
                browser: 'chromium',
                headless: true,
                includeKeyboardTests: true,
                componentBundlePath: components !== false ? getComponentBundlePath() : undefined,
                stagehand,
                stagehandModel,
                onProgress: (step) => {
                    send('progress', step);
                },
            }, AppLayer).then(({ results }) => {
                send('result', results);
                controller.close();
            }).catch((error: any) => {
                send('error', { error: error.message || 'Scan failed' });
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
};
