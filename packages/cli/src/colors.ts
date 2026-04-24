/**
 * Severity-only color palette. Non-severity text uses the terminal default
 * (or `muted` for secondary text) so the output reads as black-and-white
 * with colored severity as the only signal.
 */

export const colors = {
    critical: '#EF5350',    // Red 400 - critical issues
    serious: '#FFA726',     // Orange 400 - serious/warnings
    moderate: '#42A5F5',    // Blue 400 - moderate issues
    minor: '#BDBDBD',       // Gray 400 - minor issues

    muted: 'gray',          // Secondary text
};

export const impactColors: Record<string, string> = {
    critical: colors.critical,
    serious: colors.serious,
    moderate: colors.moderate,
    minor: colors.minor,
};
