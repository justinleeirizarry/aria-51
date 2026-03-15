import type { Context } from 'hono';
import { runScanAsPromise, AppLayer } from '@accessibility-toolkit/core';
import { getComponentBundlePath } from '@accessibility-toolkit/react';

export const scanHandler = async (c: Context) => {
    const body = await c.req.json();
    const { url, components = true } = body as { url: string; components?: boolean };

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
