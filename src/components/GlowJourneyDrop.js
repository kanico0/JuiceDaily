// ─────────────────────────────────────────────────────────────
// GlowJourneyDrop.js — Branded progress indicator for Today.
//
// Central juice-drop with rising weekly liquid fill,
// seven-leaf weekly halo, permanent journey stage,
// and next milestone message.
// Uses react-native-svg for vector drop and leaf shapes.
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Animated, useWindowDimensions } from 'react-native'
import Svg, { Defs, ClipPath, Path, RadialGradient, Stop, LinearGradient, G } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'
import { WEEKLY_GLOW_GOAL, getJourneyStage, getNextStage, getDaysToNextStage } from '../constants/glowJourneyStages'
import { useReducedMotion, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'

const MAX_DROP_SIZE = 180
const MIN_DROP_SIZE = 120

function numberToWord(n) {
  if (n === 0) return 'Zero'
  if (n === 1) return 'One'
  if (n === 2) return 'Two'
  if (n === 3) return 'Three'
  if (n === 4) return 'Four'
  if (n === 5) return 'Five'
  if (n === 6) return 'Six'
  if (n === 7) return 'Seven'
  if (n === 8) return 'Eight'
  if (n === 9) return 'Nine'
  if (n === 10) return 'Ten'
  if (n === 11) return 'Eleven'
  if (n === 12) return 'Twelve'
  return String(n)
}

function buildDropPath(cx, cy, w, h) {
  const topY = cy - h / 2
  const bottomY = cy + h / 2
  const halfW = w / 2
  return `M ${cx} ${topY} C ${cx + halfW} ${cy - h * 0.15}, ${cx + halfW} ${cy + h * 0.25}, ${cx} ${bottomY} C ${cx - halfW} ${cy + h * 0.25}, ${cx - halfW} ${cy - h * 0.15}, ${cx} ${topY} Z`
}

function buildLeafPath(cx, cy, size) {
  const halfS = size / 2
  return `M ${cx} ${cy - halfS} Q ${cx + halfS} ${cy}, ${cx} ${cy + halfS} Q ${cx - halfS} ${cy}, ${cx} ${cy - halfS} Z`
}

function GlowJourneyDrop({
  streakCount = 0,
  entries = [],
  lifetimeDays = 0,
  weeklyQualifyingDays = 0,
  weeklyLeafStates = [],
  onPress,
  isReduced: isReducedProp,
}) {
  const reducedMotion = useReducedMotion()
  const isReduced = isReducedProp !== undefined ? isReducedProp : reducedMotion
  const { width: screenWidth } = useWindowDimensions()
  const dropSize = useMemo(() => Math.max(MIN_DROP_SIZE, Math.min(screenWidth * 0.42, MAX_DROP_SIZE)), [screenWidth])
  const haloRadius = dropSize * 0.62
  const leafSize = dropSize * 0.14
  const fillAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current
  const prevWeeklyDays = useRef(weeklyQualifyingDays)

  const stage = useMemo(() => getJourneyStage(lifetimeDays), [lifetimeDays])
  const nextStage = useMemo(() => getNextStage(lifetimeDays), [lifetimeDays])
  const daysToNext = useMemo(() => getDaysToNextStage(lifetimeDays), [lifetimeDays])

  const fillRatio = Math.min(weeklyQualifyingDays / WEEKLY_GLOW_GOAL, 1)

  useEffect(() => {
    if (isReduced) {
      fillAnim.setValue(fillRatio)
      glowAnim.setValue(0)
    } else {
      Animated.timing(fillAnim, {
        toValue: fillRatio,
        duration: 600,
        easing: EASING.decelerate,
        useNativeDriver: false,
      }).start()

      if (weeklyQualifyingDays > prevWeeklyDays.current) {
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 300, easing: EASING.decelerate, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 400, easing: EASING.linear, useNativeDriver: false }),
        ]).start()
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      }
    }
    prevWeeklyDays.current = weeklyQualifyingDays
  }, [fillRatio, weeklyQualifyingDays, isReduced])

  const handlePress = useCallback(() => {
    if (onPress) onPress()
  }, [onPress])

  const accessibilityLabel = useMemo(() => {
    const streakWordFull = numberToWord(streakCount).toLowerCase()
    const parts = ['Glow Journey.']
    if (streakCount > 0) {
      parts.push(`${streakWordFull}-day streak.`)
    } else {
      parts.push('No active streak.')
    }
    parts.push(`${weeklyQualifyingDays} of ${WEEKLY_GLOW_GOAL} weekly juicing days complete.`)
    if (stage) {
      parts.push(`${stage.label} stage.`)
    } else {
      parts.push('No journey stage yet.')
    }
    if (nextStage && daysToNext > 0) {
      parts.push(`${daysToNext} more days to ${nextStage.label}.`)
    } else if (stage && !nextStage) {
      parts.push('Highest journey stage reached.')
    }
    return parts.join(' ')
  }, [streakCount, weeklyQualifyingDays, stage, nextStage, daysToNext])

  const cx = dropSize / 2
  const cy = dropSize / 2 + dropSize * 0.05
  const dropW = dropSize * 0.72
  const dropH = dropSize * 0.88

  const glowOpacity = isReduced ? 0 : glowAnim

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Tap to view your detailed Glow Journey progress."
      style={styles.container}
    >
      <View style={styles.graphicWrap}>
        <Svg width={dropSize + leafSize * 8} height={dropSize + leafSize * 8} style={styles.svg}>
          <Defs>
            <ClipPath id="dropClip">
              <Path d={buildDropPath(cx + leafSize * 4, cy + leafSize * 4, dropW, dropH)} />
            </ClipPath>
            <RadialGradient id="dropGlow" cx="50%" cy="40%" r="60%">
              <Stop offset="0%" stopColor={SEMANTIC_COLORS.success} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={SEMANTIC_COLORS.success} stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={SEMANTIC_COLORS.success} stopOpacity="0.9" />
              <Stop offset="50%" stopColor={SEMANTIC_COLORS.success} stopOpacity="0.85" />
              <Stop offset="100%" stopColor={SEMANTIC_COLORS.success} stopOpacity="0.7" />
            </LinearGradient>
            <LinearGradient id="dropStroke" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={SEMANTIC_COLORS.success} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={SEMANTIC_COLORS.success} stopOpacity="0.3" />
            </LinearGradient>
          </Defs>

          {/* Seven-leaf halo */}
          {weeklyLeafStates.map((leaf, i) => {
            const angle = (i / 7) * Math.PI * 2 - Math.PI / 2
            const haloCx = cx + leafSize * 4 + Math.cos(angle) * haloRadius
            const haloCy = cy + leafSize * 4 + Math.sin(angle) * haloRadius
            const leafColor = leaf.hasLog ? SEMANTIC_COLORS.success : 'rgba(255,255,255,0.08)'
            const strokeColor = leaf.isToday ? SEMANTIC_COLORS.success : (leaf.hasLog ? 'rgba(129,199,132,0.4)' : 'rgba(255,255,255,0.12)')
            const strokeWidth = leaf.isToday ? 2 : 1
            const opacity = leaf.isFuture ? 0.4 : 1
            const scale = leaf.isToday ? 1.25 : 1
            const leafPath = buildLeafPath(haloCx, haloCy, leafSize * scale)

            return (
              <React.Fragment key={i}>
                <Path
                  d={leafPath}
                  fill={leafColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                />
                {leaf.hasLog && (
                  <Path
                    d={leafPath}
                    fill="none"
                    stroke={SEMANTIC_COLORS.success}
                    strokeWidth={0.5}
                    opacity={0.3}
                  />
                )}
              </React.Fragment>
            )
          })}

          {/* Drop glow background */}
          <Path
            d={buildDropPath(cx + leafSize * 4, cy + leafSize * 4, dropW + 8, dropH + 8)}
            fill="url(#dropGlow)"
            opacity={0.8}
          />

          {/* Drop outline */}
          <Path
            d={buildDropPath(cx + leafSize * 4, cy + leafSize * 4, dropW, dropH)}
            fill="rgba(13,21,16,0.6)"
            stroke="url(#dropStroke)"
            strokeWidth={2}
          />

          {/* Liquid fill clipped inside drop */}
          <AnimatedClipPath
            clipPathId="dropClip"
            fillAnim={fillAnim}
            dropH={dropH}
            cy={cy + leafSize * 4}
            cx={cx + leafSize * 4}
            dropW={dropW}
            isReduced={isReduced}
          />

          {/* Pulse glow on new log */}
          {!isReduced && (
            <AnimatedPath
              d={buildDropPath(cx + leafSize * 4, cy + leafSize * 4, dropW, dropH)}
              fill="none"
              stroke={SEMANTIC_COLORS.success}
              strokeWidth={2}
              opacity={glowOpacity}
            />
          )}
        </Svg>

        {/* Streak text overlay */}
        <View style={[styles.streakOverlay, { width: dropSize, height: dropSize }]}>
          <Text style={[styles.streakNumber, { fontSize: Math.min(dropSize * 0.22, 40), lineHeight: Math.min(dropSize * 0.22, 40) * 1.1 }]}>{streakCount}</Text>
          <Text style={styles.streakLabel}>
            {streakCount === 1 ? 'Day Glow Streak' : 'Day Glow Streak'}
          </Text>
        </View>
      </View>

      {/* Journey stage + milestone */}
      <View style={styles.infoSection}>
        {stage ? (
          <View style={styles.stageRow}>
            <Text style={styles.stageEmoji}>{stage.emoji}</Text>
            <Text style={styles.stageLabel}>{stage.label}</Text>
            <Text style={styles.stageDays}>· {lifetimeDays} days</Text>
          </View>
        ) : (
          <Text style={styles.emptyStage}>Your journey starts with your first juice</Text>
        )}

        <MilestoneMessage
          lifetimeDays={lifetimeDays}
          weeklyQualifyingDays={weeklyQualifyingDays}
          nextStage={nextStage}
          daysToNext={daysToNext}
        />
      </View>

      {/* Supporting chips */}
      <View style={styles.chipsRow}>
        <Chip label="Momentum" value={streakCount > 0 ? `${streakCount}d` : '—'} />
        <Chip label="Weekly" value={`${weeklyQualifyingDays}/${WEEKLY_GLOW_GOAL}`} />
        <Chip label="Lifetime" value={lifetimeDays > 0 ? `${lifetimeDays}d` : '—'} />
      </View>
    </TouchableOpacity>
  )
}

function AnimatedClipPath({ clipPathId, fillAnim, dropH, cy, cx, dropW, isReduced }) {
  const [fillY, setFillY] = React.useState(0)

  useEffect(() => {
    if (isReduced) {
      setFillY(fillAnim.__getValue() * dropH)
    } else {
      const id = fillAnim.addListener(({ value }) => {
        setFillY(value * dropH)
      })
      return () => fillAnim.removeListener(id)
    }
  }, [fillAnim, dropH, isReduced])

  const liquidTop = cy + dropH / 2 - fillY
  const liquidHeight = fillY

  return (
    <G clipPath={`url(#${clipPathId})`}>
      {liquidHeight > 0 && (
        <Path
          d={`M ${cx - dropW / 2 - 2} ${liquidTop} L ${cx + dropW / 2 + 2} ${liquidTop} L ${cx + dropW / 2 + 2} ${cy + dropH / 2 + 2} L ${cx - dropW / 2 - 2} ${cy + dropH / 2 + 2} Z`}
          fill="url(#liquidGrad)"
        />
      )}
    </G>
  )
}

function AnimatedPath({ d, stroke, strokeWidth, opacity }) {
  const [op, setOp] = React.useState(0)
  useEffect(() => {
    if (opacity && typeof opacity.addListener === 'function') {
      const id = opacity.addListener(({ value }) => setOp(value))
      return () => opacity.removeListener(id)
    }
    setOp(typeof opacity === 'number' ? opacity : 0)
  }, [opacity])
  return <Path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} opacity={op} />
}

function MilestoneMessage({ lifetimeDays, weeklyQualifyingDays, nextStage, daysToNext }) {
  const goal = WEEKLY_GLOW_GOAL
  const daysRemaining = goal - weeklyQualifyingDays

  let primary = ''
  let secondary = ''

  if (!lifetimeDays || lifetimeDays < 1) {
    return <Text style={styles.milestoneText}>Your journey starts with your first juice</Text>
  }

  if (daysRemaining > 0) {
    primary = daysRemaining === 1
      ? 'One more juice completes your Weekly Glow'
      : `${daysRemaining} more juicing days to complete your Weekly Glow`
  } else {
    primary = 'Your Weekly Glow is complete'
  }

  if (nextStage && daysToNext > 0) {
    secondary = daysToNext === 1
      ? `1 more day to reach ${nextStage.label}`
      : `${daysToNext} more days to reach ${nextStage.label}`
  }

  if (secondary) {
    return (
      <View>
        <Text style={styles.milestoneText}>{primary}</Text>
        <Text style={styles.milestoneSecondary}>{secondary}</Text>
      </View>
    )
  }

  if (!nextStage) {
    return (
      <View>
        <Text style={styles.milestoneText}>{primary}</Text>
        <Text style={styles.milestoneSecondary}>You've reached the highest journey stage</Text>
      </View>
    )
  }

  return <Text style={styles.milestoneText}>{primary}</Text>
}

function Chip({ label, value }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SEMANTIC_SPACE.md,
    minHeight: 44,
  },
  graphicWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svg: {
    alignSelf: 'center',
  },
  streakOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakNumber: {
    fontWeight: '800',
    color: SEMANTIC_COLORS.textPrimary,
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SEMANTIC_COLORS.textSecondary,
    marginTop: 2,
  },
  infoSection: {
    alignItems: 'center',
    marginTop: SEMANTIC_SPACE.sm,
    paddingHorizontal: SEMANTIC_SPACE.lg,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stageEmoji: {
    fontSize: 16,
  },
  stageLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: SEMANTIC_COLORS.textPrimary,
  },
  stageDays: {
    fontSize: 13,
    color: SEMANTIC_COLORS.textMuted,
  },
  emptyStage: {
    fontSize: 14,
    fontWeight: '600',
    color: SEMANTIC_COLORS.textSecondary,
    textAlign: 'center',
  },
  milestoneText: {
    fontSize: 13,
    fontWeight: '500',
    color: SEMANTIC_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  milestoneSecondary: {
    fontSize: 12,
    color: SEMANTIC_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SEMANTIC_SPACE.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SEMANTIC_COLORS.surface,
    borderRadius: SEMANTIC_RADIUS.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 0.5,
    borderColor: SEMANTIC_COLORS.borderSubtle,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: SEMANTIC_COLORS.textMuted,
  },
  chipValue: {
    fontSize: 11,
    fontWeight: '700',
    color: SEMANTIC_COLORS.textPrimary,
  },
})

export default GlowJourneyDrop
