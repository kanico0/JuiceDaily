// ─────────────────────────────────────────────────────────────
// NutrientHaloCard.js — Daily Nutrient Halo progress display
// Segmented ring showing 8 nutrient pillars + completion core.
// Tap a segment → pillar detail modal.
// Gated behind ff_nutrient_halo_progress feature flag.
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native'
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { X } from 'lucide-react-native'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT, GLASS } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import {
  NUTRIENT_PILLARS,
  PILLAR_KEYS,
  PILLAR_COUNT,
  scoreDayPillars,
} from '../services/NutrientPillars'

const SVG_SIZE = 260
const CENTER = SVG_SIZE / 2
const RING_RADIUS = 106
const RING_STROKE = 18
const GAP_DEGREES = 4.5
const SEGMENT_ARC = (360 - GAP_DEGREES * PILLAR_COUNT) / PILLAR_COUNT
const CORE_DIAMETER = Math.round(SVG_SIZE * 0.64)

// ── Arc Path Helper ─────────────────────────────────────────

function describeArc(cx, cy, r, startAngle, endAngle) {
  const startRad = ((startAngle - 90) * Math.PI) / 180
  const endRad = ((endAngle - 90) * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}

// ── Pillar Segment ──────────────────────────────────────────

function PillarSegment({ pillar, index, isFilled, isReduced }) {
  const startAngle = index * (SEGMENT_ARC + GAP_DEGREES)
  const endAngle = startAngle + SEGMENT_ARC
  const arcPath = describeArc(CENTER, CENTER, RING_RADIUS, startAngle, endAngle)

  return (
    <>
      {/* Ghost segment — 22% of active color for depth */}
      <Path
        d={arcPath}
        stroke={`${pillar.color}38`}
        strokeWidth={RING_STROKE}
        fill="none"
        strokeLinecap="round"
      />
      {/* Filled segment */}
      {isFilled && (
        <Path
          d={arcPath}
          stroke={pillar.color}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          opacity={0.88}
        />
      )}
      {/* Subtle outer glow — 3px wider, 6% opacity */}
      {isFilled && (
        <Path
          d={arcPath}
          stroke={pillar.color}
          strokeWidth={RING_STROKE + 6}
          fill="none"
          strokeLinecap="round"
          opacity={0.06}
        />
      )}
    </>
  )
}

// ── Tap Overlay Segments ────────────────────────────────────
// Invisible touchable areas over each segment

function SegmentTapZones({ onTap }) {
  return PILLAR_KEYS.map((key, index) => {
    const startAngle = index * (SEGMENT_ARC + GAP_DEGREES)
    const midAngle = startAngle + SEGMENT_ARC / 2
    const midRad = ((midAngle - 90) * Math.PI) / 180
    const tapX = CENTER + RING_RADIUS * Math.cos(midRad)
    const tapY = CENTER + RING_RADIUS * Math.sin(midRad)

    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.segmentTap,
          {
            left: tapX - 20,
            top: tapY - 20,
          },
        ]}
        onPress={() => onTap(key)}
        activeOpacity={0.6}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={`${NUTRIENT_PILLARS[key].label} pillar`}
      />
    )
  })
}

// ── Completion Core ─────────────────────────────────────────

function CompletionCore({ filledCount, totalCount, hasLoggedToday }) {
  const ratio = totalCount > 0 ? filledCount / totalCount : 0
  const pct = Math.round(ratio * 100)
  const allFilled = filledCount === totalCount && filledCount > 0

  return (
    <View style={styles.coreWrap}>
      <View style={styles.coreGlass}>
        {/* Subtle radial highlight — 8% opacity max */}
        <View style={styles.coreHighlight} />
        <Text
          style={[
            styles.corePct,
            allFilled && styles.corePctComplete,
          ]}
        >
          {pct}
          <Text style={styles.corePctUnit}>%</Text>
        </Text>
        <Text style={styles.coreLabel}>
          {allFilled ? 'Complete' : hasLoggedToday ? 'Nutrient Halo' : 'Start Juicing'}
        </Text>
        <Text style={styles.coreSub}>
          {filledCount}/{totalCount} pillars
        </Text>
      </View>
    </View>
  )
}

// ── Pillar Detail Modal ─────────────────────────────────────

function PillarDetailModal({ visible, pillarKey, isFilled, onDismiss }) {
  if (!pillarKey) return null
  const pillar = NUTRIENT_PILLARS[pillarKey]
  if (!pillar) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalDot, { backgroundColor: pillar.color }]} />
            <Text style={styles.modalTitle}>{pillar.label}</Text>
            <TouchableOpacity onPress={onDismiss} style={styles.modalClose}>
              <X size={16} color={DARK.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalDesc}>{pillar.description}</Text>
          <View style={[styles.modalStatus, isFilled && styles.modalStatusFilled]}>
            <Text style={[styles.modalStatusText, isFilled && { color: pillar.color }]}>
              {isFilled ? '✓ Pillar filled today' : 'Not yet filled today'}
            </Text>
          </View>
          {pillar.produceIds && (
            <View style={styles.modalProduceWrap}>
              <Text style={styles.modalProduceLabel}>Key ingredients:</Text>
              <Text style={styles.modalProduceList}>
                {pillar.produceIds.slice(0, 5).map((id) => {
                  const name = id.replace(/_/g, ' ')
                  return name.charAt(0).toUpperCase() + name.slice(1)
                }).join(', ')}
              </Text>
            </View>
          )}
          {pillar.nutrientKey && (
            <View style={styles.modalProduceWrap}>
              <Text style={styles.modalProduceLabel}>Threshold:</Text>
              <Text style={styles.modalProduceList}>
                {pillar.threshold}{pillar.nutrientKey.includes('Mcg') ? ' mcg' : ' mg'} per day
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

// ── Pillar Legend ────────────────────────────────────────────

function PillarLegend({ pillarHits }) {
  return (
    <View style={styles.legend}>
      {PILLAR_KEYS.map((key) => {
        const pillar = NUTRIENT_PILLARS[key]
        const isFilled = pillarHits[key]
        return (
          <View
            key={key}
            style={[
              styles.legendPill,
              isFilled && {
                backgroundColor: `${pillar.color}18`,
                borderColor: `${pillar.color}30`,
              },
            ]}
          >
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor: isFilled ? pillar.color : `${pillar.color}25`,
                  shadowColor: isFilled ? pillar.color : 'transparent',
                  shadowOpacity: isFilled ? 0.5 : 0,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 0 },
                },
              ]}
            />
            <Text
              style={[
                styles.legendText,
                isFilled && { color: pillar.color, fontWeight: FONT_WEIGHT.bold },
              ]}
            >
              {pillar.shortLabel}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ── Main NutrientHaloCard ───────────────────────────────────

export default function NutrientHaloCard({ todayLog }) {
  const isReduced = useReducedMotion()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [selectedPillar, setSelectedPillar] = useState(null)
  const hasTrackedView = useRef(false)

  const pillarHits = useMemo(() => scoreDayPillars(todayLog), [todayLog])
  const filledCount = useMemo(
    () => PILLAR_KEYS.filter((k) => pillarHits[k]).length,
    [pillarHits]
  )
  const hasLoggedToday = (todayLog?.juices || []).length > 0

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: isReduced ? DURATION.crossfade : DURATION.enter,
      easing: isReduced ? EASING.linear : EASING.decelerate,
      useNativeDriver: true,
    }).start()
  }, [isReduced])

  // Analytics: view event (once per mount)
  useEffect(() => {
    if (!hasTrackedView.current) {
      hasTrackedView.current = true
      trackEvent('nutrient_halo_viewed', {
        pillars_filled: filledCount,
        total_pillars: PILLAR_COUNT,
      })
    }
  }, [filledCount])

  const handleSegmentTap = useCallback((key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedPillar(key)
    trackEvent('nutrient_segment_tapped', {
      pillar_enum: key,
      is_filled: pillarHits[key] ? 'true' : 'false',
    })
  }, [pillarHits])

  const allFilled = filledCount === PILLAR_COUNT

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim }]}
      accessibilityRole="summary"
      accessibilityLabel={`Nutrient Halo: ${filledCount} of ${PILLAR_COUNT} pillars filled today`}
    >
      {/* Ring */}
      <View style={styles.ringWrap}>
        <Svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        >
          {PILLAR_KEYS.map((key, i) => (
            <PillarSegment
              key={key}
              pillar={NUTRIENT_PILLARS[key]}
              index={i}
              isFilled={pillarHits[key]}
              isReduced={isReduced}
            />
          ))}
        </Svg>

        {/* Tap zones overlay */}
        <View style={styles.tapOverlay}>
          <SegmentTapZones onTap={handleSegmentTap} />
        </View>

        {/* Center completion */}
        <CompletionCore
          filledCount={filledCount}
          totalCount={PILLAR_COUNT}
          hasLoggedToday={hasLoggedToday}
        />
      </View>

      {/* Legend */}
      <PillarLegend pillarHits={pillarHits} />

      {/* All-filled badge */}
      {allFilled && (
        <View style={styles.completeBadge}>
          <Text style={styles.completeBadgeText}>Full Spectrum Achieved</Text>
        </View>
      )}

      {/* Empty state */}
      {!hasLoggedToday && filledCount === 0 && (
        <View style={styles.emptyHint}>
          <Text style={styles.emptyHintText}>Log a juice to light up your Nutrient Halo</Text>
        </View>
      )}

      {/* Pillar detail modal */}
      <PillarDetailModal
        visible={!!selectedPillar}
        pillarKey={selectedPillar}
        isFilled={selectedPillar ? pillarHits[selectedPillar] : false}
        onDismiss={() => setSelectedPillar(null)}
      />
    </Animated.View>
  )
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACE.md,
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.md,
    backgroundColor: GLASS.background,
    borderRadius: GLASS.borderRadius,
    borderWidth: 0.5,
    borderColor: GLASS.border,
    // Soft drop shadow under entire halo
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  ringWrap: {
    width: SVG_SIZE,
    height: SVG_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SVG_SIZE,
    height: SVG_SIZE,
  },
  segmentTap: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  coreWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coreGlass: {
    width: CORE_DIAMETER,
    height: CORE_DIAMETER,
    borderRadius: CORE_DIAMETER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,27,34,0.82)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    // Soft inner shadow feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    padding: 16,
  },
  coreHighlight: {
    position: 'absolute',
    top: 4,
    left: '15%',
    right: '15%',
    height: CORE_DIAMETER * 0.3,
    borderRadius: CORE_DIAMETER * 0.15,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  corePct: {
    fontSize: 42,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -1.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  corePctUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
  },
  corePctComplete: {
    color: DARK.green,
    textShadowColor: 'rgba(76,175,80,0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  coreLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.heavy,
    color: 'rgba(255,255,255,0.28)',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: -2,
  },
  coreSub: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: 'rgba(255,255,255,0.22)',
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACE.sm,
    paddingHorizontal: SPACE.md,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.85,
  },
  legendText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: FONT_WEIGHT.semibold,
  },
  completeBadge: {
    marginTop: SPACE.sm,
    backgroundColor: 'rgba(76,175,80,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 0.5,
    borderColor: 'rgba(76,175,80,0.25)',
  },
  completeBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.heavy,
    color: DARK.green,
    letterSpacing: 0.5,
  },
  emptyHint: {
    marginTop: SPACE.xs,
    backgroundColor: 'rgba(129,199,132,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.1)',
  },
  emptyHintText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.3,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.xl,
  },
  modalCard: {
    backgroundColor: DARK.surfaceElevated,
    borderRadius: RADIUS.xl,
    padding: SPACE.xl,
    width: '100%',
    maxWidth: 340,
    borderWidth: 0.5,
    borderColor: DARK.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    marginBottom: SPACE.md,
  },
  modalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  modalTitle: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  modalClose: {
    padding: SPACE.xs,
  },
  modalDesc: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.regular,
    color: DARK.textSecondary,
    lineHeight: 20,
    marginBottom: SPACE.md,
  },
  modalStatus: {
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: SPACE.md,
  },
  modalStatusFilled: {
    backgroundColor: 'rgba(129,199,132,0.08)',
  },
  modalStatusText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
  },
  modalProduceWrap: {
    marginBottom: SPACE.sm,
  },
  modalProduceLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.heavy,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  modalProduceList: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
  },
})
