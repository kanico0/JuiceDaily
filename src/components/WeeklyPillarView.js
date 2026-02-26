// ─────────────────────────────────────────────────────────────
// WeeklyPillarView.js — 7-day consistency wheel + pillar counts
// Shows which nutrient pillars were hit each day of the week.
// Gated behind ff_weekly_pillar_view feature flag.
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT, GLASS } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import {
  NUTRIENT_PILLARS,
  PILLAR_KEYS,
  PILLAR_COUNT,
  computeWeeklyPillarCounts,
  scoreDayPillars,
  getWeekStartKey,
  getTodayKey,
} from '../services/NutrientPillars'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WHEEL_SIZE = 200
const WHEEL_CENTER = WHEEL_SIZE / 2
const WHEEL_RADIUS = 78
const DOT_RADIUS = 12

// ── Day Dot on Wheel ────────────────────────────────────────

function DayDot({ dayIndex, filledCount, totalPillars, isToday }) {
  const angle = (dayIndex * 360) / 7 - 90
  const rad = (angle * Math.PI) / 180
  const cx = WHEEL_CENTER + WHEEL_RADIUS * Math.cos(rad)
  const cy = WHEEL_CENTER + WHEEL_RADIUS * Math.sin(rad)
  const ratio = totalPillars > 0 ? filledCount / totalPillars : 0

  // Color intensity based on fill ratio
  const opacity = filledCount > 0 ? 0.3 + ratio * 0.7 : 0.08

  return (
    <>
      <Circle
        cx={cx}
        cy={cy}
        r={DOT_RADIUS}
        fill={filledCount > 0 ? `rgba(129,199,132,${opacity})` : 'rgba(255,255,255,0.04)'}
        stroke={isToday ? DARK.green : 'rgba(255,255,255,0.06)'}
        strokeWidth={isToday ? 2 : 0.5}
      />
    </>
  )
}

// ── Pillar Count Bar ────────────────────────────────────────

function PillarCountRow({ pillarKey, count, maxDays }) {
  const pillar = NUTRIENT_PILLARS[pillarKey]
  const ratio = maxDays > 0 ? count / maxDays : 0
  const barWidth = Math.max(ratio * 100, 2)

  return (
    <View style={barStyles.row}>
      <View style={[barStyles.dot, { backgroundColor: pillar.color }]} />
      <Text style={barStyles.label} numberOfLines={1}>{pillar.shortLabel}</Text>
      <View style={barStyles.track}>
        <View
          style={[
            barStyles.fill,
            {
              width: `${barWidth}%`,
              backgroundColor: pillar.color,
            },
          ]}
        />
      </View>
      <Text style={barStyles.count}>{count}</Text>
    </View>
  )
}

// ── Main WeeklyPillarView ───────────────────────────────────

export default function WeeklyPillarView({ challengeDays }) {
  const isReduced = useReducedMotion()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const hasTracked = useRef(false)

  const todayKey = useMemo(() => getTodayKey(), [])
  const weekStartKey = useMemo(() => getWeekStartKey(todayKey), [todayKey])

  // Compute pillar counts for the week
  const weeklyPillarCounts = useMemo(
    () => computeWeeklyPillarCounts(challengeDays, weekStartKey, todayKey),
    [challengeDays, weekStartKey, todayKey]
  )

  // Compute per-day filled counts for the wheel
  const dayData = useMemo(() => {
    const result = []
    const start = new Date(weekStartKey + 'T00:00:00')
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().split('T')[0]
      const dayLog = challengeDays?.[key]
      const hits = dayLog ? scoreDayPillars(dayLog) : {}
      const filledCount = PILLAR_KEYS.filter((k) => hits[k]).length
      result.push({
        dateKey: key,
        filledCount,
        isToday: key === todayKey,
        isFuture: key > todayKey,
      })
    }
    return result
  }, [challengeDays, weekStartKey, todayKey])

  const daysWithLogs = dayData.filter((d) => d.filledCount > 0).length

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: isReduced ? DURATION.crossfade : DURATION.enter,
      easing: isReduced ? EASING.linear : EASING.decelerate,
      useNativeDriver: true,
    }).start()
  }, [isReduced])

  // Analytics
  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true
      trackEvent('weekly_progress_viewed', {
        days_with_logs: daysWithLogs,
      })
    }
  }, [daysWithLogs])

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim }]}
      accessibilityRole="summary"
      accessibilityLabel={`Weekly progress: ${daysWithLogs} of 7 days with juice logs`}
    >
      <Text style={styles.title}>This Week's Pillars</Text>

      <View style={styles.body}>
        {/* Radial Wheel */}
        <View style={styles.wheelWrap}>
          <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
            {/* Connecting ring */}
            <Circle
              cx={WHEEL_CENTER}
              cy={WHEEL_CENTER}
              r={WHEEL_RADIUS}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
              fill="none"
            />
            {/* Day dots */}
            {dayData.map((day, i) => (
              <DayDot
                key={day.dateKey}
                dayIndex={i}
                filledCount={day.isFuture ? 0 : day.filledCount}
                totalPillars={PILLAR_COUNT}
                isToday={day.isToday}
              />
            ))}
          </Svg>

          {/* Center summary */}
          <View style={styles.wheelCenter}>
            <Text style={styles.wheelCenterNum}>{daysWithLogs}</Text>
            <Text style={styles.wheelCenterLabel}>of 7 days</Text>
          </View>

          {/* Day labels around wheel */}
          {DAY_LABELS.map((label, i) => {
            const angle = (i * 360) / 7 - 90
            const rad = (angle * Math.PI) / 180
            const lx = WHEEL_CENTER + (WHEEL_RADIUS + 22) * Math.cos(rad)
            const ly = WHEEL_CENTER + (WHEEL_RADIUS + 22) * Math.sin(rad)
            return (
              <Text
                key={`label-${i}`}
                style={[
                  styles.dayLabel,
                  {
                    left: lx - 8,
                    top: ly - 7,
                  },
                  dayData[i]?.isToday && styles.dayLabelToday,
                ]}
              >
                {label}
              </Text>
            )
          })}
        </View>

        {/* Pillar count bars */}
        <View style={styles.barsWrap}>
          {PILLAR_KEYS.map((key) => (
            <PillarCountRow
              key={key}
              pillarKey={key}
              count={weeklyPillarCounts[key] || 0}
              maxDays={7}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  )
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.md,
    backgroundColor: GLASS.background,
    borderRadius: GLASS.borderRadius,
    borderWidth: 0.5,
    borderColor: GLASS.border,
    padding: SPACE.lg,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginBottom: SPACE.md,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  wheelWrap: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    position: 'relative',
  },
  wheelCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelCenterNum: {
    fontSize: 28,
    fontWeight: '900',
    color: DARK.textPrimary,
  },
  wheelCenterLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
    marginTop: -2,
  },
  dayLabel: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    width: 16,
    textAlign: 'center',
  },
  dayLabelToday: {
    color: DARK.green,
  },
  barsWrap: {
    flex: 1,
    gap: 6,
  },
})

const barStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    width: 36,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.7,
  },
  count: {
    width: 16,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textSecondary,
    textAlign: 'right',
  },
})
