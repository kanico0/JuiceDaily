import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS, SEMANTIC_TYPOGRAPHY, SEMANTIC_SHADOWS } from '../constants/tokens'

// ─────────────────────────────────────────────────────────────
// styleRecipes.js — Small reusable style objects for common
// card, button, and layout patterns. Not a component framework.
// Import SEMANTIC tokens from the canonical source.
// ─────────────────────────────────────────────────────────────

export const card = {
  backgroundColor: SEMANTIC_COLORS.surface,
  borderRadius: SEMANTIC_RADIUS.card,
  borderWidth: 0.5,
  borderColor: SEMANTIC_COLORS.borderStrong,
  paddingVertical: SEMANTIC_SPACE.md,
  paddingHorizontal: SEMANTIC_SPACE.lg,
}

export const compactCard = {
  backgroundColor: SEMANTIC_COLORS.surface,
  borderRadius: SEMANTIC_RADIUS.card,
  borderWidth: 0.5,
  borderColor: SEMANTIC_COLORS.borderStrong,
  paddingVertical: SEMANTIC_SPACE.sm,
  paddingHorizontal: SEMANTIC_SPACE.md,
}

export const sectionHeading = {
  fontSize: SEMANTIC_TYPOGRAPHY.metadata.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.metadata.fontWeight,
  color: SEMANTIC_COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

export const primaryAction = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  borderRadius: SEMANTIC_RADIUS.medium,
  backgroundColor: SEMANTIC_COLORS.accentPrimary,
  paddingHorizontal: SEMANTIC_SPACE.lg,
  paddingVertical: SEMANTIC_SPACE.md,
}

export const primaryActionLabel = {
  fontSize: SEMANTIC_TYPOGRAPHY.buttonLabel.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.buttonLabel.fontWeight,
  color: SEMANTIC_COLORS.textOnAccent,
}

export const secondaryAction = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  borderRadius: SEMANTIC_RADIUS.medium,
  borderWidth: 1,
  borderColor: SEMANTIC_COLORS.borderStrong,
  backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
  paddingHorizontal: SEMANTIC_SPACE.lg,
  paddingVertical: SEMANTIC_SPACE.md,
}

export const secondaryActionLabel = {
  fontSize: SEMANTIC_TYPOGRAPHY.buttonLabel.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.buttonLabel.fontWeight,
  color: SEMANTIC_COLORS.textMuted,
}

export const pill = {
  paddingVertical: SEMANTIC_SPACE.xs,
  paddingHorizontal: SEMANTIC_SPACE.sm,
  borderRadius: SEMANTIC_RADIUS.pill,
  backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
  borderWidth: 0.5,
  borderColor: SEMANTIC_COLORS.borderStrong,
}

export const screenPadding = {
  paddingHorizontal: SEMANTIC_SPACE.xl,
}
