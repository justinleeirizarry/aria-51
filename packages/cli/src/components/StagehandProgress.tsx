import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { WcagLevel } from '@aria51/core';

type StagehandMode = 'stagehand-keyboard' | 'stagehand-tree' | 'wcag-audit';
type StagehandState = 'idle' | 'initializing' | 'running' | 'complete' | 'error';

interface StagehandProgressProps {
    mode: StagehandMode;
    state: StagehandState;
    url: string;
    auditLevel?: WcagLevel;
}

const StagehandProgress: React.FC<StagehandProgressProps> = ({ mode, state, url, auditLevel }) => {
    const getModeTitle = (): string => {
        switch (mode) {
            case 'stagehand-keyboard':
                return 'Keyboard Navigation Test';
            case 'stagehand-tree':
                return 'Accessibility Tree Analysis';
            case 'wcag-audit':
                return `WCAG ${auditLevel || 'AA'} Compliance Audit`;
            default:
                return 'Stagehand Test';
        }
    };

    const getModeIcon = (): string => {
        switch (mode) {
            case 'stagehand-keyboard':
                return '⌨️ ';
            case 'stagehand-tree':
                return '🌳';
            case 'wcag-audit':
                return '📋';
            default:
                return '🤖';
        }
    };

    const getStateMessage = (): string => {
        switch (state) {
            case 'initializing':
                return 'Initializing Stagehand AI...';
            case 'running':
                switch (mode) {
                    case 'stagehand-keyboard':
                        return 'Testing keyboard navigation patterns...';
                    case 'stagehand-tree':
                        return 'Analyzing accessibility tree structure...';
                    case 'wcag-audit':
                        return `Running WCAG ${auditLevel || 'AA'} compliance checks...`;
                    default:
                        return 'Running test...';
                }
            case 'complete':
                return 'Test complete!';
            default:
                return 'Processing...';
        }
    };

    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Text bold color="cyan">
                    {getModeIcon()} {getModeTitle()}
                </Text>
            </Box>

            <Box marginBottom={1}>
                <Text color="gray">URL: {url}</Text>
            </Box>

            <Box>
                <Text color="green">
                    {state === 'complete' ? '✅' : <Spinner type="dots" />}
                </Text>
                <Text> {getStateMessage()}</Text>
            </Box>

            {mode === 'wcag-audit' && state === 'running' && (
                <Box marginTop={1}>
                    <Text color="gray">
                        The AI agent is autonomously testing the page for accessibility issues.
                    </Text>
                </Box>
            )}

            {mode === 'stagehand-keyboard' && state === 'running' && (
                <Box marginTop={1}>
                    <Text color="gray">
                        Testing tab navigation, focus indicators, and keyboard accessibility...
                    </Text>
                </Box>
            )}

            {mode === 'stagehand-tree' && state === 'running' && (
                <Box marginTop={1}>
                    <Text color="gray">
                        Extracting and analyzing the accessibility tree structure...
                    </Text>
                </Box>
            )}
        </Box>
    );
};

export default StagehandProgress;
