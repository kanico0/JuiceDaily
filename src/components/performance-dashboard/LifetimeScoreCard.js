// ─────────────────────────────────────────────────────────────
// LifetimeScoreCard.js — Secondary card showing the cumulative
// Lifetime Nutrition Score. Compact, understated design.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { TrendingUp } from 'lucide-react-native'
import GlassSurface from '../GlassSurface'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE } from '../../constants/tokens'

export default function LifetimeScoreCard({
  lifetime = 0,
  completedCycles = [],
  totalLifetimeScans = 0,
}) {
  const safeLifetime = typeof lifetime === 'number' && !isNaN(lifetime) ? lifetime : 0
  const cycleCount = Array.isArray(completedCycles) ? completedCycles.length : 0
  const safeScans = typeof totalLifetimeScans === 'number' ? totalLifetimeScans : 0

  return (
    <GlassSurface
      style={s.card}
      accessibilityRole="summary"
      accessibilityLabel={`Lifetime Nutrition Score: ${safeLifetime}`}
    >
      <View style={s.row}>
        <View style={s.iconWrap}>
          <TrendingUp size={18} color={BRAND.accent.chlorophyll} strokeWidth={1.8} />
        </View>
        <View style={s.textCol}>
          <Text style={s.label}>Lifetime Score</Text>
          <Text style={s.sublabel}>
            {cycleCount} cycle{cycleCount !== 1 ? 's' : ''} · {safeScans} scan{safeScans !== 1 ? 's' : ''}
          </Text>
        </View>
        <Text style={s.score}>{safeLifetime.toLocaleString()}</Text>
      </View>
    </GlassSurface>
  )
}

const s = StyleSheet.create({
  card: {
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.accentDim.chlorophyll,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACE.md,
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.primary,
    marginBottom: 2,
  },
  sublabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  score: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.heavy,
    color: BRAND.text.primary,
    letterSpacing: -0.5,
  },
})
