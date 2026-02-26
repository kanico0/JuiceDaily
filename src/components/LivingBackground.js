// ─────────────────────────────────────────────────────────────
// LivingBackground.js — Subtle living gradient background
// On tap → soft ripple (300–450ms).
// Optional ultra-slow gradient drift when not reduced motion.
// Gated behind ff_liquid_background feature flag.
// Falls back to null (no-op) when flag is off.
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useCallback } from 'react'
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { useFlags } from '../services/FeatureFlags'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

export default function LivingBackground() {
  const { isEnabled } = useFlags()
  const isReduced = useReducedMotion()

  if (!isEnabled('ff_liquid_background')) return null

  return <LivingBgInner isReduced={isReduced} />
}

function LivingBgInner({ isReduced }) {
  const driftAnim = useRef(new Animated.Value(0)).current
  const rippleScale = useRef(new Animated.Value(0)).current
  const rippleOpacity = useRef(new Animated.Value(0)).current
  const rippleX = useRef(new Animated.Value(SCREEN_W / 2)).current
  const rippleY = useRef(new Animated.Value(SCREEN_H / 2)).current

  // Ultra-slow gradient drift (disabled for reduced motion)
  useEffect(() => {
    if (isReduced) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim, {
          toValue: 1,
          duration: 12000,
          easing: EASING.linear,
          useNativeDriver: true,
        }),
        Animated.timing(driftAnim, {
          toValue: 0,
          duration: 12000,
          easing: EASING.linear,
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [isReduced])

  const driftTranslateY = driftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  })

  const driftTranslateX = driftAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 4, 0],
  })

  // Tap → ripple
  const handlePress = useCallback((evt) => {
    if (isReduced) return
    const { locationX, locationY } = evt.nativeEvent
    rippleX.setValue(locationX)
    rippleY.setValue(locationY)
    rippleScale.setValue(0)
    rippleOpacity.setValue(0.12)

    Animated.parallel([
      Animated.timing(rippleScale, {
        toValue: 1,
        duration: 400,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(rippleOpacity, {
        toValue: 0,
        duration: 450,
        easing: EASING.linear,
        useNativeDriver: true,
      }),
    ]).start()
  }, [isReduced])

  const rippleTransform = [
    { scale: rippleScale.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.5] }) },
  ]

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={styles.container} pointerEvents="box-only">
        <Animated.View
          style={[
            styles.gradientWrap,
            !isReduced && {
              transform: [
                { translateY: driftTranslateY },
                { translateX: driftTranslateX },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(13,17,23,1)',
              'rgba(18,24,16,0.95)',
              'rgba(13,17,23,1)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          />
        </Animated.View>

        {/* Ripple overlay */}
        {!isReduced && (
          <Animated.View
            style={[
              styles.ripple,
              {
                opacity: rippleOpacity,
                transform: rippleTransform,
              },
            ]}
            pointerEvents="none"
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  gradientWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    flex: 1,
  },
  ripple: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(129,199,132,0.06)',
    alignSelf: 'center',
    top: '40%',
  },
})
