/**
 * Media Accessibility Checks
 *
 * Heuristic checks for media-related WCAG criteria by examining
 * <video>, <audio>, and <img> elements for required alternatives.
 *
 * Tested criteria:
 * - 1.2.3 Audio Description or Media Alternative (A)
 * - 1.2.4 Captions (Live) (AA)
 * - 1.2.6 Sign Language (AAA)
 * - 1.2.7 Extended Audio Description (AAA)
 * - 1.2.8 Media Alternative (AAA)
 * - 1.2.9 Audio-only (Live) (AAA)
 * - 1.4.7 Low or No Background Audio (AAA)
 * - 1.4.9 Images of Text (No Exception) (AAA)
 */

import type { WCAG22Violation } from './types.js';

function getSelector(element: Element): string {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const path: string[] = [];
    let current: Element | null = element;
    while (current && current !== document.body && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();
        if (current.className && typeof current.className === 'string') {
            const classes = current.className.split(/\s+/).filter(c => c.length > 0);
            if (classes.length > 0) selector += '.' + classes.map(c => CSS.escape(c)).join('.');
        }
        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(el => el.tagName === current!.tagName);
            if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        path.unshift(selector);
        current = current.parentElement;
    }
    return path.join(' > ');
}

function getHtmlSnippet(element: Element, maxLength = 150): string {
    const html = element.outerHTML;
    if (html.length <= maxLength) return html;
    const end = html.indexOf('>') + 1;
    return end < maxLength ? html.slice(0, maxLength) + '...' : html.slice(0, end) + '...';
}

function isElementVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

export function checkMediaAccessibility(): WCAG22Violation[] {
    const violations: WCAG22Violation[] = [];

    // --- Video checks ---
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
        if (!isElementVisible(video)) continue;

        const tracks = video.querySelectorAll('track');
        const trackKinds = new Set(Array.from(tracks).map(t => t.getAttribute('kind') || 'subtitles'));
        const selector = getSelector(video);
        const html = getHtmlSnippet(video);
        const src = video.getAttribute('src') || video.querySelector('source')?.getAttribute('src') || '';

        // 1.2.3: Audio Description — check for descriptions track
        if (!trackKinds.has('descriptions')) {
            violations.push({
                id: 'media-audio-description',
                criterion: '1.2.3 Audio Description or Media Alternative',
                level: 'A',
                element: 'video',
                selector,
                html,
                impact: 'serious',
                description: 'Video lacks <track kind="descriptions"> for audio description of visual content',
                details: { type: 'missing-audio-description', src: src.slice(0, 80) },
            });
        }

        // 1.2.4: Captions (Live) — flag live video without captions
        const isLive = video.hasAttribute('live') || src.includes('.m3u8') ||
            src.includes('live') || video.closest('[class*="live"]') !== null;
        if (isLive && !trackKinds.has('captions') && !trackKinds.has('subtitles')) {
            violations.push({
                id: 'media-live-captions',
                criterion: '1.2.4 Captions (Live)',
                level: 'AA',
                element: 'video',
                selector,
                html,
                impact: 'critical',
                description: 'Live video appears to lack captions track',
                details: { type: 'missing-live-captions', src: src.slice(0, 80) },
            });
        }

        // 1.2.6: Sign Language — no sign language track/window detected
        // Can only heuristically check for a sign language video overlay or track
        // We flag all videos without sign language indicators as needing review
        violations.push({
            id: 'media-sign-language',
            criterion: '1.2.6 Sign Language (Prerecorded)',
            level: 'AAA',
            element: 'video',
            selector,
            html,
            impact: 'minor',
            description: 'Video has no detectable sign language interpretation',
            details: { type: 'no-sign-language', src: src.slice(0, 80) },
        });

        // 1.2.7: Extended Audio Description — same as 1.2.3 but stricter (AAA)
        if (!trackKinds.has('descriptions')) {
            violations.push({
                id: 'media-extended-audio-description',
                criterion: '1.2.7 Extended Audio Description (Prerecorded)',
                level: 'AAA',
                element: 'video',
                selector,
                html,
                impact: 'moderate',
                description: 'Video lacks extended audio description track',
                details: { type: 'missing-extended-audio-description', src: src.slice(0, 80) },
            });
        }

        // 1.2.8: Media Alternative — check for text transcript link nearby
        const parent = video.parentElement;
        const hasTranscript = parent?.querySelector(
            'a[href*="transcript"], a[href*="text-alternative"], [class*="transcript"]'
        ) !== null;
        if (!hasTranscript) {
            violations.push({
                id: 'media-alternative',
                criterion: '1.2.8 Media Alternative (Prerecorded)',
                level: 'AAA',
                element: 'video',
                selector,
                html,
                impact: 'moderate',
                description: 'No text transcript link found near video element',
                details: { type: 'missing-transcript', src: src.slice(0, 80) },
            });
        }
    }

    // --- Audio checks ---
    const audios = document.querySelectorAll('audio');
    for (const audio of audios) {
        if (!isElementVisible(audio)) continue;

        const selector = getSelector(audio);
        const html = getHtmlSnippet(audio);
        const src = audio.getAttribute('src') || audio.querySelector('source')?.getAttribute('src') || '';

        // 1.2.9: Audio-only (Live) — flag live audio streams
        const isLive = src.includes('.m3u8') || src.includes('live') || src.includes('stream') ||
            audio.closest('[class*="live"]') !== null;
        if (isLive) {
            violations.push({
                id: 'media-live-audio',
                criterion: '1.2.9 Audio-only (Live)',
                level: 'AAA',
                element: 'audio',
                selector,
                html,
                impact: 'moderate',
                description: 'Live audio stream detected — requires text alternative presented in real time',
                details: { type: 'live-audio-no-alternative', src: src.slice(0, 80) },
            });
        }

        // 1.4.7: Low or No Background Audio — flag audio elements for review
        violations.push({
            id: 'media-background-audio',
            criterion: '1.4.7 Low or No Background Audio',
            level: 'AAA',
            element: 'audio',
            selector,
            html,
            impact: 'minor',
            description: 'Audio element found — verify background audio is at least 20dB lower than foreground speech',
            details: { type: 'background-audio-review', src: src.slice(0, 80) },
        });
    }

    // Also flag autoplay videos for 1.4.7
    for (const video of videos) {
        if (!isElementVisible(video)) continue;
        if (video.hasAttribute('autoplay') && !video.hasAttribute('muted')) {
            violations.push({
                id: 'media-background-audio',
                criterion: '1.4.7 Low or No Background Audio',
                level: 'AAA',
                element: 'video',
                selector: getSelector(video),
                html: getHtmlSnippet(video),
                impact: 'moderate',
                description: 'Video autoplays with audio — verify background audio levels meet requirements',
                details: { type: 'autoplay-with-audio' },
            });
        }
    }

    // --- Images of Text checks (1.4.9) ---
    const images = document.querySelectorAll('img');
    for (const img of images) {
        if (!isElementVisible(img)) continue;

        const src = (img.getAttribute('src') || '').toLowerCase();
        const alt = img.getAttribute('alt') || '';

        // Heuristic: detect images that likely contain text
        // (common patterns: badges, banners, logos with text, button images)
        const isLikelyTextImage =
            src.includes('badge') || src.includes('banner') || src.includes('button') ||
            src.includes('text') || src.includes('label') || src.includes('heading') ||
            src.includes('.svg') && alt.length > 20; // SVG with long alt text likely has text

        if (isLikelyTextImage) {
            violations.push({
                id: 'images-of-text',
                criterion: '1.4.9 Images of Text (No Exception)',
                level: 'AAA',
                element: 'img',
                selector: getSelector(img),
                html: getHtmlSnippet(img),
                impact: 'moderate',
                description: `Image may contain text (src: "${src.slice(0, 60)}"). Use actual text instead of images of text`,
                details: { type: 'possible-image-of-text', src: src.slice(0, 80), alt: alt.slice(0, 80) },
            });
        }
    }

    // Also check for canvas elements (often used for text rendering)
    const canvases = document.querySelectorAll('canvas');
    for (const canvas of canvases) {
        if (!isElementVisible(canvas)) continue;
        const rect = canvas.getBoundingClientRect();
        // Only flag canvases that are likely content (not tiny icons)
        if (rect.width > 100 && rect.height > 30) {
            violations.push({
                id: 'images-of-text',
                criterion: '1.4.9 Images of Text (No Exception)',
                level: 'AAA',
                element: 'canvas',
                selector: getSelector(canvas),
                html: getHtmlSnippet(canvas),
                impact: 'moderate',
                description: 'Canvas element found — if rendering text, use actual HTML text instead',
                details: {
                    type: 'canvas-text-risk',
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
            });
        }
    }

    return violations;
}

export function getMediaAccessibilityInfo(): Array<{
    selector: string;
    criterion: string;
    type: string;
}> {
    return checkMediaAccessibility().map(v => ({
        selector: v.selector,
        criterion: v.criterion,
        type: v.details.type as string,
    }));
}
