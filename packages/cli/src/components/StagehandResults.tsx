import React from 'react';
import { Box, Text } from 'ink';
import type {
    StagehandKeyboardResults,
    TreeAnalysisResult,
    WcagAuditResult,
} from '@aria51/ai-auditor';

type StagehandMode = 'stagehand-keyboard' | 'stagehand-tree' | 'wcag-audit';
type StagehandResultType = StagehandKeyboardResults | TreeAnalysisResult | WcagAuditResult;

interface StagehandResultsProps {
    mode: StagehandMode;
    results: StagehandResultType;
}

// Type guards
function isKeyboardResults(results: StagehandResultType): results is StagehandKeyboardResults {
    return 'tabOrder' in results && 'coverage' in results;
}

function isTreeAnalysisResults(results: StagehandResultType): results is TreeAnalysisResult {
    return 'tree' in results && 'stats' in results;
}

function isWcagAuditResults(results: StagehandResultType): results is WcagAuditResult {
    return 'findings' in results && 'targetLevel' in results;
}

const KeyboardResultsView: React.FC<{ results: StagehandKeyboardResults }> = ({ results }) => {
    const { summary, coverage, issues, tabOrder } = results;

    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Text bold color="cyan">⌨️  Keyboard Navigation Test Results</Text>
            </Box>

            <Box marginBottom={1}>
                <Text color="gray">URL: {results.url}</Text>
            </Box>

            {/* Summary */}
            <Box flexDirection="column" marginBottom={1}>
                <Text bold>Summary</Text>
                <Box marginLeft={2} flexDirection="column">
                    <Text>
                        Total Issues: {' '}
                        <Text color={summary.totalIssues > 0 ? 'red' : 'green'}>
                            {summary.totalIssues}
                        </Text>
                    </Text>
                    {summary.focusTraps > 0 && (
                        <Text color="red">  Focus Traps: {summary.focusTraps}</Text>
                    )}
                    {summary.missingIndicators > 0 && (
                        <Text color="yellow">  Missing Focus Indicators: {summary.missingIndicators}</Text>
                    )}
                    {summary.inaccessibleElements > 0 && (
                        <Text color="red">  Keyboard Inaccessible: {summary.inaccessibleElements}</Text>
                    )}
                </Box>
            </Box>

            {/* Coverage */}
            <Box flexDirection="column" marginBottom={1}>
                <Text bold>Coverage</Text>
                <Box marginLeft={2}>
                    <Text>
                        {coverage.keyboardAccessible}/{coverage.totalInteractive} elements accessible ({coverage.percentAccessible}%)
                    </Text>
                </Box>
            </Box>

            {/* Tab Order */}
            {tabOrder.length > 0 && (
                <Box flexDirection="column" marginBottom={1}>
                    <Text bold>Tab Order ({tabOrder.length} elements)</Text>
                    <Box marginLeft={2} flexDirection="column">
                        {tabOrder.slice(0, 10).map((entry, i) => (
                            <Text key={i}>
                                {entry.index}. {entry.hasFocusIndicator ? '✓' : '✗'} [{entry.role}] {entry.element.substring(0, 50)}
                            </Text>
                        ))}
                        {tabOrder.length > 10 && (
                            <Text color="gray">... and {tabOrder.length - 10} more</Text>
                        )}
                    </Box>
                </Box>
            )}

            {/* Issues */}
            {issues.length > 0 && (
                <Box flexDirection="column">
                    <Text bold color="red">Issues Found</Text>
                    <Box marginLeft={2} flexDirection="column">
                        {issues.map((issue, i) => (
                            <Box key={i} flexDirection="column" marginBottom={1}>
                                <Text color={issue.severity === 'critical' ? 'red' : issue.severity === 'serious' ? 'yellow' : 'white'}>
                                    [{issue.severity.toUpperCase()}] {issue.type}
                                </Text>
                                <Text>  {issue.message}</Text>
                                <Text color="gray">  Element: {issue.element.selector}</Text>
                                {issue.wcagCriteria.length > 0 && (
                                    <Text color="gray">
                                        WCAG: {issue.wcagCriteria.map(c => `${c.id} ${c.title}`).join(', ')}
                                    </Text>
                                )}
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {issues.length === 0 && (
                <Box>
                    <Text color="green">No keyboard accessibility issues found!</Text>
                </Box>
            )}
        </Box>
    );
};

const TreeAnalysisView: React.FC<{ results: TreeAnalysisResult }> = ({ results }) => {
    const { stats, issues, summary } = results;

    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Text bold color="cyan">🌳 Accessibility Tree Analysis Results</Text>
            </Box>

            <Box marginBottom={1}>
                <Text color="gray">URL: {results.url}</Text>
            </Box>

            {/* Stats */}
            <Box flexDirection="column" marginBottom={1}>
                <Text bold>Tree Statistics</Text>
                <Box marginLeft={2} flexDirection="column">
                    <Text>Landmarks: {stats.landmarks}</Text>
                    <Text>Headings: {stats.headings}</Text>
                    <Text>Form Controls: {stats.formControls}</Text>
                    <Text>Interactive Elements: {stats.interactiveElements}</Text>
                    <Text>Total Nodes: {stats.totalNodes}</Text>
                </Box>
            </Box>

            {/* Summary */}
            <Box flexDirection="column" marginBottom={1}>
                <Text bold>Summary</Text>
                <Box marginLeft={2} flexDirection="column">
                    <Text>
                        Total Issues: {' '}
                        <Text color={summary.totalIssues > 0 ? 'red' : 'green'}>
                            {summary.totalIssues}
                        </Text>
                    </Text>
                    {Object.entries(summary.bySeverity).map(([severity, count]) => (
                        <Text key={severity} color={severity === 'critical' ? 'red' : severity === 'serious' ? 'yellow' : 'gray'}>
                            {severity}: {count}
                        </Text>
                    ))}
                </Box>
            </Box>

            {/* Issues */}
            {issues.length > 0 && (
                <Box flexDirection="column">
                    <Text bold color="red">Issues Found</Text>
                    <Box marginLeft={2} flexDirection="column">
                        {issues.slice(0, 15).map((issue, i) => (
                            <Box key={i} flexDirection="column" marginBottom={1}>
                                <Text color={issue.severity === 'critical' ? 'red' : issue.severity === 'serious' ? 'yellow' : 'white'}>
                                    [{issue.severity.toUpperCase()}] {issue.type}
                                </Text>
                                <Text>  {issue.message}</Text>
                                <Text color="gray">  {issue.node.selector}</Text>
                            </Box>
                        ))}
                        {issues.length > 15 && (
                            <Text color="gray">... and {issues.length - 15} more issues</Text>
                        )}
                    </Box>
                </Box>
            )}

            {issues.length === 0 && (
                <Box>
                    <Text color="green">No accessibility tree issues found!</Text>
                </Box>
            )}
        </Box>
    );
};

const WcagAuditView: React.FC<{ results: WcagAuditResult }> = ({ results }) => {
    const { summary, findings, targetLevel, agentMessage } = results;

    const failures = findings.filter(f => f.status === 'fail');
    const passes = findings.filter(f => f.status === 'pass');
    const manualReview = findings.filter(f => f.status === 'manual-review');

    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Text bold color="cyan">📋 WCAG {targetLevel} Compliance Audit Results</Text>
            </Box>

            <Box marginBottom={1}>
                <Text color="gray">URL: {results.url}</Text>
            </Box>

            {/* Summary */}
            <Box flexDirection="column" marginBottom={1}>
                <Text bold>Summary</Text>
                <Box marginLeft={2} flexDirection="column">
                    <Text color="green">Passed: {summary.passed}</Text>
                    <Text color="red">Failed: {summary.failed}</Text>
                    <Text color="yellow">Manual Review: {summary.manualReview}</Text>
                    <Text color="gray">States Checked: {summary.statesChecked}</Text>
                </Box>
            </Box>

            {/* Failures */}
            {failures.length > 0 && (
                <Box flexDirection="column" marginBottom={1}>
                    <Text bold color="red">Failed Criteria</Text>
                    <Box marginLeft={2} flexDirection="column">
                        {failures.slice(0, 10).map((finding, i) => (
                            <Box key={i} flexDirection="column" marginBottom={1}>
                                <Text color="red">
                                    {finding.criterion.id} {finding.criterion.title} (Level {finding.criterion.level})
                                </Text>
                                <Text>  {finding.description}</Text>
                                {finding.element && (
                                    <Text color="gray">  Element: {finding.element}</Text>
                                )}
                                {finding.impact && (
                                    <Text color="gray">  Impact: {finding.impact}</Text>
                                )}
                            </Box>
                        ))}
                        {failures.length > 10 && (
                            <Text color="gray">... and {failures.length - 10} more failures</Text>
                        )}
                    </Box>
                </Box>
            )}

            {/* Manual Review */}
            {manualReview.length > 0 && (
                <Box flexDirection="column" marginBottom={1}>
                    <Text bold color="yellow">Needs Manual Review</Text>
                    <Box marginLeft={2} flexDirection="column">
                        {manualReview.slice(0, 5).map((finding, i) => (
                            <Box key={i}>
                                <Text color="yellow">
                                    {finding.criterion.id} {finding.criterion.title}
                                </Text>
                            </Box>
                        ))}
                        {manualReview.length > 5 && (
                            <Text color="gray">... and {manualReview.length - 5} more</Text>
                        )}
                    </Box>
                </Box>
            )}

            {/* Agent Summary */}
            {agentMessage && (
                <Box flexDirection="column" marginTop={1}>
                    <Text bold>Agent Summary</Text>
                    <Box marginLeft={2}>
                        <Text>{agentMessage}</Text>
                    </Box>
                </Box>
            )}

            {failures.length === 0 && (
                <Box marginTop={1}>
                    <Text color="green">No WCAG {targetLevel} compliance failures found!</Text>
                </Box>
            )}
        </Box>
    );
};

const StagehandResults: React.FC<StagehandResultsProps> = ({ mode, results }) => {
    if (mode === 'stagehand-keyboard' && isKeyboardResults(results)) {
        return <KeyboardResultsView results={results} />;
    }

    if (mode === 'stagehand-tree' && isTreeAnalysisResults(results)) {
        return <TreeAnalysisView results={results} />;
    }

    if (mode === 'wcag-audit' && isWcagAuditResults(results)) {
        return <WcagAuditView results={results} />;
    }

    return (
        <Box padding={1}>
            <Text color="red">Unknown result type</Text>
        </Box>
    );
};

export default StagehandResults;
