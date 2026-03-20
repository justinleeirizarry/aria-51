import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ScanResults } from '@accessibility-toolkit/core';
import { colors, impactColors } from '../colors.js';

interface ResultsProps {
    results: ScanResults | null;
    url?: string;
    outputFile?: string;
    aiPromptFile?: string;
    report?: string;
    showTree?: boolean;
    quiet?: boolean;
}

function isUserComponent(name: string): boolean {
    if (!name || name.length <= 2) return false;
    if (name[0] !== name[0].toUpperCase()) return false;
    if (/^(Provider|Context|Fragment|Suspense|StrictMode|Anonymous)/.test(name)) return false;
    if (name.startsWith('__')) return false;
    return true;
}

function fmtSource(s: any): string {
    if (!s?.filePath) return '';
    let loc = s.filePath;
    if (s.lineNumber) loc += ':' + s.lineNumber;
    if (s.columnNumber) loc += ':' + s.columnNumber;
    return loc;
}

const Results: React.FC<ResultsProps> = ({ results, url: scanUrl, outputFile, aiPromptFile, quiet }) => {
    if (!results) {
        return (
            <Box flexDirection="column">
                <Text color="gray">{'━'.repeat(60)}</Text>
                <Text>{' '}</Text>
                <Text bold>{'  a11y.scan'}</Text>
                <Text>{' '}</Text>
                <Text color="gray">{'━'.repeat(60)}</Text>
                {scanUrl && (
                    <Box marginTop={1}>
                        <Text color="gray">target  </Text>
                        <Text>{scanUrl}</Text>
                    </Box>
                )}
                <Box marginTop={1}>
                    <Text color="gray"><Spinner type="dots" /></Text>
                    <Text color="gray">  scanning</Text>
                </Box>
            </Box>
        );
    }

    const { violations, incomplete, summary, url } = results;
    const sev = summary.violationsBySeverity;

    const wcag22Total = results.wcag22?.summary?.totalViolations ?? 0;

    if (quiet) {
        const total = summary.totalViolations + wcag22Total;
        const icon = total > 0 ? 'x' : 'v';
        return (
            <Box flexDirection="column">
                <Text>{icon} {url} — {total} violations, {summary.totalPasses} passes</Text>
                {violations.map((v, i) => (
                    <Text key={i} color="gray">  [{v.impact}] {v.id}: {v.nodes.length} instances</Text>
                ))}
                {wcag22Total > 0 && (
                    <Text color="gray">  + {wcag22Total} WCAG 2.2 violations</Text>
                )}
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            {/* Header */}
            <Text color="gray">{'━'.repeat(60)}</Text>
            <Text>{' '}</Text>
            <Text bold>{'  a11y.scan'}</Text>
            <Text>{' '}</Text>
            <Text color="gray">{'━'.repeat(60)}</Text>

            <Box marginTop={1}>
                <Text color="gray">target  </Text>
                <Text>{url}</Text>
            </Box>

            {/* Stats */}
            <Box marginTop={1}>
                <Text bold color={(summary.totalViolations + wcag22Total) > 0 ? colors.critical : colors.success}>
                    {summary.totalViolations + wcag22Total} violations
                </Text>
                <Text color="gray">  {summary.totalPasses} passes  {summary.totalComponents} components</Text>
            </Box>

            {summary.totalViolations > 0 && (
                <Box>
                    {sev.critical > 0 && <Text color={colors.critical}>{sev.critical} critical  </Text>}
                    {sev.serious > 0 && <Text color={colors.serious}>{sev.serious} serious  </Text>}
                    {sev.moderate > 0 && <Text color={colors.moderate}>{sev.moderate} moderate  </Text>}
                    {sev.minor > 0 && <Text color={colors.minor}>{sev.minor} minor</Text>}
                </Box>
            )}

            {summary.keyboardIssues !== undefined && summary.keyboardIssues > 0 && (
                <Text color="gray">{summary.keyboardIssues} keyboard issues</Text>
            )}

            <Box marginTop={1} marginBottom={1}>
                <Text color="gray">{'─'.repeat(60)}</Text>
            </Box>

            {/* Violations */}
            {violations.length === 0 && (
                <Text color={colors.success} bold>No violations found.</Text>
            )}

            {violations.map((v, idx) => {
                const impact = v.impact;
                const impactColor = impactColors[impact] || colors.muted;

                return (
                    <Box key={idx} flexDirection="column" marginBottom={1}>
                        {/* Rule header */}
                        <Box>
                            <Text color={impactColor} bold>{impact.toUpperCase()}</Text>
                            <Text>  {v.id}  </Text>
                            <Text color="gray">{v.nodes.length} instance{v.nodes.length !== 1 ? 's' : ''}</Text>
                        </Box>

                        {/* Description */}
                        <Text color="gray">{v.description}</Text>

                        {/* Fix suggestion */}
                        {v.fixSuggestion && (
                            <Box marginTop={1}>
                                <Text color={colors.success}>FIX: </Text>
                                <Text>{v.fixSuggestion.summary}</Text>
                            </Box>
                        )}

                        {/* Instances */}
                        {v.nodes.map((node, i) => {
                            const source = (node as any).source;
                            const sourceLoc = fmtSource(source);

                            const rawPath = node.userComponentPath?.length
                                ? node.userComponentPath
                                : node.componentPath || [];
                            const filtered = rawPath.filter(isUserComponent);
                            const comp = filtered.length > 0
                                ? filtered[filtered.length - 1]
                                : node.component && isUserComponent(node.component)
                                ? node.component
                                : null;

                            const sourceStack = (node as any).sourceStack as Array<{ filePath: string; lineNumber?: number | null; columnNumber?: number | null; componentName?: string | null }> | undefined;

                            return (
                                <Box key={i} flexDirection="column" marginLeft={2} marginTop={1}>
                                    {/* Source + component */}
                                    <Box>
                                        {sourceLoc ? (
                                            <>
                                                <Text color={colors.accent} bold>{sourceLoc}</Text>
                                                {comp && <Text color="gray"> in </Text>}
                                                {comp && <Text bold>{comp}</Text>}
                                            </>
                                        ) : comp ? (
                                            <Text bold>{comp}</Text>
                                        ) : (
                                            <Text color="gray">{node.cssSelector || node.target?.[0] || 'unknown'}</Text>
                                        )}
                                    </Box>

                                    {/* Source stack */}
                                    {sourceStack && sourceStack.length > 1 && (
                                        <Box flexDirection="column" marginLeft={2}>
                                            {sourceStack.slice(0, 5).map((frame, j) => {
                                                const name = frame.componentName && frame.componentName.length > 2 ? frame.componentName : '';
                                                const frameLoc = fmtSource(frame);
                                                return (
                                                    <Text key={j} color="gray" dimColor>
                                                        {name ? `in ${name} ` : ''}({frameLoc})
                                                    </Text>
                                                );
                                            })}
                                        </Box>
                                    )}

                                    {/* HTML snippet */}
                                    <Text color="gray" dimColor>
                                        {(node.htmlSnippet || node.html || '').substring(0, 80)}
                                    </Text>
                                </Box>
                            );
                        })}

                        {/* Help URL */}
                        {v.helpUrl && (
                            <Box marginLeft={2} marginTop={1}>
                                <Text color="gray" dimColor underline>{v.helpUrl}</Text>
                            </Box>
                        )}

                        {/* Rule separator */}
                        <Box marginTop={1}>
                            <Text color="gray">{'─'.repeat(60)}</Text>
                        </Box>
                    </Box>
                );
            })}

            {/* WCAG 2.2 Custom Check Violations */}
            {results.wcag22 && results.wcag22.summary.totalViolations > 0 && (() => {
                const checks = [
                    { key: 'targetSize', label: 'Target Size (2.5.8)' },
                    { key: 'focusObscured', label: 'Focus Not Obscured (2.4.11)' },
                    { key: 'focusAppearance', label: 'Focus Appearance (2.4.13)' },
                    { key: 'dragging', label: 'Dragging Movements (2.5.7)' },
                    { key: 'authentication', label: 'Accessible Auth (3.3.8)' },
                    { key: 'statusMessages', label: 'Status Messages (4.1.3)' },
                    { key: 'errorIdentification', label: 'Error Identification (3.3.1)' },
                    { key: 'errorSuggestion', label: 'Error Suggestion (3.3.3)' },
                    { key: 'meaningfulSequence', label: 'Meaningful Sequence (1.3.2)' },
                    { key: 'reflow', label: 'Reflow (1.4.10)' },
                    { key: 'hoverFocusContent', label: 'Hover/Focus Content (1.4.13)' },
                ] as const;
                const wcag22 = results.wcag22 as any;
                return (
                    <Box flexDirection="column" marginTop={1}>
                        <Text bold color={colors.serious}>WCAG 2.2 Checks — {results.wcag22.summary.totalViolations} violations</Text>
                        {checks.map(({ key, label }) => {
                            const items = wcag22[key];
                            if (!items || items.length === 0) return null;
                            return (
                                <Box key={key} flexDirection="column" marginTop={1}>
                                    <Box>
                                        <Text color={colors.serious} bold>{label}</Text>
                                        <Text color="gray">  {items.length} instance{items.length !== 1 ? 's' : ''}</Text>
                                    </Box>
                                    {items.slice(0, 5).map((v: any, i: number) => (
                                        <Box key={i} marginLeft={2} flexDirection="column">
                                            <Text color="gray">{v.selector}</Text>
                                            <Text color="gray" dimColor>{v.description}</Text>
                                        </Box>
                                    ))}
                                    {items.length > 5 && (
                                        <Box marginLeft={2}><Text color="gray">...and {items.length - 5} more</Text></Box>
                                    )}
                                </Box>
                            );
                        })}
                        <Box marginTop={1}>
                            <Text color="gray">{'─'.repeat(60)}</Text>
                        </Box>
                    </Box>
                );
            })()}

            {/* Incomplete */}
            {incomplete && incomplete.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                    <Text bold>REVIEW  </Text>
                    <Text color="gray">{incomplete.length} items need manual review</Text>
                    {incomplete.slice(0, 5).map((item, i) => (
                        <Box key={i} marginLeft={2} marginTop={1} flexDirection="column">
                            <Text>{item.id}</Text>
                            <Text color="gray">{item.description}</Text>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Output files */}
            {(outputFile || aiPromptFile) && (
                <Box flexDirection="column" marginTop={1}>
                    {outputFile && <Text color="gray">json: {outputFile}</Text>}
                    {aiPromptFile && <Text color="gray">prompt: {aiPromptFile}</Text>}
                </Box>
            )}
        </Box>
    );
};

export default Results;
