// ─────────────────────────────────────────────────────────────
// ScanCTA.tsx — Primary "Scan Produce" card with pulse animation
// Accepts highlight prop to trigger 2-3 pulse animations.
// ─────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Scan } from 'lucide-react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated'

interface ScanCTAProps {
  highlight?: boolean
  onPress: () => void
}

export function ScanCTA({ highlight, onPress }: ScanCTAProps) {
  const pulseScale = useSharedValue(1)
  const pulseGlow = useSharedValue(0)

  useEffect(() => {
    if (!highlight) return

    const dur = 400
    const ease = Easing.inOut(Easing.cubic)

    pulseScale.value = withSequence(
      withTiming(1.04, { duration: dur, easing: ease }),
      withTiming(1, { duration: dur, easing: ease }),
      withDelay(100, withTiming(1.04, { duration: dur, easing: ease })),
      withTiming(1, { duration: dur, easing: ease }),
      withDelay(100, withTiming(1.04, { duration: dur, easing: ease })),
      withTiming(1, { duration: dur, easing: ease }),
    )

    pulseGlow.value = withSequence(
      withTiming(1, { duration: dur, easing: ease }),
      withTiming(0, { duration: dur, easing: ease }),
      withDelay(100, withTiming(1, { duration: dur, easing: ease })),
      withTiming(0, { duration: dur, easing: ease }),
      withDelay(100, withTiming(1, { duration: dur, easing: ease })),
      withTiming(0, { duration: dur, easing: ease }),
    )
  }, [highlight])

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }))

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulseGlow.value * 0.3,
  }))

  return (
    <Animated.View style={[styles.wrapper, scaleStyle]}>
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Scan Produce"
      >
        <LinearGradient
          colors={['rgba(129, 199, 132, 0.12)', 'rgba(129, 199, 132, 0.04)']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.iconContainer}>
            <Scan size={36} color="#81C784" strokeWidth={1.8} />
          </View>
          <Text style={styles.title}>Scan Produce</Text>
          <Text style={styles.subtext}>Log today's ingredients</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 24,
    backgroundColor: 'rgba(129, 199, 132, 0.15)',
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(129, 199, 132, 0.15)',
  },
  gradient: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(129, 199, 132, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129, 199, 132, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F0F6FC',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtext: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.5)',
  },
})
