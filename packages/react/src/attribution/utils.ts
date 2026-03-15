/**
 * Utility functions for generating CSS selectors and HTML snippets
 */

/**
 * Generate a CSS selector for an element
 * Tries to create the most specific, stable selector possible
 */
export function generateCssSelector(element: Element): string {
    // Try ID first (most stable)
    if (element.id) {
        return `#${CSS.escape(element.id)}`;
    }

    // Build a path of selectors
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();

        // Add ID if available
        if (current.id) {
            selector = `#${CSS.escape(current.id)}`;
            path.unshift(selector);
            break;
        }

        // Add classes (max 2 for readability)
        if (current.classList.length > 0) {
            const classes = Array.from(current.classList)
                .slice(0, 2)
                .map(c => `.${CSS.escape(c)}`)
                .join('');
            selector += classes;
        }

        // Add nth-child if needed for uniqueness
        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(
                child => child.tagName === current!.tagName
            );
            if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-of-type(${index})`;
            }
        }

        path.unshift(selector);
        current = current.parentElement;

        // Limit depth for readability
        if (path.length >= 4) {
            break;
        }
    }

    return path.join(' > ');
}

/**
 * Extract a readable HTML snippet from full HTML
 * Truncates long content and removes excessive whitespace
 */
export function extractHtmlSnippet(html: string, maxLength: number = 100): string {
    if (!html) return '';

    // Normalize whitespace
    let snippet = html.replace(/\s+/g, ' ').trim();

    // Truncate if too long
    if (snippet.length > maxLength) {
        // Try to truncate at the end of the opening tag
        const firstTagEnd = snippet.indexOf('>');
        if (firstTagEnd !== -1 && firstTagEnd < maxLength - 3) {
            // Check if this is a self-closing tag or if there's content
            const afterTag = snippet.substring(firstTagEnd + 1);
            if (afterTag.trim().length > maxLength - firstTagEnd - 10) {
                snippet = snippet.substring(0, firstTagEnd + 1) + '...';
            } else {
                snippet = snippet.substring(0, maxLength - 3) + '...';
            }
        } else {
            snippet = snippet.substring(0, maxLength - 3) + '...';
        }
    }

    return snippet;
}

/**
 * Clean up webpack/bundler prefixes from file paths
 * e.g. "_N_E/./components/Button.tsx" → "components/Button.tsx"
 *      "_N_E/../../../src/app/page.tsx" → "src/app/page.tsx"
 */
export function cleanFilePath(filePath: string): string {
    let p = filePath;
    // Strip Next.js webpack prefix
    p = p.replace(/^_N_E\//, '');
    // Strip leading ./
    p = p.replace(/^\.\//, '');
    // Normalize ../../.. paths — keep only from the first real directory
    const parts = p.split('/');
    const firstReal = parts.findIndex(s => s !== '..' && s !== '.');
    if (firstReal > 0) {
        p = parts.slice(firstReal).join('/');
    }
    return p;
}
