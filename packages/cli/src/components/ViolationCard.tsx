import React from "react";
import { Box, Text } from "ink";
import type { AttributedViolation } from "@accessibility-toolkit/core";
import {
  generateContextualFix,
  hasContextualSupport,
} from "@accessibility-toolkit/core";
import { colors, impactColors } from "../colors.js";

interface ViolationCardProps {
  violation: AttributedViolation;
  index: number;
}

export const ViolationCard: React.FC<ViolationCardProps> = ({
  violation,
  index,
}) => {
  // Use accessible color palette
  const impactColor = impactColors[violation.impact] || colors.muted;

  // Check if we have contextual support for this violation
  const hasContextual = hasContextualSupport(violation.id);

  return (
    <Box flexDirection="column" marginTop={1} padding={1}>
      {/* Separator */}
      <Box marginBottom={1}>
        <Text color="gray">
          ──────────────────────────────────────────────────
        </Text>
      </Box>

      {/* Header */}
      <Box justifyContent="space-between">
        <Box>
          <Text color={colors.muted}>{index}. </Text>
          <Text bold color={colors.accent}>
            {violation.id}
          </Text>
        </Box>
        <Box>
          <Text
            bold
            color={impactColor}
            backgroundColor={impactColor === "yellow" ? undefined : undefined}
          >
            {" " + violation.impact.toUpperCase() + " "}
          </Text>
        </Box>
      </Box>

      {/* WCAG Criteria - Show enriched data if available, fallback to tags */}
      {violation.wcagCriteria && violation.wcagCriteria.length > 0 ? (
        <Box marginTop={1} flexDirection="row" gap={1} flexWrap="wrap">
          {violation.wcagCriteria.slice(0, 3).map((criterion, i) => {
            const levelColor =
              criterion.level === "AAA"
                ? colors.moderate
                : criterion.level === "AA"
                ? colors.serious
                : colors.critical;
            return (
              <Text key={i} color={levelColor}>
                [{criterion.id} {criterion.title}] [{criterion.level}]
              </Text>
            );
          })}
          {violation.wcagCriteria.length > 0 && (
            <Text color={colors.muted} dimColor>
              [{violation.wcagCriteria[0].principle}]
            </Text>
          )}
        </Box>
      ) : (
        violation.tags &&
        violation.tags.length > 0 && (
          <Box marginTop={1} flexDirection="row" gap={1}>
            {violation.tags
              .filter((tag) => tag.startsWith("wcag") || tag === "best-practice")
              .slice(0, 4)
              .map((tag, i) => {
                const isWcagA = tag === "wcag2a" || tag === "wcag21a";
                const isWcagAA = tag.includes("aa") && !tag.includes("aaa");
                const isWcagAAA = tag.includes("aaa");
                const color = isWcagAAA
                  ? colors.moderate
                  : isWcagAA
                  ? colors.serious
                  : isWcagA
                  ? colors.critical
                  : colors.muted;
                return (
                  <Text key={i} color={color} dimColor>
                    [{tag}]
                  </Text>
                );
              })}
          </Box>
        )
      )}

      {/* Description */}
      <Box marginTop={1}>
        <Text>{violation.description}</Text>
      </Box>

      {/* Help URL - Link to axe-core docs */}
      {violation.helpUrl && (
        <Box marginTop={1}>
          <Text color={colors.muted}>Docs: </Text>
          <Text color={colors.accent} underline>
            {violation.helpUrl}
          </Text>
        </Box>
      )}

      {/* Fix Suggestion - summary only, no generic code examples */}
      {violation.fixSuggestion && (
        <Box marginTop={1} flexDirection="column" paddingLeft={1}>
          <Text color={colors.success} bold>
            How to Fix:
          </Text>
          <Text>{violation.fixSuggestion.summary}</Text>
          {violation.fixSuggestion.userImpact && (
            <Box marginTop={1}>
              <Text color="gray" dimColor>
                Impact: {violation.fixSuggestion.userImpact}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Instances Summary */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Found in {violation.nodes.length} instance
          {violation.nodes.length !== 1 ? "s" : ""}:
        </Text>
      </Box>

      {/* List all instances with contextual fixes */}
      <Box flexDirection="column" marginLeft={2}>
        {violation.nodes.map((node, i) => {
          // Extract the nearest React component from the path
          const rawPath =
            node.userComponentPath && node.userComponentPath.length > 0
              ? node.userComponentPath
              : node.componentPath || [];

          const filteredPath = rawPath.filter((name) => {
            if (name.length <= 2) return false; // Filter minified
            if (name.includes("Anonymous")) return false;
            if (name.startsWith("__")) return false;
            return true;
          });

          const componentName =
            filteredPath.length > 0
              ? filteredPath[filteredPath.length - 1]
              : node.component && node.component.length > 2
              ? node.component
              : "Unknown Component";

          // Generate contextual fix for this instance
          const contextualFix = hasContextual
            ? generateContextualFix(violation.id, {
                html: node.html,
                htmlSnippet: node.htmlSnippet ?? node.html,
                component: node.component ?? null,
                componentPath: node.componentPath ?? [],
                failureSummary: node.failureSummary,
                checks: node.checks,
              })
            : null;

          const source = (node as any).source;
          const sourceStack = (node as any).sourceStack as Array<{ filePath: string; lineNumber?: number | null; columnNumber?: number | null; componentName?: string | null }> | undefined;
          const sourceLoc = source?.filePath
            ? source.filePath + (source.lineNumber ? ':' + source.lineNumber : '') + (source.columnNumber ? ':' + source.columnNumber : '')
            : null;

          return (
            <Box key={i} flexDirection="column" marginTop={1}>
              {/* Source + component on one line */}
              <Box>
                <Text color="gray">• </Text>
                {sourceLoc ? (
                  <>
                    <Text color={colors.accent} bold>{sourceLoc}</Text>
                    <Text color="gray"> in </Text>
                    <Text color={colors.highlight} bold>{componentName}</Text>
                  </>
                ) : (
                  <Text color={colors.highlight} bold>{componentName}</Text>
                )}
              </Box>

              {/* Selector on its own line */}
              {node.cssSelector && (
                <Box marginLeft={2}>
                  <Text color="gray" dimColor>{node.cssSelector}</Text>
                </Box>
              )}

              {/* Source stack */}
              {sourceStack && sourceStack.length > 1 && (
                <Box flexDirection="column" marginLeft={2}>
                  {sourceStack.slice(0, 4).map((frame, j) => {
                    const frameLoc = frame.filePath + (frame.lineNumber ? ':' + frame.lineNumber : '');
                    const name = frame.componentName && frame.componentName.length > 2 ? frame.componentName + ' ' : '';
                    return (
                      <Text key={j} color="gray" dimColor>
                        {name}{frameLoc}
                      </Text>
                    );
                  })}
                </Box>
              )}

              {/* Contextual fix - Current element */}
              {contextualFix && (
                <Box flexDirection="column" marginLeft={2} marginTop={1}>
                  {/* Current HTML */}
                  <Box flexDirection="column">
                    <Text color="gray">Current:</Text>
                    <Box marginLeft={2}>
                      <Text color={colors.critical} dimColor>
                        {truncateHtml(contextualFix.current, 70)}
                      </Text>
                    </Box>
                  </Box>

                  {/* What's missing */}
                  <Box marginTop={1}>
                    <Text color="gray">Missing: </Text>
                    <Text>{contextualFix.issue}</Text>
                  </Box>

                  {/* Suggested fix */}
                  {contextualFix.fixed && (
                    <Box flexDirection="column" marginTop={1}>
                      <Text color="gray">Suggested:</Text>
                      <Box marginLeft={2}>
                        <Text color={colors.success}>
                          {truncateHtml(contextualFix.fixed, 70)}
                        </Text>
                      </Box>
                    </Box>
                  )}

                  {/* React suggestion for first instance only */}
                  {i === 0 && contextualFix.reactSuggestion && (
                    <Box flexDirection="column" marginTop={1}>
                      <Text color="gray">React/JSX:</Text>
                      <Box marginLeft={2} flexDirection="column">
                        {contextualFix.reactSuggestion
                          .split("\n")
                          .slice(0, 3)
                          .map((line, j) => (
                            <Text key={j} color={colors.info} dimColor>
                              {line}
                            </Text>
                          ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * Truncate HTML to fit display width
 */
function truncateHtml(html: string | undefined | null, maxLength: number): string {
  if (!html) return "";
  if (html.length <= maxLength) {
    return html;
  }
  return html.substring(0, maxLength - 3) + "...";
}
