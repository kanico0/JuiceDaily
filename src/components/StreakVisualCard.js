// ─────────────────────────────────────────────────────────────
// StreakVisualCard.js — Enhanced streak display
// Shows "Day X of 7", grace day availability, and subtle
// grace-used indicator (non-judgmental tone).
// Uses StreakEngine without modifying its core logic.
// Emits streak_incremented, streak_grace_used, milestone_unlocked,
// badge_awarded analytics via AnalyticsService.
// Gated behind ff_streak_visual feature flag.
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native'
import { Flame, Shield, Pause } from 'lucide-react-native'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT, GLASS } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'

// ── Milestones ───────────────────────────────────────────────

const MILESTONES = [3, 7, 14, 21, 30, 60, 90]
const BADGES = {
  3: 'streak_3_day',
  7: 'streak_week',
  14: 'streak_2_week',
  30: 'streak_month',
}

// ── Day Dot ──────────────────────────────────────────────────

function DayDot({ dayIndex, currentStreak, isReduced }) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const isFilled = dayIndex < currentStreak
  const isCurrent = dayIndex === currentStreak - 1

  useEffect(() => {
    const delay = isReduced ? 0 : dayIndex * 40
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: isReduced ? DURATION.crossfade : DURATION.enter,
          easing: isReduced ? EASING.linear : EASING.decelerate,
          useNativeDriver: true,
        }),
        ...(isReduced ? [] : [
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: DURATION.enter,
            easing: EASING.decelerate,
            useNativeDriver: true,
          }),
        ]),
      ]).start()
    }, delay)
    return () => clearTimeout(timer)
  }, [isReduced, dayIndex])

  useEffect(() => {
    if (isReduced) scaleAnim.setValue(1)
  }, [isReduced])

  return (
    <Animated.View
      style={[
        dotStyles.dot,
        isFilled && dotStyles.dotFilled,
        isCurrent && dotStyles.dotCurrent,
        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
      ]}
      accessibilityLabel={`Day ${dayIndex + 1}: ${isFilled ? 'completed' : 'not yet'}`}
    >
      <Text style={[
        dotStyles.dayNum,
        isFilled && dotStyles.dayNumFilled,
      ]}>
        {dayIndex + 1}
      </Text>
    </Animated.View>
  )
}

const dotStyles = StyleSheet.create({
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotFilled: {
    backgroundColor: 'rgba(255,183,77,0.15)',
    borderColor: 'rgba(255,183,77,0.3)',
  },
  dotCurrent: {
    backgroundColor: 'rgba(255,183,77,0.25)',
    borderColor: '#FFB74D',
    borderWidth: 2,
  },
  dayNum: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
  },
  dayNumFilled: {
    color: DARK.orange,
  },
})

// ── Main StreakVisualCard ─────────────────────────────────────

export default function StreakVisualCard({ streakData }) {
  const isReduced = useReducedMotion()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const prevStreakRef = useRef(streakData.currentStreak)

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: isReduced ? DURATION.crossfade : DURATION.enter,
      easing: isReduced ? EASING.linear : EASING.decelerate,
      useNativeDriver: true,
    }).start()
  }, [isReduced])

  // Emit analytics when streak changes
  useEffect(() => {
    const prev = prevStreakRef.current
    const curr = streakData.currentStreak
    prevStreakRef.current = curr

    if (curr > prev && curr > 0) {
      trackEvent('streak_incremented', { streak_len: curr, source: 'streak_visual' })

      // Check milestones
      if (MILESTONES.includes(curr)) {
        trackEvent('milestone_unlocked', {
          milestone_enum: `day_${curr}`,
          streak_len: curr,
        })
      }

      // Check badges
      if (BADGES[curr]) {
        trackEvent('badge_awarded', {
          badge_enum: BADGES[curr],
          streak_len: curr,
        })
      }
    }
  }, [streakData.currentStreak])

  // Emit grace used analytics
  useEffect(() => {
    if (streakData.streakStatus === 'grace') {
      const graceUsed = streakData.graceDaysAllowed - streakData.graceDaysRemaining
      if (graceUsed > 0) {
        trackEvent('streak_grace_used', {
          streak_len: streakData.currentStreak,
          grace_days_used: graceUsed,
        })
      }
    }
  }, [streakData.streakStatus])

  const cycleDay = useMemo(() => {
    if (streakData.currentStreak === 0) return 0
    return ((streakData.currentStreak - 1) % 7) + 1
  }, [streakData.currentStreak])

  const showGraceIndicator = streakData.streakStatus === 'grace'
  const showPausedIndicator = streakData.isPaused

  return (
    <Animated.View
      style={[cardStyles.container, { opacity: fadeAnim }]}
      accessibilityRole="summary"
      accessibilityLabel={`Streak: Day ${cycleDay} of 7. ${streakData.message.text}`}
    >
      {/* Header */}
      <View style={cardStyles.header}>
        <View style={cardStyles.headerLeft}>
          <Flame size={16} color={DARK.orange} />
          <Text style={cardStyles.title}>
            {streakData.currentStreak > 0
              ? `Day ${cycleDay} of 7`
              : 'Start Your Streak'}
          </Text>
        </View>
        {streakData.currentStreak > 0 && (
          <Text style={cardStyles.totalStreak}>
            {streakData.currentStreak} day{streakData.currentStreak !== 1 ? 's' : ''} total
          </Text>
        )}
      </View>

      {/* 7-day progress dots */}
      <View style={cardStyles.dotsRow}>
        {Array.from({ length: 7 }, (_, i) => (
          <DayDot
            key={i}
            dayIndex={i}
            currentStreak={cycleDay}
            isReduced={isReduced}
          />
        ))}
      </View>

      {/* Streak message */}
      <Text style={cardStyles.message}>{streakData.message.text}</Text>

      {/* Grace day indicator */}
      {!showPausedIndicator && streakData.graceDaysRemaining > 0 && (
        <View style={cardStyles.graceRow}>
          <Shield size={12} color={showGraceIndicator ? DARK.orange : DARK.textMuted} />
          <Text style={[
            cardStyles.graceText,
            showGraceIndicator && cardStyles.graceTextActive,
          ]}>
            {showGraceIndicator
              ? 'Grace day in use — your streak is safe'
              : `${streakData.graceDaysRemaining} grace day${streakData.graceDaysRemaining !== 1 ? 's' : ''} available`}
          </Text>
        </View>
      )}

      {/* Paused indicator */}
      {showPausedIndicator && (
        <View style={cardStyles.graceRow}>
          <Pause size={12} color={DARK.textMuted} />
          <Text style={cardStyles.graceText}>Streak paused</Text>
        </View>
      )}

      {/* Longest streak */}
      {streakData.longestStreak > streakData.currentStreak && (
        <Text style={cardStyles.longestText}>
          Personal best: {streakData.longestStreak} days
        </Text>
      )}
    </Animated.View>
  )
}

const cardStyles = StyleSheet.create({
  container: {
    marginBottom: SPACE.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(22,27,34,0.95)',
    padding: SPACE.lg,
    borderWidth: 0.5,
    borderColor: GLASS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  totalStreak: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACE.md,
  },
  message: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
    textAlign: 'center',
    marginBottom: SPACE.sm,
  },
  graceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACE.xs,
  },
  graceText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
  graceTextActive: {
    color: DARK.orange,
  },
  longestText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    textAlign: 'center',
    marginTop: SPACE.sm,
  },
})
