// ─────────────────────────────────────────────────────────────
// SpectrumRings.js — Liquid-wave concentric vitality rings
// Animated SVG wave fill, spring physics, glassmorphism,
// organic shapes, breathing glow, haptic feedback
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated, Platform } from 'react-native'
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  ClipPath,
  Path,
  Rect,
} from 'react-native-svg'
import * as Haptics from 'expo-haptics'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

const SVG_SIZE = 290
const CENTER = SVG_SIZE / 2

export const RING_CONFIG = [
  {
    key: 'base',
    label: 'Base',
    radius: 122,
    strokeWidth: 18,
    ghostColor: 'rgba(100,181,246,0.06)',
    gradientId: 'gradBase',
    waveId: 'waveBase',
    stops: [
      { offset: '0%', color: '#90CAF9' },
      { offset: '50%', color: '#64B5F6' },
      { offset: '100%', color: '#1565C0' },
    ],
  },
  {
    key: 'power',
    label: 'Power',
    radius: 96,
    strokeWidth: 18,
    ghostColor: 'rgba(129,199,132,0.06)',
    gradientId: 'gradPower',
    waveId: 'wavePower',
    stops: [
      { offset: '0%', color: '#A5D6A7' },
      { offset: '50%', color: '#81C784' },
      { offset: '100%', color: '#2E7D32' },
    ],
  },
  {
    key: 'kick',
    label: 'Kick',
    radius: 70,
    strokeWidth: 18,
    ghostColor: 'rgba(255,183,77,0.06)',
    gradientId: 'gradKick',
    waveId: 'waveKick',
    stops: [
      { offset: '0%', color: '#FFE082' },
      { offset: '50%', color: '#FFB74D' },
      { offset: '100%', color: '#E65100' },
    ],
  },
]

// ── Wave Ring Arc — liquid fill with sloshing wave ───────────

function WaveRingArc({ ring, isFilled, prevFilledRef, entranceDelay }) {
  const fillAnim = useRef(new Animated.Value(0)).current
  const wavePhase = useRef(new Animated.Value(0)).current
  const circumference = 2 * Math.PI * ring.radius
  const [hasEnteredOnce, setHasEnteredOnce] = useState(false)

  // Entrance: spring physics (damping 15, stiffness 100)
  useEffect(() => {
    if (isFilled && !hasEnteredOnce) {
      setHasEnteredOnce(true)
      Animated.sequence([
        Animated.delay(entranceDelay),
        Animated.spring(fillAnim, {
          toValue: 1,
          damping: 15,
          stiffness: 100,
          useNativeDriver: false,
        }),
      ]).start()
    }
  }, [isFilled, hasEnteredOnce, entranceDelay])

  // Subsequent fills
  useEffect(() => {
    const wasFilledBefore = prevFilledRef.current
    prevFilledRef.current = isFilled
    if (!hasEnteredOnce) return
    if (isFilled && !wasFilledBefore) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Animated.spring(fillAnim, {
        toValue: 1,
        damping: 12,
        stiffness: 120,
        useNativeDriver: false,
      }).start()
    } else if (!isFilled) {
      Animated.spring(fillAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 80,
        useNativeDriver: false,
      }).start()
    }
  }, [isFilled, hasEnteredOnce])

  // Liquid wave oscillation
  useEffect(() => {
    if (!isFilled) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wavePhase, { toValue: 1, duration: 2400, useNativeDriver: false }),
        Animated.timing(wavePhase, { toValue: 0, duration: 2400, useNativeDriver: false }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [isFilled])

  const strokeDashoffset = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  })

  // Wave stroke width oscillation — simulates liquid surface tension
  const waveStroke = wavePhase.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      ring.strokeWidth,
      ring.strokeWidth + 2.5,
      ring.strokeWidth,
      ring.strokeWidth - 1.5,
      ring.strokeWidth,
    ],
  })

  return (
    <>
      {/* Ghost ring — dashed hint for empty state */}
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={ring.radius}
        stroke={ring.ghostColor}
        strokeWidth={ring.strokeWidth}
        fill="none"
        strokeDasharray={isFilled ? undefined : '4 8'}
      />
      {/* Gradient-filled ring with wave */}
      <AnimatedCircle
        cx={CENTER}
        cy={CENTER}
        r={ring.radius}
        stroke={`url(#${ring.gradientId})`}
        strokeWidth={isFilled ? waveStroke : ring.strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={strokeDashoffset}
        rotation="-90"
        origin={`${CENTER}, ${CENTER}`}
      />
      {/* Outer glow bloom */}
      {isFilled && (
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={ring.radius}
          stroke={ring.stops[0].color}
          strokeWidth={ring.strokeWidth + 14}
          fill="none"
          strokeLinecap="round"
          opacity={0.07}
          rotation="-90"
          origin={`${CENTER}, ${CENTER}`}
        />
      )}
      {/* Inner glow highlight — glass edge */}
      {isFilled && (
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={ring.radius}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
          fill="none"
          strokeLinecap="round"
          rotation="-90"
          origin={`${CENTER}, ${CENTER}`}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
        />
      )}
    </>
  )
}

// ── Animated Vitality Counter ────────────────────────────────

function VitalityCounter({ target, allClosed }) {
  const [display, setDisplay] = useState(0)
  const glowOpacity = useRef(new Animated.Value(0.8)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current

  useEffect(() => {
    if (target === 0) { setDisplay(0); return }
    let frame = 0
    const totalFrames = 40
    const interval = setInterval(() => {
      frame++
      const progress = frame / totalFrames
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * target))
      if (frame >= totalFrames) clearInterval(interval)
    }, 30)
    return () => clearInterval(interval)
  }, [target])

  // Entrance spring
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 15,
      stiffness: 100,
      useNativeDriver: true,
    }).start()
  }, [])

  // Breathing glow
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.85, duration: 2000, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <View style={styles.centerLabel}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <Animated.Text style={[
          styles.vitalityPercent,
          allClosed && styles.vitalityGlow,
          { opacity: glowOpacity },
        ]}>
          {display}
          <Text style={styles.vitalityUnit}>%</Text>
        </Animated.Text>
        <Text style={styles.vitalityLabel}>Vitality</Text>
      </Animated.View>
    </View>
  )
}

// ── Main Component ───────────────────────────────────────────

export default function SpectrumRings({ todayLog, vitalityScore }) {
  const allClosed = todayLog.base && todayLog.power && todayLog.kick
  const prismPulse = useRef(new Animated.Value(1)).current

  const prevBase = useRef(todayLog.base)
  const prevPower = useRef(todayLog.power)
  const prevKick = useRef(todayLog.kick)

  useEffect(() => {
    if (allClosed) {
      Animated.loop(
        Animated.sequence([
          Animated.spring(prismPulse, { toValue: 1.04, damping: 15, stiffness: 60, useNativeDriver: true }),
          Animated.spring(prismPulse, { toValue: 1, damping: 15, stiffness: 60, useNativeDriver: true }),
        ])
      ).start()
    } else {
      prismPulse.setValue(1)
    }
  }, [allClosed])

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: prismPulse }] }}>
        <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
          <Defs>
            {RING_CONFIG.map((ring) => (
              <SvgGradient key={ring.gradientId} id={ring.gradientId} x1="0" y1="0" x2="1" y2="1">
                {ring.stops.map((s, i) => (
                  <Stop key={i} offset={s.offset} stopColor={s.color} />
                ))}
              </SvgGradient>
            ))}
          </Defs>

          <WaveRingArc ring={RING_CONFIG[0]} isFilled={todayLog.base} prevFilledRef={prevBase} entranceDelay={200} />
          <WaveRingArc ring={RING_CONFIG[1]} isFilled={todayLog.power} prevFilledRef={prevPower} entranceDelay={500} />
          <WaveRingArc ring={RING_CONFIG[2]} isFilled={todayLog.kick} prevFilledRef={prevKick} entranceDelay={800} />
        </Svg>
      </Animated.View>

      <VitalityCounter target={vitalityScore} allClosed={allClosed} />

      {/* Empty state invite */}
      {!todayLog.base && !todayLog.power && !todayLog.kick && vitalityScore === 0 && (
        <View style={styles.emptyInvite}>
          <Text style={styles.emptyInviteText}>Tap below to fill your first ring</Text>
        </View>
      )}

      {/* Ring legend — glass pills */}
      <View style={styles.legend}>
        {RING_CONFIG.map((ring) => (
          <View key={ring.key} style={[
            styles.legendPill,
            todayLog[ring.key] && {
              backgroundColor: `${ring.stops[1].color}18`,
              borderColor: `${ring.stops[1].color}30`,
            },
          ]}>
            <View style={[
              styles.legendDot,
              {
                backgroundColor: todayLog[ring.key] ? ring.stops[1].color : ring.ghostColor,
                shadowColor: todayLog[ring.key] ? ring.stops[1].color : 'transparent',
                shadowOpacity: todayLog[ring.key] ? 0.6 : 0,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              },
            ]} />
            <Text style={[
              styles.legendText,
              todayLog[ring.key] && { color: ring.stops[1].color, fontWeight: '700' },
            ]}>
              {ring.label}
            </Text>
          </View>
        ))}
      </View>

      {allClosed && (
        <View style={styles.prismBadge}>
          <Text style={styles.prismText}>Today Complete</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  centerLabel: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: SVG_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vitalityPercent: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  vitalityUnit: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  vitalityGlow: {
    color: '#81C784',
    textShadowColor: 'rgba(76,175,80,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  vitalityLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginTop: -2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '600',
  },
  prismBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(76,175,80,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(76,175,80,0.25)',
  },
  prismText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#81C784',
    letterSpacing: 0.5,
  },
  emptyInvite: {
    marginTop: 6,
    backgroundColor: 'rgba(129,199,132,0.04)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.1)',
  },
  emptyInviteText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.3,
  },
})
