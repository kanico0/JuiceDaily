// ─────────────────────────────────────────────────────────────
// WeeklyInsightsCard.js — Non-judgmental weekly juicing insights
// No medical claims. Observational framing only.
// Gated behind ff_insights feature flag.
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { BarChart3, TrendingUp, Palette, ChevronRight } from 'lucide-react-native'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT, GLASS } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'

// ── Insight generators ───────────────────────────────────────
// All framing is observational ("you logged X") not prescriptive.

function generateInsights(weeklyStats, weeklyDiversity) {
  const insights = []

  // Frequency insight
  const logCount = weeklyStats?.totalLogs || 0
  if (logCount > 0) {
    insights.push({
      id: 'frequency',
      icon: BarChart3,
      color: '#64B5F6',
      title: `${logCount} juice${logCount !== 1 ? 's' : ''} this week`,
      body: logCount >= 5
        ? 'Consistent logging this week.'
        : logCount >= 3
          ? 'Solid mid-week momentum.'
          : 'Every log counts toward your pattern.',
    })
  }

  // Diversity insight
  const colorCount = weeklyDiversity?.uniqueColors || 0
  if (colorCount > 0) {
    const colorNames = weeklyDiversity?.colors || []
    insights.push({
      id: 'diversity',
      icon: Palette,
      color: '#81C784',
      title: `${colorCount} color${colorCount !== 1 ? 's' : ''} logged`,
      body: colorCount >= 5
        ? 'Great variety across the color spectrum this week.'
        : colorCount >= 3
          ? `You explored ${colorNames.slice(0, 3).join(', ')}. Nice range.`
          : 'Adding different colored produce increases variety.',
    })
  }

  // Trend insight (compare to previous)
  const prevLogs = weeklyStats?.previousWeekLogs || 0
  if (logCount > 0 && prevLogs > 0) {
    const diff = logCount - prevLogs
    if (diff > 0) {
      insights.push({
        id: 'trend',
        icon: TrendingUp,
        color: '#FFB74D',
        title: `+${diff} more than last week`,
        body: 'Your logging frequency is trending up.',
      })
    } else if (diff === 0) {
      insights.push({
        id: 'trend',
        icon: TrendingUp,
        color: '#FFB74D',
        title: 'Same pace as last week',
        body: 'Steady consistency is a great sign.',
      })
    }
  }

  // Pillar balance insight
  const pillars = weeklyStats?.pillarCounts || {}
  const base = pillars.base || 0
  const power = pillars.power || 0
  const kick = pillars.kick || 0
  const total = base + power + kick
  if (total > 0) {
    const dominant = base >= power && base >= kick ? 'Base' : power >= kick ? 'Power' : 'Kick'
    insights.push({
      id: 'balance',
      icon: BarChart3,
      color: '#CE93D8',
      title: `${dominant} was your top pillar`,
      body: `Base: ${base}, Power: ${power}, Kick: ${kick} — mixing pillars adds nutritional variety.`,
    })
  }

  return insights.slice(0, 3)
}

// ── Single Insight Row ───────────────────────────────────────

function InsightRow({ insight, index }) {
  const isReduced = useReducedMotion()
  const slideAnim = useRef(new Animated.Value(20)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const Icon = insight.icon

  useEffect(() => {
    const delay = isReduced ? 0 : index * 100
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: isReduced ? DURATION.crossfade : DURATION.enter,
          easing: isReduced ? EASING.linear : EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: isReduced ? DURATION.crossfade : DURATION.enter,
          easing: EASING.linear,
          useNativeDriver: true,
        }),
      ]).start()
    }, delay)
  }, [isReduced, index])

  return (
    <Animated.View
      style={[
        rowStyles.container,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[rowStyles.iconWrap, { backgroundColor: `${insight.color}15` }]}>
        <Icon size={16} color={insight.color} />
      </View>
      <View style={rowStyles.content}>
        <Text style={rowStyles.title}>{insight.title}</Text>
        <Text style={rowStyles.body}>{insight.body}</Text>
      </View>
    </Animated.View>
  )
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginBottom: 2,
  },
  body: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
    lineHeight: 18,
  },
})

// ── Main Card ────────────────────────────────────────────────

export default function WeeklyInsightsCard({ weeklyStats, weeklyDiversity, onViewFull }) {
  const insights = useMemo(
    () => generateInsights(weeklyStats, weeklyDiversity),
    [weeklyStats, weeklyDiversity]
  )

  if (insights.length === 0) return null

  return (
    <View style={cardStyles.container}>
      {/* Header */}
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>Weekly Insights</Text>
        <Text style={cardStyles.subtitle}>Your patterns this week</Text>
      </View>

      {/* Insight rows */}
      {insights.map((insight, i) => (
        <InsightRow key={insight.id} insight={insight} index={i} />
      ))}

      {/* View full report link */}
      {onViewFull && (
        <TouchableOpacity
          style={cardStyles.viewFull}
          onPress={onViewFull}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="View full weekly report"
        >
          <Text style={cardStyles.viewFullText}>View full report</Text>
          <ChevronRight size={14} color={DARK.green} />
        </TouchableOpacity>
      )}

      {/* Disclaimer */}
      <Text style={cardStyles.disclaimer}>
        These observations reflect your logged data, not health advice.
      </Text>
    </View>
  )
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.xl,
    padding: SPACE.lg,
    marginBottom: SPACE.lg,
    borderWidth: 0.5,
    borderColor: GLASS.border,
  },
  header: {
    marginBottom: SPACE.md,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
  viewFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: SPACE.md,
    paddingVertical: SPACE.sm,
    backgroundColor: 'rgba(129,199,132,0.06)',
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.12)',
  },
  viewFullText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.green,
  },
  disclaimer: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    textAlign: 'center',
    marginTop: SPACE.md,
    opacity: 0.6,
  },
})
