import type { Context } from 'hono';
import type { TypedResponse } from 'hono/types';
import { WCAG_CRITERIA, AXE_WCAG_MAP } from '@aria51/core';

export const wcagCriteriaHandler = (c: Context): TypedResponse => {
    return c.json({ criteria: WCAG_CRITERIA, axeMap: AXE_WCAG_MAP });
};
