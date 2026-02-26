// ─────────────────────────────────────────────────────────────
// TodayHubCard.js — Today Hub shell: liquid fill progress,
// streak status, and next recommended action.
// Gated behind ff_today_hub feature flag.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Droplets, Zap, Flame, ChevronRight } from 'lucide-react-native'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT, GLASS } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING, getMotionConfig } from '../utils/motion'
import { useFlags } from '../services/FeatureFlags'

// ── Liquid Fill Bar ──────────────────────────────────────────

function LiquidFillBar({ ratio, color, label, icon: Icon }) {
  const isReduced = useReducedMotion()
  const fillAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const config = getMotionConfig(isReduced)
    Animated.timing(fillAnim, {
      toValue: Math.min(ratio, 1),
      duration: isReduced ? DURATION.crossfade : DURATION.standard,
      easing: isReduced ? EASING.linear : EASING.decelerate,
      useNativeDriver: false,
    }).start()
  }, [ratio, isReduced])

  const widthInterp = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <View style={fillStyles.row}>
      <View style={fillStyles.iconWrap}>
        <Icon size={14} color={color} />
      </View>
      <View style={fillStyles.barOuter}>
        <Animated.View
          style={[
            fillStyles.barInner,
            { width: widthInterp, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[fillStyles.label, { color }]}>{label}</Text>
    </View>
  )
}

const fillStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barOuter: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  barInner: {
    height: '100%',
    borderRadius: 4,
    opacity: 0.85,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    width: 36,
    textAlign: 'right',
  },
})

// ── Next Action Card ─────────────────────────────────────────

function NextActionCard({ action, onPress }) {
  if (!action) return null

  return (
    <TouchableOpacity
      style={actionStyles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityHint={action.hint}
    >
      <View style={actionStyles.left}>
        <Text style={actionStyles.eyebrow}>NEXT UP</Text>
        <Text style={actionStyles.label}>{action.label}</Text>
      </View>
      <ChevronRight size={16} color={DARK.textMuted} />
    </TouchableOpacity>
  )
}

const actionStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(129,199,132,0.06)',
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    marginTop: SPACE.sm,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.12)',
  },
  left: {
    flex: 1,
  },
  eyebrow: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.heavy,
    color: DARK.green,
    letterSpacing: 1,
    marginBottom: 2,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
  },
})

// ── Main Today Hub Card ──────────────────────────────────────

export default function TodayHubCard({ todayLog, vitalityScore, streak, onLogJuice }) {
  const isReduced = useReducedMotion()
  const { isEnabled } = useFlags()
  const emotionalCopy = isEnabled('ff_emotional_copy')
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const config = getMotionConfig(isReduced)
    Animated.timing(fadeAnim, {
      toValue: 1,
      ...config.enter,
    }).start()
  }, [isReduced])

  // Calculate pillar fill ratios
  const baseRatio = todayLog.base ? 1 : 0
  const powerRatio = todayLog.power ? 1 : 0
  const kickRatio = todayLog.kick ? 1 : 0
  const totalFilled = baseRatio + powerRatio + kickRatio
  const overallRatio = totalFilled / 3

  // Determine next recommended action
  const nextAction = useMemo(() => {
    if (!todayLog.base) {
      return {
        label: emotionalCopy
          ? 'Build your Base — cucumber, celery, or melon'
          : 'Add a Base juice (cucumber, celery, or melon)',
        hint: emotionalCopy ? 'Tap to build your first juice today' : 'Tap to start logging a juice',
        target: 'log',
      }
    }
    if (!todayLog.power) {
      return {
        label: emotionalCopy
          ? 'Power up — kale, spinach, or beet'
          : 'Add a Power juice (kale, spinach, or beet)',
        hint: emotionalCopy ? 'Tap to add power to your day' : 'Tap to start logging a juice',
        target: 'log',
      }
    }
    if (!todayLog.kick) {
      return {
        label: emotionalCopy
          ? 'Add the Kick — ginger, lemon, or turmeric'
          : 'Add a Kick juice (ginger, lemon, or turmeric)',
        hint: emotionalCopy ? 'Tap to close your final ring' : 'Tap to start logging a juice',
        target: 'log',
      }
    }
    return {
      label: emotionalCopy
        ? 'All rings closed! Explore new recipes'
        : 'All rings closed! Explore recipes for tomorrow',
      hint: 'Tap to browse recipes',
      target: 'recipes',
    }
  }, [todayLog, emotionalCopy])

  const handleActionPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (onLogJuice) onLogJuice(nextAction.target)
  }

  return (
    <Animated.View style={[hubStyles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['rgba(22,27,34,0.95)', 'rgba(13,17,23,0.95)']}
        style={hubStyles.gradient}
      >
        {/* Header */}
        <View style={hubStyles.header}>
          <Text style={hubStyles.title}>{emotionalCopy ? 'Your Daily Flow' : "Today's Flow"}</Text>
          <View style={hubStyles.scorePill}>
            <Text style={hubStyles.scoreText}>
              {Math.round(overallRatio * 100)}%
            </Text>
          </View>
        </View>

        {/* Liquid Fill Bars */}
        <View style={hubStyles.fillSection}>
          <LiquidFillBar
            ratio={baseRatio}
            color="#64B5F6"
            label={baseRatio ? '✓' : '—'}
            icon={Droplets}
          />
          <LiquidFillBar
            ratio={powerRatio}
            color="#81C784"
            label={powerRatio ? '✓' : '—'}
            icon={Zap}
          />
          <LiquidFillBar
            ratio={kickRatio}
            color="#FFB74D"
            label={kickRatio ? '✓' : '—'}
            icon={Flame}
          />
        </View>

        {/* Streak Badge */}
        {streak > 0 && (
          <View style={hubStyles.streakRow}>
            <Text style={hubStyles.streakEmoji}>🔥</Text>
            <Text style={hubStyles.streakText}>{streak} day streak</Text>
          </View>
        )}

        {/* Next Action */}
        <NextActionCard action={nextAction} onPress={handleActionPress} />
      </LinearGradient>
    </Animated.View>
  )
}

const hubStyles = StyleSheet.create({
  container: {
    marginBottom: SPACE.lg,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: GLASS.border,
  },
  gradient: {
    padding: SPACE.lg,
    borderRadius: RADIUS.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.md,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  scorePill: {
    backgroundColor: 'rgba(129,199,132,0.12)',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.2)',
  },
  scoreText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.heavy,
    color: DARK.green,
  },
  fillSection: {
    marginBottom: SPACE.sm,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACE.xs,
  },
  streakEmoji: {
    fontSize: 14,
  },
  streakText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.orange,
  },
})
