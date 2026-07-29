import { SEMANTIC_COLORS, SEMANTIC_TYPOGRAPHY, SEMANTIC_SPACE, SEMANTIC_RADIUS } from './tokens'

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
