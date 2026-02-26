// ─────────────────────────────────────────────────────────────
// PerformanceOnboardingScreen.js — 2-slide high-retention
// onboarding optimized for performance tracking identity.
// Slide 1: "Train your nutrition." → Start
// Slide 2: "Track nutrients like you track fitness." → First Scan
// Camera auto-opens after onboarding. No static final screen.
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { ArrowRight, ScanLine, X } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import MeshGradientBg from '../components/MeshGradientBg'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE, RADIUS, SHADOW } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'

const { width: W } = Dimensions.get('window')

const ONBOARDING_KEY = '@juicing_performance_onboarding_done'

const SLIDES = [
  {
    key: 'identity',
    headline: 'Train your nutrition.',
    sub: 'Your body responds to what you feed it.',
    cta: 'Start',
    ctaIcon: ArrowRight,
  },
  {
    key: 'tracking',
    headline: 'Track nutrients like\nyou track fitness.',
    sub: null,
    cta: 'Start My First Scan',
    ctaIcon: ScanLine,
  },
]

export default function PerformanceOnboardingScreen({ navigation }) {
  const [slideIndex, setSlideIndex] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const reducedMotion = useReducedMotion()

  const slide = SLIDES[slideIndex]
  const isLast = slideIndex === SLIDES.length - 1

  const animateTransition = useCallback((onMid, onDone) => {
    if (reducedMotion) {
      onMid()
      onDone()
      return
    }
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      easing: EASING.decelerate,
      useNativeDriver: true,
    }).start(() => {
      onMid()
      slideAnim.setValue(20)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
      ]).start(onDone)
    })
  }, [fadeAnim, slideAnim, reducedMotion])

  const handleCTA = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    trackEvent('performance_onboarding_slide', { slide_index: slideIndex })

    if (!isLast) {
      animateTransition(
        () => setSlideIndex((i) => i + 1),
        () => {}
      )
      return
    }

    // Last slide — mark done and go to camera
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
    } catch (e) { /* non-fatal */ }

    trackEvent('performance_onboarding_completed', {})

    // Navigate directly to camera — no static final screen
    navigation.replace('JuiceSnap', { openCamera: true })
  }, [slideIndex, isLast, navigation, animateTransition])

  const CtaIcon = slide.ctaIcon

  return (
    <View style={s.root}>
      <MeshGradientBg />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* Close button */}
        <TouchableOpacity
          style={s.closeBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={20} color={BRAND.text.muted} />
        </TouchableOpacity>

        {/* Progress dots */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[s.dot, i === slideIndex && s.dotActive]}
            />
          ))}
        </View>

        {/* Content */}
        <Animated.View
          style={[
            s.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={s.headline}>{slide.headline}</Text>
          {slide.sub && <Text style={s.sub}>{slide.sub}</Text>}
        </Animated.View>

        {/* CTA */}
        <View style={s.ctaWrap}>
          <TouchableOpacity
            onPress={handleCTA}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={slide.cta}
          >
            <LinearGradient
              colors={BRAND.cta.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.ctaBtn}
            >
              <Text style={s.ctaText}>{slide.cta}</Text>
              <CtaIcon size={18} color="#FFFFFF" strokeWidth={2} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

// ── Check if onboarding is complete ──────────────────────────

export async function isPerformanceOnboardingDone() {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY)
    return val === 'true'
  } catch (e) {
    return false
  }
}

export { ONBOARDING_KEY }

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.background.primary,
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  closeBtn: {
    position: 'absolute',
    top: SPACE.xl,
    right: SPACE.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACE.xxl,
    gap: SPACE.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dotActive: {
    backgroundColor: BRAND.cta.primary,
    width: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE.xxl,
  },
  headline: {
    fontSize: 36,
    fontWeight: FONT_WEIGHT.heavy,
    color: BRAND.text.primary,
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: SPACE.lg,
  },
  sub: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    lineHeight: 24,
  },
  ctaWrap: {
    paddingHorizontal: SPACE.xxl,
    paddingBottom: SPACE.xxl,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: RADIUS.xl,
    gap: SPACE.sm,
    ...SHADOW.md,
    shadowColor: BRAND.cta.shadow,
  },
  ctaText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
})
