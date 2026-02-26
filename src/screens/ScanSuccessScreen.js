// ─────────────────────────────────────────────────────────────
// ScanSuccessScreen.js — Post-scan success screen showing
// session metrics from the Nutrition Score system.
//
// Shows: Ingredient Diversity, Nutrients Discovered,
// Score Increase, New Total Momentum Score.
//
// Subtle celebration: soft glow + light haptic. No loud anims.
// Updates streak and metrics in real time via NutritionScoreStore.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  BackHandler,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Check, Leaf, Beaker, TrendingUp, Flame, X } from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import GlassSurface from '../components/GlassSurface'
import { useNutritionScore } from '../services/NutritionScoreStore'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE, RADIUS, SHADOW } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import { checkInToday } from '../services/glowStreak'
import { checkAchievements } from '../services/achievements'
import { refreshNudges } from '../services/NotificationNudges'
import { useActivation } from '../services/ActivationStore'
import AchievementOverlay from '../components/AchievementOverlay'

export default function ScanSuccessScreen({ route, navigation }) {
  const {
    ingredientCount = 0,
    nutrientsFound = 0,
    previousMomentum = 0,
    ingredientNames = [],
  } = route.params || {}

  const { momentum, streak, diversity, coverage } = useNutritionScore()
  const { activation } = useActivation()

  // Compute live score increase from pre-log snapshot
  const scoreIncrease = Math.max(0, momentum - previousMomentum)
  const reducedMotion = useReducedMotion()

  // ── Glow Streak auto check-in + Achievement check ──
  const [glowToast, setGlowToast] = useState(null)
  const [pendingAchievement, setPendingAchievement] = useState(null)
  useEffect(() => {
    ;(async () => {
      try {
        const result = await checkInToday()
        if (result.wasIncremented) {
          setGlowToast(`Glow streak: ${result.count} day${result.count !== 1 ? 's' : ''}`)
        }
        // Check achievements after log + streak update
        const totalLogs = (activation?.totalLogsCount || 0) + 1
        const streakCount = result.count || 0
        const newlyUnlocked = await checkAchievements({ totalLogs, streakCount })
        if (newlyUnlocked.length > 0) {
          // Delay slightly so toast shows first
          setTimeout(() => setPendingAchievement(newlyUnlocked[0]), 1500)
        }
      } catch (e) {
        console.warn('[GlowStreak] auto check-in failed:', e)
      }
    })()
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (!glowToast) return
    const t = setTimeout(() => setGlowToast(null), 3000)
    return () => clearTimeout(t)
  }, [glowToast])

  // ── Animations ──
  const glowAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const checkScale = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Light haptic on mount
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    trackEvent('scan_success_viewed', {
      ingredient_count: ingredientCount,
      nutrients_found: nutrientsFound,
      score_increase: scoreIncrease,
      new_momentum: momentum,
    })

    if (reducedMotion) {
      glowAnim.setValue(1)
      fadeAnim.setValue(1)
      slideAnim.setValue(0)
      checkScale.setValue(1)
      return
    }

    // Staggered entrance
    Animated.sequence([
      // Check icon scales in
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      // Content fades + slides up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
      ]),
    ]).start()

    // Soft glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 2000,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.2],
  })

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.navigate('PerformanceDashboard')
  }

  const handleScanAnother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.replace('JuiceSnap', { openCamera: true, source: 'camera' })
  }

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // ScanFlow is a modal in RootStack — walk up to RootStack and goBack
    // to dismiss the modal and land on MainTabs.
    // If we're inside a tab stack instead, pop to root then switch tab.
    let nav = navigation
    // Walk up to the RootStack (the one that owns 'Main' and 'ScanFlow')
    while (nav.getParent?.()) {
      nav = nav.getParent()
    }
    // If the root can go back (ScanFlow modal is on top of Main), do it
    if (nav.canGoBack?.()) {
      nav.goBack()
    } else {
      // Fallback: navigate to TodayTab
      nav.navigate('Main', { screen: 'TodayTab' })
    }
  }, [navigation])

  // Android hardware back → go home
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleDone()
      return true
    })
    return () => sub.remove()
  }, [handleDone])

  const metrics = useMemo(() => [
    {
      icon: Leaf,
      iconColor: BRAND.accent.chlorophyll,
      dimColor: BRAND.accentDim.chlorophyll,
      value: ingredientCount,
      label: 'Ingredients',
      sub: `${diversity.cycleUnique} unique this cycle`,
    },
    {
      icon: Beaker,
      iconColor: BRAND.accent.potassium,
      dimColor: BRAND.accentDim.potassium,
      value: nutrientsFound,
      label: 'Nutrients',
      sub: `${coverage.cycleNutrients}/8 discovered`,
    },
    {
      icon: TrendingUp,
      iconColor: BRAND.accent.vitaminC,
      dimColor: BRAND.accentDim.vitaminC,
      value: `+${scoreIncrease}`,
      label: 'Score Increase',
      sub: null,
    },
    {
      icon: Flame,
      iconColor: BRAND.accent.vitaminA,
      dimColor: BRAND.accentDim.vitaminA,
      value: `${streak.currentCycleStreak}d`,
      label: 'Streak',
      sub: null,
    },
  ], [ingredientCount, nutrientsFound, scoreIncrease, diversity, coverage, streak])

  return (
    <View style={s.root}>
      <MeshGradientBg />

      {/* Soft glow behind check icon */}
      <Animated.View style={[s.glowOrb, { opacity: glowOpacity }]}>
        <LinearGradient
          colors={['rgba(61,139,64,0.35)', 'rgba(61,139,64,0.0)']}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* Close button — top-right */}
        <Pressable
          onPress={handleDone}
          style={s.closeBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={22} color={BRAND.text.muted} />
        </Pressable>

        {/* Check icon */}
        <View style={s.checkArea}>
          <Animated.View
            style={[
              s.checkCircle,
              { transform: [{ scale: checkScale }] },
            ]}
          >
            <Check size={32} color="#FFFFFF" strokeWidth={2.5} />
          </Animated.View>
          <Text style={s.headline}>Session Logged</Text>
        </View>

        {/* Momentum score */}
        <Animated.View
          style={[
            s.momentumWrap,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <GlassSurface elevated style={s.momentumCard}>
            <Text style={s.momentumLabel}>Nutrition Momentum</Text>
            <Text style={s.momentumScore}>{momentum}</Text>
            <View style={s.momentumBar}>
              <View
                style={[
                  s.momentumFill,
                  { width: `${Math.min(momentum / 1000, 1) * 100}%` },
                ]}
              />
            </View>
          </GlassSurface>
        </Animated.View>

        {/* Metrics grid */}
        <Animated.View
          style={[
            s.metricsGrid,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {metrics.map((m) => (
            <GlassSurface key={m.label} style={s.metricCell} borderRadius={RADIUS.lg}>
              <View style={[s.metricIcon, { backgroundColor: m.dimColor }]}>
                <m.icon size={16} color={m.iconColor} strokeWidth={2} />
              </View>
              <Text style={s.metricValue}>{m.value}</Text>
              <Text style={s.metricLabel}>{m.label}</Text>
              {m.sub && <Text style={s.metricSub}>{m.sub}</Text>}
            </GlassSurface>
          ))}
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[s.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.85}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="View Today"
          >
            <LinearGradient
              colors={BRAND.cta.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.primaryBtn}
            >
              <Text style={s.primaryBtnText}>View Today</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleScanAnother}
            activeOpacity={0.7}
            hitSlop={4}
            style={s.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Scan Another"
          >
            <Text style={s.secondaryBtnText}>Scan Another</Text>
          </TouchableOpacity>

          <Pressable
            onPress={handleDone}
            style={({ pressed }) => [s.doneBtn, pressed && { opacity: 0.6 }]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Done — return to home"
          >
            <Text style={s.doneBtnText}>Done</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>

      {/* Glow Streak toast */}
      {glowToast && (
        <View style={s.glowToast}>
          <Flame size={14} color="#FFB74D" />
          <Text style={s.glowToastText}>{glowToast}</Text>
        </View>
      )}

      {/* Achievement Overlay */}
      <AchievementOverlay
        achievement={pendingAchievement}
        visible={!!pendingAchievement}
        onDismiss={() => setPendingAchievement(null)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.background.primary,
  },
  safe: {
    flex: 1,
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
  glowOrb: {
    position: 'absolute',
    top: '10%',
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
  },
  checkArea: {
    alignItems: 'center',
    paddingTop: SPACE.xxxl,
    marginBottom: SPACE.xl,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BRAND.cta.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACE.lg,
    ...SHADOW.glow,
  },
  headline: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    letterSpacing: -0.5,
  },
  momentumWrap: {
    paddingHorizontal: SPACE.xl,
    marginBottom: SPACE.lg,
  },
  momentumCard: {
    alignItems: 'center',
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.xl,
  },
  momentumLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: SPACE.xs,
  },
  momentumScore: {
    fontSize: 48,
    fontWeight: FONT_WEIGHT.heavy,
    color: BRAND.text.primary,
    letterSpacing: -2,
    marginBottom: SPACE.md,
  },
  momentumBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  momentumFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: BRAND.cta.primary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACE.xl,
    gap: SPACE.sm,
    marginBottom: SPACE.xl,
  },
  metricCell: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.sm,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
  metricValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.secondary,
    marginBottom: 2,
  },
  metricSub: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xxl,
    gap: SPACE.md,
  },
  primaryBtn: {
    height: 56,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.md,
    shadowColor: BRAND.cta.shadow,
  },
  primaryBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.muted,
  },
  doneBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.secondary,
  },
  glowToast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30,30,30,0.92)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,179,0,0.2)',
  },
  glowToastText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#FFB74D',
  },
})
