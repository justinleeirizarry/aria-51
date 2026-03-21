/**
 * WCAG 2.2 Criteria Database
 *
 * Complete database of all 86 WCAG 2.2 success criteria with metadata
 * for enriching accessibility violation reports.
 */

import type { WcagLevel, TestabilityLevel } from '../types.js';

/**
 * WCAG principle categories
 */
export type WcagPrinciple = 'Perceivable' | 'Operable' | 'Understandable' | 'Robust';

/**
 * Complete WCAG 2.2 criterion information
 */
export interface WcagCriterion {
    /** Criterion ID (e.g., "1.4.3") */
    id: string;
    /** Criterion title (e.g., "Contrast (Minimum)") */
    title: string;
    /** Conformance level */
    level: WcagLevel;
    /** WCAG principle */
    principle: WcagPrinciple;
    /** Guideline title (e.g., "1.4 Distinguishable") */
    guideline: string;
    /** Brief description of the criterion */
    description: string;
    /** W3C Understanding document URL */
    w3cUrl: string;
    /** How automatable this criterion is */
    testability: TestabilityLevel;
    /** W3C normative success criterion text */
    successCriterionText?: string;
}

/**
 * Complete WCAG 2.2 criteria database
 * Contains all 86 success criteria organized by ID
 */
export const WCAG_CRITERIA: Record<string, WcagCriterion> = {
    // ============================================================================
    // Principle 1: Perceivable
    // ============================================================================

    // Guideline 1.1: Text Alternatives
    '1.1.1': {
        id: '1.1.1',
        title: 'Non-text Content',
        level: 'A',
        principle: 'Perceivable',
        guideline: '1.1 Text Alternatives',
        description: 'All non-text content has a text alternative that serves the equivalent purpose.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
        testability: 'automated',
        successCriterionText: 'All non-text content that is presented to the user has a text alternative that serves the equivalent purpose, except for the situations listed below. Controls, Input: If non-text content is a control or accepts user input, then it has a name that describes its purpose. (Refer to Success Criterion 4.1.2 for additional requirements for controls and content that accepts user input.) Time-Based Media: If non-text content is time-based media, then text alternatives at least provide descriptive identification of the non-text content. (Refer to Guideline 1.2 for additional requirements for media.) Test: If non-text content is a test or exercise that would be invalid if presented in text, then text alternatives at least provide descriptive identification of the non-text content. Sensory: If non-text content is primarily intended to create a specific sensory experience, then text alternatives at least provide descriptive identification of the non-text content. CAPTCHA: If the purpose of non-text content is to confirm that content is being accessed by a person rather than a computer, then text alternatives that identify and describe the purpose of the non-text content are provided, and alternative forms of CAPTCHA using output modes for different types of sensory perception are provided to accommodate different disabilities. Decoration, Formatting, Invisible: If non-text content is pure decoration, is used only for visual formatting, or is not presented to users, then it is implemented in a way that it can be ignored by assistive technology.'
    },

    // Guideline 1.2: Time-based Media
    '1.2.1': {
        id: '1.2.1',
        title: 'Audio-only and Video-only (Prerecorded)',
        level: 'A',
        principle: 'Perceivable',
        guideline: '1.2 Time-based Media',
        description: 'Alternatives are provided for prerecorded audio-only and video-only media.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html',
        testability: 'automated',
        successCriterionText: 'For prerecorded audio-only and prerecorded video-only media, the following are true, except when the audio or video is a media alternative for text and is clearly labeled as such: Prerecorded Audio-only: An alternative for time-based media is provided that presents equivalent information for prerecorded audio-only content. Prerecorded Video-only: Either an alternative for time-based media or an audio track is provided that presents equivalent information for prerecorded video-only content.'
    },
    '1.2.2': {
        id: '1.2.2',
        title: 'Captions (Prerecorded)',
        level: 'A',
        principle: 'Perceivable',
        guideline: '1.2 Time-based Media',
        description: 'Captions are provided for all prerecorded audio content in synchronized media.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html',
        testability: 'automated',
        successCriterionText: 'Captions are provided for all prerecorded audio content in synchronized media, except when the media is a media alternative for text and is clearly labeled as such.'
    },
    '1.2.3': {
        id: '1.2.3',
        title: 'Audio Description or Media Alternative (Prerecorded)',
        level: 'A',
        principle: 'Perceivable',
        guideline: '1.2 Time-based Media',
        description: 'An alternative or audio description is provided for prerecorded video content.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-description-or-media-alternative-prerecorded.html',
        testability: 'manual',
        successCriterionText: 'An alternative for time-based media or audio description of the prerecorded video content is provided for synchronized media, except when the media is a media alternative for text and is clearly labeled as such.'
    },
    '1.2.4': {
        id: '1.2.4',
        title: 'Captions (Live)',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.2 Time-based Media',
        description: 'Captions are provided for all live audio content in synchronized media.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/captions-live.html',
        testability: 'manual',
        successCriterionText: 'Captions are provided for all live audio content in synchronized media.'
    },
    '1.2.5': {
        id: '1.2.5',
        title: 'Audio Description (Prerecorded)',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.2 Time-based Media',
        description: 'Audio description is provided for all prerecorded video content.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-description-prerecorded.html',
        testability: 'automated',
        successCriterionText: 'Audio description is provided for all prerecorded video content in synchronized media.'
    },
    '1.2.6': {
        id: '1.2.6',
        title: 'Sign Language (Prerecorded)',
        level: 'AAA',
        principle: 'Perceivable',
        guideline: '1.2 Time-based Media',
        description: 'Sign language interpretation is provided for all prerecorded audio content.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/sign-language-prerecorded.html',
        testability: 'manual',
        successCriterionText: 'Sign language interpretation is provided for all prerecorded audio content in synchronized media.'
    },
    '1.2.7': {
        id: '1.2.7',
        title: 'Extended Audio Description (Prerecorded)',
        level: 'AAA',
        principle: 'Perceivable',
        guideline: '1.2 Time-based Media',
        description: 'Extended audio description is provided when pauses are insufficient.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/extended-audio-description-prerecorded.html',
        testability: 'manual',
        successCriterionText: 'Where pauses in foreground audio are insufficient to allow audio descriptions to convey the sense of the video, extended audio description is provided for all prerecorded video content in synchronized media.'
    },
    '1.2.8': {
        id: '1.2.8',
        title: 'Media Alternative (Prerecorded)',
        level: 'AAA',
        principle: 'Perceivable',
        guideline: '1.2 Time-based Media',
        description: 'An alternative for time-based media is provided for all prerecorded content.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/media-alternative-prerecorded.html',
        testability: 'manual',
        successCriterionText: 'An alternative for time-based media is provided for all prerecorded synchronized media and for all prerecorded video-only media.'
    },
    '1.2.9': {
        id: '1.2.9',
        title: 'Audio-only (Live)',
        level: 'AAA',
        principle: 'Perceivable',
        guideline: '1.2 Time-based Media',
        description: 'An alternative is provided for live audio-only content.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-only-live.html',
        testability: 'manual',
        successCriterionText: 'An alternative for time-based media that presents equivalent information for live audio-only content is provided.'
    },

    // Guideline 1.3: Adaptable
    '1.3.1': {
        id: '1.3.1',
        title: 'Info and Relationships',
        level: 'A',
        principle: 'Perceivable',
        guideline: '1.3 Adaptable',
        description: 'Information and relationships conveyed through presentation can be programmatically determined.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
        testability: 'automated',
        successCriterionText: 'Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text.'
    },
    '1.3.2': {
        id: '1.3.2',
        title: 'Meaningful Sequence',
        level: 'A',
        principle: 'Perceivable',
        guideline: '1.3 Adaptable',
        description: 'The correct reading sequence can be programmatically determined.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html',
        testability: 'semi-automated',
        successCriterionText: 'When the sequence in which content is presented affects its meaning, a correct reading sequence can be programmatically determined.'
    },
    '1.3.3': {
        id: '1.3.3',
        title: 'Sensory Characteristics',
        level: 'A',
        principle: 'Perceivable',
        guideline: '1.3 Adaptable',
        description: 'Instructions do not rely solely on sensory characteristics like shape or location.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/sensory-characteristics.html',
        testability: 'semi-automated',
        successCriterionText: 'Instructions provided for understanding and operating content do not rely solely on sensory characteristics of components such as shape, color, size, visual location, orientation, or sound. Note For requirements related to color, refer to Guideline 1.4.'
    },
    '1.3.4': {
        id: '1.3.4',
        title: 'Orientation',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.3 Adaptable',
        description: 'Content does not restrict its view to a single display orientation.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/orientation.html',
        testability: 'automated',
        successCriterionText: 'Content does not restrict its view and operation to a single display orientation, such as portrait or landscape, unless a specific display orientation is essential. Note Examples where a particular display orientation may be essential are a bank check, a piano application, slides for a projector or television, or virtual reality content where content is not necessarily restricted to landscape or portrait display orientation.'
    },
    '1.3.5': {
        id: '1.3.5',
        title: 'Identify Input Purpose',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.3 Adaptable',
        description: 'The purpose of input fields collecting user information can be programmatically determined.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html',
        testability: 'automated',
        successCriterionText: 'The purpose of each input field collecting information about the user can be programmatically determined when: - The input field serves a purpose identified in the Input Purposes for user interface components section; and - The content is implemented using technologies with support for identifying the expected meaning for form input data.'
    },
    '1.3.6': {
        id: '1.3.6',
        title: 'Identify Purpose',
        level: 'AAA',
        principle: 'Perceivable',
        guideline: '1.3 Adaptable',
        description: 'The purpose of UI components, icons, and regions can be programmatically determined.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/identify-purpose.html',
        testability: 'semi-automated',
        successCriterionText: 'In content implemented using markup languages, the purpose of user interface components, icons, and regions can be programmatically determined.'
    },

    // Guideline 1.4: Distinguishable
    '1.4.1': {
        id: '1.4.1',
        title: 'Use of Color',
        level: 'A',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'Color is not used as the only visual means of conveying information.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html',
        testability: 'automated',
        successCriterionText: 'Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element. Note This success criterion addresses color perception specifically. Other forms of perception are covered in Guideline 1.3 including programmatic access to color and other visual presentation coding.'
    },
    '1.4.2': {
        id: '1.4.2',
        title: 'Audio Control',
        level: 'A',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'A mechanism is available to pause, stop, or control audio volume.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html',
        testability: 'automated',
        successCriterionText: 'If any audio on a web page plays automatically for more than 3 seconds, either a mechanism is available to pause or stop the audio, or a mechanism is available to control audio volume independently from the overall system volume level. Note Since any content that does not meet this success criterion can interfere with a user\'s ability to use the whole page, all content on the web page (whether or not it is used to meet other success criteria) must meet this success criterion. See Conformance Requirement 5: Non-Interference.'
    },
    '1.4.3': {
        id: '1.4.3',
        title: 'Contrast (Minimum)',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'Text has a contrast ratio of at least 4.5:1 (3:1 for large text).',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
        testability: 'automated',
        successCriterionText: 'The visual presentation of text and images of text has a contrast ratio of at least 4.5:1, except for the following: Large Text: Large-scale text and images of large-scale text have a contrast ratio of at least 3:1; Incidental: Text or images of text that are part of an inactive user interface component, that are pure decoration, that are not visible to anyone, or that are part of a picture that contains significant other visual content, have no contrast requirement. Logotypes: Text that is part of a logo or brand name has no contrast requirement.'
    },
    '1.4.4': {
        id: '1.4.4',
        title: 'Resize Text',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'Text can be resized up to 200% without loss of content or functionality.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html',
        testability: 'automated',
        successCriterionText: 'Except for captions and images of text, text can be resized without assistive technology up to 200 percent without loss of content or functionality.'
    },
    '1.4.5': {
        id: '1.4.5',
        title: 'Images of Text',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'Text is used instead of images of text when possible.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/images-of-text.html',
        testability: 'semi-automated',
        successCriterionText: 'If the technologies being used can achieve the visual presentation, text is used to convey information rather than images of text except for the following: Customizable: The image of text can be visually customized to the user\'s requirements; Essential: A particular presentation of text is essential to the information being conveyed. Note Logotypes (text that is part of a logo or brand name) are considered essential.'
    },
    '1.4.6': {
        id: '1.4.6',
        title: 'Contrast (Enhanced)',
        level: 'AAA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'Text has a contrast ratio of at least 7:1 (4.5:1 for large text).',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html',
        testability: 'automated',
        successCriterionText: 'The visual presentation of text and images of text has a contrast ratio of at least 7:1, except for the following: Large Text: Large-scale text and images of large-scale text have a contrast ratio of at least 4.5:1; Incidental: Text or images of text that are part of an inactive user interface component, that are pure decoration, that are not visible to anyone, or that are part of a picture that contains significant other visual content, have no contrast requirement. Logotypes: Text that is part of a logo or brand name has no contrast requirement.'
    },
    '1.4.7': {
        id: '1.4.7',
        title: 'Low or No Background Audio',
        level: 'AAA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'Background sounds are at least 20dB lower than foreground speech.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/low-or-no-background-audio.html',
        testability: 'manual',
        successCriterionText: 'For prerecorded audio-only content that (1) contains primarily speech in the foreground, (2) is not an audio CAPTCHA or audio logo, and (3) is not vocalization intended to be primarily musical expression such as singing or rapping, at least one of the following is true: No Background: The audio does not contain background sounds. Turn Off: The background sounds can be turned off. 20 dB: The background sounds are at least 20 decibels lower than the foreground speech content, with the exception of occasional sounds that last for only one or two seconds. Note Per the definition of "decibel," background sound that meets this requirement will be approximately four times quieter than the foreground speech content.'
    },
    '1.4.8': {
        id: '1.4.8',
        title: 'Visual Presentation',
        level: 'AAA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'Text blocks can be customized for width, colors, spacing, and alignment.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html',
        testability: 'semi-automated',
        successCriterionText: 'For the visual presentation of blocks of text, a mechanism is available to achieve the following: - Foreground and background colors can be selected by the user. - Width is no more than 80 characters or glyphs (40 if CJK). - Text is not justified (aligned to both the left and the right margins). - Line spacing (leading) is at least space-and-a-half within paragraphs, and paragraph spacing is at least 1.5 times larger than the line spacing. - Text can be resized without assistive technology up to 200 percent in a way that does not require the user to scroll horizontally to read a line of text on a full-screen window. Note 1 Content is not required to use these values. The requirement is that a mechanism is available for users to change these presentation aspects. The mechanism can be provided by the browser or other user agent. Content is not required to provide the mechanism. Note 2 Writing systems for some languages use different presentation aspects to improve readability and legibility. If a presentation aspect in this success criterion is not used in a writing system, content in that writing system does not need to use that presentation setting and can conform without it. Authors are encouraged to follow guidance for improving readability and legibility of text in their writing system.'
    },
    '1.4.9': {
        id: '1.4.9',
        title: 'Images of Text (No Exception)',
        level: 'AAA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'Images of text are only used for pure decoration or essential presentation.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/images-of-text-no-exception.html',
        testability: 'manual',
        successCriterionText: 'Images of text are only used for pure decoration or where a particular presentation of text is essential to the information being conveyed. Note Logotypes (text that is part of a logo or brand name) are considered essential.'
    },
    '1.4.10': {
        id: '1.4.10',
        title: 'Reflow',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'Content can reflow without scrolling in two dimensions at 400% zoom.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/reflow.html',
        testability: 'semi-automated',
        successCriterionText: 'Content can be presented without loss of information or functionality, and without requiring scrolling in two dimensions for: - Vertical scrolling content at a width equivalent to 320 CSS pixels; - Horizontal scrolling content at a height equivalent to 256 CSS pixels. Except for parts of the content which require two-dimensional layout for usage or meaning. Note 1 320 CSS pixels is equivalent to a starting viewport width of 1280 CSS pixels wide at 400% zoom. For web content which is designed to scroll horizontally (e.g., with vertical text), 256 CSS pixels is equivalent to a starting viewport height of 1024 CSS pixels at 400% zoom. Note 2 Examples of content which requires two-dimensional layout are images required for understanding (such as maps and diagrams), video, games, presentations, data tables (not individual cells), and interfaces where it is necessary to keep toolbars in view while manipulating content. It is acceptable to provide two-dimensional scrolling for such parts of the content.'
    },
    '1.4.11': {
        id: '1.4.11',
        title: 'Non-text Contrast',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'UI components and graphics have a contrast ratio of at least 3:1.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html',
        testability: 'semi-automated',
        successCriterionText: 'The visual presentation of the following have a contrast ratio of at least 3:1 against adjacent color(s): User Interface Components: Visual information required to identify user interface components and states, except for inactive components or where the appearance of the component is determined by the user agent and not modified by the author; Graphical Objects: Parts of graphics required to understand the content, except when a particular presentation of graphics is essential to the information being conveyed.'
    },
    '1.4.12': {
        id: '1.4.12',
        title: 'Text Spacing',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'No loss of content when text spacing is adjusted.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html',
        testability: 'automated',
        successCriterionText: 'In content implemented using markup languages that support the following text style properties, no loss of content or functionality occurs by setting all of the following and by changing no other style property: - Line height (line spacing) to at least 1.5 times the font size; - Spacing following paragraphs to at least 2 times the font size; - Letter spacing (tracking) to at least 0.12 times the font size; - Word spacing to at least 0.16 times the font size. Exception: Human languages and scripts that do not make use of one or more of these text style properties in written text can conform using only the properties that exist for that combination of language and script. Note 1 Content is not required to use these text spacing values. The requirement is to ensure that when a user overrides the authored text spacing, content or functionality is not lost. Note 2 Writing systems for some languages use different text spacing settings, such as paragraph start indent. Authors are encouraged to follow locally available guidance for improving readability and legibility of text in their writing system.'
    },
    '1.4.13': {
        id: '1.4.13',
        title: 'Content on Hover or Focus',
        level: 'AA',
        principle: 'Perceivable',
        guideline: '1.4 Distinguishable',
        description: 'Hover/focus content is dismissible, hoverable, and persistent.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html',
        testability: 'semi-automated',
        successCriterionText: 'Where receiving and then removing pointer hover or keyboard focus triggers additional content to become visible and then hidden, the following are true: Dismissible: A mechanism is available to dismiss the additional content without moving pointer hover or keyboard focus, unless the additional content communicates an input error or does not obscure or replace other content; Hoverable: If pointer hover can trigger the additional content, then the pointer can be moved over the additional content without the additional content disappearing; Persistent: The additional content remains visible until the hover or focus trigger is removed, the user dismisses it, or its information is no longer valid. Exception: The visual presentation of the additional content is controlled by the user agent and is not modified by the author. Note 1 Examples of additional content controlled by the user agent include browser tooltips created through use of the HTML title attribute [HTML]. Note 2 Custom tooltips, sub-menus, and other nonmodal popups that display on hover and focus are examples of additional content covered by this criterion. Note 3 This criterion applies to content that appears in addition to the triggering component itself. Since hidden components that are made visible on keyboard focus (such as links used to skip to another part of a page) do not present additional content they are not covered by this criterion. - Rewording the normative preamble for clarity View all errata'
    },

    // ============================================================================
    // Principle 2: Operable
    // ============================================================================

    // Guideline 2.1: Keyboard Accessible
    '2.1.1': {
        id: '2.1.1',
        title: 'Keyboard',
        level: 'A',
        principle: 'Operable',
        guideline: '2.1 Keyboard Accessible',
        description: 'All functionality is operable through a keyboard interface.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
        testability: 'automated',
        successCriterionText: 'All functionality of the content is operable through a keyboard interface without requiring specific timings for individual keystrokes, except where the underlying function requires input that depends on the path of the user\'s movement and not just the endpoints. Note 1 This exception relates to the underlying function, not the input technique. For example, if using handwriting to enter text, the input technique (handwriting) requires path-dependent input but the underlying function (text input) does not. Note 2 This does not forbid and should not discourage providing mouse input or other input methods in addition to keyboard operation.'
    },
    '2.1.2': {
        id: '2.1.2',
        title: 'No Keyboard Trap',
        level: 'A',
        principle: 'Operable',
        guideline: '2.1 Keyboard Accessible',
        description: 'Keyboard focus can be moved away from any component using the keyboard.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html',
        testability: 'semi-automated',
        successCriterionText: 'If keyboard focus can be moved to a component of the page using a keyboard interface, then focus can be moved away from that component using only a keyboard interface, and, if it requires more than unmodified arrow or tab keys or other standard exit methods, the user is advised of the method for moving focus away. Note Since any content that does not meet this success criterion can interfere with a user\'s ability to use the whole page, all content on the web page (whether it is used to meet other success criteria or not) must meet this success criterion. See Conformance Requirement 5: Non-Interference.'
    },
    '2.1.3': {
        id: '2.1.3',
        title: 'Keyboard (No Exception)',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.1 Keyboard Accessible',
        description: 'All functionality is operable through keyboard without exception.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard-no-exception.html',
        testability: 'manual',
        successCriterionText: 'All functionality of the content is operable through a keyboard interface without requiring specific timings for individual keystrokes.'
    },
    '2.1.4': {
        id: '2.1.4',
        title: 'Character Key Shortcuts',
        level: 'A',
        principle: 'Operable',
        guideline: '2.1 Keyboard Accessible',
        description: 'Single-character key shortcuts can be turned off or remapped.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html',
        testability: 'semi-automated',
        successCriterionText: 'If a keyboard shortcut is implemented in content using only letter (including upper- and lower-case letters), punctuation, number, or symbol characters, then at least one of the following is true: Turn off: A mechanism is available to turn the shortcut off; Remap: A mechanism is available to remap the shortcut to include one or more non-printable keyboard keys (e.g., Ctrl, Alt); Active only on focus: The keyboard shortcut for a user interface component is only active when that component has focus.'
    },

    // Guideline 2.2: Enough Time
    '2.2.1': {
        id: '2.2.1',
        title: 'Timing Adjustable',
        level: 'A',
        principle: 'Operable',
        guideline: '2.2 Enough Time',
        description: 'Users can turn off, adjust, or extend time limits.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html',
        testability: 'automated',
        successCriterionText: 'For each time limit that is set by the content, at least one of the following is true: Turn off: The user is allowed to turn off the time limit before encountering it; or Adjust: The user is allowed to adjust the time limit before encountering it over a wide range that is at least ten times the length of the default setting; or Extend: The user is warned before time expires and given at least 20 seconds to extend the time limit with a simple action (for example, "press the space bar"), and the user is allowed to extend the time limit at least ten times; or Real-time Exception: The time limit is a required part of a real-time event (for example, an auction), and no alternative to the time limit is possible; or Essential Exception: The time limit is essential and extending it would invalidate the activity; or 20 Hour Exception: The time limit is longer than 20 hours. Note This success criterion helps ensure that users can complete tasks without unexpected changes in content or context that are a result of a time limit. This success criterion should be considered in conjunction with Success Criterion 3.2.1, which puts limits on changes of content or context as a result of user action.'
    },
    '2.2.2': {
        id: '2.2.2',
        title: 'Pause, Stop, Hide',
        level: 'A',
        principle: 'Operable',
        guideline: '2.2 Enough Time',
        description: 'Moving, blinking, or auto-updating content can be paused, stopped, or hidden.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html',
        testability: 'automated',
        successCriterionText: 'For moving, blinking, scrolling, or auto-updating information, all of the following are true: Moving, blinking, scrolling: For any moving, blinking or scrolling information that (1) starts automatically, (2) lasts more than five seconds, and (3) is presented in parallel with other content, there is a mechanism for the user to pause, stop, or hide it unless the movement, blinking, or scrolling is part of an activity where it is essential; and Auto-updating: For any auto-updating information that (1) starts automatically and (2) is presented in parallel with other content, there is a mechanism for the user to pause, stop, or hide it or to control the frequency of the update unless the auto-updating is part of an activity where it is essential. Note 1 For requirements related to flickering or flashing content, refer to Guideline 2.3. Note 2 Since any content that does not meet this success criterion can interfere with a user\'s ability to use the whole page, all content on the web page (whether it is used to meet other success criteria or not) must meet this success criterion. See Conformance Requirement 5: Non-Interference. Note 3 Content that is updated periodically by software or that is streamed to the user agent is not required to preserve or present information that is generated or received between the initiation of the pause and resuming presentation, as this may not be technically possible, and in many situations could be misleading to do so. Note 4 An animation that occurs as part of a preload phase or similar situation can be considered essential if interaction cannot occur during that phase for all users and if not indicating progress could confuse users or cause them to think that content was frozen or broken.'
    },
    '2.2.3': {
        id: '2.2.3',
        title: 'No Timing',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.2 Enough Time',
        description: 'Timing is not an essential part of the activity.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/no-timing.html',
        testability: 'manual',
        successCriterionText: 'Timing is not an essential part of the event or activity presented by the content, except for non-interactive synchronized media and real-time events.'
    },
    '2.2.4': {
        id: '2.2.4',
        title: 'Interruptions',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.2 Enough Time',
        description: 'Interruptions can be postponed or suppressed by the user.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/interruptions.html',
        testability: 'manual',
        successCriterionText: 'Interruptions can be postponed or suppressed by the user, except interruptions involving an emergency.'
    },
    '2.2.5': {
        id: '2.2.5',
        title: 'Re-authenticating',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.2 Enough Time',
        description: 'Users can continue activity without data loss after re-authenticating.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/re-authenticating.html',
        testability: 'manual',
        successCriterionText: 'When an authenticated session expires, the user can continue the activity without loss of data after re-authenticating.'
    },
    '2.2.6': {
        id: '2.2.6',
        title: 'Timeouts',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.2 Enough Time',
        description: 'Users are warned of timeout duration that could cause data loss.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/timeouts.html',
        testability: 'manual',
        successCriterionText: 'Users are warned of the duration of any user inactivity that could cause data loss, unless the data is preserved for more than 20 hours when the user does not take any actions. Note Privacy regulations may require explicit user consent before user identification has been authenticated and before user data is preserved. In cases where the user is a minor, explicit consent may not be solicited in most jurisdictions, countries or regions. Consultation with privacy professionals and legal counsel is advised when considering data preservation as an approach to satisfy this success criterion.'
    },

    // Guideline 2.3: Seizures and Physical Reactions
    '2.3.1': {
        id: '2.3.1',
        title: 'Three Flashes or Below Threshold',
        level: 'A',
        principle: 'Operable',
        guideline: '2.3 Seizures and Physical Reactions',
        description: 'Content does not flash more than 3 times per second.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html',
        testability: 'semi-automated',
        successCriterionText: 'Web pages do not contain anything that flashes more than three times in any one second period, or the flash is below the general flash and red flash thresholds. Note Since any content that does not meet this success criterion can interfere with a user\'s ability to use the whole page, all content on the web page (whether it is used to meet other success criteria or not) must meet this success criterion. See Conformance Requirement 5: Non-Interference.'
    },
    '2.3.2': {
        id: '2.3.2',
        title: 'Three Flashes',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.3 Seizures and Physical Reactions',
        description: 'Content does not flash more than 3 times per second (no exceptions).',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/three-flashes.html',
        testability: 'manual',
        successCriterionText: 'Web pages do not contain anything that flashes more than three times in any one second period.'
    },
    '2.3.3': {
        id: '2.3.3',
        title: 'Animation from Interactions',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.3 Seizures and Physical Reactions',
        description: 'Motion animation triggered by interaction can be disabled.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html',
        testability: 'semi-automated',
        successCriterionText: 'Motion animation triggered by interaction can be disabled, unless the animation is essential to the functionality or the information being conveyed.'
    },

    // Guideline 2.4: Navigable
    '2.4.1': {
        id: '2.4.1',
        title: 'Bypass Blocks',
        level: 'A',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'A mechanism is available to bypass blocks of repeated content.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
        testability: 'automated',
        successCriterionText: 'A mechanism is available to bypass blocks of content that are repeated on multiple web pages.'
    },
    '2.4.2': {
        id: '2.4.2',
        title: 'Page Titled',
        level: 'A',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'Web pages have titles that describe topic or purpose.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html',
        testability: 'automated',
        successCriterionText: 'Web pages have titles that describe topic or purpose.'
    },
    '2.4.3': {
        id: '2.4.3',
        title: 'Focus Order',
        level: 'A',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'Focus order preserves meaning and operability.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html',
        testability: 'automated',
        successCriterionText: 'If a web page can be navigated sequentially and the navigation sequences affect meaning or operation, focusable components receive focus in an order that preserves meaning and operability.'
    },
    '2.4.4': {
        id: '2.4.4',
        title: 'Link Purpose (In Context)',
        level: 'A',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'Link purpose can be determined from link text or context.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
        testability: 'automated',
        successCriterionText: 'The purpose of each link can be determined from the link text alone or from the link text together with its programmatically determined link context, except where the purpose of the link would be ambiguous to users in general.'
    },
    '2.4.5': {
        id: '2.4.5',
        title: 'Multiple Ways',
        level: 'AA',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'More than one way is available to locate a page within a set.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/multiple-ways.html',
        testability: 'semi-automated',
        successCriterionText: 'More than one way is available to locate a web page within a set of web pages except where the web page is the result of, or a step in, a process.'
    },
    '2.4.6': {
        id: '2.4.6',
        title: 'Headings and Labels',
        level: 'AA',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'Headings and labels describe topic or purpose.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html',
        testability: 'automated',
        successCriterionText: 'Headings and labels describe topic or purpose.'
    },
    '2.4.7': {
        id: '2.4.7',
        title: 'Focus Visible',
        level: 'AA',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'Keyboard focus indicator is visible.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html',
        testability: 'semi-automated',
        successCriterionText: 'Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible.'
    },
    '2.4.8': {
        id: '2.4.8',
        title: 'Location',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'Information about user location within a set of pages is available.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/location.html',
        testability: 'manual',
        successCriterionText: 'Information about the user\'s location within a set of web pages is available.'
    },
    '2.4.9': {
        id: '2.4.9',
        title: 'Link Purpose (Link Only)',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'Link purpose can be determined from link text alone.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-link-only.html',
        testability: 'automated',
        successCriterionText: 'A mechanism is available to allow the purpose of each link to be identified from link text alone, except where the purpose of the link would be ambiguous to users in general.'
    },
    '2.4.10': {
        id: '2.4.10',
        title: 'Section Headings',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'Section headings are used to organize content.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/section-headings.html',
        testability: 'semi-automated',
        successCriterionText: 'Section headings are used to organize the content. Note 1 "Heading" is used in its general sense and includes titles and other ways to add a heading to different types of content. Note 2 This success criterion covers sections within writing, not user interface components. User interface components are covered under Success Criterion 4.1.2.'
    },
    '2.4.11': {
        id: '2.4.11',
        title: 'Focus Not Obscured (Minimum)',
        level: 'AA',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'Focused component is not entirely hidden by author-created content.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html',
        testability: 'automated',
        successCriterionText: 'When a user interface component receives keyboard focus, the component is not entirely hidden due to author-created content. Note 1 Where content in a configurable interface can be repositioned by the user, then only the initial positions of user-movable content are considered for testing and conformance of this success criterion. Note 2 Content opened by the user may obscure the component receiving focus. If the user can reveal the focused component without advancing the keyboard focus, the component with focus is not considered visually hidden due to author-created content.'
    },
    '2.4.12': {
        id: '2.4.12',
        title: 'Focus Not Obscured (Enhanced)',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'No part of the focused component is hidden by author-created content.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-enhanced.html',
        testability: 'manual',
        successCriterionText: 'When a user interface component receives keyboard focus, no part of the component is hidden by author-created content.'
    },
    '2.4.13': {
        id: '2.4.13',
        title: 'Focus Appearance',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.4 Navigable',
        description: 'Focus indicator has sufficient size and contrast.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html',
        testability: 'automated',
        successCriterionText: 'When the keyboard focus indicator is visible, an area of the focus indicator meets all the following: - is at least as large as the area of a 2 CSS pixel thick perimeter of the unfocused component or sub-component, and - has a contrast ratio of at least 3:1 between the same pixels in the focused and unfocused states. Exceptions: - The focus indicator is determined by the user agent and cannot be adjusted by the author, or - The focus indicator and the indicator\'s background color are not modified by the author. Note 1 What is perceived as the user interface component or sub-component (to determine the perimeter) depends on its visual presentation. The visual presentation includes the component\'s visible content, border, and component-specific background. It does not include shadow and glow effects outside the component\'s content, background, or border. Note 2 Examples of sub-components that may receive a focus indicator are menu items in an opened drop-down menu, or focusable cells in a grid. Note 3 Contrast calculations can be based on colors defined within the technology (such as HTML, CSS, and SVG). Pixels modified by user agent resolution enhancements and anti-aliasing can be ignored.'
    },

    // Guideline 2.5: Input Modalities
    '2.5.1': {
        id: '2.5.1',
        title: 'Pointer Gestures',
        level: 'A',
        principle: 'Operable',
        guideline: '2.5 Input Modalities',
        description: 'Multi-point gestures have single-pointer alternatives.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html',
        testability: 'semi-automated',
        successCriterionText: 'All functionality that uses multipoint or path-based gestures for operation can be operated with a single pointer without a path-based gesture, unless a multipoint or path-based gesture is essential. Note This requirement applies to web content that interprets pointer actions (i.e., this does not apply to actions that are required to operate the user agent or assistive technology).'
    },
    '2.5.2': {
        id: '2.5.2',
        title: 'Pointer Cancellation',
        level: 'A',
        principle: 'Operable',
        guideline: '2.5 Input Modalities',
        description: 'Single pointer actions can be cancelled or undone.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html',
        testability: 'semi-automated',
        successCriterionText: 'For functionality that can be operated using a single pointer, at least one of the following is true: No Down-Event: The down-event of the pointer is not used to execute any part of the function; Abort or Undo: Completion of the function is on the up-event, and a mechanism is available to abort the function before completion or to undo the function after completion; Up Reversal: The up-event reverses any outcome of the preceding down-event; Essential: Completing the function on the down-event is essential. Note 1 Functions that emulate a keyboard or numeric keypad key press are considered essential. Note 2 This requirement applies to web content that interprets pointer actions (i.e., this does not apply to actions that are required to operate the user agent or assistive technology).'
    },
    '2.5.3': {
        id: '2.5.3',
        title: 'Label in Name',
        level: 'A',
        principle: 'Operable',
        guideline: '2.5 Input Modalities',
        description: 'Accessible name includes the visible label text.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html',
        testability: 'automated',
        successCriterionText: 'For user interface components with labels that include text or images of text, the name contains the text that is presented visually. Note A best practice is to have the text of the label at the start of the name.'
    },
    '2.5.4': {
        id: '2.5.4',
        title: 'Motion Actuation',
        level: 'A',
        principle: 'Operable',
        guideline: '2.5 Input Modalities',
        description: 'Motion-triggered functionality has UI alternatives.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/motion-actuation.html',
        testability: 'semi-automated',
        successCriterionText: 'Functionality that can be operated by device motion or user motion can also be operated by user interface components and responding to the motion can be disabled to prevent accidental actuation, except when: Supported Interface: The motion is used to operate functionality through an accessibility supported interface; Essential: The motion is essential for the function and doing so would invalidate the activity.'
    },
    '2.5.5': {
        id: '2.5.5',
        title: 'Target Size (Enhanced)',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.5 Input Modalities',
        description: 'Pointer targets are at least 44x44 CSS pixels.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html',
        testability: 'manual',
        successCriterionText: 'The size of the target for pointer inputs is at least 44 by 44 CSS pixels except when: Equivalent: The target is available through an equivalent link or control on the same page that is at least 44 by 44 CSS pixels; Inline: The target is in a sentence or block of text; User Agent Control: The size of the target is determined by the user agent and is not modified by the author; Essential: A particular presentation of the target is essential to the information being conveyed.'
    },
    '2.5.6': {
        id: '2.5.6',
        title: 'Concurrent Input Mechanisms',
        level: 'AAA',
        principle: 'Operable',
        guideline: '2.5 Input Modalities',
        description: 'Content does not restrict use of different input modalities.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/concurrent-input-mechanisms.html',
        testability: 'manual',
        successCriterionText: 'Web content does not restrict use of input modalities available on a platform except where the restriction is essential, required to ensure the security of the content, or required to respect user settings.'
    },
    '2.5.7': {
        id: '2.5.7',
        title: 'Dragging Movements',
        level: 'AA',
        principle: 'Operable',
        guideline: '2.5 Input Modalities',
        description: 'Dragging operations have single-pointer alternatives.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html',
        testability: 'automated',
        successCriterionText: 'All functionality that uses a dragging movement for operation can be achieved by a single pointer without dragging, unless dragging is essential or the functionality is determined by the user agent and not modified by the author. Note This requirement applies to web content that interprets pointer actions (i.e., this does not apply to actions that are required to operate the user agent or assistive technology).'
    },
    '2.5.8': {
        id: '2.5.8',
        title: 'Target Size (Minimum)',
        level: 'AA',
        principle: 'Operable',
        guideline: '2.5 Input Modalities',
        description: 'Pointer targets are at least 24x24 CSS pixels.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
        testability: 'automated',
        successCriterionText: 'The size of the target for pointer inputs is at least 24 by 24 CSS pixels, except when: Spacing: Undersized targets (those less than 24 by 24 CSS pixels) are positioned so that if a 24 CSS pixel diameter circle is centered on the bounding box of each, the circles do not intersect another target or the circle for another undersized target; Equivalent: The function can be achieved through a different control on the same page that meets this criterion; Inline: The target is in a sentence or its size is otherwise constrained by the line-height of non-target text; User Agent Control: The size of the target is determined by the user agent and is not modified by the author; Essential: A particular presentation of the target is essential or is legally required for the information being conveyed. Note 1 Targets that allow for values to be selected spatially based on position within the target are considered one target for the purpose of the success criterion. Examples include sliders, color pickers displaying a gradient of colors, or editable areas where you position the cursor. Note 2 For inline targets the line-height should be interpreted as perpendicular to the flow of text. For example, in a language displayed vertically, the line-height would be horizontal.'
    },

    // ============================================================================
    // Principle 3: Understandable
    // ============================================================================

    // Guideline 3.1: Readable
    '3.1.1': {
        id: '3.1.1',
        title: 'Language of Page',
        level: 'A',
        principle: 'Understandable',
        guideline: '3.1 Readable',
        description: 'The default language of the page can be programmatically determined.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html',
        testability: 'automated',
        successCriterionText: 'The default human language of each web page can be programmatically determined.'
    },
    '3.1.2': {
        id: '3.1.2',
        title: 'Language of Parts',
        level: 'AA',
        principle: 'Understandable',
        guideline: '3.1 Readable',
        description: 'The language of passages or phrases can be programmatically determined.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html',
        testability: 'automated',
        successCriterionText: 'The human language of each passage or phrase in the content can be programmatically determined except for proper names, technical terms, words of indeterminate language, and words or phrases that have become part of the vernacular of the immediately surrounding text.'
    },
    '3.1.3': {
        id: '3.1.3',
        title: 'Unusual Words',
        level: 'AAA',
        principle: 'Understandable',
        guideline: '3.1 Readable',
        description: 'A mechanism identifies definitions of unusual words or jargon.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/unusual-words.html',
        testability: 'manual',
        successCriterionText: 'A mechanism is available for identifying specific definitions of words or phrases used in an unusual or restricted way, including idioms and jargon.'
    },
    '3.1.4': {
        id: '3.1.4',
        title: 'Abbreviations',
        level: 'AAA',
        principle: 'Understandable',
        guideline: '3.1 Readable',
        description: 'A mechanism identifies the expanded form of abbreviations.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/abbreviations.html',
        testability: 'manual',
        successCriterionText: 'A mechanism for identifying the expanded form or meaning of abbreviations is available.'
    },
    '3.1.5': {
        id: '3.1.5',
        title: 'Reading Level',
        level: 'AAA',
        principle: 'Understandable',
        guideline: '3.1 Readable',
        description: 'Content is available at a lower secondary education reading level.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/reading-level.html',
        testability: 'manual',
        successCriterionText: 'When text requires reading ability more advanced than the lower secondary education level after removal of proper names and titles, supplemental content, or a version that does not require reading ability more advanced than the lower secondary education level, is available.'
    },
    '3.1.6': {
        id: '3.1.6',
        title: 'Pronunciation',
        level: 'AAA',
        principle: 'Understandable',
        guideline: '3.1 Readable',
        description: 'A mechanism identifies pronunciation of ambiguous words.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/pronunciation.html',
        testability: 'manual',
        successCriterionText: 'A mechanism is available for identifying specific pronunciation of words where meaning of the words, in context, is ambiguous without knowing the pronunciation.'
    },

    // Guideline 3.2: Predictable
    '3.2.1': {
        id: '3.2.1',
        title: 'On Focus',
        level: 'A',
        principle: 'Understandable',
        guideline: '3.2 Predictable',
        description: 'Focusing a component does not initiate a change of context.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html',
        testability: 'semi-automated',
        successCriterionText: 'When any user interface component receives focus, it does not initiate a change of context.'
    },
    '3.2.2': {
        id: '3.2.2',
        title: 'On Input',
        level: 'A',
        principle: 'Understandable',
        guideline: '3.2 Predictable',
        description: 'Changing a setting does not automatically cause a context change.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/on-input.html',
        testability: 'semi-automated',
        successCriterionText: 'Changing the setting of any user interface component does not automatically cause a change of context unless the user has been advised of the behavior before using the component.'
    },
    '3.2.3': {
        id: '3.2.3',
        title: 'Consistent Navigation',
        level: 'AA',
        principle: 'Understandable',
        guideline: '3.2 Predictable',
        description: 'Navigation mechanisms occur in the same relative order.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html',
        testability: 'semi-automated',
        successCriterionText: 'Navigational mechanisms that are repeated on multiple web pages within a set of web pages occur in the same relative order each time they are repeated, unless a change is initiated by the user.'
    },
    '3.2.4': {
        id: '3.2.4',
        title: 'Consistent Identification',
        level: 'AA',
        principle: 'Understandable',
        guideline: '3.2 Predictable',
        description: 'Components with the same functionality are identified consistently.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html',
        testability: 'semi-automated',
        successCriterionText: 'Components that have the same functionality within a set of web pages are identified consistently.'
    },
    '3.2.5': {
        id: '3.2.5',
        title: 'Change on Request',
        level: 'AAA',
        principle: 'Understandable',
        guideline: '3.2 Predictable',
        description: 'Changes of context are initiated only by user request.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/change-on-request.html',
        testability: 'automated',
        successCriterionText: 'Changes of context are initiated only by user request or a mechanism is available to turn off such changes.'
    },
    '3.2.6': {
        id: '3.2.6',
        title: 'Consistent Help',
        level: 'A',
        principle: 'Understandable',
        guideline: '3.2 Predictable',
        description: 'Help mechanisms occur in the same relative order across pages.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html',
        testability: 'semi-automated',
        successCriterionText: 'If a web page contains any of the following help mechanisms, and those mechanisms are repeated on multiple web pages within a set of web pages, they occur in the same order relative to other page content, unless a change is initiated by the user: - Human contact details; - Human contact mechanism; - Self-help option; - A fully automated contact mechanism. Note 1 Help mechanisms may be provided directly on the page, or may be provided via a direct link to a different page containing the information. Note 2 For this success criterion, "the same order relative to other page content" can be thought of as how the content is ordered when the page is serialized. The visual position of a help mechanism is likely to be consistent across pages for the same page variation (e.g., CSS break-point). The user can initiate a change, such as changing the page\'s zoom or orientation, which may trigger a different page variation. This criterion is concerned with relative order across pages displayed in the same page variation (e.g., same zoom level and orientation). - Harmonizing occurrences of "breakpoint" to be one word View all errata'
    },

    // Guideline 3.3: Input Assistance
    '3.3.1': {
        id: '3.3.1',
        title: 'Error Identification',
        level: 'A',
        principle: 'Understandable',
        guideline: '3.3 Input Assistance',
        description: 'Input errors are identified and described to the user in text.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html',
        testability: 'semi-automated',
        successCriterionText: 'If an input error is automatically detected, the item that is in error is identified and the error is described to the user in text.'
    },
    '3.3.2': {
        id: '3.3.2',
        title: 'Labels or Instructions',
        level: 'A',
        principle: 'Understandable',
        guideline: '3.3 Input Assistance',
        description: 'Labels or instructions are provided for user input.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
        testability: 'automated',
        successCriterionText: 'Labels or instructions are provided when content requires user input.'
    },
    '3.3.3': {
        id: '3.3.3',
        title: 'Error Suggestion',
        level: 'AA',
        principle: 'Understandable',
        guideline: '3.3 Input Assistance',
        description: 'Suggestions for correction are provided for detected errors.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html',
        testability: 'semi-automated',
        successCriterionText: 'If an input error is automatically detected and suggestions for correction are known, then the suggestions are provided to the user, unless it would jeopardize the security or purpose of the content.'
    },
    '3.3.4': {
        id: '3.3.4',
        title: 'Error Prevention (Legal, Financial, Data)',
        level: 'AA',
        principle: 'Understandable',
        guideline: '3.3 Input Assistance',
        description: 'Submissions are reversible, checked, or confirmed.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html',
        testability: 'manual',
        successCriterionText: 'For web pages that cause legal commitments or financial transactions for the user to occur, that modify or delete user-controllable data in data storage systems, or that submit user test responses, at least one of the following is true: Reversible: Submissions are reversible. Checked: Data entered by the user is checked for input errors and the user is provided an opportunity to correct them. Confirmed: A mechanism is available for reviewing, confirming, and correcting information before finalizing the submission.'
    },
    '3.3.5': {
        id: '3.3.5',
        title: 'Help',
        level: 'AAA',
        principle: 'Understandable',
        guideline: '3.3 Input Assistance',
        description: 'Context-sensitive help is available.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/help.html',
        testability: 'manual',
        successCriterionText: 'Context-sensitive help is available.'
    },
    '3.3.6': {
        id: '3.3.6',
        title: 'Error Prevention (All)',
        level: 'AAA',
        principle: 'Understandable',
        guideline: '3.3 Input Assistance',
        description: 'All submissions are reversible, checked, or confirmed.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-all.html',
        testability: 'manual',
        successCriterionText: 'For web pages that require the user to submit information, at least one of the following is true: Reversible: Submissions are reversible. Checked: Data entered by the user is checked for input errors and the user is provided an opportunity to correct them. Confirmed: A mechanism is available for reviewing, confirming, and correcting information before finalizing the submission.'
    },
    '3.3.7': {
        id: '3.3.7',
        title: 'Redundant Entry',
        level: 'A',
        principle: 'Understandable',
        guideline: '3.3 Input Assistance',
        description: 'Previously entered information is auto-populated or selectable.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html',
        testability: 'semi-automated',
        successCriterionText: 'Information previously entered by or provided to the user that is required to be entered again in the same process is either: - auto-populated, or - available for the user to select. Except when: - re-entering the information is essential, - the information is required to ensure the security of the content, or - previously entered information is no longer valid.'
    },
    '3.3.8': {
        id: '3.3.8',
        title: 'Accessible Authentication (Minimum)',
        level: 'AA',
        principle: 'Understandable',
        guideline: '3.3 Input Assistance',
        description: 'Cognitive function tests are not required for authentication.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html',
        testability: 'automated',
        successCriterionText: 'A cognitive function test (such as remembering a password or solving a puzzle) is not required for any step in an authentication process unless that step provides at least one of the following: Alternative: Another authentication method that does not rely on a cognitive function test. Mechanism: A mechanism is available to assist the user in completing the cognitive function test. Object Recognition: The cognitive function test is to recognize objects. Personal Content: The cognitive function test is to identify non-text content the user provided to the website. Note 1 "Object recognition" and "Personal content" may be represented by images, video, or audio. Note 2 Examples of mechanisms that satisfy this criterion include: - support for password entry by password managers to reduce memory need, and - copy and paste to reduce the cognitive burden of re-typing.'
    },
    '3.3.9': {
        id: '3.3.9',
        title: 'Accessible Authentication (Enhanced)',
        level: 'AAA',
        principle: 'Understandable',
        guideline: '3.3 Input Assistance',
        description: 'No cognitive function tests required, with fewer exceptions.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-enhanced.html',
        testability: 'manual',
        successCriterionText: 'A cognitive function test (such as remembering a password or solving a puzzle) is not required for any step in an authentication process unless that step provides at least one of the following: Alternative: Another authentication method that does not rely on a cognitive function test. Mechanism: A mechanism is available to assist the user in completing the cognitive function test.'
    },

    // ============================================================================
    // Principle 4: Robust
    // ============================================================================

    // Guideline 4.1: Compatible
    // Note: 4.1.1 Parsing is obsolete in WCAG 2.2 but kept for axe-core compatibility
    '4.1.1': {
        id: '4.1.1',
        title: 'Parsing (Obsolete)',
        level: 'A',
        principle: 'Robust',
        guideline: '4.1 Compatible',
        description: 'OBSOLETE in WCAG 2.2. Previously required unique IDs and valid markup.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/parsing.html',
        testability: 'automated',
        successCriterionText: 'Note This criterion was originally adopted to address problems that assistive technology had directly parsing HTML. Assistive technology no longer has any need to directly parse HTML. Consequently, these problems either no longer exist or are addressed by other criteria. This criterion no longer has utility and is removed.'
    },
    '4.1.2': {
        id: '4.1.2',
        title: 'Name, Role, Value',
        level: 'A',
        principle: 'Robust',
        guideline: '4.1 Compatible',
        description: 'UI components have programmatically determinable name, role, and state.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
        testability: 'automated',
        successCriterionText: 'For all user interface components (including but not limited to: form elements, links and components generated by scripts), the name and role can be programmatically determined; states, properties, and values that can be set by the user can be programmatically set; and notification of changes to these items is available to user agents, including assistive technologies. Note This success criterion is primarily for web authors who develop or script their own user interface components. For example, standard HTML controls already meet this success criterion when used according to specification.'
    },
    '4.1.3': {
        id: '4.1.3',
        title: 'Status Messages',
        level: 'AA',
        principle: 'Robust',
        guideline: '4.1 Compatible',
        description: 'Status messages can be presented to users by assistive technologies.',
        w3cUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html',
        testability: 'semi-automated',
        successCriterionText: 'In content implemented using markup languages, status messages can be programmatically determined through role or properties such that they can be presented to the user by assistive technologies without receiving focus.'
    }
};

/**
 * Get all WCAG criteria as an array
 */
export function getAllCriteria(): WcagCriterion[] {
    return Object.values(WCAG_CRITERIA);
}

/**
 * Get total count of criteria
 */
export function getCriteriaCount(): number {
    return Object.keys(WCAG_CRITERIA).length;
}
