/**
 * WCAG 2.2 Check Types
 *
 * Re-exports from schemas for backward compatibility.
 * The discriminated violation types with typed details are also available
 * directly from '@accessibility-toolkit/core' via Schemas namespace.
 */
import type { ImpactLevel, WcagLevel } from '../../types.js';
import type { WCAG22ExceptionType as SchemaExceptionType } from '../../schemas/wcag22-violations.js';

// Re-export discriminated violation ID and exception types from schemas
export type { WCAG22ViolationId } from '../../schemas/wcag22-violations.js';
export type { WCAG22ExceptionType } from '../../schemas/wcag22-violations.js';

// Re-export typed violation subtypes from schemas
export type { TargetSizeViolation } from '../../schemas/wcag22-violations.js';
export type { FocusObscuredViolation } from '../../schemas/wcag22-violations.js';
export type { FocusAppearanceViolation } from '../../schemas/wcag22-violations.js';
export type { DraggingViolation } from '../../schemas/wcag22-violations.js';
export type { AccessibleAuthViolation } from '../../schemas/wcag22-violations.js';

// Base violation interface (used internally by wcag22 checkers)
export interface WCAG22Violation {
    id: string;
    criterion: string;
    level: WcagLevel;
    element: string;
    selector: string;
    html: string;
    impact: ImpactLevel;
    description: string;
    details: Record<string, any>;
    exception?: SchemaExceptionType;
}

// Target size result (not a violation, used by target-size checker)
export interface TargetSizeResult {
    element: string;
    selector: string;
    html: string;
    size: { width: number; height: number };
    meetsRequirement: boolean;
    exception?: SchemaExceptionType;
    spacing?: { top: number; right: number; bottom: number; left: number };
}

// Combined results (used internally)
export interface WCAG22CheckResults {
    targetSize: WCAG22Violation[];
    focusObscured: WCAG22Violation[];
    focusAppearance: WCAG22Violation[];
    dragging: WCAG22Violation[];
    authentication: WCAG22Violation[];
    statusMessages: WCAG22Violation[];
    errorIdentification: WCAG22Violation[];
    errorSuggestion: WCAG22Violation[];
    meaningfulSequence: WCAG22Violation[];
    reflow: WCAG22Violation[];
    hoverFocusContent: WCAG22Violation[];
    sensoryCharacteristics: WCAG22Violation[];
    identifyPurpose: WCAG22Violation[];
    visualPresentation: WCAG22Violation[];
    characterKeyShortcuts: WCAG22Violation[];
    animationInteractions: WCAG22Violation[];
    threeFlashes: WCAG22Violation[];
    sectionHeadings: WCAG22Violation[];
    pointerGestures: WCAG22Violation[];
    pointerCancellation: WCAG22Violation[];
    motionActuation: WCAG22Violation[];
    onFocus: WCAG22Violation[];
    onInput: WCAG22Violation[];
    redundantEntry: WCAG22Violation[];
    // Media checks
    mediaAudioDescription: WCAG22Violation[];
    mediaLiveCaptions: WCAG22Violation[];
    mediaSignLanguage: WCAG22Violation[];
    mediaExtendedAudioDescription: WCAG22Violation[];
    mediaAlternative: WCAG22Violation[];
    mediaLiveAudio: WCAG22Violation[];
    mediaBackgroundAudio: WCAG22Violation[];
    imagesOfText: WCAG22Violation[];
    // Timing & interaction checks
    keyboardNoException: WCAG22Violation[];
    noTiming: WCAG22Violation[];
    interruptions: WCAG22Violation[];
    reAuthenticating: WCAG22Violation[];
    timeouts: WCAG22Violation[];
    threeFlashesAbsolute: WCAG22Violation[];
    location: WCAG22Violation[];
    focusNotObscuredEnhanced: WCAG22Violation[];
    targetSizeEnhanced: WCAG22Violation[];
    concurrentInput: WCAG22Violation[];
    // Language & error prevention checks
    unusualWords: WCAG22Violation[];
    abbreviations: WCAG22Violation[];
    readingLevel: WCAG22Violation[];
    pronunciation: WCAG22Violation[];
    errorPreventionLegal: WCAG22Violation[];
    help: WCAG22Violation[];
    errorPreventionAll: WCAG22Violation[];
    accessibleAuthEnhanced: WCAG22Violation[];
    summary: {
        totalViolations: number;
        byLevel: {
            A: number;
            AA: number;
            AAA: number;
        };
        byCriterion: Record<string, number>;
    };
}
