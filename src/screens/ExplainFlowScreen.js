// ─────────────────────────────────────────────────────────────
// ExplainFlowScreen.js — 3-slide "How it works" micro walkthrough.
// Optimized for first-scan conversion: Outcome → Method → Progress.
// Final CTA routes directly to camera. Uses revealBloom on exit.
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScanLine, Sparkles, Activity, X } from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import GlassSurface from '../components/GlassSurface'
import { BRAND, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'

// ── Slide order: Outcome → Method → Progress ────────────────

const SLIDES = [
  {
    key: 'outcome',
    icon: Sparkles,
    iconColor: BRAND.accent.vitaminC,
    title: 'See the nutrients instantly',
    subtitle: 'Every ingredient is identified and analyzed.',
    mockData: [
      { name: 'Carrot', nutrient: 'Vitamin A', color: BRAND.accent.vitaminA },
      { name: 'Spinach', nutrient: 'Iron', color: BRAND.accent.iron },
      { name: 'Ginger', nutrient: 'Anti-inflammatory', color: BRAND.accent.antioxidant },
    ],
  },
  {
    key: 'method',
    icon: ScanLine,
    iconColor: BRAND.text.secondary,
    title: 'Scan your produce',
    subtitle: 'Point your camera at fresh ingredients.',
  },
  {
    key: 'progress',
    icon: Activity,
    iconColor: BRAND.accent.chlorophyll,
    title: 'Track your nutrient journey',
    subtitle: 'Just like fitness — but for your juice.',
    haloColors: [
      BRAND.accent.chlorophyll,
      BRAND.accent.potassium,
      BRAND.accent.vitaminC,
    ],
  },
]

// ── Mock nutrient card (Step 2) ──────────────────────────────

function MockNutrientCard({ data }) {
  return (
    <GlassSurface style={efStyles.mockCard} borderRadius={16}>
      {data.map((item) => (
        <View key={item.name} style={efStyles.mockRow}>
          <View style={[efStyles.mockDot, { backgroundColor: item.color }]} />
          <Text style={efStyles.mockName}>{item.name}</Text>
          <Text style={[efStyles.mockNutrient, { color: item.color }]}>
            {item.nutrient}
          </Text>
        </View>
      ))}
    </GlassSurface>
  )
}

// ── Mock halo preview (Step 3) ───────────────────────────────

function MockHaloPreview({ colors }) {
  return (
    <View style={efStyles.haloWrap}>
      {colors.map((c, i) => (
        <View
          key={i}
          style={[
            efStyles.haloRing,
            {
              borderColor: c,
              width: 80 + i * 28,
              height: 80 + i * 28,
              borderRadius: 40 + i * 14,
              opacity: 0.35 - i * 0.08,
            },
          ]}
        />
      ))}
      <View style={efStyles.haloCenterDot} />
    </View>
  )
}

// ── Mock scan frame (Step 1) ─────────────────────────────────

function MockScanFrame() {
  return (
    <GlassSurface style={efStyles.scanFrame} borderRadius={16}>
      <View style={efStyles.scanCornerTL} />
      <View style={efStyles.scanCornerTR} />
      <View style={efStyles.scanCornerBL} />
      <View style={efStyles.scanCornerBR} />
      <View style={efStyles.scanLine} />
    </GlassSurface>
  )
}

// ── Main Screen ──────────────────────────────────────────────

export default function ExplainFlowScreen({ navigation }) {
  const isReduced = useReducedMotion()
  const [slide, setSlide] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const opacity = useRef(new Animated.Value(0)).current
  const contentScale = useRef(new Animated.Value(isReduced ? 1 : 0.97)).current
  const dimOpacity = useRef(new Animated.Value(0)).current
  const bloomScale = useRef(new Animated.Value(1)).current

  const animateIn = useCallback(() => {
    opacity.setValue(0)
    contentScale.setValue(isReduced ? 1 : 0.97)

    if (isReduced) {
      opacity.setValue(1)
      return
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(contentScale, {
        toValue: 1,
        duration: 250,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }),
    ]).start()
  }, [isReduced])

  useEffect(() => {
    trackEvent('explain_flow_started', {})
    animateIn()
  }, [])

  useEffect(() => {
    trackEvent('explain_slide_viewed', { slide_index: slide })
    animateIn()
  }, [slide])

  const handleNext = useCallback(() => {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1)
    }
  }, [slide])

  const navigateToCamera = useCallback(() => {
    navigation.goBack()
    // Small delay to let goBack settle, then navigate to ScanFlow modal
    setTimeout(() => {
      navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { openCamera: true } })
    }, 50)
  }, [navigation])

  const handleReveal = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    trackEvent('explain_reveal_pressed', {})

    if (isReduced) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: DURATION.crossfade,
        easing: EASING.linear,
        useNativeDriver: true,
      }).start(() => navigateToCamera())
      return
    }

    // Step 1: Dim (5%) + Step 2: Bloom scale (1.0→1.05) + Step 3: Accent bloom
    // Total: ~450ms
    Animated.parallel([
      Animated.timing(dimOpacity, {
        toValue: 1,
        duration: 150,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(bloomScale, {
        toValue: 1.05,
        duration: 300,
        easing: EASING.decelerate,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(150),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => navigateToCamera())
  }, [isReduced, isExiting, navigateToCamera])

  const handleSkip = useCallback(() => {
    trackEvent('explain_skipped', { slide_index: slide })
    navigation.goBack()
  }, [navigation, slide])

  const current = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1
  const Icon = current.icon

  return (
    <View style={efStyles.root}>
      <MeshGradientBg />

      {/* Dim overlay for reveal bloom */}
      <Animated.View
        style={[efStyles.dimOverlay, { opacity: dimOpacity }]}
        pointerEvents="none"
      />

      <SafeAreaView style={efStyles.safe} edges={['top', 'bottom']}>
        {/* Close button */}
        <TouchableOpacity
          style={efStyles.closeBtn}
          onPress={handleSkip}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={20} color={BRAND.text.muted} />
        </TouchableOpacity>

        <Animated.View
          style={[
            efStyles.content,
            { opacity, transform: [{ scale: isLast ? bloomScale : contentScale }] },
          ]}
        >
          {/* Visual area */}
          <View style={efStyles.visualWrap}>
            {current.key === 'outcome' && current.mockData && (
              <MockNutrientCard data={current.mockData} />
            )}
            {current.key === 'method' && <MockScanFrame />}
            {current.key === 'progress' && current.haloColors && (
              <MockHaloPreview colors={current.haloColors} />
            )}
          </View>

          {/* Icon */}
          <View style={efStyles.iconWrap}>
            <Icon size={28} color={current.iconColor} strokeWidth={1.8} />
          </View>

          {/* Text */}
          <Text style={efStyles.title}>{current.title}</Text>
          <Text style={efStyles.subtitle}>{current.subtitle}</Text>

          {/* Slide dots */}
          <View style={efStyles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  efStyles.dot,
                  i === slide && efStyles.dotActive,
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* CTAs */}
        <View style={efStyles.ctaWrap}>
          {isLast ? (
            <>
              <TouchableOpacity
                style={efStyles.primaryBtn}
                onPress={handleReveal}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Reveal My Nutrients"
                disabled={isExiting}
              >
                <Text style={efStyles.primaryBtnText}>Reveal My Nutrients</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={efStyles.skipBtn}
                onPress={handleSkip}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Skip"
              >
                <Text style={efStyles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={efStyles.primaryBtn}
                onPress={handleNext}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Next"
              >
                <Text style={efStyles.primaryBtnText}>Next</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={efStyles.skipBtn}
                onPress={handleSkip}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Skip"
              >
                <Text style={efStyles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────

const CORNER_SIZE = 20
const CORNER_BORDER = 2

const efStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.background.primary,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',
    zIndex: 1,
  },
  safe: {
    flex: 1,
    zIndex: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  visualWrap: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND.glass.surface,
    borderWidth: 0.5,
    borderColor: BRAND.glass.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.secondary,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dotActive: {
    backgroundColor: BRAND.text.secondary,
    width: 18,
    borderRadius: 3,
  },
  ctaWrap: {
    paddingHorizontal: 32,
    paddingBottom: 16,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: BRAND.cta.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.heavy,
    color: '#FFFFFF',
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.muted,
  },

  // ── Mock scan frame ──
  scanFrame: {
    width: 180,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanCornerTL: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderColor: BRAND.text.muted,
    borderTopLeftRadius: 4,
  },
  scanCornerTR: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderColor: BRAND.text.muted,
    borderTopRightRadius: 4,
  },
  scanCornerBL: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderColor: BRAND.text.muted,
    borderBottomLeftRadius: 4,
  },
  scanCornerBR: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderColor: BRAND.text.muted,
    borderBottomRightRadius: 4,
  },
  scanLine: {
    width: 120,
    height: 1.5,
    backgroundColor: BRAND.accent.chlorophyll,
    opacity: 0.5,
  },

  // ── Mock nutrient card ──
  mockCard: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  mockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  mockName: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.primary,
  },
  mockNutrient: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },

  // ── Mock halo ──
  haloWrap: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  haloRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  haloCenterDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BRAND.accent.chlorophyll,
    opacity: 0.6,
  },
})
