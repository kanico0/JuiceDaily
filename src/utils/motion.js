// ─────────────────────────────────────────────────────────────
// motion.js — Easing constants, duration presets, and
// useReducedMotion hook for accessibility compliance.
// Based on Material motion guidance + Apple Reduce Motion APIs.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Easing } from 'react-native'

// ── Duration Presets (ms) ────────────────────────────────────
// Material guidance: ~195ms exit, ~225ms enter, ~300ms temporary

export const DURATION = {
  instant: 0,
  fast: 150,
  enter: 225,
  exit: 195,
  standard: 300,
  emphasis: 450,
  // Reduced-motion fallbacks
  crossfade: 175,
}

// ── Easing Curves ────────────────────────────────────────────
// Standard Material easing for transforms; linear for opacity

export const EASING = {
  standard: Easing.bezier(0.4, 0.0, 0.2, 1.0),
  decelerate: Easing.bezier(0.0, 0.0, 0.2, 1.0),
  accelerate: Easing.bezier(0.4, 0.0, 1.0, 1.0),
  sharp: Easing.bezier(0.4, 0.0, 0.6, 1.0),
  linear: Easing.linear,
}

// ── useReducedMotion Hook ────────────────────────────────────
// Returns true when the OS "Reduce Motion" setting is enabled.
// Components should use this to swap animations for crossfades
// or instant state changes.

export function useReducedMotion() {
  const [isReduced, setIsReduced] = useState(false)

  useEffect(() => {
    let mounted = true

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setIsReduced(enabled)
    })

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (mounted) setIsReduced(enabled)
      }
    )

    return () => {
      mounted = false
      if (subscription && subscription.remove) {
        subscription.remove()
      }
    }
  }, [])

  return isReduced
}

// ── Motion Config Helper ─────────────────────────────────────
// Returns animation config based on reduced-motion preference.
// Usage: const config = getMotionConfig(isReduced)
//        Animated.timing(val, { ...config.enter, toValue: 1 })

export function getMotionConfig(isReduced) {
  if (isReduced) {
    return {
      enter: {
        duration: DURATION.crossfade,
        easing: EASING.linear,
        useNativeDriver: true,
      },
      exit: {
        duration: DURATION.crossfade,
        easing: EASING.linear,
        useNativeDriver: true,
      },
      // For reduced motion: only opacity, no transforms
      properties: ['opacity'],
    }
  }

  return {
    enter: {
      duration: DURATION.enter,
      easing: EASING.decelerate,
      useNativeDriver: true,
    },
    exit: {
      duration: DURATION.exit,
      easing: EASING.accelerate,
      useNativeDriver: true,
    },
    properties: ['opacity', 'transform'],
  }
}

// ── Spring Config Presets ────────────────────────────────────
// For use with Animated.spring() — disabled when reduced motion

export const SPRING = {
  gentle: {
    tension: 100,
    friction: 12,
    useNativeDriver: true,
  },
  bouncy: {
    tension: 140,
    friction: 14,
    useNativeDriver: true,
  },
  stiff: {
    tension: 300,
    friction: 20,
    useNativeDriver: true,
  },
}

export function getSpringConfig(preset, isReduced) {
  if (isReduced) {
    return {
      duration: DURATION.crossfade,
      easing: EASING.linear,
      useNativeDriver: true,
    }
  }
  return SPRING[preset] || SPRING.gentle
}

// ─────────────────────────────────────────────────────────────
// Liquid-Flow Motion v2 — Extended motion system
// Gated behind ff_liquid_motion_v2 feature flag.
// Performance budget: ≤16ms per frame, ≤3 concurrent animations.
// ─────────────────────────────────────────────────────────────

// ── Liquid Fill Easing ───────────────────────────────────────
// Custom curve that mimics liquid settling into a container.

export const LIQUID_EASING = {
  fill: Easing.bezier(0.25, 0.46, 0.45, 0.94),
  drain: Easing.bezier(0.55, 0.06, 0.68, 0.19),
  settle: Easing.bezier(0.22, 1.0, 0.36, 1.0),
  ripple: Easing.bezier(0.0, 0.55, 0.45, 1.0),
}

export const LIQUID_DURATION = {
  fill: 600,
  drain: 400,
  ripple: 350,
  settle: 500,
  staggerDelay: 60,
}

// ── Staggered List Animation Helper ──────────────────────────
// Creates staggered entrance for list items within perf budget.
// Max concurrent: 3 animations at a time.

export function createStaggeredEntrance(animValues, isReduced, options = {}) {
  const {
    staggerDelay = LIQUID_DURATION.staggerDelay,
    maxConcurrent = 3,
    enterDuration = DURATION.enter,
  } = options

  if (isReduced) {
    // Reduced motion: fade all in at once
    return Animated.parallel(
      animValues.map(({ opacity }) =>
        Animated.timing(opacity, {
          toValue: 1,
          duration: DURATION.crossfade,
          easing: EASING.linear,
          useNativeDriver: true,
        })
      )
    )
  }

  // Batch animations to respect maxConcurrent budget
  const batches = []
  for (let i = 0; i < animValues.length; i += maxConcurrent) {
    const batch = animValues.slice(i, i + maxConcurrent)
    batches.push(
      Animated.stagger(
        staggerDelay,
        batch.map(({ opacity, translateY }) =>
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1,
              duration: enterDuration,
              easing: EASING.decelerate,
              useNativeDriver: true,
            }),
            ...(translateY
              ? [Animated.timing(translateY, {
                  toValue: 0,
                  duration: enterDuration,
                  easing: EASING.decelerate,
                  useNativeDriver: true,
                })]
              : []),
          ])
        )
      )
    )
  }

  return Animated.sequence(batches)
}

// ── Liquid Fill Animation Config ─────────────────────────────
// For progress bars, ring fills, and volume indicators.

export function getLiquidFillConfig(isReduced) {
  if (isReduced) {
    return {
      duration: DURATION.crossfade,
      easing: EASING.linear,
      useNativeDriver: false,
    }
  }
  return {
    duration: LIQUID_DURATION.fill,
    easing: LIQUID_EASING.fill,
    useNativeDriver: false,
  }
}

// ── Ripple Effect Config ─────────────────────────────────────
// For tap feedback on liquid-themed interactive elements.

export function getRippleConfig(isReduced) {
  if (isReduced) {
    return {
      duration: DURATION.crossfade,
      easing: EASING.linear,
      useNativeDriver: true,
      scale: { from: 1, to: 1 },
      opacity: { from: 0.3, to: 0 },
    }
  }
  return {
    duration: LIQUID_DURATION.ripple,
    easing: LIQUID_EASING.ripple,
    useNativeDriver: true,
    scale: { from: 0.6, to: 1.2 },
    opacity: { from: 0.4, to: 0 },
  }
}

// ── Choreography Helper ──────────────────────────────────────
// Sequences multiple animation phases with perf-safe delays.
// Each phase runs max 3 concurrent animations.

export function choreograph(phases, isReduced) {
  if (isReduced) {
    // Reduced: run all phases as simple parallel fades
    const allAnims = phases.flatMap((phase) =>
      phase.animations.map((anim) =>
        Animated.timing(anim.value, {
          toValue: anim.toValue,
          duration: DURATION.crossfade,
          easing: EASING.linear,
          useNativeDriver: anim.useNativeDriver !== false,
        })
      )
    )
    return Animated.parallel(allAnims)
  }

  return Animated.sequence(
    phases.map((phase) => {
      const phaseAnims = phase.animations.map((anim) =>
        Animated.timing(anim.value, {
          toValue: anim.toValue,
          duration: anim.duration || DURATION.enter,
          easing: anim.easing || EASING.decelerate,
          useNativeDriver: anim.useNativeDriver !== false,
        })
      )

      if (phase.parallel) {
        return Animated.parallel(phaseAnims)
      }
      return Animated.stagger(phase.stagger || 50, phaseAnims)
    })
  )
}

// ─────────────────────────────────────────────────────────────
// Liquid Motion Presets — Step 2 Phase 3
// Gated behind ff_liquid_motion feature flag.
// liquidSpring: organic, fluid spring for card transitions
// fadeSlide: combined opacity + translateY entrance
// pressSquish: micro-scale feedback on press
// ─────────────────────────────────────────────────────────────

export const LIQUID_SPRING = {
  damping: 18,
  stiffness: 90,
  mass: 1,
  useNativeDriver: true,
}

export const LIQUID_SPRING_SNAPPY = {
  damping: 22,
  stiffness: 160,
  mass: 0.8,
  useNativeDriver: true,
}

export function fadeSlide(opacity, translateY, isReduced, options = {}) {
  const { delay = 0, distance = 16, duration = DURATION.enter } = options

  if (isReduced) {
    return Animated.timing(opacity, {
      toValue: 1,
      duration: DURATION.crossfade,
      easing: EASING.linear,
      useNativeDriver: true,
      delay,
    })
  }

  return Animated.sequence([
    ...(delay > 0 ? [Animated.delay(delay)] : []),
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        ...LIQUID_SPRING,
      }),
    ]),
  ])
}

export function pressSquish(scaleAnim, isReduced) {
  if (isReduced) return { start: () => {}, release: () => {} }

  return {
    start: () => {
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        ...LIQUID_SPRING_SNAPPY,
      }).start()
    },
    release: () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        ...LIQUID_SPRING,
      }).start()
    },
  }
}

// ── Precision Wellness Motion Presets ────────────────────────
// Standardized motion vocabulary for the brand system.

export function liquidFade(opacity, scale, isReduced, options = {}) {
  const { delay = 0, duration = 250, fromScale = 0.97 } = options

  if (isReduced) {
    return Animated.timing(opacity, {
      toValue: 1,
      duration: DURATION.crossfade,
      easing: EASING.linear,
      useNativeDriver: true,
      delay,
    })
  }

  if (scale) {
    scale.setValue(fromScale)
  }

  return Animated.sequence([
    ...(delay > 0 ? [Animated.delay(delay)] : []),
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }),
      ...(scale
        ? [Animated.timing(scale, {
            toValue: 1,
            duration,
            easing: EASING.decelerate,
            useNativeDriver: true,
          })]
        : []),
    ]),
  ])
}

export function revealBloom(opacity, scale, isReduced, options = {}) {
  const { delay = 0, duration = 350, toScale = 1.08 } = options

  if (isReduced) {
    return Animated.timing(opacity, {
      toValue: 1,
      duration: DURATION.crossfade,
      easing: EASING.linear,
      useNativeDriver: true,
      delay,
    })
  }

  return Animated.sequence([
    ...(delay > 0 ? [Animated.delay(delay)] : []),
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: toScale,
        duration,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }),
    ]),
  ])
}

// ── Performance Guard ────────────────────────────────────────
// Tracks active animation count to stay within budget.

let activeAnimationCount = 0
const MAX_CONCURRENT_ANIMATIONS = 3

export function canStartAnimation() {
  return activeAnimationCount < MAX_CONCURRENT_ANIMATIONS
}

export function trackAnimationStart() {
  activeAnimationCount = Math.min(activeAnimationCount + 1, MAX_CONCURRENT_ANIMATIONS)
}

export function trackAnimationEnd() {
  activeAnimationCount = Math.max(activeAnimationCount - 1, 0)
}
