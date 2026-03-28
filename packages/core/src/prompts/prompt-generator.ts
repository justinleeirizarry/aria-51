import fs from 'fs';
import path from 'path';
import type { ScanResults, PromptContext, PromptExportOptions } from '../types.js';
import { getTemplate } from './templates/index.js';

/**
 * Generate AI prompt from scan results
 */
export function generatePrompt(
    results: ScanResults,
    templateName: string = 'fix-all'
): string {
    const template = getTemplate(templateName);

    if (!template) {
        throw new Error(`Template "${templateName}" not found. Available templates: fix-all, explain, quick-wins, critical-only`);
    }

    const context: PromptContext = {
        violations: results.violations,
        summary: results.summary,
        url: results.url,
        wcag22: results.wcag22,
        supplementalResults: results.supplementalResults,
        keyboardTests: results.keyboardTests,
    };

    return template.render(context);
}

/**
 * Export prompt to file
 */
export function exportPrompt(
    prompt: string,
    options: PromptExportOptions
): string {
    const { format, outputPath, template } = options;

    let content: string;
    let defaultFilename: string;

    switch (format) {
        case 'txt':
            content = prompt;
            defaultFilename = `a11y-prompt-${template}.txt`;
            break;

        case 'md':
            content = prompt;
            defaultFilename = 'a11y-prompt.md';
            break;

        case 'json':
            content = JSON.stringify({
                template,
                prompt,
                generatedAt: new Date().toISOString(),
            }, null, 2);
            defaultFilename = `a11y-prompt-${template}.json`;
            break;

        default:
            throw new Error(`Unknown format: ${format}`);
    }

    const filepath = outputPath || defaultFilename;

    try {
        // Ensure directory exists
        const dir = path.dirname(filepath);
        if (dir !== '.') {
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (err) {
                // Directory may already exist
                if (err instanceof Error && !err.message.includes('exists')) {
                    throw err;
                }
            }
        }

        fs.writeFileSync(filepath, content, 'utf-8');
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to write prompt to ${filepath}: ${errorMsg}`);
    }

    return path.resolve(filepath);
}

/**
 * Generate and export prompt in one step
 */
export function generateAndExport(
    results: ScanResults,
    options: PromptExportOptions
): string {
    const prompt = generatePrompt(results, options.template);
    return exportPrompt(prompt, options);
}
