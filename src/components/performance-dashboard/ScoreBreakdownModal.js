// ─────────────────────────────────────────────────────────────
// ScoreBreakdownModal.js — Full-screen modal showing the
// transparent score breakdown for all 4 Momentum dimensions.
// Opened by tapping the MomentumCard.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import GlassSurface from '../GlassSurface'
import MeshGradientBg from '../MeshGradientBg'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE, RADIUS } from '../../constants/tokens'
import { MAX_MOMENTUM } from '../../services/NutritionScoreEngine'

// Accent colors per dimension for visual differentiation
const DIMENSION_COLORS = {
  ingredientDiversity: BRAND.accent.chlorophyll,
  nutrientCoverage: BRAND.accent.potassium,
  consistency: BRAND.accent.vitaminA,
  weeklyActivity: BRAND.accent.vitaminC,
}

const DIMENSION_DIM_COLORS = {
  ingredientDiversity: BRAND.accentDim.chlorophyll,
  nutrientCoverage: BRAND.accentDim.potassium,
  consistency: BRAND.accentDim.vitaminA,
  weeklyActivity: BRAND.accentDim.vitaminC,
}

function DimensionRow({ dimensionKey, dimension }) {
  if (!dimension) return null
  const accentColor = DIMENSION_COLORS[dimensionKey] || BRAND.text.secondary
  const dimColor = DIMENSION_DIM_COLORS[dimensionKey] || 'rgba(255,255,255,0.06)'
  const pct = Math.round((dimension.normalized || 0) * 100)

  return (
    <GlassSurface style={s.dimCard} borderRadius={RADIUS.lg}>
      {/* Header */}
      <View style={s.dimHeader}>
        <Text style={s.dimLabel}>{dimension.label}</Text>
        <View style={[s.weightBadge, { backgroundColor: dimColor }]}>
          <Text style={[s.weightText, { color: accentColor }]}>
            {Math.round(dimension.weight * 100)}%
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.dimBarTrack}>
        <View
          style={[
            s.dimBarFill,
            { width: `${pct}%`, backgroundColor: accentColor },
          ]}
        />
      </View>

      {/* Stats row */}
      <View style={s.dimStatsRow}>
        <Text style={s.dimRaw}>
          {dimension.raw} / {dimension.maxPossible}
        </Text>
        <Text style={[s.dimContribution, { color: accentColor }]}>
          +{Math.round(dimension.weighted)}
        </Text>
      </View>
    </GlassSurface>
  )
}

export default function ScoreBreakdownModal({ visible, onClose, breakdown, momentum }) {
  if (!breakdown) return null

  const dimensions = [
    { key: 'ingredientDiversity', data: breakdown.ingredientDiversity },
    { key: 'nutrientCoverage', data: breakdown.nutrientCoverage },
    { key: 'consistency', data: breakdown.consistency },
    { key: 'weeklyActivity', data: breakdown.weeklyActivity },
  ]

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={s.root}>
        <MeshGradientBg />
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerTextCol}>
              <Text style={s.headerTitle}>Score Breakdown</Text>
              <Text style={s.headerSubtitle}>How your Momentum is calculated</Text>
            </View>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color={BRAND.text.muted} />
            </TouchableOpacity>
          </View>

          {/* Total score */}
          <View style={s.totalRow}>
            <Text style={s.totalScore}>{momentum}</Text>
            <Text style={s.totalMax}>/ {MAX_MOMENTUM}</Text>
          </View>

          {/* Dimension cards */}
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {dimensions.map(({ key, data }) => (
              <DimensionRow key={key} dimensionKey={key} dimension={data} />
            ))}

            {/* Formula explanation */}
            <GlassSurface style={s.formulaCard} borderRadius={RADIUS.lg}>
              <Text style={s.formulaTitle}>Calculation</Text>
              <Text style={s.formulaText}>
                Each dimension is normalized (0–1), multiplied by its weight, then scaled to {MAX_MOMENTUM}.
              </Text>
              <Text style={s.formulaCode}>
                Momentum = Σ(normalized × weight) × {MAX_MOMENTUM}
              </Text>
            </GlassSurface>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.background.primary,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.sm,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.xl,
  },
  totalScore: {
    fontSize: 48,
    fontWeight: FONT_WEIGHT.heavy,
    color: BRAND.text.primary,
    letterSpacing: -2,
  },
  totalMax: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    marginLeft: SPACE.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xxxl,
    gap: SPACE.md,
  },
  dimCard: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
  },
  dimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.md,
  },
  dimLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.primary,
  },
  weightBadge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  weightText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  dimBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: SPACE.md,
  },
  dimBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  dimStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dimRaw: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  dimContribution: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  formulaCard: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    marginTop: SPACE.sm,
  },
  formulaTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: SPACE.sm,
  },
  formulaText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    lineHeight: 20,
    marginBottom: SPACE.sm,
  },
  formulaCode: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.accent.chlorophyll,
    fontFamily: 'monospace',
  },
})
