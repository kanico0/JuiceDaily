// ─────────────────────────────────────────────────────────────
// LiquidNutrientOrb.js — Premium liquid glass orb with
// drifting nutrient particles. Fully reduced-motion compliant.
// No external animation libraries — uses only RN Animated.
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useMemo } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const ORB_SIZE = 140
const PARTICLE_COUNT = 8

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function createParticle(index) {
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2
  const radius = randomBetween(15, 45)
  return {
    id: index,
    startX: Math.cos(angle) * radius,
    startY: Math.sin(angle) * radius,
    endX: Math.cos(angle + Math.PI * 0.6) * randomBetween(20, 50),
    endY: Math.sin(angle + Math.PI * 0.6) * randomBetween(20, 50),
    size: randomBetween(3, 7),
    duration: randomBetween(4000, 8000),
    opacity: randomBetween(0.05, 0.12),
    color: index % 3 === 0
      ? 'rgba(129,199,132,1)'
      : index % 3 === 1
        ? 'rgba(165,214,167,1)'
        : 'rgba(200,230,201,1)',
  }
}

function DriftingParticle({ particle, isReduced }) {
  const posX = useRef(new Animated.Value(particle.startX)).current
  const posY = useRef(new Animated.Value(particle.startY)).current

  useEffect(() => {
    if (isReduced) return

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(posX, {
            toValue: particle.endX,
            duration: particle.duration,
            easing: undefined,
            useNativeDriver: true,
          }),
          Animated.timing(posY, {
            toValue: particle.endY,
            duration: particle.duration,
            easing: undefined,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(posX, {
            toValue: particle.startX,
            duration: particle.duration,
            easing: undefined,
            useNativeDriver: true,
          }),
          Animated.timing(posY, {
            toValue: particle.startY,
            duration: particle.duration,
            easing: undefined,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start()
  }, [isReduced])

  if (isReduced) {
    return (
      <View
        style={[
          orbStyles.particle,
          {
            width: particle.size,
            height: particle.size,
            borderRadius: particle.size / 2,
            backgroundColor: particle.color,
            opacity: particle.opacity,
            transform: [
              { translateX: particle.startX },
              { translateY: particle.startY },
            ],
          },
        ]}
      />
    )
  }

  return (
    <Animated.View
      style={[
        orbStyles.particle,
        {
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: particle.color,
          opacity: particle.opacity,
          transform: [{ translateX: posX }, { translateY: posY }],
        },
      ]}
    />
  )
}

export default function LiquidNutrientOrb({ isReduced }) {
  const particles = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, (_, i) => createParticle(i)),
    []
  )

  return (
    <View
      style={orbStyles.container}
      accessibilityRole="image"
      accessibilityLabel="Nutrient analysis orb"
    >
      {/* Outer soft glow */}
      <View style={orbStyles.outerGlow} />

      {/* Main orb body */}
      <View style={orbStyles.orbBody}>
        {/* Base glass fill */}
        <LinearGradient
          colors={[
            'rgba(129,199,132,0.08)',
            'rgba(129,199,132,0.03)',
            'rgba(20,40,30,0.12)',
          ]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={orbStyles.glassFill}
        />

        {/* Upper-left radial highlight */}
        <View style={orbStyles.radialHighlight} />

        {/* Inner vignette ring */}
        <View style={orbStyles.innerVignette} />

        {/* Drifting particles */}
        <View style={orbStyles.particleField}>
          {particles.map((p) => (
            <DriftingParticle key={p.id} particle={p} isReduced={isReduced} />
          ))}
        </View>

        {/* Top specular highlight — thin rim */}
        <View style={orbStyles.specularRim} />
      </View>

      {/* 1px highlight rim */}
      <View style={orbStyles.highlightRim} />
    </View>
  )
}

const orbStyles = StyleSheet.create({
  container: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerGlow: {
    position: 'absolute',
    width: ORB_SIZE + 20,
    height: ORB_SIZE + 20,
    borderRadius: (ORB_SIZE + 20) / 2,
    backgroundColor: 'rgba(129,199,132,0.04)',
    shadowColor: '#81C784',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 6,
  },
  orbBody: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,25,20,0.35)',
  },
  glassFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ORB_SIZE / 2,
  },
  radialHighlight: {
    position: 'absolute',
    top: 8,
    left: 12,
    width: ORB_SIZE * 0.5,
    height: ORB_SIZE * 0.4,
    borderRadius: ORB_SIZE * 0.25,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  innerVignette: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 12,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  particleField: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
  },
  specularRim: {
    position: 'absolute',
    top: 2,
    left: ORB_SIZE * 0.2,
    right: ORB_SIZE * 0.2,
    height: 18,
    borderTopLeftRadius: ORB_SIZE * 0.3,
    borderTopRightRadius: ORB_SIZE * 0.3,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  highlightRim: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
})
