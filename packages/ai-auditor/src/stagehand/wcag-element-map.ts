/**
 * WCAG Element Type Mapping
 *
 * Maps element types to relevant axe-core rules and provides utilities
 * for prioritizing elements by WCAG conformance level.
 */

import { getWcagCriteriaForViolation, formatCriterionDisplay, type WcagCriterion } from '@aria51/core';
import type { ElementType } from '../types.js';

/**
 * Maps element types to axe-core rules that commonly apply to them.
 * These mappings help determine which WCAG criteria are relevant for testing
 * each type of interactive element.
 */
const ELEMENT_TYPE_TO_AXE_RULES: Record<ElementType, string[]> = {
    button: ['button-name', 'aria-command-name', 'focus-order-semantics'],
    link: ['link-name', 'link-in-text-block'],
    input: ['label', 'autocomplete-valid', 'aria-input-field-name'],
    checkbox: ['label', 'aria-toggle-field-name'],
    radio: ['label', 'aria-input-field-name'],
    select: ['select-name', 'label'],
    custom: ['aria-roles', 'aria-valid-attr', 'aria-required-attr'],
};

/**
 * Get WCAG criteria related to a specific element type.
 */
export function getRelatedCriteria(type: ElementType): WcagCriterion[] {
    const rules = ELEMENT_TYPE_TO_AXE_RULES[type] || [];
    const criteria = new Map<string, WcagCriterion>();

    for (const rule of rules) {
        const ruleCriteria = getWcagCriteriaForViolation(rule);
        for (const c of ruleCriteria) {
            criteria.set(c.id, c);
        }
    }

    return Array.from(criteria.values());
}

/**
 * Sort elements by WCAG conformance level priority.
 */
export function sortByWcagPriority<T extends { type: ElementType }>(elements: T[]): T[] {
    const levelPriority: Record<string, number> = { 'A': 1, 'AA': 2, 'AAA': 3 };

    return [...elements].sort((a, b) => {
        const aCriteria = getRelatedCriteria(a.type);
        const bCriteria = getRelatedCriteria(b.type);

        // Get minimum level (highest priority) for each element
        const aMinLevel = aCriteria.length > 0
            ? Math.min(...aCriteria.map(c => levelPriority[c.level] ?? 4))
            : 4; // Elements with no criteria go last
        const bMinLevel = bCriteria.length > 0
            ? Math.min(...bCriteria.map(c => levelPriority[c.level] ?? 4))
            : 4;

        return aMinLevel - bMinLevel;
    });
}

/**
 * Format WCAG criteria as a comment string for generated tests.
 */
export function formatCriteriaComment(criteria: WcagCriterion[]): string {
    if (criteria.length === 0) {
        return '';
    }
    const formatted = criteria
        .map(c => `${formatCriterionDisplay(c)} (${c.level})`)
        .join(', ');
    return `WCAG: ${formatted}`;
}
