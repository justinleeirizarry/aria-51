import React from 'react';
import { Box, Text } from 'ink';
import type { TestGenerationResults as TestGenResults } from '@aria51/ai-auditor';
import { Banner } from './Banner.js';

interface TestGenerationResultsProps {
    results: TestGenResults;
}

const TestGenerationResults: React.FC<TestGenerationResultsProps> = ({ results }) => {
    if (!results.success) {
        return (
            <Box flexDirection="column" padding={1}>
                <Box>
                    <Text color="red" bold>❌ Test Generation Failed</Text>
                </Box>
                <Box marginTop={1}>
                    <Text>{results.error || 'Unknown error'}</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1}>
            <Banner />

            {/* Success Banner */}
            <Box marginTop={1} marginBottom={1} paddingX={1}>
                <Text color="green" bold>✅ Test Generation Complete!</Text>
            </Box>

            {/* Summary */}
            <Box flexDirection="column" marginBottom={1} paddingX={1}>
                <Box>
                    <Text color="gray">URL: </Text>
                    <Text color="cyan">{results.url}</Text>
                </Box>
                <Box>
                    <Text color="gray">Test File: </Text>
                    <Text color="green">{results.outputFile}</Text>
                </Box>
                <Box>
                    <Text color="gray">Elements Discovered: </Text>
                    <Text color="yellow" bold>{results.elementsDiscovered}</Text>
                </Box>
            </Box>

            {/* Discovered Elements */}
            {results.elements.length > 0 && (
                <Box flexDirection="column" marginTop={1} paddingX={1}>
                    <Text bold underline>Discovered Interactive Elements</Text>
                    <Box flexDirection="column" marginTop={1}>
                        {results.elements.slice(0, 10).map((element, idx) => (
                            <Box key={idx} marginLeft={2}>
                                <Text color="gray">{idx + 1}. </Text>
                                <Text color="cyan">[{element.type}]</Text>
                                <Text> {element.description}</Text>
                            </Box>
                        ))}
                        {results.elements.length > 10 && (
                            <Box marginLeft={2} marginTop={1}>
                                <Text color="gray">
                                    ... and {results.elements.length - 10} more
                                </Text>
                            </Box>
                        )}
                    </Box>
                </Box>
            )}

            {/* Next Steps */}
            <Box flexDirection="column" marginTop={2} paddingX={1}>
                <Text bold color="yellow">📝 Next Steps</Text>
                <Box flexDirection="column" marginTop={1} marginLeft={2}>
                    <Box>
                        <Text color="gray">1. Review the generated test file</Text>
                    </Box>
                    <Box>
                        <Text color="gray">2. Run the test with: </Text>
                        <Text color="green">npx playwright test {results.outputFile}</Text>
                    </Box>
                    <Box>
                        <Text color="gray">3. Customize interactions as needed</Text>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default TestGenerationResults;
