// ─────────────────────────────────────────────────────────────
// GlassSurface.js — Reusable glass material container.
// Standardizes the frosted-glass aesthetic across the app.
// Uses BRAND.glass tokens for consistent appearance.
// No external blur library — uses layered opacity + shadows.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { View, StyleSheet } from 'react-native'
import { BRAND, RADIUS } from '../constants/tokens'

export default function GlassSurface({
  children,
  style,
  elevated = false,
  borderRadius = BRAND.glass.radius,
  accessibilityRole,
  accessibilityLabel,
}) {
  return (
    <View
      style={[
        glassStyles.container,
        {
          backgroundColor: elevated
            ? BRAND.glass.surfaceElevated
            : BRAND.glass.surface,
          borderRadius,
        },
        BRAND.glass.shadow,
        style,
      ]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      {/* Top specular highlight rim */}
      <View
        style={[
          glassStyles.specularRim,
          { borderTopLeftRadius: borderRadius, borderTopRightRadius: borderRadius },
        ]}
      />
      {/* Inner glow layer */}
      <View
        style={[
          glassStyles.innerGlow,
          { borderRadius },
        ]}
      />
      {/* 1px highlight rim */}
      <View
        style={[
          glassStyles.highlightRim,
          { borderRadius },
        ]}
      />
      {children}
    </View>
  )
}

const glassStyles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: BRAND.glass.border,
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: BRAND.glass.specular,
    zIndex: 1,
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 8,
    borderColor: BRAND.glass.innerGlow,
    zIndex: 0,
  },
  highlightRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0.5,
    borderColor: BRAND.glass.borderSubtle,
    zIndex: 0,
  },
})
