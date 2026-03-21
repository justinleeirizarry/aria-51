import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { Effect } from 'effect';
import Results from './components/Results.js';
import TestGenerator from './components/TestGenerator.js';
import TestGenerationResults from './components/TestGenerationResults.js';
import StagehandProgress from './components/StagehandProgress.js';
import StagehandResults from './components/StagehandResults.js';
import {
    runScanAsPromise,
    AppLayer,
    EXIT_CODES,
    setExitCode,
    generateAndExport,
} from '@aria51/core';
import {
    createTestGenerationService,
    createKeyboardTestService,
    createTreeAnalysisService,
    createWcagAuditService,
} from '@aria51/ai-auditor';
import { getComponentBundlePath } from '@aria51/react';
import type {
    ScanResults,
    BrowserType,
    WcagLevel,
} from '@aria51/core';
import type {
    TestGenerationResults as TestGenResults,
    StagehandKeyboardResults,
    TreeAnalysisResult,
    WcagAuditResult,
} from '@aria51/ai-auditor';

type AppMode = 'scan' | 'generate-test' | 'stagehand-keyboard' | 'stagehand-tree' | 'wcag-audit';

interface AppProps {
    mode: AppMode;
    url: string;
    browser: BrowserType;
    output?: string;
    ci: boolean;
    threshold: number;
    headless: boolean;
    ai?: boolean;
    tags?: string[];
    keyboardNav?: boolean;
    tree?: boolean;
    quiet?: boolean;
    components?: boolean;
    disableRules?: string[];
    exclude?: string[];
    generateTest?: boolean;
    testFile?: string;
    stagehandModel?: string;
    stagehandVerbose?: boolean;
    // New Stagehand props
    maxTabPresses?: number;
    includeFullTree?: boolean;
    auditLevel?: WcagLevel;
    maxSteps?: number;
}

type ScanState = 'idle' | 'scanning' | 'complete' | 'error';
type TestGenState = 'idle' | 'initializing' | 'navigating' | 'discovering' | 'generating' | 'complete' | 'error';
type StagehandState = 'idle' | 'initializing' | 'running' | 'complete' | 'error';

// Type for Stagehand results
type StagehandResultType = StagehandKeyboardResults | TreeAnalysisResult | WcagAuditResult;

const App: React.FC<AppProps> = ({
    mode,
    url,
    browser,
    output,
    ci,
    threshold,
    headless,
    ai,
    tags,
    keyboardNav,
    tree,
    quiet,
    components,
    disableRules,
    exclude,
    generateTest,
    testFile,
    stagehandModel,
    stagehandVerbose,
    maxTabPresses,
    includeFullTree,
    auditLevel,
    maxSteps,
}) => {
    const { exit } = useApp();
    const [scanState, setScanState] = useState<ScanState>('idle');
    const [testGenState, setTestGenState] = useState<TestGenState>('idle');
    const [stagehandState, setStagehandState] = useState<StagehandState>('idle');
    const [scanResults, setScanResults] = useState<ScanResults | null>(null);
    const [testGenResults, setTestGenResults] = useState<TestGenResults | null>(null);
    const [stagehandResults, setStagehandResults] = useState<StagehandResultType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [aiPromptFilePath, setAiPromptFilePath] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (mode === 'stagehand-keyboard') {
            // Stagehand keyboard navigation testing
            const performKeyboardTest = async () => {
                setStagehandState('initializing');

                try {
                    const keyboardService = createKeyboardTestService();
                    await Effect.runPromise(keyboardService.init({
                        maxTabPresses,
                        verbose: stagehandVerbose,
                        model: stagehandModel,
                    }));

                    setStagehandState('running');
                    const results = await Effect.runPromise(keyboardService.test(url));
                    await Effect.runPromise(keyboardService.close());

                    if (cancelled) return;

                    setStagehandResults(results);
                    setStagehandState('complete');
                    exit();
                } catch (err) {
                    if (cancelled) return;
                    setStagehandState('error');
                    setError(err instanceof Error ? err.message : String(err));
                    setExitCode(EXIT_CODES.RUNTIME_ERROR);
                    exit();
                }
            };

            performKeyboardTest();
        } else if (mode === 'stagehand-tree') {
            // Stagehand tree analysis
            const performTreeAnalysis = async () => {
                setStagehandState('initializing');

                try {
                    const treeService = createTreeAnalysisService();
                    await Effect.runPromise(treeService.init({
                        verbose: stagehandVerbose,
                        model: stagehandModel,
                        includeFullTree,
                    }));

                    setStagehandState('running');
                    const results = await Effect.runPromise(treeService.analyze(url));
                    await Effect.runPromise(treeService.close());

                    if (cancelled) return;

                    setStagehandResults(results);
                    setStagehandState('complete');
                    exit();
                } catch (err) {
                    if (cancelled) return;
                    setStagehandState('error');
                    setError(err instanceof Error ? err.message : String(err));
                    setExitCode(EXIT_CODES.RUNTIME_ERROR);
                    exit();
                }
            };

            performTreeAnalysis();
        } else if (mode === 'wcag-audit') {
            // WCAG audit
            const performWcagAudit = async () => {
                setStagehandState('initializing');

                try {
                    const auditService = createWcagAuditService();
                    await Effect.runPromise(auditService.init({
                        targetLevel: auditLevel || 'AA',
                        maxSteps,
                        verbose: stagehandVerbose,
                        model: stagehandModel,
                    }));

                    setStagehandState('running');
                    const results = await Effect.runPromise(auditService.audit(url));
                    await Effect.runPromise(auditService.close());

                    if (cancelled) return;

                    setStagehandResults(results);
                    setStagehandState('complete');
                    exit();
                } catch (err) {
                    if (cancelled) return;
                    setStagehandState('error');
                    setError(err instanceof Error ? err.message : String(err));
                    setExitCode(EXIT_CODES.RUNTIME_ERROR);
                    exit();
                }
            };

            performWcagAudit();
        } else if (mode === 'generate-test') {
            // Test generation mode
            const performTestGeneration = async () => {
                setTestGenState('initializing');

                try {
                    if (!testFile) {
                        throw new Error('Test output file not specified');
                    }

                    setTestGenState('navigating');

                    const testGenService = createTestGenerationService();
                    await Effect.runPromise(testGenService.init({ model: stagehandModel, verbose: stagehandVerbose }));
                    await Effect.runPromise(testGenService.navigateTo(url));

                    setTestGenState('discovering');
                    const elements = await Effect.runPromise(testGenService.discoverElements());

                    setTestGenState('generating');
                    const testContent = await Effect.runPromise(testGenService.generateTest(url, elements));

                    // Write test file
                    const fs = await import('fs/promises');
                    const path = await import('path');
                    const dir = path.dirname(testFile);
                    if (dir !== '.') {
                        await fs.mkdir(dir, { recursive: true }).catch(() => {});
                    }
                    await fs.writeFile(testFile, testContent);

                    await Effect.runPromise(testGenService.close());

                    if (cancelled) return;

                    setTestGenResults({
                        url,
                        timestamp: new Date().toISOString(),
                        outputFile: testFile,
                        elementsDiscovered: elements.length,
                        elements,
                        success: true,
                    });
                    setTestGenState('complete');

                    // Exit after completion
                    exit();
                } catch (err) {
                    if (cancelled) return;

                    setTestGenState('error');
                    setError(err instanceof Error ? err.message : String(err));
                    setExitCode(EXIT_CODES.RUNTIME_ERROR);
                    exit();
                }
            };

            performTestGeneration();
        } else {
            // Accessibility scan mode using Effect-based orchestration
            const performScan = async () => {
                setScanState('scanning');

                try {
                    const { results, ciPassed } = await runScanAsPromise({
                        url,
                        browser,
                        headless,
                        tags,
                        includeKeyboardTests: keyboardNav,
                        outputFile: output,
                        ciMode: ci,
                        ciThreshold: threshold,
                        componentBundlePath: components ? getComponentBundlePath() : undefined,
                        disableRules,
                        exclude,
                    }, AppLayer);

                    if (cancelled) return;

                    setScanResults(results);
                    setScanState('complete');

                    // Handle AI prompts (must happen before exit)
                    if (ai) {
                        try {
                            const promptPath = generateAndExport(
                                results,
                                {
                                    template: 'fix-all',
                                    format: 'md',
                                    outputPath: undefined,
                                }
                            );
                            setAiPromptFilePath(promptPath);
                        } catch (err) {
                            const errorMsg = err instanceof Error ? err.message : String(err);
                            setScanState('error');
                            setError(`Failed to generate AI prompt: ${errorMsg}`);
                            if (ci) {
                                setExitCode(EXIT_CODES.RUNTIME_ERROR);
                                exit();
                            }
                            return;
                        }
                    }

                    // Handle CI mode exit
                    if (ci) {
                        setExitCode(ciPassed ? EXIT_CODES.SUCCESS : EXIT_CODES.VIOLATIONS_FOUND);
                        exit();
                    } else if (!tree) {
                        // Exit for non-interactive modes
                        // If --tree is set, we keep running for the interactive TreeViewer
                        exit();
                    }
                } catch (err) {
                    if (cancelled) return;

                    setScanState('error');
                    setError(err instanceof Error ? err.message : String(err));

                    setExitCode(EXIT_CODES.RUNTIME_ERROR);
                    exit();
                }
            };

            performScan();
        }

        return () => {
            cancelled = true;
        };
    }, [mode, url, browser, headless, ci, threshold, output, ai, tags, keyboardNav, tree, components, disableRules, exclude, generateTest, stagehandModel, stagehandVerbose, maxTabPresses, includeFullTree, auditLevel, maxSteps, testFile, exit]);

    // Error state
    if (scanState === 'error' || testGenState === 'error' || stagehandState === 'error') {
        return (
            <Box flexDirection="column" padding={1}>
                <Box>
                    <Text color="red" bold>Error</Text>
                </Box>
                <Box marginTop={1}>
                    <Text>{error}</Text>
                </Box>
            </Box>
        );
    }

    // Stagehand modes
    if (mode === 'stagehand-keyboard' || mode === 'stagehand-tree' || mode === 'wcag-audit') {
        if (stagehandState === 'complete' && stagehandResults) {
            return <StagehandResults mode={mode} results={stagehandResults} />;
        }
        return <StagehandProgress mode={mode} state={stagehandState} url={url} auditLevel={auditLevel} />;
    }

    // Test generation mode
    if (mode === 'generate-test') {
        if (testGenState === 'complete' && testGenResults) {
            return <TestGenerationResults results={testGenResults} />;
        }

        return <TestGenerator url={url} stage={testGenState} elementsFound={testGenResults?.elementsDiscovered} />;
    }

    // Scan mode
    if (scanState === 'scanning') {
        if (quiet) {
            return (
                <Box>
                    <Text color="gray">Scanning {url}...</Text>
                </Box>
            );
        }
        return <Results results={null} url={url} quiet={quiet} />;
    }

    if (scanState === 'complete' && scanResults) {
        return <Results results={scanResults} url={url} outputFile={output} aiPromptFile={aiPromptFilePath || undefined} showTree={tree} quiet={quiet} />;
    }

    // In quiet mode, show nothing during initialization
    if (quiet) {
        return null;
    }

    return (
        <Box>
            <Text color="green">
                <Spinner type="dots" />
            </Text>
            <Text> Initializing...</Text>
        </Box>
    );
};

export default App;
