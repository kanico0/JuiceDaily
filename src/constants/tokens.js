// ─────────────────────────────────────────────────────────────
// tokens.js — Design tokens: typography, spacing, radii,
// shadows, and extended color palette for liquid-flow UI.
// Import alongside colors.js for full design system coverage.
// ─────────────────────────────────────────────────────────────

// ── Typography ───────────────────────────────────────────────

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  hero: 32,
}

export const FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
}

export const LINE_HEIGHT = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
}

// ── Spacing Scale (4px base) ─────────────────────────────────

export const SPACE = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
}

// ── Border Radii ─────────────────────────────────────────────
// Liquid-flow aesthetic: minimum 24 for cards/modals

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 999,
}

// ── Shadows ──────────────────────────────────────────────────

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#81C784',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
}

// ── Extended Palette (dark theme) ────────────────────────────
// Supplements colors.js for the liquid-flow dark UI

export const DARK = {
  bg: '#0D1117',
  surface: '#161B22',
  surfaceElevated: '#1C2128',
  border: 'rgba(255,255,255,0.06)',
  borderSubtle: 'rgba(255,255,255,0.03)',
  textPrimary: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#484F58',
  green: '#81C784',
  greenDim: 'rgba(129,199,132,0.15)',
  orange: '#FFB74D',
  orangeDim: 'rgba(255,183,77,0.15)',
  red: '#E91E63',
  redDim: 'rgba(233,30,99,0.10)',
  blue: '#64B5F6',
  blueDim: 'rgba(100,181,246,0.15)',
  gold: '#FFD54F',
  goldDim: 'rgba(255,213,79,0.15)',
}

// ── Brand Color System ──────────────────────────────────────
// Single source of truth for the Precision Wellness identity.

export const BRAND = {
  // ── Foundation Layer ──
  background: {
    primary: '#060D0A',
    secondary: '#0D1510',
    tertiary: '#131E17',
  },
  glass: {
    surface: 'rgba(13,21,16,0.65)',
    surfaceElevated: 'rgba(19,30,23,0.78)',
    highlight: 'rgba(129,199,132,0.06)',
    border: 'rgba(255,255,255,0.08)',
    borderSubtle: 'rgba(255,255,255,0.04)',
    specular: 'rgba(255,255,255,0.04)',
    innerGlow: 'rgba(255,255,255,0.03)',
    blur: 50,
    radius: RADIUS.xl,
    shadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  text: {
    primary: '#E8EDE9',
    secondary: '#B0BEC5',
    muted: '#90A4AE',
    inverse: '#060D0A',
  },
  // ── CTA Layer ──
  cta: {
    primary: '#3D8B40',
    gradient: ['#43A047', '#2E7D32', '#1B5E20'],
    pressed: '#2E6B30',
    shadow: '#2E7D32',
  },
  // ── Nutrient Accent Layer ──
  // Richer than CTA. Only appear post-scan and in data views.
  accent: {
    vitaminC: '#F9A825',
    iron: '#EF5350',
    antioxidant: '#AB47BC',
    chlorophyll: '#66BB6A',
    potassium: '#42A5F5',
    vitaminA: '#FF7043',
    folate: '#26C6DA',
    magnesium: '#7E57C2',
  },
  // Dimmed versions for backgrounds/badges (12% opacity)
  accentDim: {
    vitaminC: 'rgba(249,168,37,0.12)',
    iron: 'rgba(239,83,80,0.12)',
    antioxidant: 'rgba(171,71,188,0.12)',
    chlorophyll: 'rgba(102,187,106,0.12)',
    potassium: 'rgba(66,165,245,0.12)',
    vitaminA: 'rgba(255,112,67,0.12)',
    folate: 'rgba(38,198,218,0.12)',
    magnesium: 'rgba(126,87,194,0.12)',
  },
}

// ── Glass Effect (legacy — prefer BRAND.glass) ──────────────

export const GLASS = {
  background: 'rgba(22,27,34,0.85)',
  border: 'rgba(255,255,255,0.08)',
  borderRadius: RADIUS.xl,
}

// ── Liquid Glass Surface Tokens ─────────────────────────────
// Extended glass tokens for the Liquid UX system (Step 2).
// Gated behind ff_liquid_surfaces feature flag.

export const LIQUID_GLASS = {
  glassSurface: 'rgba(22,27,34,0.78)',
  glassBorder: 'rgba(255,255,255,0.10)',
  subtleSpecular: 'rgba(255,255,255,0.04)',
  liquidShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  innerGlow: 'rgba(255,255,255,0.03)',
  borderRadius: RADIUS.xl,
  blurIntensity: 50,
}

// ── Accessibility Contrast ───────────────────────────────────
// Minimum contrast ratios (WCAG 2.2)

export const A11Y = {
  minContrastText: 4.5,
  minContrastLargeText: 3.0,
  minContrastUI: 3.0,
}

// ─────────────────────────────────────────────────────────────
// Semantic Design System (Phase 0C1)
// One canonical source for semantic visual tokens.
// Primitive exports above (FONT_SIZE, SPACE, RADIUS, etc.) remain
// for backward compatibility — components may import either.
// Future visual phases should reference SEMANTIC tokens exclusively.
// ─────────────────────────────────────────────────────────────

// ── Semantic Colors ───────────────────────────────────────────
// Maps to current dark-theme values to preserve appearance.
// Future "Calm Premium Vitality" palette can update these mappings
// without touching component code.

export const SEMANTIC_COLORS = {
  canvas: BRAND.background.primary,
  canvasDeep: BRAND.background.secondary,
  surface: 'rgba(255,255,255,0.04)',
  surfaceRaised: BRAND.glass.surfaceElevated,
  surfaceInteractive: 'rgba(255,255,255,0.06)',
  surfaceMuted: 'rgba(255,255,255,0.03)',
  borderSubtle: 'rgba(255,255,255,0.04)',
  borderStrong: 'rgba(255,255,255,0.08)',
  textPrimary: BRAND.text.primary,
  textSecondary: BRAND.text.secondary,
  textMuted: BRAND.text.muted,
  textOnAccent: '#FFFFFF',
  accentPrimary: BRAND.cta.primary,
  accentPrimaryPressed: BRAND.cta.pressed,
  accentSecondary: '#64B5F6',
  success: '#81C784',
  warning: '#FFB74D',
  danger: '#E91E63',
  focusRing: 'rgba(100,181,246,0.4)',
  overlay: 'rgba(0,0,0,0.7)',
}

// ── Semantic Spacing ──────────────────────────────────────────
// Maps to existing SPACE scale for backward compatibility.

export const SEMANTIC_SPACE = {
  xs: SPACE.xs,
  sm: SPACE.sm,
  md: SPACE.md,
  lg: SPACE.lg,
  xl: SPACE.xl,
  xxl: SPACE.xxl,
  xxxl: SPACE.xxxl,
}

// ── Semantic Radii ────────────────────────────────────────────

export const SEMANTIC_RADIUS = {
  small: RADIUS.sm,
  medium: RADIUS.md,
  large: RADIUS.lg,
  card: RADIUS.lg,
  pill: RADIUS.pill,
  circular: RADIUS.pill,
}

// ── Semantic Typography Roles ─────────────────────────────────
// Each role defines fontSize, fontWeight, and lineHeight.
// No new font family introduced.

export const SEMANTIC_TYPOGRAPHY = {
  screenTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: LINE_HEIGHT.tight * FONT_SIZE.xxl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: LINE_HEIGHT.normal * FONT_SIZE.md,
  },
  cardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: LINE_HEIGHT.normal * FONT_SIZE.md,
  },
  body: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    lineHeight: LINE_HEIGHT.normal * FONT_SIZE.sm,
  },
  bodyStrong: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: LINE_HEIGHT.normal * FONT_SIZE.sm,
  },
  caption: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    lineHeight: LINE_HEIGHT.normal * FONT_SIZE.xs,
  },
  metadata: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: LINE_HEIGHT.normal * FONT_SIZE.xs,
  },
  buttonLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: LINE_HEIGHT.normal * FONT_SIZE.sm,
  },
  numericEmphasis: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: LINE_HEIGHT.tight * FONT_SIZE.xl,
  },
}

// ── Semantic Shadows / Elevation ──────────────────────────────

export const SEMANTIC_SHADOWS = {
  card: SHADOW.sm,
  floatingAction: SHADOW.md,
  modal: SHADOW.lg,
}

// ── Semantic Motion Durations ─────────────────────────────────
// Maps to existing DURATION presets from motion.js.
// Re-exported here for single-source discovery.

export const SEMANTIC_MOTION = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 450,
}
