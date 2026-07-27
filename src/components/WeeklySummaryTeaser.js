import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { DARK, FONT_SIZE, FONT_WEIGHT } from '../constants/tokens'
import { trackEvent } from '../services/AnalyticsService'
import { shouldShowWeeklySummary, dismissWeeklySummary, buildWeeklySummaryData } from '../services/weeklySummary'

export default function WeeklySummaryTeaser({ juicesThisWeek, glowStreakCount, isReduced }) {
  const [weeklySummary, setWeeklySummary] = useState(null)
  const [showWeekly, setShowWeekly] = useState(false)
  const weeklyFade = useRef(new Animated.Value(0)).current
  const weeklySlide = useRef(new Animated.Value(-20)).current

  useEffect(() => {
    ;(async () => {
      const result = await shouldShowWeeklySummary()
      if (result.show) {
        const data = buildWeeklySummaryData({
          juicesThisWeek,
          glowStreak: glowStreakCount,
          recentNutrients: [],
        })
        setWeeklySummary(data)
        setShowWeekly(true)
        if (!isReduced) {
          Animated.parallel([
            Animated.timing(weeklyFade, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(weeklySlide, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]).start()
        } else {
          weeklyFade.setValue(1)
          weeklySlide.setValue(0)
        }
      }
    })()
  }, [glowStreakCount, juicesThisWeek, isReduced])

  const handleDismiss = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await dismissWeeklySummary()
    if (!isReduced) {
      Animated.timing(weeklyFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setShowWeekly(false)
      })
    } else {
      setShowWeekly(false)
    }
    trackEvent('weekly_summary_dismissed')
  }, [isReduced, weeklyFade])

  if (!showWeekly || !weeklySummary) return null

  return (
    <Animated.View style={[styles.card, { opacity: weeklyFade, transform: [{ translateY: weeklySlide }] }]}>
      <View style={styles.headerRow}>
        <Text style={styles.emoji}>🌟</Text>
        <Text style={styles.title}>Your Glow Week</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{weeklySummary.juicesThisWeek}</Text>
          <Text style={styles.statLabel}>juices</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{weeklySummary.glowStreak}d</Text>
          <Text style={styles.statLabel}>streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{weeklySummary.highlightNutrient}</Text>
          <Text style={styles.statLabel}>top nutrient</Text>
        </View>
      </View>
      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
          onPress={handleDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Keep the glow going"
        >
          <Text style={styles.primaryBtnText}>Keep the glow going</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.6 }]}
          onPress={handleDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Share glow"
        >
          <Text style={styles.secondaryBtnText}>Share glow</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,179,0,0.15)',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  emoji: {
    fontSize: 22,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2E7D32',
  },
  primaryBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
})
