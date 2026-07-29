import { SEMANTIC_COLORS, SEMANTIC_TYPOGRAPHY, SEMANTIC_SPACE, SEMANTIC_RADIUS } from './tokens'

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

export const screenHeader = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: SEMANTIC_SPACE.lg,
  paddingVertical: SEMANTIC_SPACE.sm,
}

export const scrollContentPadding = {
  paddingHorizontal: SEMANTIC_SPACE.lg,
  paddingBottom: SEMANTIC_SPACE.xl,
}

export const screenTitle = {
  fontSize: SEMANTIC_TYPOGRAPHY.screenTitle.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
  color: SEMANTIC_COLORS.textPrimary,
  letterSpacing: -0.3,
}

export const greeting = {
  fontSize: SEMANTIC_TYPOGRAPHY.screenTitle.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
  color: SEMANTIC_COLORS.textPrimary,
  letterSpacing: -0.3,
}

export const eyebrow = {
  fontSize: SEMANTIC_TYPOGRAPHY.metadata.fontSize,
  fontWeight: SEMANTIC_TYPOGRAPHY.metadata.fontWeight,
  color: SEMANTIC_COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

export const iconOnlyAction = {
  width: 36,
  height: 36,
  borderRadius: SEMANTIC_RADIUS.medium,
  backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
  alignItems: 'center',
  justifyContent: 'center',
}

export const standardCard = {
  backgroundColor: SEMANTIC_COLORS.surface,
  borderRadius: SEMANTIC_RADIUS.card,
  borderWidth: 0.5,
  borderColor: SEMANTIC_COLORS.borderStrong,
  paddingVertical: SEMANTIC_SPACE.md,
  paddingHorizontal: SEMANTIC_SPACE.lg,
}

export const compactSupportingCard = {
  backgroundColor: SEMANTIC_COLORS.surfaceMuted,
  borderRadius: SEMANTIC_RADIUS.medium,
  borderWidth: 0.5,
  borderColor: SEMANTIC_COLORS.borderSubtle,
  paddingVertical: SEMANTIC_SPACE.sm,
  paddingHorizontal: SEMANTIC_SPACE.md,
}
