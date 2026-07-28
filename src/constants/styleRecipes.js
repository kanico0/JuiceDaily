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

// ─────────────────────────────────────────────────────────────
// Phase 0C3 — Screen Hierarchy Recipes
// Narrow extensions for screen-level typography, card levels,
// button touch targets, and spacing consistency.
// Not a component framework — just reusable style objects.
// ─────────────────────────────────────────────────────────────

// ── Screen Layout ─────────────────────────────────────────────

export const screenHeader = {
  paddingHorizontal: SEMANTIC_SPACE.xl,
  paddingTop: SEMANTIC_SPACE.lg,
  paddingBottom: SEMANTIC_SPACE.md,
}

export const scrollContentPadding = {
  paddingHorizontal: SEMANTIC_SPACE.xl,
  paddingBottom: SEMANTIC_SPACE.xxl,
}

export const sectionGap = {
  marginBottom: SEMANTIC_SPACE.lg,
}

// ── Typography Roles ──────────────────────────────────────────

export const screenTitle = {
  fontSize: SEMANTIC_TYPOGRAPHY.screenTitle.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
  color: SEMANTIC_COLORS.textPrimary,
  letterSpacing: -0.5,
}

export const greeting = {
  fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
  color: SEMANTIC_COLORS.textSecondary,
}

export const eyebrow = {
  fontSize: SEMANTIC_TYPOGRAPHY.metadata.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.metadata.fontWeight,
  color: SEMANTIC_COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

export const sectionTitle = {
  fontSize: SEMANTIC_TYPOGRAPHY.sectionTitle.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.sectionTitle.fontWeight,
  color: SEMANTIC_COLORS.textPrimary,
}

// ── Card Hierarchy — Three Intentional Levels ─────────────────

// LEVEL 1 — Primary Feature: raised surface, subtle shadow, generous padding
export const primaryFeatureCard = {
  backgroundColor: SEMANTIC_COLORS.surfaceRaised,
  borderRadius: SEMANTIC_RADIUS.large,
  borderWidth: 0.5,
  borderColor: SEMANTIC_COLORS.borderStrong,
  paddingVertical: SEMANTIC_SPACE.lg,
  paddingHorizontal: SEMANTIC_SPACE.xl,
  ...SEMANTIC_SHADOWS.card,
}

// LEVEL 2 — Standard Card: standard surface, no shadow (alias of `card`)
export const standardCard = card

// LEVEL 3 — Compact Supporting: muted surface, smaller radius, minimal padding
export const compactSupportingCard = {
  backgroundColor: SEMANTIC_COLORS.surfaceMuted,
  borderRadius: SEMANTIC_RADIUS.medium,
  borderWidth: 0.5,
  borderColor: SEMANTIC_COLORS.borderSubtle,
  paddingVertical: SEMANTIC_SPACE.sm,
  paddingHorizontal: SEMANTIC_SPACE.md,
}

// ── Button Consistency ────────────────────────────────────────

// Compact text action — 44dp minimum effective target
export const compactTextAction = {
  minHeight: 44,
  justifyContent: 'center',
  alignItems: 'center',
  paddingVertical: SEMANTIC_SPACE.sm,
  paddingHorizontal: SEMANTIC_SPACE.lg,
}

export const compactTextActionLabel = {
  fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
  color: SEMANTIC_COLORS.textMuted,
}

// Icon-only action — 44dp minimum, requires accessibilityLabel
export const iconOnlyAction = {
  width: 44,
  height: 44,
  borderRadius: SEMANTIC_RADIUS.circular,
  backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
  justifyContent: 'center',
  alignItems: 'center',
}

// ── Status Pill (alias of `pill` with semantic naming) ────────
export const statusPill = pill

// ── Metadata Row ──────────────────────────────────────────────
export const metadataRow = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: SEMANTIC_SPACE.sm,
  paddingVertical: SEMANTIC_SPACE.xs,
}
