// ─────────────────────────────────────────────────────────────
// PerformanceRow.js — Compact horizontal row showing three
// key performance metrics: Streak, Ingredient Count, Nutrient
// Coverage. Each metric in its own glass cell.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Flame, Leaf, Beaker } from 'lucide-react-native'
import GlassSurface from '../GlassSurface'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE, RADIUS } from '../../constants/tokens'

function MetricCell({ icon: Icon, iconColor, value, label, dimColor }) {
  return (
    <GlassSurface style={s.cell} borderRadius={RADIUS.lg}>
      <View style={[s.iconDot, { backgroundColor: dimColor }]}>
        <Icon size={14} color={iconColor} strokeWidth={2} />
      </View>
      <Text style={s.cellValue}>{value}</Text>
      <Text style={s.cellLabel}>{label}</Text>
    </GlassSurface>
  )
}

export default function PerformanceRow({ streak = {}, diversity = {}, coverage = {} }) {
  return (
    <View style={s.row}>
      <MetricCell
        icon={Flame}
        iconColor={BRAND.accent.vitaminA}
        dimColor={BRAND.accentDim.vitaminA}
        value={`${streak?.currentCycleStreak ?? 0}d`}
        label="Streak"
      />
      <MetricCell
        icon={Leaf}
        iconColor={BRAND.accent.chlorophyll}
        dimColor={BRAND.accentDim.chlorophyll}
        value={diversity?.cycleUnique ?? 0}
        label="Ingredients"
      />
      <MetricCell
        icon={Beaker}
        iconColor={BRAND.accent.potassium}
        dimColor={BRAND.accentDim.potassium}
        value={`${coverage?.cycleNutrients ?? 0}/8`}
        label="Nutrients"
      />
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACE.sm,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.sm,
  },
  iconDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
  cellValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    marginBottom: 2,
  },
  cellLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
})
