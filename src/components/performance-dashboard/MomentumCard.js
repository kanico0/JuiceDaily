// ─────────────────────────────────────────────────────────────
// MomentumCard.js — Primary visual focus on the Performance
// Dashboard. Shows Nutrition Momentum (0–1000), progress bar,
// weekly delta, cycle days remaining. Tappable → breakdown modal.
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import GlassSurface from '../GlassSurface'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE, RADIUS } from '../../constants/tokens'
import { MAX_MOMENTUM } from '../../services/NutritionScoreEngine'

export default function MomentumCard({
  momentum = 0,
  breakdown = null,
  cycleProgress = {},
  weeklyActivity = null,
  onPress,
}) {
  const safeMomentum = typeof momentum === 'number' && !isNaN(momentum) ? momentum : 0

  const progressPct = useMemo(
    () => Math.min(safeMomentum / MAX_MOMENTUM, 1),
    [safeMomentum]
  )

  const weeklyDelta = weeklyActivity?.scanCount || 0
  const daysRemaining = cycleProgress?.daysRemaining ?? 0
  const logCount = cycleProgress?.logCount ?? 0

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Nutrition Momentum ${momentum} of ${MAX_MOMENTUM}. Tap for breakdown.`}
    >
      <GlassSurface elevated style={s.card}>
        {/* Header row */}
        <View style={s.headerRow}>
          <Text style={s.label}>Nutrition Momentum</Text>
          <View style={s.chevronWrap}>
            <ChevronRight size={16} color={BRAND.text.muted} strokeWidth={2} />
          </View>
        </View>

        {/* Score */}
        <View style={s.scoreRow}>
          <Text style={s.score}>{safeMomentum}</Text>
          <Text style={s.scoreMax}>/ {MAX_MOMENTUM}</Text>
        </View>

        {/* Progress bar */}
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${progressPct * 100}%` }]} />
        </View>

        {/* Meta row */}
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Text style={s.metaValue}>
              {weeklyDelta > 0 ? `+${weeklyDelta}` : '0'}
            </Text>
            <Text style={s.metaLabel}>this week</Text>
          </View>
          <View style={s.metaDivider} />
          <View style={s.metaItem}>
            <Text style={s.metaValue}>{daysRemaining}</Text>
            <Text style={s.metaLabel}>days left</Text>
          </View>
          <View style={s.metaDivider} />
          <View style={s.metaItem}>
            <Text style={s.metaValue}>{logCount}</Text>
            <Text style={s.metaLabel}>scans</Text>
          </View>
        </View>
      </GlassSurface>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.xs,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACE.lg,
  },
  score: {
    fontSize: 56,
    fontWeight: FONT_WEIGHT.heavy,
    color: BRAND.text.primary,
    letterSpacing: -2,
    lineHeight: 62,
  },
  scoreMax: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    marginLeft: SPACE.sm,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: SPACE.lg,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: BRAND.cta.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  metaDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
})
