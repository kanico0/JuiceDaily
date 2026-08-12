// ─────────────────────────────────────────────────────────────
// GlowJourneyDrop.js — Redesigned progress indicator for Today.
//
// Canonical SVG drop with rising weekly liquid fill,
// seven-leaf weekly halo, permanent journey stage motif,
// five storyboards, reduced-motion replacements, and
// celebration coordination support.
// Uses GlowJourneyDropArtwork for the live SVG rendering.
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import { View, Text, StyleSheet, Animated, useWindowDimensions, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'
import { WEEKLY_GLOW_GOAL, getJourneyStage, getNextStage, getDaysToNextStage } from '../constants/glowJourneyStages'
import { useReducedMotion, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import { buildGlowJourneyVisualState, clampProgress } from './GlowJourneyVisualState'
import GlowJourneyDropArtwork from './GlowJourneyDropArtwork'
import GlowJourneyStageIcon from './GlowJourneyStageIcon'

const MAX_DROP_SIZE = 220
const MIN_DROP_SIZE = 140

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
  const dropSize = useMemo(() => Math.max(MIN_DROP_SIZE, Math.min(screenWidth * 0.52, MAX_DROP_SIZE)), [screenWidth])

  const visualState = useMemo(() => buildGlowJourneyVisualState({
    lifetimeDays,
    weeklyQualifyingDays,
    weeklyLeafStates,
    streakCount,
  }), [lifetimeDays, weeklyQualifyingDays, weeklyLeafStates, streakCount])

  const stage = useMemo(() => getJourneyStage(lifetimeDays), [lifetimeDays])
  const nextStage = useMemo(() => getNextStage(lifetimeDays), [lifetimeDays])
  const daysToNext = useMemo(() => getDaysToNextStage(lifetimeDays), [lifetimeDays])

  const fillRatio = clampProgress(weeklyQualifyingDays / WEEKLY_GLOW_GOAL)

  // Animation refs
  const entranceAnim = useRef(new Animated.Value(isReduced ? 1 : 0)).current
  const pressScaleAnim = useRef(new Animated.Value(1)).current
  const pressGlowAnim = useRef(new Animated.Value(0)).current
  const fillAnim = useRef(new Animated.Value(fillRatio)).current
  const glowRingAnim = useRef(new Animated.Value(0)).current
  const dropletAnim = useRef(new Animated.Value(0)).current
  const rippleAnim = useRef(new Animated.Value(0)).current
  const leafPulseAnim = useRef(new Animated.Value(1)).current

  const prevWeeklyDays = useRef(weeklyQualifyingDays)
  const hasEnteredRef = useRef(false)
  const pressGlowBaseRef = useRef(visualState.stageProps.glowRingOpacity)

  // Animated state for artwork
  const [animatedFillRatio, setAnimatedFillRatio] = useState(fillRatio)
  const [animatedGlowRing, setAnimatedGlowRing] = useState(visualState.stageProps.glowRingOpacity)
  const [dropletOpacity, setDropletOpacity] = useState(0)
  const [rippleOpacity, setRippleOpacity] = useState(0)
  const [leafScaleOverrides, setLeafScaleOverrides] = useState(Array(7).fill(1))

  // Storyboard 1: Entrance — only on first mount
  useEffect(() => {
    if (hasEnteredRef.current) return
    hasEnteredRef.current = true
    if (isReduced) {
      entranceAnim.setValue(1)
      setAnimatedFillRatio(fillRatio)
      setAnimatedGlowRing(visualState.stageProps.glowRingOpacity)
    } else {
      Animated.timing(entranceAnim, {
        toValue: 1,
        duration: 500,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }).start()
      setAnimatedFillRatio(fillRatio)
      setAnimatedGlowRing(visualState.stageProps.glowRingOpacity)
    }
  }, [])

  // Storyboard 3: Progress update — only when progress advances
  useEffect(() => {
    if (!hasEnteredRef.current) return
    const prevDays = prevWeeklyDays.current
    const progressAdvanced = weeklyQualifyingDays > prevDays

    if (isReduced) {
      setAnimatedFillRatio(fillRatio)
      setDropletOpacity(0)
      setRippleOpacity(0)
      prevWeeklyDays.current = weeklyQualifyingDays
      return
    }

    if (progressAdvanced) {
      // Falling droplet
      setDropletOpacity(0)
      Animated.sequence([
        Animated.timing(dropletAnim, { toValue: 1, duration: 200, easing: EASING.accelerate, useNativeDriver: false }),
        Animated.timing(dropletAnim, { toValue: 0, duration: 300, easing: EASING.decelerate, useNativeDriver: false }),
      ]).start(() => setDropletOpacity(0))
      const dId = dropletAnim.addListener(({ value }) => setDropletOpacity(value))

      // Liquid rise
      Animated.timing(fillAnim, {
        toValue: fillRatio,
        duration: 500,
        easing: EASING.decelerate,
        useNativeDriver: false,
      }).start()
      const fId = fillAnim.addListener(({ value }) => setAnimatedFillRatio(value))

      // Ripple after liquid settles
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(rippleAnim, { toValue: 0.55, duration: 175, easing: EASING.decelerate, useNativeDriver: false }),
          Animated.timing(rippleAnim, { toValue: 0, duration: 175, easing: EASING.linear, useNativeDriver: false }),
        ]).start()
        const rId = rippleAnim.addListener(({ value }) => setRippleOpacity(value))
        setTimeout(() => rippleAnim.removeListener(rId), 400)
      }, 450)

      // Leaf pulse for today's leaf
      const todayIndex = weeklyLeafStates.findIndex((l) => l.isToday)
      if (todayIndex >= 0) {
        setLeafScaleOverrides((prev) => {
          const next = [...prev]
          next[todayIndex] = 1.06
          return next
        })
        setTimeout(() => {
          setLeafScaleOverrides((prev) => {
            const next = [...prev]
            next[todayIndex] = 1
            return next
          })
        }, 350)
      }

      // Glow ring brief pass
      const baseGlow = visualState.stageProps.glowRingOpacity
      Animated.sequence([
        Animated.timing(glowRingAnim, { toValue: baseGlow + 0.08, duration: 150, easing: EASING.decelerate, useNativeDriver: false }),
        Animated.timing(glowRingAnim, { toValue: baseGlow, duration: 150, easing: EASING.linear, useNativeDriver: false }),
      ]).start()
      const gId = glowRingAnim.addListener(({ value }) => setAnimatedGlowRing(value))

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})

      // Cleanup listeners after animation
      setTimeout(() => {
        dropletAnim.removeListener(dId)
        fillAnim.removeListener(fId)
        glowRingAnim.removeListener(gId)
      }, 1100)
    } else {
      setAnimatedFillRatio(fillRatio)
    }

    prevWeeklyDays.current = weeklyQualifyingDays
  }, [fillRatio, weeklyQualifyingDays, isReduced, weeklyLeafStates, visualState.stageProps.glowRingOpacity])

  // Update glow ring base when stage changes
  useEffect(() => {
    pressGlowBaseRef.current = visualState.stageProps.glowRingOpacity
    setAnimatedGlowRing(visualState.stageProps.glowRingOpacity)
  }, [visualState.stageProps.glowRingOpacity])

  // Storyboard 2: Press interaction
  const handlePressIn = useCallback(() => {
    if (isReduced) return
    Animated.timing(pressScaleAnim, {
      toValue: 0.97,
      duration: 90,
      easing: EASING.decelerate,
      useNativeDriver: true,
    }).start()
    const baseGlow = pressGlowBaseRef.current
    Animated.timing(pressGlowAnim, {
      toValue: baseGlow + 0.05,
      duration: 90,
      easing: EASING.decelerate,
      useNativeDriver: false,
    }).start()
    const pId = pressGlowAnim.addListener(({ value }) => setAnimatedGlowRing(value))
    setTimeout(() => pressGlowAnim.removeListener(pId), 300)
  }, [isReduced])

  const handlePressOut = useCallback(() => {
    if (isReduced) return
    Animated.timing(pressScaleAnim, {
      toValue: 1,
      duration: 140,
      easing: EASING.decelerate,
      useNativeDriver: true,
    }).start()
    const baseGlow = pressGlowBaseRef.current
    Animated.timing(pressGlowAnim, {
      toValue: baseGlow,
      duration: 140,
      easing: EASING.linear,
      useNativeDriver: false,
    }).start()
    const pId = pressGlowAnim.addListener(({ value }) => setAnimatedGlowRing(value))
    setTimeout(() => pressGlowAnim.removeListener(pId), 200)
  }, [isReduced])

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

  // Build artwork visual state with animated values
  const artworkVisualState = useMemo(() => ({
    ...visualState,
    fillRatio: animatedFillRatio,
    liquidGeometry: {
      x: 100,
      width: 200,
      y: 378 - (378 - 65) * clampProgress(animatedFillRatio),
      height: (378 - 65) * clampProgress(animatedFillRatio),
    },
  }), [visualState, animatedFillRatio])

  // Entrance style
  const entranceOpacity = isReduced ? 1 : entranceAnim
  const entranceScale = isReduced ? 1 : entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  })

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Tap to view your detailed Glow Journey progress."
      style={styles.container}
    >
      <Animated.View
        style={{
          opacity: entranceOpacity,
          transform: [{ scale: Animated.multiply(entranceScale, pressScaleAnim) }],
          alignItems: 'center',
        }}
      >
        <View style={styles.graphicWrap}>
          <GlowJourneyDropArtwork
            visualState={artworkVisualState}
            size={dropSize}
            showFallingDroplet={dropletOpacity > 0}
            showRipple={rippleOpacity > 0}
            showParticles={false}
            fallingDropletOpacity={dropletOpacity}
            rippleOpacity={rippleOpacity}
            glowRingOpacityOverride={animatedGlowRing}
            leafScaleOverrides={leafScaleOverrides}
            isReduced={isReduced}
          />

          {/* Streak text overlay */}
          <View style={[styles.streakOverlay, { width: dropSize, height: dropSize }]}>
            <Text style={[styles.streakNumber, { fontSize: Math.min(dropSize * 0.22, 40), lineHeight: Math.min(dropSize * 0.22, 40) * 1.1 }]}>{streakCount}</Text>
            <Text style={styles.streakLabel}>
              {streakCount === 1 ? '1 Day Glow Streak' : `${streakCount} Day Glow Streak`}
            </Text>
          </View>
        </View>

        {/* Journey stage + milestone */}
        <View style={styles.infoSection}>
          {stage ? (
            <View style={styles.stageRow}>
              <GlowJourneyStageIcon stageKey={stage.key} size={18} color={SEMANTIC_COLORS.textPrimary} />
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

        {/* Supporting chips — grouped by time horizon for clarity */}
        <View style={styles.chipsRow}>
          <View style={styles.chipGroup}>
            <Text style={styles.chipGroupLabel}>This Week</Text>
            <View style={styles.chipPair}>
              <Chip label="Weekly" value={`${weeklyQualifyingDays}/${WEEKLY_GLOW_GOAL}`} />
              <Chip label="Momentum" value={streakCount > 0 ? `${streakCount}d` : '—'} />
            </View>
          </View>
          <View style={styles.chipGroup}>
            <Text style={styles.chipGroupLabel}>Lifetime</Text>
            <View style={styles.chipPair}>
              <Chip label="Days" value={lifetimeDays > 0 ? `${lifetimeDays}d` : '—'} />
            </View>
          </View>
        </View>

        {/* Motivational copy */}
        <Text style={styles.motivationalCopy}>
          {lifetimeDays === 0
            ? 'Every great journey begins with a single sip. Scan your first juice to start glowing!'
            : weeklyQualifyingDays >= WEEKLY_GLOW_GOAL
              ? 'You\u2019ve hit your weekly goal. Your body is glowing from the inside out.'
              : streakCount > 0
                ? `${streakCount} day${streakCount === 1 ? '' : 's'} of consistent glow. Keep the momentum alive!`
                : 'Your glow is waiting. Log a juice today to reignite your streak.'}
        </Text>
      </Animated.View>
    </Pressable>
  )
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
    gap: 12,
    marginTop: SEMANTIC_SPACE.sm,
    justifyContent: 'center',
  },
  chipGroup: {
    alignItems: 'center',
  },
  chipGroupLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: SEMANTIC_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  chipPair: {
    flexDirection: 'row',
    gap: 6,
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
  motivationalCopy: {
    fontSize: 12,
    fontWeight: '500',
    color: SEMANTIC_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SEMANTIC_SPACE.sm,
    paddingHorizontal: SEMANTIC_SPACE.lg,
    lineHeight: 17,
  },
})

export default GlowJourneyDrop
