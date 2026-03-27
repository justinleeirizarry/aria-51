import type { Context } from 'hono';
import { runAgent } from '@aria51/agent';
import type { AgentEvent } from '@aria51/agent';

export const agentHandler = async (c: Context) => {
    const body = await c.req.json();
    const { url, wcagLevel = 'AA', maxPages = 10, specialists = false } = body as {
        url: string;
        wcagLevel?: 'A' | 'AA' | 'AAA';
        maxPages?: number;
        specialists?: boolean;
    };

    if (!url) {
        return c.json({ error: 'URL is required' }, 400);
    }

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const send = (event: string, data: unknown) => {
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
                } catch {
                    // Stream closed by client
                }
            };

            // Heartbeat every 10s to keep the connection alive during long scans
            const heartbeat = setInterval(() => {
                send('heartbeat', { ts: Date.now() });
            }, 10000);

            runAgent({
                targetUrl: url,
                wcagLevel,
                maxPages,
                specialists,
                headless: true,
                onEvent: (event: AgentEvent) => {
                    send(event.type, event);
                },
            }).then((report) => {
                clearInterval(heartbeat);
                send('complete', report);
                controller.close();
            }).catch((error: any) => {
                clearInterval(heartbeat);
                send('error', { error: error.message || 'Agent failed' });
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
