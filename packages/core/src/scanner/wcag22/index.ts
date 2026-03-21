/**
 * WCAG 2.2 Custom Checks
 *
 * These checks supplement axe-core's limited WCAG 2.2 coverage with custom implementations
 * for criteria not covered by axe-core.
 */

export * from './types.js';
export { checkTargetSize, getAllTargetSizeResults } from './target-size.js';
export { checkFocusNotObscured, getOverlayInfo } from './focus-obscured.js';
export { checkFocusAppearance, getFocusIndicatorDetails } from './focus-appearance.js';
export { checkDraggingMovements, getDraggableElements } from './dragging.js';
export { checkAccessibleAuthentication, getAuthenticationInfo } from './authentication.js';
export { checkStatusMessages, getStatusMessageInfo } from './status-messages.js';
export { checkErrorIdentification, getErrorIdentificationInfo } from './error-identification.js';
export { checkErrorSuggestion, getErrorSuggestionInfo } from './error-suggestion.js';
export { checkMeaningfulSequence, getMeaningfulSequenceInfo } from './meaningful-sequence.js';
export { checkSensoryCharacteristics, getSensoryCharacteristicsInfo } from './sensory-characteristics.js';
export { checkIdentifyPurpose, getIdentifyPurposeInfo } from './identify-purpose.js';
export { checkVisualPresentation, getVisualPresentationInfo } from './visual-presentation.js';
export { checkCharacterKeyShortcuts, getCharacterKeyShortcutsInfo } from './character-key-shortcuts.js';
export { checkAnimationInteractions, getAnimationInteractionsInfo } from './animation-interactions.js';
export { checkSectionHeadings, getSectionHeadingsInfo } from './section-headings.js';
export { checkPointerGestures, getPointerGesturesInfo } from './pointer-gestures.js';
export { checkOnFocusOnInput, getOnFocusOnInputInfo } from './on-focus-on-input.js';
export { checkRedundantEntry, getRedundantEntryInfo } from './redundant-entry.js';
export { checkMediaAccessibility, getMediaAccessibilityInfo } from './media-checks.js';
export { checkTimingAndInteraction, getTimingAndInteractionInfo } from './timing-interaction-checks.js';
export { checkLanguageAndErrorPrevention, getLanguageAndErrorPreventionInfo } from './language-error-prevention.js';

import type { WCAG22CheckResults, WCAG22Violation } from './types.js';
import { checkTargetSize } from './target-size.js';
import { checkFocusNotObscured } from './focus-obscured.js';
import { checkFocusAppearance } from './focus-appearance.js';
import { checkDraggingMovements } from './dragging.js';
import { checkAccessibleAuthentication } from './authentication.js';
import { checkStatusMessages } from './status-messages.js';
import { checkErrorIdentification } from './error-identification.js';
import { checkErrorSuggestion } from './error-suggestion.js';
import { checkMeaningfulSequence } from './meaningful-sequence.js';
import { checkSensoryCharacteristics } from './sensory-characteristics.js';
import { checkIdentifyPurpose } from './identify-purpose.js';
import { checkVisualPresentation } from './visual-presentation.js';
import { checkCharacterKeyShortcuts } from './character-key-shortcuts.js';
import { checkAnimationInteractions } from './animation-interactions.js';
import { checkSectionHeadings } from './section-headings.js';
import { checkPointerGestures } from './pointer-gestures.js';
import { checkOnFocusOnInput } from './on-focus-on-input.js';
import { checkRedundantEntry } from './redundant-entry.js';
import { checkMediaAccessibility } from './media-checks.js';
import { checkTimingAndInteraction } from './timing-interaction-checks.js';
import { checkLanguageAndErrorPrevention } from './language-error-prevention.js';

/**
 * Run all WCAG 2.2 checks
 */
export function runWCAG22Checks(): WCAG22CheckResults {
    console.log('🔍 Running WCAG 2.2 checks...');

    // Run all checks
    const targetSizeViolations = checkTargetSize();
    console.log(`  ✓ Target Size (2.5.8): ${targetSizeViolations.length} violations`);

    const focusObscuredViolations = checkFocusNotObscured();
    console.log(`  ✓ Focus Not Obscured (2.4.11): ${focusObscuredViolations.length} violations`);

    const focusAppearanceViolations = checkFocusAppearance();
    console.log(`  ✓ Focus Appearance (2.4.13): ${focusAppearanceViolations.length} violations`);

    const draggingViolations = checkDraggingMovements();
    console.log(`  ✓ Dragging Movements (2.5.7): ${draggingViolations.length} violations`);

    const authenticationViolations = checkAccessibleAuthentication();
    console.log(`  ✓ Accessible Authentication (3.3.8): ${authenticationViolations.length} violations`);

    const statusMessagesViolations = checkStatusMessages();
    console.log(`  ✓ Status Messages (4.1.3): ${statusMessagesViolations.length} violations`);

    const errorIdentificationViolations = checkErrorIdentification();
    console.log(`  ✓ Error Identification (3.3.1): ${errorIdentificationViolations.length} violations`);

    const errorSuggestionViolations = checkErrorSuggestion();
    console.log(`  ✓ Error Suggestion (3.3.3): ${errorSuggestionViolations.length} violations`);

    const meaningfulSequenceViolations = checkMeaningfulSequence();
    console.log(`  ✓ Meaningful Sequence (1.3.2): ${meaningfulSequenceViolations.length} violations`);

    const sensoryViolations = checkSensoryCharacteristics();
    console.log(`  ✓ Sensory Characteristics (1.3.3): ${sensoryViolations.length} violations`);

    const identifyPurposeViolations = checkIdentifyPurpose();
    console.log(`  ✓ Identify Purpose (1.3.6): ${identifyPurposeViolations.length} violations`);

    const visualPresentationViolations = checkVisualPresentation();
    console.log(`  ✓ Visual Presentation (1.4.8): ${visualPresentationViolations.length} violations`);

    const characterKeyViolations = checkCharacterKeyShortcuts();
    console.log(`  ✓ Character Key Shortcuts (2.1.4): ${characterKeyViolations.length} violations`);

    const animationViolations = checkAnimationInteractions();
    // Split animation results: 2.3.1 and 2.3.3 come from same checker
    const threeFlashViolations = animationViolations.filter(v => v.id === 'three-flashes');
    const animationInteractionViolations = animationViolations.filter(v => v.id === 'animation-interactions');
    console.log(`  ✓ Three Flashes (2.3.1): ${threeFlashViolations.length} violations`);
    console.log(`  ✓ Animation from Interactions (2.3.3): ${animationInteractionViolations.length} violations`);

    const sectionHeadingViolations = checkSectionHeadings();
    console.log(`  ✓ Section Headings (2.4.10): ${sectionHeadingViolations.length} violations`);

    const pointerViolations = checkPointerGestures();
    // Split pointer results: 2.5.1, 2.5.2, 2.5.4 come from same checker
    const pointerGestureViolations = pointerViolations.filter(v => v.id === 'pointer-gestures');
    const pointerCancellationViolations = pointerViolations.filter(v => v.id === 'pointer-cancellation');
    const motionActuationViolations = pointerViolations.filter(v => v.id === 'motion-actuation');
    console.log(`  ✓ Pointer Gestures (2.5.1): ${pointerGestureViolations.length} violations`);
    console.log(`  ✓ Pointer Cancellation (2.5.2): ${pointerCancellationViolations.length} violations`);
    console.log(`  ✓ Motion Actuation (2.5.4): ${motionActuationViolations.length} violations`);

    const focusInputViolations = checkOnFocusOnInput();
    // Split: 3.2.1 and 3.2.2 come from same checker
    const onFocusViolations = focusInputViolations.filter(v => v.id === 'on-focus');
    const onInputViolations = focusInputViolations.filter(v => v.id === 'on-input');
    console.log(`  ✓ On Focus (3.2.1): ${onFocusViolations.length} violations`);
    console.log(`  ✓ On Input (3.2.2): ${onInputViolations.length} violations`);

    const redundantEntryViolations = checkRedundantEntry();
    console.log(`  ✓ Redundant Entry (3.3.7): ${redundantEntryViolations.length} violations`);

    const mediaViolations = checkMediaAccessibility();
    const mediaAudioDescViolations = mediaViolations.filter(v => v.id === 'media-audio-description');
    const mediaLiveCaptionsViolations = mediaViolations.filter(v => v.id === 'media-live-captions');
    const mediaSignLanguageViolations = mediaViolations.filter(v => v.id === 'media-sign-language');
    const mediaExtAudioDescViolations = mediaViolations.filter(v => v.id === 'media-extended-audio-description');
    const mediaAlternativeViolations = mediaViolations.filter(v => v.id === 'media-alternative');
    const mediaLiveAudioViolations = mediaViolations.filter(v => v.id === 'media-live-audio');
    const mediaBackgroundAudioViolations = mediaViolations.filter(v => v.id === 'media-background-audio');
    const imagesOfTextViolations = mediaViolations.filter(v => v.id === 'images-of-text');
    console.log(`  ✓ Media checks: ${mediaViolations.length} violations`);

    const timingViolations = checkTimingAndInteraction();
    const keyboardNoExceptionViolations = timingViolations.filter(v => v.id === 'keyboard-no-exception');
    const noTimingViolations = timingViolations.filter(v => v.id === 'no-timing');
    const interruptionViolations = timingViolations.filter(v => v.id === 'interruptions');
    const reAuthViolations = timingViolations.filter(v => v.id === 're-authenticating');
    const timeoutViolations = timingViolations.filter(v => v.id === 'timeouts');
    const threeFlashAbsoluteViolations = timingViolations.filter(v => v.id === 'three-flashes-absolute');
    const locationViolations = timingViolations.filter(v => v.id === 'location');
    const focusObscuredEnhancedViolations = timingViolations.filter(v => v.id === 'focus-not-obscured-enhanced');
    const targetSizeEnhancedViolations = timingViolations.filter(v => v.id === 'target-size-enhanced');
    const concurrentInputViolations = timingViolations.filter(v => v.id === 'concurrent-input');
    console.log(`  ✓ Timing & interaction checks: ${timingViolations.length} violations`);

    const langErrorViolations = checkLanguageAndErrorPrevention();
    const unusualWordsViolations = langErrorViolations.filter(v => v.id === 'unusual-words');
    const abbreviationViolations = langErrorViolations.filter(v => v.id === 'abbreviations');
    const readingLevelViolations = langErrorViolations.filter(v => v.id === 'reading-level');
    const pronunciationViolations = langErrorViolations.filter(v => v.id === 'pronunciation');
    const errorPreventionLegalViolations = langErrorViolations.filter(v => v.id === 'error-prevention-legal');
    const helpViolations = langErrorViolations.filter(v => v.id === 'help');
    const errorPreventionAllViolations = langErrorViolations.filter(v => v.id === 'error-prevention-all');
    const accessibleAuthEnhancedViolations = langErrorViolations.filter(v => v.id === 'accessible-auth-enhanced');
    console.log(`  ✓ Language & error prevention checks: ${langErrorViolations.length} violations`);

    // Calculate summary
    const allViolations: WCAG22Violation[] = [
        ...targetSizeViolations,
        ...focusObscuredViolations,
        ...focusAppearanceViolations,
        ...draggingViolations,
        ...authenticationViolations,
        ...statusMessagesViolations,
        ...errorIdentificationViolations,
        ...errorSuggestionViolations,
        ...meaningfulSequenceViolations,
        ...sensoryViolations,
        ...identifyPurposeViolations,
        ...visualPresentationViolations,
        ...characterKeyViolations,
        ...animationViolations,
        ...sectionHeadingViolations,
        ...pointerViolations,
        ...focusInputViolations,
        ...redundantEntryViolations,
        ...mediaViolations,
        ...timingViolations,
        ...langErrorViolations,
    ];

    const byLevel = {
        A: allViolations.filter(v => v.level === 'A').length,
        AA: allViolations.filter(v => v.level === 'AA').length,
        AAA: allViolations.filter(v => v.level === 'AAA').length
    };

    const byCriterion: Record<string, number> = {};
    for (const violation of allViolations) {
        const key = violation.criterion;
        byCriterion[key] = (byCriterion[key] || 0) + 1;
    }

    console.log(`✓ WCAG 2.2 checks complete: ${allViolations.length} total violations`);

    return {
        targetSize: targetSizeViolations,
        focusObscured: focusObscuredViolations,
        focusAppearance: focusAppearanceViolations,
        dragging: draggingViolations,
        authentication: authenticationViolations,
        statusMessages: statusMessagesViolations,
        errorIdentification: errorIdentificationViolations,
        errorSuggestion: errorSuggestionViolations,
        meaningfulSequence: meaningfulSequenceViolations,
        reflow: [],          // Populated by post-scan Playwright check
        hoverFocusContent: [], // Populated by post-scan Playwright check
        sensoryCharacteristics: sensoryViolations,
        identifyPurpose: identifyPurposeViolations,
        visualPresentation: visualPresentationViolations,
        characterKeyShortcuts: characterKeyViolations,
        animationInteractions: animationInteractionViolations,
        threeFlashes: threeFlashViolations,
        sectionHeadings: sectionHeadingViolations,
        pointerGestures: pointerGestureViolations,
        pointerCancellation: pointerCancellationViolations,
        motionActuation: motionActuationViolations,
        onFocus: onFocusViolations,
        onInput: onInputViolations,
        redundantEntry: redundantEntryViolations,
        mediaAudioDescription: mediaAudioDescViolations,
        mediaLiveCaptions: mediaLiveCaptionsViolations,
        mediaSignLanguage: mediaSignLanguageViolations,
        mediaExtendedAudioDescription: mediaExtAudioDescViolations,
        mediaAlternative: mediaAlternativeViolations,
        mediaLiveAudio: mediaLiveAudioViolations,
        mediaBackgroundAudio: mediaBackgroundAudioViolations,
        imagesOfText: imagesOfTextViolations,
        keyboardNoException: keyboardNoExceptionViolations,
        noTiming: noTimingViolations,
        interruptions: interruptionViolations,
        reAuthenticating: reAuthViolations,
        timeouts: timeoutViolations,
        threeFlashesAbsolute: threeFlashAbsoluteViolations,
        location: locationViolations,
        focusNotObscuredEnhanced: focusObscuredEnhancedViolations,
        targetSizeEnhanced: targetSizeEnhancedViolations,
        concurrentInput: concurrentInputViolations,
        unusualWords: unusualWordsViolations,
        abbreviations: abbreviationViolations,
        readingLevel: readingLevelViolations,
        pronunciation: pronunciationViolations,
        errorPreventionLegal: errorPreventionLegalViolations,
        help: helpViolations,
        errorPreventionAll: errorPreventionAllViolations,
        accessibleAuthEnhanced: accessibleAuthEnhancedViolations,
        summary: {
            totalViolations: allViolations.length,
            byLevel,
            byCriterion
        }
    };
}
