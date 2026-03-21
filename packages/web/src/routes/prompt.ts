import type { Context } from 'hono';
import { generatePrompt } from '@aria51/core';

export const promptHandler = async (c: Context) => {
    const body = await c.req.json();
    const { results, template = 'fix-all' } = body as { results: any; template?: string };

    try {
        const prompt = generatePrompt(results, template);
        return c.json({ prompt });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
};
