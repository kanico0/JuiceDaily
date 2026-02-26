// ─────────────────────────────────────────────────────────────
// WeekIngredientsList.js — Horizontal scrollable list of
// ingredients scanned in the rolling 7-day window. Shows
// produce name chips with subtle accent coloring.
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Sprout } from 'lucide-react-native'
import GlassSurface from '../GlassSurface'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE, RADIUS } from '../../constants/tokens'
import { PRODUCE_DATA } from '../../services/JuiceEngine'

function formatName(produceId) {
  const entry = PRODUCE_DATA[produceId]
  if (entry) return entry.name
  return produceId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function WeekIngredientsList({ activeCycle }) {
  const weekIngredients = useMemo(() => {
    const now = new Date()
    const windowStart = new Date(now)
    windowStart.setDate(windowStart.getDate() - 6)
    const startStr = windowStart.toISOString().split('T')[0]
    const endStr = now.toISOString().split('T')[0]

    const set = new Set()
    for (const log of (activeCycle?.logs || [])) {
      const logDate = log.timestamp.split('T')[0]
      if (logDate >= startStr && logDate <= endStr) {
        for (const id of log.ingredientIds) {
          set.add(id)
        }
      }
    }
    return Array.from(set).sort()
  }, [activeCycle])

  if (weekIngredients.length === 0) {
    return (
      <GlassSurface style={s.emptyCard} borderRadius={RADIUS.lg}>
        <Sprout size={20} color={BRAND.text.muted} strokeWidth={1.5} />
        <Text style={s.emptyText}>No ingredients this week</Text>
        <Text style={s.emptyHint}>Scan your first juice to start tracking</Text>
      </GlassSurface>
    )
  }

  return (
    <View>
      <View style={s.headerRow}>
        <Text style={s.sectionLabel}>This Week's Ingredients</Text>
        <Text style={s.countBadge}>{weekIngredients.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {weekIngredients.map((id) => (
          <View key={id} style={s.chip}>
            <View style={s.chipDot} />
            <Text style={s.chipText}>{formatName(id)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACE.md,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flex: 1,
  },
  countBadge: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.accent.chlorophyll,
    backgroundColor: BRAND.accentDim.chlorophyll,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingRight: SPACE.lg,
    gap: SPACE.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.glass.surface,
    borderWidth: 0.5,
    borderColor: BRAND.glass.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.accent.chlorophyll,
    marginRight: SPACE.sm,
    opacity: 0.6,
  },
  chipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.primary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: SPACE.xxl,
    paddingHorizontal: SPACE.xl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.secondary,
    marginTop: SPACE.md,
    marginBottom: SPACE.xs,
  },
  emptyHint: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
})
