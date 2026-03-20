/**
 * WCAG 2.2 discriminated violation schemas
 *
 * Replaces the untyped `details: Record<string, any>` with typed details
 * per violation subtype using discriminated unions on the `id` field.
 */
import { Schema } from 'effect';
import { ImpactLevel, type Mutable } from './primitives.js';
import { WcagLevel } from './primitives.js';

// WCAG 2.2 violation IDs
export const WCAG22ViolationId = Schema.Literal(
    'target-size',
    'focus-obscured',
    'focus-appearance',
    'dragging-movement',
    'accessible-authentication',
    'status-messages',
    'error-identification',
    'error-suggestion',
    'meaningful-sequence',
    'reflow',
    'hover-focus-content',
);
export type WCAG22ViolationId = typeof WCAG22ViolationId.Type;

// WCAG 2.2 exception types
export const WCAG22ExceptionType = Schema.Literal(
    'inline',
    'spacing',
    'equivalent',
    'user-agent',
    'essential',
);
export type WCAG22ExceptionType = typeof WCAG22ExceptionType.Type;

// Dimension struct reused across violations
const Dimensions = Schema.Struct({
    width: Schema.Number,
    height: Schema.Number,
});

// Rect struct for element positioning
const Rect = Schema.Struct({
    top: Schema.Number,
    left: Schema.Number,
    bottom: Schema.Number,
    right: Schema.Number,
    width: Schema.Number,
    height: Schema.Number,
});

// Base fields shared by all WCAG 2.2 violation summaries
const WCAG22ViolationBase = {
    criterion: Schema.String,
    level: WcagLevel,
    element: Schema.String,
    selector: Schema.String,
    html: Schema.String,
    impact: ImpactLevel,
    description: Schema.String,
    exception: Schema.optional(WCAG22ExceptionType),
};

// Target Size (2.5.8) - typed details
export const TargetSizeDetails = Schema.Struct({
    actualSize: Dimensions,
    requiredSize: Dimensions,
    shortfall: Dimensions,
});

export const TargetSizeViolation = Schema.Struct({
    id: Schema.Literal('target-size'),
    ...WCAG22ViolationBase,
    details: TargetSizeDetails,
});
export type TargetSizeViolation = Mutable<typeof TargetSizeViolation.Type>;

// Focus Not Obscured (2.4.11) - typed details
export const FocusObscuredDetails = Schema.Struct({
    focusedElementRect: Rect,
    obscuringElement: Schema.String,
    obscuringType: Schema.Literal(
        'sticky-header', 'sticky-footer', 'fixed', 'modal', 'overlay', 'cookie-banner',
    ),
    obscuringRect: Rect,
    percentageObscured: Schema.Number,
});

export const FocusObscuredViolation = Schema.Struct({
    id: Schema.Literal('focus-obscured'),
    ...WCAG22ViolationBase,
    details: FocusObscuredDetails,
});
export type FocusObscuredViolation = Mutable<typeof FocusObscuredViolation.Type>;

// Focus Appearance (2.4.13) - typed details
export const FocusAppearanceDetails = Schema.Struct({
    indicatorType: Schema.Literal('outline', 'border', 'box-shadow', 'background', 'none'),
    indicatorThickness: Schema.Number,
    indicatorArea: Schema.Number,
    meetsMinimumArea: Schema.Boolean,
    contrastWithAdjacent: Schema.Number,
    contrastWithUnfocused: Schema.Number,
    meetsContrastRequirement: Schema.Boolean,
});

export const FocusAppearanceViolation = Schema.Struct({
    id: Schema.Literal('focus-appearance'),
    ...WCAG22ViolationBase,
    details: FocusAppearanceDetails,
});
export type FocusAppearanceViolation = Mutable<typeof FocusAppearanceViolation.Type>;

// Dragging Movements (2.5.7) - typed details
export const DraggingDetails = Schema.Struct({
    dragType: Schema.Literal('native', 'react-beautiful-dnd', 'dnd-kit', 'sortablejs', 'custom'),
    hasAlternative: Schema.Boolean,
    suggestedAlternatives: Schema.Array(Schema.String),
});

export const DraggingViolation = Schema.Struct({
    id: Schema.Literal('dragging-movement'),
    ...WCAG22ViolationBase,
    details: DraggingDetails,
});
export type DraggingViolation = Mutable<typeof DraggingViolation.Type>;

// Accessible Authentication (3.3.8) - typed details
export const AccessibleAuthDetails = Schema.Struct({
    authType: Schema.Literal('captcha-image', 'captcha-puzzle', 'cognitive-test', 'memory-test'),
    hasAlternative: Schema.Boolean,
    allowsCopyPaste: Schema.Boolean,
    supportsPasswordManager: Schema.Boolean,
});

export const AccessibleAuthViolation = Schema.Struct({
    id: Schema.Literal('accessible-authentication'),
    ...WCAG22ViolationBase,
    details: AccessibleAuthDetails,
});
export type AccessibleAuthViolation = Mutable<typeof AccessibleAuthViolation.Type>;

// Generic WCAG 2.2 violation summary (for backward compat with untyped details)
export const WCAG22ViolationSummary = Schema.Struct({
    id: Schema.String,
    ...WCAG22ViolationBase,
    details: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});
export type WCAG22ViolationSummary = Mutable<typeof WCAG22ViolationSummary.Type>;

// WCAG 2.2 combined results
export const WCAG22Results = Schema.Struct({
    targetSize: Schema.Array(WCAG22ViolationSummary),
    focusObscured: Schema.Array(WCAG22ViolationSummary),
    focusAppearance: Schema.Array(WCAG22ViolationSummary),
    dragging: Schema.Array(WCAG22ViolationSummary),
    authentication: Schema.Array(WCAG22ViolationSummary),
    statusMessages: Schema.Array(WCAG22ViolationSummary),
    errorIdentification: Schema.Array(WCAG22ViolationSummary),
    errorSuggestion: Schema.Array(WCAG22ViolationSummary),
    meaningfulSequence: Schema.Array(WCAG22ViolationSummary),
    reflow: Schema.Array(WCAG22ViolationSummary),
    hoverFocusContent: Schema.Array(WCAG22ViolationSummary),
    summary: Schema.Struct({
        totalViolations: Schema.Number,
        byLevel: Schema.Struct({
            A: Schema.Number,
            AA: Schema.Number,
            AAA: Schema.Number,
        }),
        byCriterion: Schema.Record({ key: Schema.String, value: Schema.Number }),
    }),
});
export type WCAG22Results = Mutable<typeof WCAG22Results.Type>;
