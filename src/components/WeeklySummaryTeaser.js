import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS, SEMANTIC_TYPOGRAPHY, FONT_WEIGHT } from '../constants/tokens'
import { card, primaryAction, primaryActionLabel, secondaryAction, secondaryActionLabel } from '../constants/styleRecipes'
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
    ...card,
    width: '100%',
    borderColor: 'rgba(255,179,0,0.15)',
    marginBottom: SEMANTIC_SPACE.md,
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
    fontSize: SEMANTIC_TYPOGRAPHY.cardTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.cardTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
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
    fontSize: SEMANTIC_TYPOGRAPHY.cardTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.cardTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.textMuted,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: SEMANTIC_COLORS.borderSubtle,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    ...primaryAction,
    flex: 1,
  },
  primaryBtnText: {
    ...primaryActionLabel,
  },
  secondaryBtn: {
    ...secondaryAction,
    flex: 0,
  },
  secondaryBtnText: {
    ...secondaryActionLabel,
  },
})
