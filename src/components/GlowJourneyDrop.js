// ─────────────────────────────────────────────────────────────
// GlowJourneyDrop.js — Living Juice Glow card
//
// Reconstructed per GLOW_RECONSTRUCTION_FINAL spec.
// New hierarchy: eyebrow → hero → week vine → streak → divider → journey row.
// No text overlaps the hero. Streak is outside the hero.
// Existing animation triggers, press behavior, accessibility,
// and reduced-motion handling are preserved.
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import { View, Text, StyleSheet, Animated, useWindowDimensions, Pressable, Platform } from 'react-native'
import * as Haptics from 'expo-haptics'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'
import { WEEKLY_GLOW_GOAL, getJourneyStage, getNextStage, getDaysToNextStage } from '../constants/glowJourneyStages'
import { useReducedMotion, EASING } from '../utils/motion'
import { buildGlowJourneyVisualState, clampProgress, surfaceY, getFillRatio, GLOW_PALETTE } from './GlowJourneyVisualState'
import GlowJourneyDropArtwork from './GlowJourneyDropArtwork'
import GlowJourneyStageIcon from './GlowJourneyStageIcon'

// Hero sizing (spec §4): 0.64 × content width, range 0.56–0.68
const HERO_WIDTH_FACTOR = 0.64
const HERO_WIDTH_MIN = 150
const HERO_WIDTH_MAX = 220

// Card padding (spec §4)
const CARD_PADDING_TOP = 20
const CARD_PADDING_SIDES = 18
const CARD_PADDING_BOTTOM = 18
const CARD_RADIUS = 26

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

  // Content width = screen width - 2*16dp screen margins - 2*18dp card padding
  const contentWidth = useMemo(() => Math.max(260, screenWidth - 32 - CARD_PADDING_SIDES * 2), [screenWidth])
  const heroWidth = useMemo(() => {
    const w = contentWidth * HERO_WIDTH_FACTOR
    return Math.max(HERO_WIDTH_MIN, Math.min(w, HERO_WIDTH_MAX))
  }, [contentWidth])
  const vineWidth = contentWidth

  const visualState = useMemo(() => buildGlowJourneyVisualState({
    lifetimeDays,
    weeklyQualifyingDays,
    weeklyLeafStates,
    streakCount,
  }), [lifetimeDays, weeklyQualifyingDays, weeklyLeafStates, streakCount])

  const stage = useMemo(() => getJourneyStage(lifetimeDays), [lifetimeDays])
  const nextStage = useMemo(() => getNextStage(lifetimeDays), [lifetimeDays])
  const daysToNext = useMemo(() => getDaysToNextStage(lifetimeDays), [lifetimeDays])

  const fillRatio = getFillRatio(weeklyQualifyingDays)
  const restingSurfaceY = surfaceY(0)
  const targetSurfaceY = surfaceY(fillRatio)

  // ── Animation refs (preserved shell) ───────────────────────
  const entranceAnim = useRef(new Animated.Value(isReduced ? 1 : 0)).current
  const pressScaleAnim = useRef(new Animated.Value(1)).current
  const liquidTranslateAnim = useRef(new Animated.Value(isReduced ? targetSurfaceY : restingSurfaceY)).current
  const bloomAnim = useRef(new Animated.Value(0)).current

  const prevWeeklyDays = useRef(weeklyQualifyingDays)
  const hasEnteredRef = useRef(false)
  const bloomFiredRef = useRef(false)

  // Animated surface translateY for the artwork
  const [animatedSurfaceY, setAnimatedSurfaceY] = useState(isReduced ? targetSurfaceY : restingSurfaceY)
  const [bloomOpacity, setBloomOpacity] = useState(0)

  // ── Storyboard 1: Entrance ─────────────────────────────────
  useEffect(() => {
    if (hasEnteredRef.current) return
    hasEnteredRef.current = true
    if (isReduced) {
      entranceAnim.setValue(1)
      setAnimatedSurfaceY(targetSurfaceY)
      if (fillRatio >= 1) setBloomOpacity(visualState.heroState.completionBloomOpacity)
    } else {
      Animated.timing(entranceAnim, {
        toValue: 1,
        duration: 320,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }).start()
      // Liquid rises from resting to current level
      Animated.timing(liquidTranslateAnim, {
        toValue: targetSurfaceY,
        duration: 900,
        easing: EASING.decelerate,
        useNativeDriver: false,
      }).start()
      const lId = liquidTranslateAnim.addListener(({ value }) => setAnimatedSurfaceY(value))
      setTimeout(() => liquidTranslateAnim.removeListener(lId), 1000)
    }
  }, [])

  // ── Storyboard 3: Progress update (qualifying day logged) ──
  useEffect(() => {
    if (!hasEnteredRef.current) return
    const prevDays = prevWeeklyDays.current
    const progressAdvanced = weeklyQualifyingDays > prevDays

    if (isReduced) {
      setAnimatedSurfaceY(targetSurfaceY)
      if (fillRatio >= 1 && !bloomFiredRef.current) {
        setBloomOpacity(visualState.heroState.completionBloomOpacity)
        bloomFiredRef.current = true
      }
      prevWeeklyDays.current = weeklyQualifyingDays
      return
    }

    if (progressAdvanced) {
      // Liquid rise with spring overshoot
      Animated.spring(liquidTranslateAnim, {
        toValue: targetSurfaceY,
        damping: 18,
        stiffness: 90,
        useNativeDriver: false,
      }).start()
      const lId = liquidTranslateAnim.addListener(({ value }) => setAnimatedSurfaceY(value))
      setTimeout(() => liquidTranslateAnim.removeListener(lId), 1100)

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    } else {
      setAnimatedSurfaceY(targetSurfaceY)
    }

    // Storyboard 8: Weekly completion bloom (fires once per week)
    if (fillRatio >= 1 && progressAdvanced && !bloomFiredRef.current) {
      bloomFiredRef.current = true
      if (isReduced) {
        setBloomOpacity(visualState.heroState.completionBloomOpacity)
      } else {
        Animated.sequence([
          Animated.timing(bloomAnim, { toValue: 1, duration: 520, easing: EASING.decelerate, useNativeDriver: false }),
          Animated.timing(bloomAnim, { toValue: 0.7, duration: 380, easing: EASING.linear, useNativeDriver: false }),
        ]).start()
        const bId = bloomAnim.addListener(({ value }) => {
          setBloomOpacity(value * visualState.heroState.completionBloomOpacity)
        })
        setTimeout(() => bloomAnim.removeListener(bId), 1000)
      }
    }

    prevWeeklyDays.current = weeklyQualifyingDays
  }, [fillRatio, weeklyQualifyingDays, isReduced, targetSurfaceY, visualState.heroState.completionBloomOpacity])

  // ── Storyboard 2: Press interaction ────────────────────────
  const handlePressIn = useCallback(() => {
    if (isReduced) return
    Animated.timing(pressScaleAnim, {
      toValue: 0.97,
      duration: 90,
      easing: EASING.decelerate,
      useNativeDriver: true,
    }).start()
  }, [isReduced])

  const handlePressOut = useCallback(() => {
    if (isReduced) return
    Animated.timing(pressScaleAnim, {
      toValue: 1,
      duration: 140,
      easing: EASING.decelerate,
      useNativeDriver: true,
    }).start()
  }, [isReduced])

  const handlePress = useCallback(() => {
    if (onPress) onPress()
  }, [onPress])

  // ── Accessibility label ────────────────────────────────────
  const accessibilityLabel = useMemo(() => {
    const parts = ['Living Juice Glow.']
    parts.push(`${weeklyQualifyingDays} of ${WEEKLY_GLOW_GOAL} weekly Glow days.`)
    if (streakCount > 0) {
      parts.push(`${streakCount} day Glow streak.`)
    } else {
      parts.push('No active streak.')
    }
    if (stage) {
      parts.push(`${stage.label}, lifetime journey.`)
    } else {
      parts.push('No journey stage yet.')
    }
    return parts.join(' ')
  }, [streakCount, weeklyQualifyingDays, stage])

  // ── Eyebrow text (spec §7) ─────────────────────────────────
  const eyebrow = useMemo(() => {
    if (weeklyQualifyingDays >= WEEKLY_GLOW_GOAL) {
      return `Glow complete · ${weeklyQualifyingDays} days logged`
    }
    return `${weeklyQualifyingDays} of ${WEEKLY_GLOW_GOAL} Glow days`
  }, [weeklyQualifyingDays])

  const eyebrowColor = weeklyQualifyingDays >= WEEKLY_GLOW_GOAL
    ? GLOW_PALETTE.juiceMint
    : GLOW_PALETTE.inkMuted

  // ── Build artwork visual state with animated surface ───────
  const artworkVisualState = useMemo(() => ({
    ...visualState,
    heroState: {
      ...visualState.heroState,
      surfaceY: animatedSurfaceY,
      completionBloomOpacity: Math.max(bloomOpacity, visualState.heroState.isComplete ? visualState.heroState.completionBloomOpacity : 0),
    },
  }), [visualState, animatedSurfaceY, bloomOpacity])

  // ── Entrance style ─────────────────────────────────────────
  const entranceOpacity = isReduced ? 1 : entranceAnim
  const entranceTranslateY = isReduced ? 0 : entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  })

  // Serif font for streak numeral (codebase pattern)
  const serifFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'

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
          transform: [
            { translateY: entranceTranslateY },
            { scale: pressScaleAnim },
          ],
        }}
      >
        {/* GlowCard — rounded 26, gradient surface */}
        <View style={styles.card}>
          {/* 1. Eyebrow */}
          <Text style={[styles.eyebrow, { color: eyebrowColor }]}>
            {eyebrow.toUpperCase()}
          </Text>

          {/* 2. Hero (Living Juice Glow) */}
          <View style={styles.heroWrap}>
            <GlowJourneyDropArtwork
              visualState={artworkVisualState}
              heroWidth={heroWidth}
              vineWidth={vineWidth}
              surfaceTranslateY={animatedSurfaceY}
              isReduced={isReduced}
            />
          </View>

          {/* 3. Streak (outside hero, centred pair) */}
          <View style={styles.streakRow}>
            <Text style={styles.streakNumeral} fontFamily={serifFontFamily}>
              {streakCount}
            </Text>
            <View style={styles.streakLabelWrap}>
              <Text style={styles.streakLabel}>DAY GLOW</Text>
              <Text style={styles.streakLabel}>STREAK</Text>
            </View>
          </View>

          {/* 4. Divider */}
          <View style={styles.divider} />

          {/* 5. Lifetime Journey row */}
          {stage ? (
            <View style={styles.journeyRow}>
              <GlowJourneyStageIcon
                stageKey={stage.key}
                size={22}
                color={GLOW_PALETTE.juiceMint}
              />
              <Text style={styles.journeyText}>
                <Text style={styles.journeyStageName}>{stage.label}</Text>
                <Text style={styles.journeyDot}> · </Text>
                <Text>Lifetime Journey</Text>
              </Text>
            </View>
          ) : (
            <View style={styles.journeyRow}>
              <GlowJourneyStageIcon stageKey="seed" size={22} color={GLOW_PALETTE.inkMuted} />
              <Text style={styles.journeyText}>
                Your journey starts with your first juice
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SEMANTIC_SPACE.sm,
    minHeight: 44,
  },
  card: {
    width: '100%',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: GLOW_PALETTE.hairline,
    paddingTop: CARD_PADDING_TOP,
    paddingHorizontal: CARD_PADDING_SIDES,
    paddingBottom: CARD_PADDING_BOTTOM,
    alignItems: 'center',
    // Card surface gradient approximation (dark mode)
    backgroundColor: GLOW_PALETTE.surfaceTop,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  heroWrap: {
    alignItems: 'center',
    overflow: 'visible',
    marginTop: 2,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 9,
  },
  streakNumeral: {
    fontSize: 34,
    fontWeight: '600',
    color: GLOW_PALETTE.juiceGold,
    lineHeight: 34,
  },
  streakLabelWrap: {
    flexDirection: 'column',
  },
  streakLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: GLOW_PALETTE.inkMuted,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    lineHeight: 13,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: GLOW_PALETTE.hairline,
    marginTop: 16,
    marginBottom: 12,
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 9,
  },
  journeyText: {
    fontSize: 13,
    fontWeight: '400',
    color: GLOW_PALETTE.inkMuted,
    letterSpacing: 0.13,
  },
  journeyStageName: {
    color: GLOW_PALETTE.ink,
  },
  journeyDot: {
    opacity: 0.45,
  },
})

export default GlowJourneyDrop
