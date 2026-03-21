import { Stagehand } from "@browserbasehq/stagehand";
import type { StagehandConfig, ElementDiscovery, ElementType } from "../types.js";
import { logger } from "@aria51/core";

export class StagehandScanner {
    private stagehand: Stagehand | null = null;

    constructor(private config: StagehandConfig) { }

    get page() {
        if (!this.stagehand) return null;
        // @ts-ignore - Stagehand exposes page directly
        return this.stagehand.page || this.stagehand.context?.pages()[0] || null;
    }

    async init(url: string): Promise<void> {
        if (!this.config.enabled) return;

        logger.info('Initializing Stagehand AI scanner...');

        try {
            const options = {
                env: "LOCAL" as const,
                model: this.config.model || "openai/gpt-4o-mini",
                verbose: (this.config.verbose ? 2 : 0) as 0 | 2,
            };

            this.stagehand = new Stagehand(options);
            await this.stagehand.init();
        } catch (error) {
            logger.error(`Failed to initialize Stagehand: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    async discoverElements(): Promise<ElementDiscovery[]> {
        if (!this.stagehand) {
            throw new Error("Stagehand not initialized");
        }

        logger.info('Running AI element discovery...');

        try {
            // Use observe to find elements without interacting
            // API expects 'description' parameter, not 'instruction'
            logger.debug('Calling stagehand.observe()...');
            const actions = await this.stagehand.observe(
                "find all interactive elements including buttons, links, form inputs, custom controls, and widgets"
            );

            logger.debug(`Stagehand returned ${actions?.length || 0} actions`);
            if (actions && actions.length > 0) {
                logger.debug(`First action: ${JSON.stringify(actions[0])}`);
            }

            if (!actions || actions.length === 0) {
                logger.warn('Stagehand observe returned no actions');
                return [];
            }

            return actions.map((action: any) => ({
                selector: action.selector,
                description: action.description,
                suggestedMethod: action.method,
                type: this.categorizeElement(action.description)
            }));
        } catch (error) {
            logger.error(`Stagehand discovery failed: ${error instanceof Error ? error.message : String(error)}`);
            if (error instanceof Error && error.stack) {
                logger.debug(`Stack trace: ${error.stack}`);
            }
            return [];
        }
    }

    private categorizeElement(description: string): ElementType {
        const lower = description.toLowerCase();
        if (lower.includes('button')) return 'button';
        if (lower.includes('link')) return 'link';
        if (lower.includes('input') || lower.includes('field')) return 'input';
        if (lower.includes('checkbox')) return 'checkbox';
        if (lower.includes('radio')) return 'radio';
        if (lower.includes('select') || lower.includes('dropdown')) return 'select';
        return 'custom';
    }

    async close(): Promise<void> {
        if (this.stagehand) {
            await this.stagehand.close();
            this.stagehand = null;
        }
    }
}
