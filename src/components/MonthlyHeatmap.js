// ─────────────────────────────────────────────────────────────
// MonthlyHeatmap.js — Monthly calendar heatmap colored by
// dominant nutrient pillar or fill ratio per day.
// Tap a day → detail modal showing pillar breakdown.
// Gated behind ff_monthly_heatmap feature flag.
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
} from 'react-native'
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT, GLASS } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import {
  NUTRIENT_PILLARS,
  PILLAR_KEYS,
  PILLAR_COUNT,
  scoreDayPillars,
  computeDayDominantPillar,
  countFilledPillars,
} from '../services/NutrientPillars'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ── Build calendar grid for a month ─────────────────────────

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const grid = []
  let week = []

  // Leading blanks
  for (let i = 0; i < startDow; i++) {
    week.push(null)
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    week.push({ day: d, dateKey })
    if (week.length === 7) {
      grid.push(week)
      week = []
    }
  }

  // Trailing blanks
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    grid.push(week)
  }

  return grid
}

// ── Day Cell ────────────────────────────────────────────────

function DayCell({ cell, dayLog, isToday, isFuture, onPress }) {
  if (!cell) return <View style={cellStyles.empty} />

  const filledCount = dayLog ? countFilledPillars(dayLog) : 0
  const dominant = dayLog ? computeDayDominantPillar(dayLog) : null
  const pillarColor = dominant ? NUTRIENT_PILLARS[dominant].color : null
  const ratio = filledCount / PILLAR_COUNT

  // Opacity scales with fill ratio
  const bgOpacity = filledCount > 0 ? 0.15 + ratio * 0.45 : 0

  return (
    <TouchableOpacity
      style={[
        cellStyles.cell,
        filledCount > 0 && {
          backgroundColor: `${pillarColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
          borderColor: `${pillarColor}30`,
        },
        isToday && cellStyles.cellToday,
        isFuture && cellStyles.cellFuture,
      ]}
      onPress={() => !isFuture && onPress(cell.dateKey, dayLog)}
      activeOpacity={isFuture ? 1 : 0.6}
      disabled={isFuture}
      accessibilityRole="button"
      accessibilityLabel={`${cell.dateKey}: ${filledCount} pillars filled`}
    >
      <Text
        style={[
          cellStyles.dayNum,
          filledCount > 0 && { color: pillarColor || DARK.textSecondary },
          isToday && cellStyles.dayNumToday,
          isFuture && cellStyles.dayNumFuture,
        ]}
      >
        {cell.day}
      </Text>
      {filledCount > 0 && !isFuture && (
        <View style={cellStyles.dotRow}>
          {filledCount >= 3 && <View style={[cellStyles.miniDot, { backgroundColor: pillarColor }]} />}
          {filledCount >= 5 && <View style={[cellStyles.miniDot, { backgroundColor: pillarColor }]} />}
          {filledCount >= 7 && <View style={[cellStyles.miniDot, { backgroundColor: pillarColor }]} />}
        </View>
      )}
    </TouchableOpacity>
  )
}

// ── Day Detail Modal ────────────────────────────────────────

function DayDetailModal({ visible, dateKey, dayLog, onDismiss }) {
  if (!dateKey) return null

  const hits = dayLog ? scoreDayPillars(dayLog) : {}
  const filledCount = PILLAR_KEYS.filter((k) => hits[k]).length
  const juiceCount = dayLog?.juices?.length || 0

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableOpacity
        style={modalStyles.overlay}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <View style={modalStyles.card}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{dateKey}</Text>
            <TouchableOpacity onPress={onDismiss} style={modalStyles.close}>
              <X size={16} color={DARK.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.summary}>
            {juiceCount > 0
              ? `${juiceCount} juice${juiceCount !== 1 ? 's' : ''} · ${filledCount}/${PILLAR_COUNT} pillars`
              : 'No juices logged'}
          </Text>

          {juiceCount > 0 && (
            <View style={modalStyles.pillarGrid}>
              {PILLAR_KEYS.map((key) => {
                const pillar = NUTRIENT_PILLARS[key]
                const isFilled = hits[key]
                return (
                  <View
                    key={key}
                    style={[
                      modalStyles.pillarChip,
                      isFilled && { backgroundColor: `${pillar.color}18`, borderColor: `${pillar.color}30` },
                    ]}
                  >
                    <View style={[modalStyles.pillarDot, { backgroundColor: isFilled ? pillar.color : DARK.textMuted }]} />
                    <Text style={[modalStyles.pillarLabel, isFilled && { color: pillar.color }]}>
                      {pillar.shortLabel}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

// ── Main MonthlyHeatmap ─────────────────────────────────────

export default function MonthlyHeatmap({ challengeDays }) {
  const isReduced = useReducedMotion()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const hasTracked = useRef(false)

  const now = new Date()
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)

  const viewDate = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  }, [monthOffset])

  const todayKey = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const grid = useMemo(
    () => buildMonthGrid(viewDate.year, viewDate.month),
    [viewDate.year, viewDate.month]
  )

  // Count days with logs in this month
  const daysLogged = useMemo(() => {
    const monthStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}`
    let count = 0
    for (const dateKey of Object.keys(challengeDays || {})) {
      if (dateKey.startsWith(monthStr)) {
        const dayLog = challengeDays[dateKey]
        if (dayLog?.juices?.length > 0) count++
      }
    }
    return count
  }, [challengeDays, viewDate])

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
      trackEvent('monthly_heatmap_viewed', {
        days_logged: daysLogged,
        month_offset: monthOffset,
      })
    }
  }, [daysLogged, monthOffset])

  const handleDayPress = useCallback((dateKey, dayLog) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedDay({ dateKey, dayLog })
    trackEvent('day_detail_opened', { day_key: dateKey })
  }, [])

  const handlePrevMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setMonthOffset((prev) => prev - 1)
  }, [])

  const handleNextMonth = useCallback(() => {
    if (monthOffset >= 0) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setMonthOffset((prev) => prev + 1)
  }, [monthOffset])

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim }]}
      accessibilityRole="summary"
      accessibilityLabel={`Monthly heatmap for ${MONTH_NAMES[viewDate.month]} ${viewDate.year}: ${daysLogged} days logged`}
    >
      {/* Month navigation */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn} activeOpacity={0.7}>
          <ChevronLeft size={18} color={DARK.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>
          {MONTH_NAMES[viewDate.month]} {viewDate.year}
        </Text>
        <TouchableOpacity
          onPress={handleNextMonth}
          style={[styles.navBtn, monthOffset >= 0 && { opacity: 0.3 }]}
          activeOpacity={0.7}
          disabled={monthOffset >= 0}
        >
          <ChevronRight size={18} color={DARK.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((h) => (
          <Text key={h} style={styles.headerCell}>{h}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      {grid.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell, ci) => (
            <DayCell
              key={cell ? cell.dateKey : `blank-${wi}-${ci}`}
              cell={cell}
              dayLog={cell ? challengeDays?.[cell.dateKey] : null}
              isToday={cell?.dateKey === todayKey}
              isFuture={cell?.dateKey > todayKey}
              onPress={handleDayPress}
            />
          ))}
        </View>
      ))}

      {/* Summary */}
      <Text style={styles.summary}>
        {daysLogged > 0
          ? `${daysLogged} day${daysLogged !== 1 ? 's' : ''} with juice logs this month`
          : 'No juices logged this month yet'}
      </Text>

      {/* Day detail modal */}
      <DayDetailModal
        visible={!!selectedDay}
        dateKey={selectedDay?.dateKey}
        dayLog={selectedDay?.dayLog}
        onDismiss={() => setSelectedDay(null)}
      />
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
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.md,
  },
  navBtn: {
    padding: SPACE.xs,
  },
  navTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: SPACE.xs,
  },
  headerCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: FONT_WEIGHT.heavy,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  summary: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    textAlign: 'center',
    marginTop: SPACE.sm,
  },
})

const cellStyles = StyleSheet.create({
  empty: {
    flex: 1,
    aspectRatio: 1,
    margin: 1.5,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    margin: 1.5,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellToday: {
    borderColor: DARK.green,
    borderWidth: 1.5,
  },
  cellFuture: {
    opacity: 0.3,
  },
  dayNum: {
    fontSize: 10,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
  },
  dayNumToday: {
    color: DARK.green,
    fontWeight: FONT_WEIGHT.bold,
  },
  dayNumFuture: {
    color: DARK.textMuted,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 1.5,
    marginTop: 1,
  },
  miniDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
})

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.xl,
  },
  card: {
    backgroundColor: DARK.surfaceElevated,
    borderRadius: RADIUS.xl,
    padding: SPACE.xl,
    width: '100%',
    maxWidth: 340,
    borderWidth: 0.5,
    borderColor: DARK.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.sm,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  close: {
    padding: SPACE.xs,
  },
  summary: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
    marginBottom: SPACE.md,
  },
  pillarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pillarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillarLabel: {
    fontSize: 9,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
  },
})
