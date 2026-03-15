import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface ScannerProps {
    url: string;
    browser: string;
}

const Scanner: React.FC<ScannerProps> = ({ url }) => {
    return (
        <Box flexDirection="column">
            <Text color="gray">{'━'.repeat(60)}</Text>
            <Text>{' '}</Text>
            <Text bold>{'  a11y.scan'}</Text>
            <Text>{' '}</Text>
            <Text color="gray">{'━'.repeat(60)}</Text>

            <Box marginTop={1}>
                <Text color="gray">target  </Text>
                <Text>{url}</Text>
            </Box>
            <Box>
                <Text color="gray">
                    <Spinner type="dots" />
                </Text>
                <Text color="gray">  scanning</Text>
            </Box>
        </Box>
    );
};

export default Scanner;
