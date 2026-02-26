// ─────────────────────────────────────────────────────────────
// LiquidGlassSurface.js — Reusable liquid glass card wrapper
// Applies glassmorphism surface with specular highlight,
// liquid shadow, and subtle inner glow.
// Gated behind ff_liquid_surfaces feature flag.
// Falls back to standard GLASS styling when flag is off.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { GLASS, LIQUID_GLASS, RADIUS, SPACE } from '../constants/tokens'
import { useFlags } from '../services/FeatureFlags'

export default function LiquidGlassSurface({ children, style, noPadding }) {
  const { isEnabled } = useFlags()
  const isLiquid = isEnabled('ff_liquid_surfaces')

  if (!isLiquid) {
    return (
      <View style={[styles.fallback, style]}>
        {children}
      </View>
    )
  }

  return (
    <View style={[styles.outer, LIQUID_GLASS.liquidShadow, style]}>
      <LinearGradient
        colors={[
          LIQUID_GLASS.glassSurface,
          'rgba(18,22,28,0.88)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, !noPadding && styles.padding]}
      >
        {/* Top specular highlight */}
        <View style={styles.specular} />
        {/* Inner glow edge */}
        <View style={styles.innerGlow} />
        {children}
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: GLASS.background,
    borderRadius: GLASS.borderRadius,
    borderWidth: 0.5,
    borderColor: GLASS.border,
  },
  outer: {
    borderRadius: LIQUID_GLASS.borderRadius,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: LIQUID_GLASS.glassBorder,
  },
  gradient: {
    borderRadius: LIQUID_GLASS.borderRadius,
    position: 'relative',
    overflow: 'hidden',
  },
  padding: {
    padding: SPACE.lg,
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: LIQUID_GLASS.subtleSpecular,
  },
  innerGlow: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: LIQUID_GLASS.innerGlow,
    opacity: 0.5,
  },
})
