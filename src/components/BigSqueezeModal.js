// ─────────────────────────────────────────────────────────────
// BigSqueezeModal.js — "The Big Squeeze" Success Animation
// Liquid fill + bubble particles + haptic pulse + level-up toast
// + Post-Juice Summary (Micro-Load, Body Benefit, Trash-to-Treasure)
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg'
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Check, Zap, Leaf, Heart, ArrowRight } from 'lucide-react-native'
import { getLevelUp, getBodyBenefit } from '../constants/motivationData'
import { useFormatWeight } from '../utils/weightFormat'

const { width: SCREEN_W } = Dimensions.get('window')
const RING_SIZE = 200
const CENTER = RING_SIZE / 2

const COLOR_MAP = {
  green: {
    label: 'Chlorophyll Green',
    stops: ['#81C784', '#4CAF50', '#2E7D32'],
    glow: '#4CAF50',
  },
  orange: {
    label: 'Beta-Carotene Orange',
    stops: ['#FFB74D', '#FF9800', '#E65100'],
    glow: '#FF9800',
  },
  red: {
    label: 'Antioxidant Red',
    stops: ['#F48FB1', '#E91E63', '#880E4F'],
    glow: '#E91E63',
  },
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedRect = Animated.createAnimatedComponent(Rect)

// ── Bubble Particle ──────────────────────────────────────────

function BubbleParticle({ delay, startX, size }) {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -120,
            duration: 1800 + Math.random() * 800,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.7, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
          ]),
          Animated.timing(scale, { toValue: 1, duration: 1800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.3, duration: 0, useNativeDriver: true }),
        ]),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [])

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          left: startX,
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    />
  )
}

// ── Liquid Fill Ring ─────────────────────────────────────────

function LiquidFillRing({ color, fillProgress }) {
  const colorData = COLOR_MAP[color] || COLOR_MAP.green
  const radius = 80
  const strokeWidth = 18
  const circumference = 2 * Math.PI * radius

  const strokeDashoffset = fillProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  })

  return (
    <View style={styles.ringContainer}>
      <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <Defs>
          <LinearGradient id="fillGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={colorData.stops[0]} />
            <Stop offset="50%" stopColor={colorData.stops[1]} />
            <Stop offset="100%" stopColor={colorData.stops[2]} />
          </LinearGradient>
        </Defs>
        {/* Ghost ring */}
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Filling ring */}
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={radius}
          stroke="url(#fillGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${CENTER}, ${CENTER}`}
        />
        {/* Glow */}
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={radius}
          stroke={colorData.glow}
          strokeWidth={strokeWidth + 12}
          fill="none"
          opacity={0.08}
        />
      </Svg>

      {/* Bubbles inside ring area */}
      <View style={styles.bubblesContainer}>
        {Array.from({ length: 8 }).map((_, i) => (
          <BubbleParticle
            key={i}
            delay={i * 200}
            startX={30 + Math.random() * 140}
            size={4 + Math.random() * 8}
          />
        ))}
      </View>
    </View>
  )
}

// ── Main Modal ───────────────────────────────────────────────

export default function BigSqueezeModal({
  visible,
  onDismiss,
  filledColors = [],
  juiceData = null,
  vitalityScore = 0,
}) {
  const fillProgress = useRef(new Animated.Value(0)).current
  const checkScale = useRef(new Animated.Value(0)).current
  const cardSlide = useRef(new Animated.Value(60)).current
  const cardOpacity = useRef(new Animated.Value(0)).current
  const titleOpacity = useRef(new Animated.Value(0)).current
  const glowPulse = useRef(new Animated.Value(1)).current

  const { fmtG } = useFormatWeight()
  const primaryColor = filledColors[0] || 'green'
  const colorData = COLOR_MAP[primaryColor] || COLOR_MAP.green
  const levelUp = useMemo(() => getLevelUp(vitalityScore), [vitalityScore])
  const bodyBenefit = useMemo(() => getBodyBenefit(filledColors), [filledColors])

  const totalWeight = useMemo(() => {
    if (!juiceData?.ingredients) return 0
    return juiceData.ingredients.reduce((sum, ing) => sum + (ing.rawWeightG || 0), 0)
  }, [juiceData])

  const topNutrient = useMemo(() => {
    if (!juiceData?.totals) return null
    const { vitaminC = 0, vitaminA = 0, potassium = 0 } = juiceData.totals
    const dv = { vitaminC: vitaminC / 90, vitaminA: vitaminA / 900, potassium: potassium / 4700 }
    const best = Object.entries(dv).sort((a, b) => b[1] - a[1])[0]
    if (!best) return null
    const names = { vitaminC: 'Vitamin C', vitaminA: 'Vitamin A', potassium: 'Potassium' }
    return { name: names[best[0]] || best[0], percent: Math.round(best[1] * 100) }
  }, [juiceData])

  useEffect(() => {
    if (!visible) {
      fillProgress.setValue(0)
      checkScale.setValue(0)
      cardSlide.setValue(60)
      cardOpacity.setValue(0)
      titleOpacity.setValue(0)
      glowPulse.setValue(1)
      return
    }

    // Phase 1: Haptic pulse sequence (juicer thrum)
    const hapticSequence = async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      await new Promise((r) => setTimeout(r, 100))
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      await new Promise((r) => setTimeout(r, 100))
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      await new Promise((r) => setTimeout(r, 400))
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    hapticSequence()

    // Phase 2: Liquid fill animation
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(fillProgress, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: false,
      }),
    ]).start()

    // Phase 3: Checkmark pop
    Animated.sequence([
      Animated.delay(1200),
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start()

    // Phase 4: Level-up title
    Animated.sequence([
      Animated.delay(1600),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start()

    // Phase 5: Summary card slides up
    Animated.sequence([
      Animated.delay(2200),
      Animated.parallel([
        Animated.spring(cardSlide, {
          toValue: 0,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start()

    // Phase 6: Glow pulse loop
    Animated.sequence([
      Animated.delay(1400),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ),
    ]).start()
  }, [visible])

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDismiss()
  }, [onDismiss])

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        {/* ── Ring Animation ────────────────────────────────── */}
        <Animated.View style={{ transform: [{ scale: glowPulse }] }}>
          <LiquidFillRing color={primaryColor} fillProgress={fillProgress} />

          {/* Center checkmark */}
          <Animated.View style={[
            styles.checkCircle,
            {
              backgroundColor: colorData.glow,
              transform: [{ scale: checkScale }],
            },
          ]}>
            <Check size={32} color="#FFFFFF" strokeWidth={3} />
          </Animated.View>
        </Animated.View>

        {/* ── Level-Up Title ────────────────────────────────── */}
        <Animated.View style={[styles.levelUpWrap, { opacity: titleOpacity }]}>
          <Text style={styles.levelUpLabel}>Vitality Increasing...</Text>
          <Text style={[styles.levelUpTitle, { color: colorData.glow }]}>
            {levelUp.title}
          </Text>
          <Text style={styles.levelUpMsg}>{levelUp.message}</Text>
        </Animated.View>

        {/* ── Post-Juice Summary Card ───────────────────────── */}
        <Animated.View style={[
          styles.summaryCard,
          {
            transform: [{ translateY: cardSlide }],
            opacity: cardOpacity,
          },
        ]}>
          {/* Micro-Load */}
          {topNutrient && (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryIcon, { backgroundColor: 'rgba(76,175,80,0.12)' }]}>
                <Zap size={16} color="#81C784" />
              </View>
              <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryLabel}>The Micro-Load</Text>
                <Text style={styles.summaryValue}>
                  You just ingested {topNutrient.percent}% of your Daily {topNutrient.name}.
                </Text>
              </View>
            </View>
          )}

          {/* Body Benefit */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryIcon, { backgroundColor: 'rgba(233,30,99,0.12)' }]}>
              <Heart size={16} color="#F48FB1" />
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryLabel}>The Body Benefit</Text>
              <Text style={styles.summaryValue}>{bodyBenefit}</Text>
            </View>
          </View>

          {/* Trash-to-Treasure */}
          {totalWeight > 0 && (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryIcon, { backgroundColor: 'rgba(255,152,0,0.12)' }]}>
                <Leaf size={16} color="#FFB74D" />
              </View>
              <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryLabel}>Trash-to-Treasure</Text>
                <Text style={styles.summaryValue}>
                  You successfully processed {fmtG(totalWeight)} of fresh produce!
                </Text>
              </View>
            </View>
          )}

          {/* Dismiss CTA */}
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={handleDismiss}
            activeOpacity={0.8}
          >
            <ExpoGradient
              colors={[colorData.stops[1], colorData.stops[2]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dismissGradient}
            >
              <Text style={styles.dismissText}>Back to Dashboard</Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </ExpoGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  )
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13,17,23,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubblesContainer: {
    position: 'absolute',
    top: 30,
    left: 30,
    right: 30,
    bottom: 30,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  checkCircle: {
    position: 'absolute',
    top: RING_SIZE / 2 - 28,
    left: RING_SIZE / 2 - 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  levelUpWrap: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  levelUpLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B949E',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  levelUpTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  levelUpMsg: {
    fontSize: 14,
    color: '#8B949E',
    fontWeight: '500',
  },
  summaryCard: {
    width: '100%',
    backgroundColor: 'rgba(13,17,23,0.95)',
    borderRadius: 28,
    padding: 22,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    color: '#C9D1D9',
    lineHeight: 20,
    fontWeight: '500',
  },
  dismissBtn: {
    marginTop: 4,
    borderRadius: 28,
    overflow: 'hidden',
  },
  dismissGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
})
