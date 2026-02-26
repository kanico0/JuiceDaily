// ─────────────────────────────────────────────────────────────
// MeshGradientBg.js — Layered liquid-depth mesh gradient
// Emerald / Deep Forest / Mint — slow-moving organic background
// Desaturated blobs (15–25%), radial highlight, edge vignette,
// specular overlay. Android-safe: LinearGradient layers only.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react'
import { StyleSheet, View, Animated, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const { width: W, height: H } = Dimensions.get('window')

export default function MeshGradientBg() {
  const drift1 = useRef(new Animated.Value(0)).current
  const drift2 = useRef(new Animated.Value(0)).current
  const opacity1 = useRef(new Animated.Value(0.18)).current
  const opacity2 = useRef(new Animated.Value(0.14)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(drift1, { toValue: 1, duration: 10000, useNativeDriver: true }),
          Animated.timing(opacity1, { toValue: 0.24, duration: 10000, useNativeDriver: true }),
          Animated.timing(drift2, { toValue: 1, duration: 12000, useNativeDriver: true }),
          Animated.timing(opacity2, { toValue: 0.20, duration: 12000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(drift1, { toValue: 0, duration: 10000, useNativeDriver: true }),
          Animated.timing(opacity1, { toValue: 0.18, duration: 10000, useNativeDriver: true }),
          Animated.timing(drift2, { toValue: 0, duration: 12000, useNativeDriver: true }),
          Animated.timing(opacity2, { toValue: 0.14, duration: 12000, useNativeDriver: true }),
        ]),
      ])
    ).start()
  }, [])

  const translateX1 = drift1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 30],
  })
  const translateY1 = drift1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  })
  const scale1 = drift1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.04, 1],
  })
  const translateX2 = drift2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -25],
  })
  const translateY2 = drift2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  })
  const scale2 = drift2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.06, 1],
  })

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base dark layer — deep green */}
      <LinearGradient
        colors={['#050B08', '#080F0C', '#0A1210']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Radial highlight — upper-left warmth */}
      <LinearGradient
        colors={['rgba(13,59,46,0.30)', 'rgba(13,59,46,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Emerald blob — top-left drift, desaturated */}
      <Animated.View
        style={[
          styles.blob,
          styles.blob1,
          {
            opacity: opacity1,
            transform: [
              { translateX: translateX1 },
              { translateY: translateY1 },
              { scale: scale1 },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#0A3024', '#14493A', '#081F18']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Mint blob — bottom-right drift, desaturated */}
      <Animated.View
        style={[
          styles.blob,
          styles.blob2,
          {
            opacity: opacity2,
            transform: [
              { translateX: translateX2 },
              { translateY: translateY2 },
              { scale: scale2 },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#0B3D2E', '#1F6B52', '#0A3024']}
          start={{ x: 0.3, y: 0.2 }}
          end={{ x: 0.7, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Deep forest accent — center drift */}
      <Animated.View
        style={[
          styles.blob,
          styles.blob3,
          {
            opacity: opacity2,
            transform: [
              { translateX: translateX1 },
              { translateY: translateY2 },
              { scale: scale1 },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#081F18', '#123D30', '#0A3024']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Specular highlight — faint curved light near top */}
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)', 'transparent']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 0.35 }}
        style={styles.specular}
      />

      {/* Edge vignette — darkens periphery for depth */}
      <LinearGradient
        colors={['transparent', 'rgba(5,11,8,0.4)']}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.vignetteLeft} />
      <View style={styles.vignetteRight} />
    </View>
  )
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
  blob1: {
    top: -H * 0.18,
    left: -W * 0.25,
    width: W * 1.0,
    height: W * 1.0,
  },
  blob2: {
    bottom: -H * 0.12,
    right: -W * 0.2,
    width: W * 0.9,
    height: W * 0.9,
  },
  blob3: {
    top: H * 0.32,
    left: W * 0.05,
    width: W * 0.65,
    height: W * 0.65,
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: H * 0.35,
  },
  vignetteLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: W * 0.15,
    backgroundColor: 'rgba(5,11,8,0.25)',
  },
  vignetteRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: W * 0.15,
    backgroundColor: 'rgba(5,11,8,0.25)',
  },
})
