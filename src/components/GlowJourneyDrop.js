// ─────────────────────────────────────────────────────────────
// GlowJourneyDrop.js — Living Juice Glow card
//
// Reconstructed per GLOW_RECONSTRUCTION_FINAL spec.
// New hierarchy: eyebrow → hero → week vine → streak → divider → journey row.
// No text overlaps the hero. Streak is outside the hero.
// Existing animation triggers, press behavior, accessibility,
// and reduced-motion handling are preserved.
//
// MOTION v1.1 — Spec-Conformance Correction:
//   - Liquid body: duration-based timing (~700ms), NOT spring
//   - Meniscus: independent restrained spring/overshoot
//   - q1→q2: one-pass interior caustic lane
//   - q2→q3 Goal Complete: liquid timing + meniscus crest + caustic +
//     Glow-line response + vessel breath + Ripen + header crossfade
//   - Leaf Ripen: 1.00→0.94→1.06, translateY 0→-2→0, restrained highlight
//   - Journey: icon opacity/contraction + 1px mint hairline L→R + label crossfade
//   - Post-goal: downward caustic sweep (NOT ambient pulse), liquid+meniscus frozen
//   - Explicit priority-ordered composed timeline (not undifferentiated parallel)
//   - Max continuous event <= 2400ms
//   - Reduced motion: all canonical instantly, no translate/scale
//   - All terminal states identical to static renderer
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  useWindowDimensions,
  Pressable,
  Platform,
  AppState,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'
import {
  WEEKLY_GLOW_GOAL,
  getJourneyStage,
  getNextStage,
  getDaysToNextStage,
} from '../constants/glowJourneyStages'
import { useReducedMotion, EASING } from '../utils/motion'
import {
  buildGlowJourneyVisualState,
  clampProgress,
  surfaceY,
  getFillRatio,
  GLOW_PALETTE,
} from './GlowJourneyVisualState'
import GlowJourneyDropArtwork from './GlowJourneyDropArtwork'
import GlowJourneyStageIcon from './GlowJourneyStageIcon'

// Hero sizing — reduced to match RawLife Garden graphic footprint.
// Garden card artwork max is 140px (Math.min(cardWidth * 0.38, 140)).
// Glow hero is vertically elongated (200×260), so it must be narrower
// than the Garden artwork to have equivalent perceived visual weight.
const HERO_WIDTH_FACTOR = 0.35
const HERO_WIDTH_MIN = 105
const HERO_WIDTH_MAX = 120

// Card padding (spec §4)
const CARD_PADDING_TOP = 20
const CARD_PADDING_SIDES = 18
const CARD_PADDING_BOTTOM = 18
const CARD_RADIUS = 26

// ── Motion v1.1 timing constants (spec-conformance) ───────────
// Liquid body: duration-based, ~700ms, E_RISE character (decelerate)
const MOTION_LIQUID_RISE = 700
// Meniscus: independent spring with restrained overshoot
const MOTION_MENISCUS_SPRING = { damping: 22, stiffness: 120 }
// Caustic lane: one-pass interior sweep
const MOTION_CAUSTIC_DURATION = 500
// Glow-line response: temporary brightness pulse
const MOTION_GLOW_LINE_DURATION = 600
// Vessel breath: one restrained rim/bloom breath
const MOTION_VESSEL_BREATH_DURATION = 800
// Leaf Ripen: compression → settle, restrained
const MOTION_RIPEN_DURATION = 550
const MOTION_RIPEN_DELAY = 150
// Streak crossfade: numeral opacity
const MOTION_STREAK_CROSSFADE = 350
// Journey: icon + hairline + label
const MOTION_JOURNEY_DURATION = 700
const MOTION_JOURNEY_DELAY = 200 // deferred during Goal Complete
// Post-goal downward sweep
const MOTION_DEEPENING_DURATION = 600
// Bloom (goal-complete)
const MOTION_BLOOM_DURATION = 900

// ── Composed timeline max duration check ───────────────────────
// Priority order: Goal Complete > Journey > Deepening > Rise > Ripen > Streak
// Goal Complete: liquid(700) + meniscus(spring~600) + caustic(500) +
//   glow-line(600) + breath(800) + bloom(900) — all parallel = ~900ms
// Journey (deferred 200ms): 700ms → tail at 900ms
// Ripen (delayed 150ms): 550ms → tail at 700ms
// Streak: 350ms → tail at 350ms
// Max continuous: ~900ms + 200 + 700 = ~1800ms (well within 2400ms)

// Ripen amplitudes (v1.1 restrained)
const RIPEN_COMPRESS = 0.94
const RIPEN_SETTLE = 1.06
const RIPEN_LIFT = -2 // px translateY

function GlowJourneyDrop({
  streakCount = 0,
  entries = [],
  lifetimeDays = 0,
  weeklyQualifyingDays = 0,
  weeklyLeafStates = [],
  onPress,
  isReduced: isReducedProp,
  replayToken = 0,
}) {
  const reducedMotion = useReducedMotion()
  const isReduced = isReducedProp !== undefined ? isReducedProp : reducedMotion
  const { width: screenWidth } = useWindowDimensions()

  const contentWidth = useMemo(
    () => Math.max(260, screenWidth - 32 - CARD_PADDING_SIDES * 2),
    [screenWidth],
  )
  const heroWidth = useMemo(() => {
    const w = contentWidth * HERO_WIDTH_FACTOR
    return Math.max(HERO_WIDTH_MIN, Math.min(w, HERO_WIDTH_MAX))
  }, [contentWidth])
  const vineWidth = heroWidth

  const visualState = useMemo(
    () =>
      buildGlowJourneyVisualState({
        lifetimeDays,
        weeklyQualifyingDays,
        weeklyLeafStates,
        streakCount,
      }),
    [lifetimeDays, weeklyQualifyingDays, weeklyLeafStates, streakCount],
  )

  const stage = useMemo(() => getJourneyStage(lifetimeDays), [lifetimeDays])
  const nextStage = useMemo(() => getNextStage(lifetimeDays), [lifetimeDays])
  const daysToNext = useMemo(() => getDaysToNextStage(lifetimeDays), [lifetimeDays])

  const fillRatio = getFillRatio(weeklyQualifyingDays)
  const restingSurfaceY = surfaceY(0)
  const targetSurfaceY = surfaceY(fillRatio)

  // ── Animation refs ──────────────────────────────────────────
  const entranceAnim = useRef(new Animated.Value(isReduced ? 1 : 0)).current
  const pressScaleAnim = useRef(new Animated.Value(1)).current
  // Liquid body: timing-based (NOT spring)
  const liquidTranslateAnim = useRef(
    new Animated.Value(isReduced ? targetSurfaceY : restingSurfaceY),
  ).current
  // Meniscus: independent spring with overshoot
  const meniscusOffsetAnim = useRef(new Animated.Value(0)).current
  // Caustic lane: one-pass sweep
  const causticOpacityAnim = useRef(new Animated.Value(0)).current
  const causticYAnim = useRef(new Animated.Value(0)).current
  // Glow-line response
  const glowLineResponseAnim = useRef(new Animated.Value(0)).current
  // Vessel breath
  const vesselBreathAnim = useRef(new Animated.Value(0)).current
  // Bloom
  const bloomAnim = useRef(new Animated.Value(0)).current
  // Leaf Ripen: compression + lift + highlight
  const ripenScaleAnim = useRef(new Animated.Value(1)).current
  const ripenTranslateYAnim = useRef(new Animated.Value(0)).current
  const ripenHighlightAnim = useRef(new Animated.Value(0)).current
  // Streak crossfade
  const streakOpacityAnim = useRef(new Animated.Value(1)).current
  // Journey: icon + hairline + label
  const journeyIconOutAnim = useRef(new Animated.Value(0)).current
  const journeyIconInAnim = useRef(new Animated.Value(0)).current
  const journeyHairlineAnim = useRef(new Animated.Value(0)).current
  // Post-goal downward sweep
  const downwardSweepYAnim = useRef(new Animated.Value(0)).current
  const downwardSweepOpacityAnim = useRef(new Animated.Value(0)).current

  // ── Tracking refs ───────────────────────────────────────────
  const prevWeeklyDays = useRef(weeklyQualifyingDays)
  const prevLeafStatesRef = useRef(weeklyLeafStates)
  const prevStageKey = useRef(stage ? stage.key : null)
  const prevStreakCount = useRef(streakCount)
  const hasEnteredRef = useRef(false)
  const bloomFiredRef = useRef(false)
  const timelineRef = useRef(null)
  const pendingTimeoutsRef = useRef(new Set())

  // ── Animated state (bridges Animated → React for SVG) ───────
  const [animatedSurfaceY, setAnimatedSurfaceY] = useState(
    isReduced ? targetSurfaceY : restingSurfaceY,
  )
  const [bloomOpacity, setBloomOpacity] = useState(0)
  const [ripenLeafIndex, setRipenLeafIndex] = useState(-1)
  const [ripenScale, setRipenScale] = useState(1)
  const [ripenTranslateY, setRipenTranslateY] = useState(0)
  const [ripenHighlight, setRipenHighlight] = useState(0)
  const [streakOpacity, setStreakOpacity] = useState(1)
  const [meniscusOffsetY, setMeniscusOffsetY] = useState(0)
  const [causticOpacity, setCausticOpacity] = useState(0)
  const [causticY, setCausticY] = useState(0)
  const [glowLineResponse, setGlowLineResponse] = useState(0)
  const [vesselBreath, setVesselBreath] = useState(0)
  const [journeyIconOut, setJourneyIconOut] = useState(0)
  const [journeyIconIn, setJourneyIconIn] = useState(0)
  const [journeyHairline, setJourneyHairline] = useState(0)
  const [downwardSweepY, setDownwardSweepY] = useState(0)
  const [downwardSweepOpacity, setDownwardSweepOpacity] = useState(0)

  // ── Helper: tracked timeout (cancellable) ───────────────────
  const trackedTimeout = useCallback((fn, delay) => {
    const id = setTimeout(() => {
      pendingTimeoutsRef.current.delete(id)
      fn()
    }, delay)
    pendingTimeoutsRef.current.add(id)
    return id
  }, [])

  // ── Helper: clear all pending timeouts ──────────────────────
  const clearAllPendingTimeouts = useCallback(() => {
    pendingTimeoutsRef.current.forEach((id) => clearTimeout(id))
    pendingTimeoutsRef.current.clear()
  }, [])

  // ── Helper: cancel active timeline + pending timeouts ───────
  const cancelTimeline = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.stop()
      timelineRef.current = null
    }
    clearAllPendingTimeouts()
  }, [clearAllPendingTimeouts])

  // ── Helper: reset temp motion to canonical (NOT liquid) ─────
  // Used during transition interruption so temp values from the
  // previous transition don't bleed into the new one. Liquid is
  // left at its current animated position so the new transition
  // can animate from there.
  const resetTempMotionToCanonical = useCallback(() => {
    meniscusOffsetAnim.setValue(0)
    causticOpacityAnim.setValue(0)
    causticYAnim.setValue(0)
    glowLineResponseAnim.setValue(0)
    vesselBreathAnim.setValue(0)
    bloomAnim.setValue(0)
    ripenScaleAnim.setValue(1)
    ripenTranslateYAnim.setValue(0)
    ripenHighlightAnim.setValue(0)
    streakOpacityAnim.setValue(1)
    journeyIconOutAnim.setValue(0)
    journeyIconInAnim.setValue(0)
    journeyHairlineAnim.setValue(0)
    downwardSweepYAnim.setValue(0)
    downwardSweepOpacityAnim.setValue(0)
    setMeniscusOffsetY(0)
    setCausticOpacity(0)
    setCausticY(0)
    setGlowLineResponse(0)
    setVesselBreath(0)
    setBloomOpacity(
      visualState.heroState.isComplete ? visualState.heroState.completionBloomOpacity : 0,
    )
    setRipenLeafIndex(-1)
    setRipenScale(1)
    setRipenTranslateY(0)
    setRipenHighlight(0)
    setStreakOpacity(1)
    setJourneyIconOut(0)
    setJourneyIconIn(0)
    setJourneyHairline(0)
    setDownwardSweepY(0)
    setDownwardSweepOpacity(0)
  }, [
    visualState.heroState.isComplete,
    visualState.heroState.completionBloomOpacity,
    meniscusOffsetAnim,
    causticOpacityAnim,
    causticYAnim,
    glowLineResponseAnim,
    vesselBreathAnim,
    bloomAnim,
    ripenScaleAnim,
    ripenTranslateYAnim,
    ripenHighlightAnim,
    streakOpacityAnim,
    journeyIconOutAnim,
    journeyIconInAnim,
    journeyHairlineAnim,
    downwardSweepYAnim,
    downwardSweepOpacityAnim,
  ])

  // ── Helper: resolve ALL motion to canonical rest ────────────
  // Used for background/inactive — component remains mounted but
  // no new transition is starting. Everything snaps to canonical.
  const resolveToCanonicalRest = useCallback(() => {
    resetTempMotionToCanonical()
    liquidTranslateAnim.setValue(targetSurfaceY)
    setAnimatedSurfaceY(targetSurfaceY)
  }, [resetTempMotionToCanonical, targetSurfaceY, liquidTranslateAnim])

  // ── Helper: detect newly earned leaf ────────────────────────
  const detectNewlyEarnedLeaf = useCallback((prevLeaves, currLeaves) => {
    if (!prevLeaves || !currLeaves) return -1
    for (let i = 0; i < currLeaves.length && i < prevLeaves.length; i++) {
      const prevLogged = prevLeaves[i] ? prevLeaves[i].hasLog : false
      const currLogged = currLeaves[i] ? currLeaves[i].hasLog : false
      if (currLogged && !prevLogged) return i
    }
    return -1
  }, [])

  // ── Storyboard 1: Entrance ─────────────────────────────────
  // Replays on each intentional Explore tab focus (replayToken change).
  // replayToken is incremented by the parent screen on navigation focus.
  // Presentation-only — does not alter persisted Glow state.
  const prevReplayTokenRef = useRef(replayToken)
  useEffect(() => {
    // Reset entrance guard when replayToken changes (except first mount)
    if (prevReplayTokenRef.current !== replayToken) {
      prevReplayTokenRef.current = replayToken
      hasEnteredRef.current = false
      // Reset entrance animation values to initial frame
      entranceAnim.setValue(0)
      // Reset liquid to start position for replay
      if (!isReduced) {
        liquidTranslateAnim.setValue(visualState.heroState.surfaceY - 40)
      }
    }
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
      // Liquid rises with timing (NOT spring)
      Animated.timing(liquidTranslateAnim, {
        toValue: targetSurfaceY,
        duration: MOTION_LIQUID_RISE,
        easing: EASING.decelerate,
        useNativeDriver: false,
      }).start()
      const lId = liquidTranslateAnim.addListener(({ value }) => setAnimatedSurfaceY(value))
      trackedTimeout(() => liquidTranslateAnim.removeListener(lId), MOTION_LIQUID_RISE + 100)
    }
  }, [replayToken, isReduced, targetSurfaceY, fillRatio, visualState.heroState.completionBloomOpacity, visualState.heroState.surfaceY, entranceAnim, liquidTranslateAnim, setAnimatedSurfaceY, setBloomOpacity, trackedTimeout])

  // ── Storyboard 3: Progress update — composed timeline ──────
  // Priority: 1 Goal Complete, 2 Journey, 3 Deepening, 4 Rise, 5 Ripen, 6 Streak
  useEffect(() => {
    if (!hasEnteredRef.current) return
    const prevDays = prevWeeklyDays.current
    const progressAdvanced = weeklyQualifyingDays > prevDays
    const isPostGoal = prevDays >= WEEKLY_GLOW_GOAL
    const isGoalComplete = fillRatio >= 1 && progressAdvanced && !isPostGoal
    const newLeafIdx = detectNewlyEarnedLeaf(prevLeafStatesRef.current, weeklyLeafStates)
    const stageChanged = stage ? stage.key !== prevStageKey.current : false
    const streakChanged = streakCount !== prevStreakCount.current

    cancelTimeline()

    // Reset temp motion channels to canonical so stale values from
    // the previous transition don't bleed into the new one.
    // Liquid is left at its current position so the new transition
    // can animate from there.
    if (!isReduced) {
      resetTempMotionToCanonical()
    }

    if (isReduced) {
      // Reduced motion: all canonical instantly
      setAnimatedSurfaceY(targetSurfaceY)
      setMeniscusOffsetY(0)
      setCausticOpacity(0)
      setGlowLineResponse(0)
      setVesselBreath(0)
      setRipenLeafIndex(-1)
      setRipenScale(1)
      setRipenTranslateY(0)
      setRipenHighlight(0)
      setStreakOpacity(1)
      setJourneyIconOut(0)
      setJourneyIconIn(0)
      setJourneyHairline(0)
      setDownwardSweepY(0)
      setDownwardSweepOpacity(0)
      if (fillRatio >= 1 && !bloomFiredRef.current) {
        setBloomOpacity(visualState.heroState.completionBloomOpacity)
        bloomFiredRef.current = true
      }
      prevWeeklyDays.current = weeklyQualifyingDays
      prevLeafStatesRef.current = weeklyLeafStates
      prevStageKey.current = stage ? stage.key : null
      prevStreakCount.current = streakCount
      return
    }

    // ── Build composed timeline with explicit priority ────────
    // We use Animated.parallel for segments that overlap,
    // and Animated.sequence for deferred segments.
    const parallelSegments = []

    // ═══ Priority 1: Goal Complete (q2→q3) ═══
    if (isGoalComplete) {
      bloomFiredRef.current = true

      // 1a. Liquid body: timing-based rise (NOT spring)
      Animated.timing(liquidTranslateAnim, {
        toValue: targetSurfaceY,
        duration: MOTION_LIQUID_RISE,
        easing: EASING.decelerate,
        useNativeDriver: false,
      }).start()
      const lId = liquidTranslateAnim.addListener(({ value }) => setAnimatedSurfaceY(value))
      trackedTimeout(() => liquidTranslateAnim.removeListener(lId), MOTION_LIQUID_RISE + 200)

      // 1b. Meniscus: independent spring with restrained overshoot
      parallelSegments.push(
        Animated.spring(meniscusOffsetAnim, {
          toValue: 0,
          ...MOTION_MENISCUS_SPRING,
          useNativeDriver: false,
        }),
      )
      // Meniscus starts at a slight offset, springs to 0
      meniscusOffsetAnim.setValue(-4)
      const mId = meniscusOffsetAnim.addListener(({ value }) => setMeniscusOffsetY(value))
      trackedTimeout(() => {
        meniscusOffsetAnim.removeListener(mId)
        setMeniscusOffsetY(0)
      }, 800)

      // 1c. Caustic lane: one-pass interior sweep
      parallelSegments.push(
        Animated.sequence([
          Animated.timing(causticOpacityAnim, {
            toValue: 1,
            duration: MOTION_CAUSTIC_DURATION / 2,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          Animated.timing(causticOpacityAnim, {
            toValue: 0,
            duration: MOTION_CAUSTIC_DURATION / 2,
            easing: EASING.linear,
            useNativeDriver: false,
          }),
        ]),
      )
      // Caustic travels downward through vessel
      causticYAnim.setValue(40)
      Animated.timing(causticYAnim, {
        toValue: 220,
        duration: MOTION_CAUSTIC_DURATION,
        easing: EASING.accelerate,
        useNativeDriver: false,
      }).start()
      const cId = causticOpacityAnim.addListener(({ value }) => setCausticOpacity(value))
      const cyId = causticYAnim.addListener(({ value }) => setCausticY(value))
      trackedTimeout(() => {
        causticOpacityAnim.removeListener(cId)
        causticYAnim.removeListener(cyId)
        setCausticOpacity(0)
      }, MOTION_CAUSTIC_DURATION + 100)

      // 1d. Glow-line response: temporary brightness
      parallelSegments.push(
        Animated.sequence([
          Animated.timing(glowLineResponseAnim, {
            toValue: 1,
            duration: MOTION_GLOW_LINE_DURATION / 2,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          Animated.timing(glowLineResponseAnim, {
            toValue: 0,
            duration: MOTION_GLOW_LINE_DURATION / 2,
            easing: EASING.linear,
            useNativeDriver: false,
          }),
        ]),
      )
      const gId = glowLineResponseAnim.addListener(({ value }) => setGlowLineResponse(value))
      trackedTimeout(() => {
        glowLineResponseAnim.removeListener(gId)
        setGlowLineResponse(0)
      }, MOTION_GLOW_LINE_DURATION + 100)

      // 1e. Vessel breath: one restrained rim breath
      parallelSegments.push(
        Animated.sequence([
          Animated.timing(vesselBreathAnim, {
            toValue: 1,
            duration: MOTION_VESSEL_BREATH_DURATION / 2,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          Animated.timing(vesselBreathAnim, {
            toValue: 0,
            duration: MOTION_VESSEL_BREATH_DURATION / 2,
            easing: EASING.linear,
            useNativeDriver: false,
          }),
        ]),
      )
      const vId = vesselBreathAnim.addListener(({ value }) => setVesselBreath(value))
      trackedTimeout(() => {
        vesselBreathAnim.removeListener(vId)
        setVesselBreath(0)
      }, MOTION_VESSEL_BREATH_DURATION + 100)

      // 1f. Bloom (goal-complete)
      parallelSegments.push(
        Animated.sequence([
          Animated.timing(bloomAnim, {
            toValue: 1,
            duration: 520,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          Animated.timing(bloomAnim, {
            toValue: 0.7,
            duration: 380,
            easing: EASING.linear,
            useNativeDriver: false,
          }),
        ]),
      )
      const bId = bloomAnim.addListener(({ value }) => {
        setBloomOpacity(value * visualState.heroState.completionBloomOpacity)
      })
      trackedTimeout(() => bloomAnim.removeListener(bId), MOTION_BLOOM_DURATION + 100)

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    } else if (progressAdvanced && !isPostGoal) {
      // ═══ Priority 4: Pre-goal rise (q0→q1, q1→q2) ═══
      // Liquid body: timing-based (NOT spring)
      Animated.timing(liquidTranslateAnim, {
        toValue: targetSurfaceY,
        duration: MOTION_LIQUID_RISE,
        easing: EASING.decelerate,
        useNativeDriver: false,
      }).start()
      const lId = liquidTranslateAnim.addListener(({ value }) => setAnimatedSurfaceY(value))
      trackedTimeout(() => liquidTranslateAnim.removeListener(lId), MOTION_LIQUID_RISE + 200)

      // Meniscus: independent spring with restrained overshoot
      meniscusOffsetAnim.setValue(-3)
      Animated.spring(meniscusOffsetAnim, {
        toValue: 0,
        ...MOTION_MENISCUS_SPRING,
        useNativeDriver: false,
      }).start()
      const mId = meniscusOffsetAnim.addListener(({ value }) => setMeniscusOffsetY(value))
      trackedTimeout(() => {
        meniscusOffsetAnim.removeListener(mId)
        setMeniscusOffsetY(0)
      }, 700)

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})

      // q1→q2: caustic lane (Day-2 distinguishing feature)
      if (weeklyQualifyingDays === 2 || isGoalComplete) {
        causticYAnim.setValue(40)
        Animated.timing(causticYAnim, {
          toValue: 200,
          duration: MOTION_CAUSTIC_DURATION,
          easing: EASING.accelerate,
          useNativeDriver: false,
        }).start()
        Animated.sequence([
          Animated.timing(causticOpacityAnim, {
            toValue: 1,
            duration: MOTION_CAUSTIC_DURATION / 2,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          Animated.timing(causticOpacityAnim, {
            toValue: 0,
            duration: MOTION_CAUSTIC_DURATION / 2,
            easing: EASING.linear,
            useNativeDriver: false,
          }),
        ]).start()
        const cId = causticOpacityAnim.addListener(({ value }) => setCausticOpacity(value))
        const cyId = causticYAnim.addListener(({ value }) => setCausticY(value))
        trackedTimeout(() => {
          causticOpacityAnim.removeListener(cId)
          causticYAnim.removeListener(cyId)
          setCausticOpacity(0)
        }, MOTION_CAUSTIC_DURATION + 100)
      }
    } else {
      // Post-goal or non-progress: liquid stays at canonical
      setAnimatedSurfaceY(targetSurfaceY)
    }

    // ═══ Priority 3: Post-goal Deepening (q3→q4/q5/q6/q7) ═══
    // Liquid + meniscus ABSOLUTELY FROZEN. Downward caustic sweep.
    if (progressAdvanced && isPostGoal) {
      // Downward sweep travels inward/downward through vessel
      downwardSweepYAnim.setValue(60)
      downwardSweepOpacityAnim.setValue(0)
      Animated.parallel([
        Animated.timing(downwardSweepYAnim, {
          toValue: 240,
          duration: MOTION_DEEPENING_DURATION,
          easing: EASING.accelerate,
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.timing(downwardSweepOpacityAnim, {
            toValue: 1,
            duration: MOTION_DEEPENING_DURATION / 2,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          Animated.timing(downwardSweepOpacityAnim, {
            toValue: 0,
            duration: MOTION_DEEPENING_DURATION / 2,
            easing: EASING.linear,
            useNativeDriver: false,
          }),
        ]),
      ]).start()
      const dsyId = downwardSweepYAnim.addListener(({ value }) => setDownwardSweepY(value))
      const dsoId = downwardSweepOpacityAnim.addListener(({ value }) =>
        setDownwardSweepOpacity(value),
      )
      trackedTimeout(() => {
        downwardSweepYAnim.removeListener(dsyId)
        downwardSweepOpacityAnim.removeListener(dsoId)
        setDownwardSweepY(0)
        setDownwardSweepOpacity(0)
      }, MOTION_DEEPENING_DURATION + 100)
    }

    // ═══ Priority 5: Leaf Ripen ═══
    if (progressAdvanced && newLeafIdx >= 0) {
      setRipenLeafIndex(newLeafIdx)
      // v1.1 restrained: 1.00 → 0.94 → 1.06 → 1.00
      // translateY: 0 → -2 → 0
      // highlight: restrained mint, not broad gold
      const ripenSequence = Animated.parallel([
        Animated.sequence([
          // Compress
          Animated.timing(ripenScaleAnim, {
            toValue: RIPEN_COMPRESS,
            duration: MOTION_RIPEN_DURATION / 4,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          // Settle with slight overshoot
          Animated.timing(ripenScaleAnim, {
            toValue: RIPEN_SETTLE,
            duration: MOTION_RIPEN_DURATION / 4,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          // Return to canonical
          Animated.timing(ripenScaleAnim, {
            toValue: 1,
            duration: MOTION_RIPEN_DURATION / 2,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
        ]),
        // translateY: 0 → -2 → 0
        Animated.sequence([
          Animated.timing(ripenTranslateYAnim, {
            toValue: RIPEN_LIFT,
            duration: MOTION_RIPEN_DURATION / 3,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          Animated.timing(ripenTranslateYAnim, {
            toValue: 0,
            duration: (MOTION_RIPEN_DURATION * 2) / 3,
            easing: EASING.linear,
            useNativeDriver: false,
          }),
        ]),
        // Restrained highlight
        Animated.sequence([
          Animated.timing(ripenHighlightAnim, {
            toValue: 1,
            duration: MOTION_RIPEN_DURATION / 3,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          Animated.timing(ripenHighlightAnim, {
            toValue: 0,
            duration: (MOTION_RIPEN_DURATION * 2) / 3,
            easing: EASING.linear,
            useNativeDriver: false,
          }),
        ]),
      ])
      // Delay ripen slightly after liquid begins
      trackedTimeout(() => {
        ripenSequence.start()
      }, MOTION_RIPEN_DELAY)
      const sId = ripenScaleAnim.addListener(({ value }) => setRipenScale(value))
      const tId = ripenTranslateYAnim.addListener(({ value }) => setRipenTranslateY(value))
      const hId = ripenHighlightAnim.addListener(({ value }) => setRipenHighlight(value))
      trackedTimeout(
        () => {
          ripenScaleAnim.removeListener(sId)
          ripenTranslateYAnim.removeListener(tId)
          ripenHighlightAnim.removeListener(hId)
          setRipenLeafIndex(-1)
          setRipenScale(1)
          setRipenTranslateY(0)
          setRipenHighlight(0)
        },
        MOTION_RIPEN_DURATION + MOTION_RIPEN_DELAY + 100,
      )
    }

    // ═══ Priority 2: Journey advancement (deferred during Goal Complete) ═══
    if (stageChanged) {
      const journeyDelay = isGoalComplete ? MOTION_JOURNEY_DELAY : 0
      trackedTimeout(() => {
        // Outgoing icon: opacity down + slight contraction
        Animated.timing(journeyIconOutAnim, {
          toValue: 1,
          duration: MOTION_JOURNEY_DURATION / 3,
          easing: EASING.linear,
          useNativeDriver: false,
        }).start()
        // Incoming icon: opacity in + restrained scale settle
        Animated.timing(journeyIconInAnim, {
          toValue: 1,
          duration: MOTION_JOURNEY_DURATION / 2,
          easing: EASING.decelerate,
          useNativeDriver: false,
        }).start()
        // 1px mint hairline growing L→R
        Animated.timing(journeyHairlineAnim, {
          toValue: 1,
          duration: (MOTION_JOURNEY_DURATION * 2) / 3,
          easing: EASING.decelerate,
          useNativeDriver: false,
        }).start()
        // Hairline fades to zero after full width
        trackedTimeout(
          () => {
            Animated.timing(journeyHairlineAnim, {
              toValue: 0,
              duration: MOTION_JOURNEY_DURATION / 3,
              easing: EASING.linear,
              useNativeDriver: false,
            }).start()
          },
          (MOTION_JOURNEY_DURATION * 2) / 3,
        )
      }, journeyDelay)
      const joId = journeyIconOutAnim.addListener(({ value }) => setJourneyIconOut(value))
      const jiId = journeyIconInAnim.addListener(({ value }) => setJourneyIconIn(value))
      const jhId = journeyHairlineAnim.addListener(({ value }) => setJourneyHairline(value))
      trackedTimeout(
        () => {
          journeyIconOutAnim.removeListener(joId)
          journeyIconInAnim.removeListener(jiId)
          journeyHairlineAnim.removeListener(jhId)
          setJourneyIconOut(0)
          setJourneyIconIn(0)
          setJourneyHairline(0)
        },
        MOTION_JOURNEY_DURATION + journeyDelay + 100,
      )
    }

    // ═══ Priority 6: Streak crossfade (tail treatment) ═══
    if (streakChanged) {
      Animated.sequence([
        Animated.timing(streakOpacityAnim, {
          toValue: 0.3,
          duration: MOTION_STREAK_CROSSFADE / 2,
          easing: EASING.linear,
          useNativeDriver: false,
        }),
        Animated.timing(streakOpacityAnim, {
          toValue: 1,
          duration: MOTION_STREAK_CROSSFADE / 2,
          easing: EASING.linear,
          useNativeDriver: false,
        }),
      ]).start()
      const sId = streakOpacityAnim.addListener(({ value }) => setStreakOpacity(value))
      trackedTimeout(() => {
        streakOpacityAnim.removeListener(sId)
        setStreakOpacity(1)
      }, MOTION_STREAK_CROSSFADE + 100)
    }

    // Run parallel segments (Goal Complete sub-lanes)
    if (parallelSegments.length > 0) {
      timelineRef.current = Animated.parallel(parallelSegments)
      timelineRef.current.start(() => {
        timelineRef.current = null
      })
    }

    // Update tracking refs
    prevWeeklyDays.current = weeklyQualifyingDays
    prevLeafStatesRef.current = weeklyLeafStates
    prevStageKey.current = stage ? stage.key : null
    prevStreakCount.current = streakCount
  }, [
    fillRatio,
    weeklyQualifyingDays,
    weeklyLeafStates,
    streakCount,
    lifetimeDays,
    isReduced,
    targetSurfaceY,
    visualState.heroState.completionBloomOpacity,
    stage,
    cancelTimeline,
    detectNewlyEarnedLeaf,
    trackedTimeout,
    resetTempMotionToCanonical,
    liquidTranslateAnim,
    meniscusOffsetAnim,
    causticOpacityAnim,
    causticYAnim,
    glowLineResponseAnim,
    vesselBreathAnim,
    bloomAnim,
    ripenScaleAnim,
    ripenTranslateYAnim,
    ripenHighlightAnim,
    streakOpacityAnim,
    journeyIconOutAnim,
    journeyIconInAnim,
    journeyHairlineAnim,
    downwardSweepYAnim,
    downwardSweepOpacityAnim,
  ])

  // ── Cleanup on unmount + app background ─────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        cancelTimeline()
        // Component remains mounted — resolve all motion to canonical
        resolveToCanonicalRest()
      }
    })
    return () => {
      cancelTimeline()
      subscription.remove()
    }
  }, [cancelTimeline, resolveToCanonicalRest])

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

  const eyebrowColor =
    weeklyQualifyingDays >= WEEKLY_GLOW_GOAL ? GLOW_PALETTE.juiceMint : GLOW_PALETTE.inkMuted

  // ── Build artwork visual state with animated surface ───────
  const artworkVisualState = useMemo(
    () => ({
      ...visualState,
      heroState: {
        ...visualState.heroState,
        surfaceY: animatedSurfaceY,
        completionBloomOpacity: Math.max(
          bloomOpacity,
          visualState.heroState.isComplete ? visualState.heroState.completionBloomOpacity : 0,
        ),
      },
    }),
    [visualState, animatedSurfaceY, bloomOpacity],
  )

  // ── Entrance style ─────────────────────────────────────────
  const entranceOpacity = isReduced ? 1 : entranceAnim
  const entranceTranslateY = isReduced
    ? 0
    : entranceAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [8, 0],
      })

  const serifFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'

  // ── Journey row motion styles ──────────────────────────────
  // NO background flash — use icon opacity/contraction + hairline + label
  const journeyIconOutStyle =
    journeyIconOut > 0
      ? { opacity: 1 - journeyIconOut * 0.5, transform: [{ scale: 1 - journeyIconOut * 0.08 }] }
      : undefined
  const journeyIconInStyle =
    journeyIconIn > 0
      ? { opacity: journeyIconIn, transform: [{ scale: 0.9 + journeyIconIn * 0.1 }] }
      : undefined
  const journeyHairlineWidth = journeyHairline > 0 ? `${journeyHairline * 100}%` : '0%'

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
          transform: [{ translateY: entranceTranslateY }, { scale: pressScaleAnim }],
        }}
      >
        <View style={styles.card}>
          {/* 1. Eyebrow */}
          <Text style={[styles.eyebrow, { color: eyebrowColor }]}>{eyebrow.toUpperCase()}</Text>

          {/* 2. Hero (Living Juice Glow) */}
          <View style={styles.heroWrap}>
            <GlowJourneyDropArtwork
              visualState={artworkVisualState}
              heroWidth={heroWidth}
              vineWidth={vineWidth}
              surfaceTranslateY={animatedSurfaceY}
              isReduced={isReduced}
              ripenLeafIndex={ripenLeafIndex}
              ripenScale={ripenScale}
              ripenHighlight={ripenHighlight}
              ripenTranslateY={ripenTranslateY}
              meniscusOffsetY={meniscusOffsetY}
              causticOpacity={causticOpacity}
              causticY={causticY}
              glowLineResponse={glowLineResponse}
              vesselBreath={vesselBreath}
              downwardSweepY={downwardSweepY}
              downwardSweepOpacity={downwardSweepOpacity}
            />
          </View>

          {/* 3. Streak (outside hero, centred pair) */}
          <View style={styles.streakRow}>
            <Animated.Text
              style={[styles.streakNumeral, { opacity: streakOpacity }]}
              fontFamily={serifFontFamily}
            >
              {streakCount}
            </Animated.Text>
            <View style={styles.streakLabelWrap}>
              <Text style={styles.streakLabel}>DAY GLOW</Text>
              <Text style={styles.streakLabel}>STREAK</Text>
            </View>
          </View>

          {/* 4. Divider */}
          <View style={styles.divider} />

          {/* 5. Lifetime Journey row — icon/hairline/text treatment */}
          {stage ? (
            <View style={styles.journeyRow}>
              {/* Outgoing icon (fades out during stage change) */}
              {journeyIconOut > 0 ? (
                <Animated.View style={[styles.journeyIconWrap, journeyIconOutStyle]}>
                  <GlowJourneyStageIcon
                    stageKey={prevStageKey.current || stage.key}
                    size={22}
                    color={GLOW_PALETTE.juiceMint}
                  />
                </Animated.View>
              ) : null}
              {/* Incoming icon (fades in during stage change) */}
              {journeyIconIn > 0 ? (
                <Animated.View style={[styles.journeyIconWrap, journeyIconInStyle]}>
                  <GlowJourneyStageIcon
                    stageKey={stage.key}
                    size={22}
                    color={GLOW_PALETTE.juiceMint}
                  />
                </Animated.View>
              ) : null}
              {/* Default icon (when no transition) */}
              {journeyIconOut === 0 && journeyIconIn === 0 ? (
                <GlowJourneyStageIcon
                  stageKey={stage.key}
                  size={22}
                  color={GLOW_PALETTE.juiceMint}
                />
              ) : null}
              <View style={styles.journeyTextWrap}>
                <Text style={styles.journeyText}>
                  <Text style={styles.journeyStageName}>{stage.label}</Text>
                  <Text style={styles.journeyDot}> · </Text>
                  <Text>Lifetime Journey</Text>
                </Text>
                {/* Temporary 1px mint hairline growing L→R */}
                {journeyHairline > 0 && (
                  <View style={[styles.journeyHairline, { width: journeyHairlineWidth }]} />
                )}
              </View>
            </View>
          ) : (
            <View style={styles.journeyRow}>
              <GlowJourneyStageIcon stageKey="seed" size={22} color={GLOW_PALETTE.inkMuted} />
              <Text style={styles.journeyText}>Your journey starts with your first juice</Text>
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
  journeyIconWrap: {
    position: 'absolute',
    left: 0,
  },
  journeyTextWrap: {
    marginLeft: 31,
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
  journeyHairline: {
    height: 1,
    backgroundColor: GLOW_PALETTE.juiceMint,
    opacity: 0.5,
    marginTop: 2,
  },
})

export default GlowJourneyDrop
