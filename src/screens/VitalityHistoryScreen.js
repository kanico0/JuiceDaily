// ─────────────────────────────────────────────────────────────
// VitalityHistoryScreen.js — Liquid Timeline + Spectrum Grid
// Calendar heatmap, time-travel blur, search/filter, re-squeeze
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  TextInput,
  FlatList,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg'
import {
  ArrowLeft,
  Search,
  Filter,
  X,
  RotateCcw,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native'
import {
  useChallenge,
  WEEKLY_COLORS,
  DAILY_PILLARS,
  getAllHistoryDays,
  filterHistoryByColor,
  filterHistoryByIngredient,
  getDayDominantColor,
  isFullRainbowDay,
} from '../services/ChallengeStore'
import MeshGradientBg from '../components/MeshGradientBg'
import { useFormatWeight } from '../utils/weightFormat'

// ── Color Chip Filter ────────────────────────────────────────

const COLOR_KEYS = ['red', 'orange', 'yellow', 'green', 'purple', 'white']

function ColorFilterBar({ activeColor, onSelect }) {
  return (
    <View style={styles.colorBar}>
      {COLOR_KEYS.map((key) => {
        const data = WEEKLY_COLORS[key]
        const isActive = activeColor === key
        return (
          <TouchableOpacity
            key={key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onSelect(isActive ? null : key)
            }}
            style={[
              styles.colorChip,
              { backgroundColor: isActive ? data.color : 'rgba(255,255,255,0.06)' },
              isActive && { borderColor: data.color },
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.colorChipText, isActive && { color: '#FFFFFF' }]}>
              {data.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ── 5-Week Spectrum Grid (Calendar Heatmap) ──────────────────

function SpectrumGrid({ challenge }) {
  const today = new Date()
  const todayKey = today.toISOString().split('T')[0]

  // Build 35 days (5 weeks) ending today
  const gridDays = useMemo(() => {
    const days = []
    for (let i = 34; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const dayLog = challenge.days[key]
      const dominantColor = dayLog ? getDayDominantColor(dayLog) : null
      const rainbow = dayLog ? isFullRainbowDay(dayLog) : false
      const hasData = dayLog && (dayLog.base || dayLog.power || dayLog.kick)
      days.push({ key, dominantColor, rainbow, hasData, isToday: key === todayKey })
    }
    return days
  }, [challenge.days, todayKey])

  // Day-of-week labels
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const weekLabels = ['5 wk ago', '4 wk ago', '3 wk ago', '2 wk ago', 'This wk']

  return (
    <View style={styles.gridContainer}>
      <View style={styles.gridHeader}>
        <Calendar size={14} color="#484F58" />
        <Text style={styles.gridTitle}>Spectrum Grid</Text>
        <Text style={styles.gridSubtitle}>Last 5 weeks</Text>
      </View>
      <View style={styles.gridBody}>
        <View style={styles.gridLabels}>
          <View style={{ height: 16 }} />
          {dayLabels.map((l, i) => (
            <Text key={i} style={styles.gridLabel}>{l}</Text>
          ))}
        </View>
        <View style={styles.gridWeeks}>
          {[0, 1, 2, 3, 4].map((week) => (
            <View key={week} style={styles.gridWeek}>
              <Text style={styles.gridWeekLabel}>{weekLabels[week]}</Text>
              {gridDays.slice(week * 7, week * 7 + 7).map((day) => {
                const colorHex = day.dominantColor
                  ? WEEKLY_COLORS[day.dominantColor]?.color
                  : null
                return (
                  <View
                    key={day.key}
                    style={[
                      styles.gridSquare,
                      day.hasData && colorHex && { backgroundColor: colorHex },
                      day.rainbow && styles.gridSquareRainbow,
                      day.isToday && styles.gridSquareToday,
                    ]}
                  />
                )
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

// ── Mini Vitality Rings (for timeline entries) ───────────────

function MiniRings({ dayLog }) {
  const size = 40
  const center = size / 2
  const rings = [
    { key: 'base', r: 16, color: '#64B5F6', ghost: 'rgba(100,181,246,0.15)' },
    { key: 'power', r: 12, color: '#81C784', ghost: 'rgba(129,199,132,0.15)' },
    { key: 'kick', r: 8, color: '#FFB74D', ghost: 'rgba(255,183,77,0.15)' },
  ]

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((ring) => {
        const isFilled = dayLog[ring.key]
        const circumference = 2 * Math.PI * ring.r
        return (
          <React.Fragment key={ring.key}>
            <Circle
              cx={center}
              cy={center}
              r={ring.r}
              stroke={ring.ghost}
              strokeWidth={3}
              fill="none"
            />
            {isFilled && (
              <Circle
                cx={center}
                cy={center}
                r={ring.r}
                stroke={ring.color}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={0}
                rotation="-90"
                origin={`${center}, ${center}`}
              />
            )}
          </React.Fragment>
        )
      })}
    </Svg>
  )
}

// ── Timeline Entry ───────────────────────────────────────────

function TimelineEntry({ entry, onReSqueeze, isLast }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const { fmtLbs } = useFormatWeight()

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start()
  }, [])

  const { date, dayLog, dominantColor, isRainbow, juiceCount } = entry
  const d = new Date(date + 'T12:00:00')
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
  const dayNum = d.getDate()
  const monthName = d.toLocaleDateString('en-US', { month: 'short' })
  const colorHex = dominantColor ? WEEKLY_COLORS[dominantColor]?.color : '#21262D'

  // Collect all unique ingredients from this day
  const ingredients = []
  const seen = new Set()
  for (const juice of (dayLog.juices || [])) {
    for (const ing of (juice.ingredients || [])) {
      if (!seen.has(ing.produceId)) {
        seen.add(ing.produceId)
        ingredients.push(ing.produceId)
      }
    }
  }

  const totalWeight = (dayLog.juices || []).reduce((sum, j) =>
    sum + (j.ingredients || []).reduce((s, i) => s + (i.weightG || 150), 0), 0
  )

  return (
    <Animated.View style={[styles.timelineEntry, { opacity: fadeAnim }]}>
      {/* Timeline connector */}
      <View style={styles.timelineLeft}>
        <View style={[styles.timelineDot, { backgroundColor: colorHex }]}>
          {isRainbow && <View style={styles.timelineDotGold} />}
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>

      {/* Content card */}
      <View style={styles.timelineCard}>
        <View style={styles.timelineHeader}>
          <View>
            <Text style={styles.timelineDate}>{dayName}, {monthName} {dayNum}</Text>
            <Text style={styles.timelineJuiceCount}>
              {juiceCount} juice{juiceCount !== 1 ? 's' : ''} · {fmtLbs(totalWeight)}
            </Text>
          </View>
          <MiniRings dayLog={dayLog} />
        </View>

        {/* Ingredient chips */}
        {ingredients.length > 0 && (
          <View style={styles.ingredientChips}>
            {ingredients.slice(0, 6).map((id) => (
              <View key={id} style={styles.ingredientChip}>
                <Text style={styles.ingredientChipText}>
                  {id.replace(/_/g, ' ')}
                </Text>
              </View>
            ))}
            {ingredients.length > 6 && (
              <Text style={styles.moreChip}>+{ingredients.length - 6}</Text>
            )}
          </View>
        )}

        {/* Rainbow badge */}
        {isRainbow && (
          <View style={styles.rainbowBadge}>
            <Text style={styles.rainbowBadgeText}>🌈 Full Squeeze</Text>
          </View>
        )}

        {/* Quick Re-Squeeze */}
        <TouchableOpacity
          style={styles.reSqueezeBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onReSqueeze(ingredients)
          }}
          activeOpacity={0.7}
        >
          <RotateCcw size={14} color="#81C784" />
          <Text style={styles.reSqueezeBtnText}>Make this again?</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

// ── Main Screen ──────────────────────────────────────────────

export default function VitalityHistoryScreen({ navigation }) {
  const { challenge } = useChallenge()
  const [searchText, setSearchText] = useState('')
  const [activeColor, setActiveColor] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const scrollRef = useRef(null)
  const bgColorAnim = useRef(new Animated.Value(0)).current

  // Compute full history
  const allHistory = useMemo(() => getAllHistoryDays(challenge), [challenge])

  // Apply filters
  const filteredHistory = useMemo(() => {
    let result = allHistory
    if (activeColor) {
      result = filterHistoryByColor(result, activeColor)
    }
    if (searchText.trim()) {
      result = filterHistoryByIngredient(result, searchText.trim())
    }
    return result
  }, [allHistory, activeColor, searchText])

  const handleReSqueeze = useCallback((ingredients) => {
    navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { preloadIngredients: ingredients } })
  }, [navigation])

  // Determine dominant month color for background tint
  const dominantBgColor = useMemo(() => {
    if (filteredHistory.length === 0) return '#0D1117'
    const colorCounts = {}
    for (const entry of filteredHistory.slice(0, 10)) {
      if (entry.dominantColor) {
        colorCounts[entry.dominantColor] = (colorCounts[entry.dominantColor] || 0) + 1
      }
    }
    const top = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]
    return top ? WEEKLY_COLORS[top[0]]?.color || '#0D1117' : '#0D1117'
  }, [filteredHistory])

  const hasFilters = activeColor || searchText.trim()

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      {/* Time-travel background blur */}
      <Animated.View style={[styles.bgTint, { backgroundColor: dominantBgColor }]} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vitality History</Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowFilters(!showFilters)
            }}
            style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          >
            <Filter size={18} color={showFilters ? '#81C784' : '#8B949E'} />
          </TouchableOpacity>
        </View>

        {/* Search & Filter Panel */}
        {showFilters && (
          <View style={styles.filterPanel}>
            <View style={styles.searchRow}>
              <Search size={16} color="#484F58" />
              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search by ingredient (e.g. ginger)"
                placeholderTextColor="#484F58"
                returnKeyType="search"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <X size={16} color="#8B949E" />
                </TouchableOpacity>
              )}
            </View>
            <ColorFilterBar activeColor={activeColor} onSelect={setActiveColor} />
            {hasFilters && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setActiveColor(null)
                  setSearchText('')
                }}
              >
                <X size={12} color="#8B949E" />
                <Text style={styles.clearBtnText}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Spectrum Grid */}
          <SpectrumGrid challenge={challenge} />

          {/* Monthly Wrap CTA */}
          <TouchableOpacity
            style={styles.wrapCta}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              navigation.navigate('MonthlyWrap')
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(129,199,132,0.12)', 'rgba(100,181,246,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.wrapCtaGradient}
            >
              <Text style={styles.wrapCtaEmoji}>📊</Text>
              <View style={styles.wrapCtaInfo}>
                <Text style={styles.wrapCtaTitle}>Monthly Vitality Wrap</Text>
                <Text style={styles.wrapCtaDesc}>Your Spotify Wrapped, but for juicing</Text>
              </View>
              <ChevronRight size={18} color="#484F58" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Timeline Header */}
          <View style={styles.timelineHeader2}>
            <Text style={styles.timelineTitle}>Liquid Timeline</Text>
            <Text style={styles.timelineCount}>
              {filteredHistory.length} day{filteredHistory.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Timeline Feed */}
          {filteredHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🧃</Text>
              <Text style={styles.emptyTitle}>
                {hasFilters ? 'No matching days' : 'No history yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {hasFilters
                  ? 'Try a different filter or ingredient'
                  : 'Log your first juice to start building your timeline'}
              </Text>
            </View>
          ) : (
            filteredHistory.map((entry, i) => (
              <TimelineEntry
                key={entry.date}
                entry={entry}
                onReSqueeze={handleReSqueeze}
                isLast={i === filteredHistory.length - 1}
              />
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060D0A' },
  bgTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.06,
  },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  filterBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(129,199,132,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.2)',
  },

  // Filter Panel
  filterPanel: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 10,
    fontWeight: '500',
  },
  colorBar: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  colorChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  colorChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B949E',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  clearBtnText: {
    fontSize: 12,
    color: '#8B949E',
    fontWeight: '600',
  },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  // Spectrum Grid
  gridContainer: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gridSubtitle: {
    fontSize: 11,
    color: '#484F58',
    marginLeft: 'auto',
  },
  gridBody: {
    flexDirection: 'row',
    gap: 6,
  },
  gridLabels: {
    gap: 3,
    justifyContent: 'space-around',
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#484F58',
    width: 12,
    textAlign: 'center',
    height: 18,
    lineHeight: 18,
  },
  gridWeeks: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  gridWeek: {
    flex: 1,
    gap: 3,
    alignItems: 'center',
  },
  gridWeekLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#484F58',
    textAlign: 'center',
    marginBottom: 2,
    height: 14,
  },
  gridSquare: {
    aspectRatio: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignSelf: 'stretch',
  },
  gridSquareRainbow: {
    borderWidth: 1.5,
    borderColor: '#FFD54F',
    shadowColor: '#FFD54F',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  gridSquareToday: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // Monthly Wrap CTA
  wrapCta: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  wrapCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.12)',
    gap: 12,
  },
  wrapCtaEmoji: { fontSize: 28 },
  wrapCtaInfo: { flex: 1 },
  wrapCtaTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  wrapCtaDesc: { fontSize: 12, color: '#8B949E', marginTop: 2 },

  // Timeline
  timelineHeader2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  timelineCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#484F58',
  },

  // Timeline Entry
  timelineEntry: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  timelineDotGold: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD54F',
    position: 'absolute',
    top: 3,
    left: 3,
  },
  timelineLine: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    marginLeft: 10,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  timelineDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timelineJuiceCount: {
    fontSize: 12,
    color: '#8B949E',
    marginTop: 2,
  },

  // Ingredient chips
  ingredientChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  ingredientChip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ingredientChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B949E',
    textTransform: 'capitalize',
  },
  moreChip: {
    fontSize: 11,
    fontWeight: '600',
    color: '#484F58',
    alignSelf: 'center',
  },

  // Rainbow badge
  rainbowBadge: {
    backgroundColor: 'rgba(255,213,79,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 24,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,213,79,0.15)',
  },
  rainbowBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD54F',
  },

  // Re-Squeeze button
  reSqueezeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  reSqueezeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#81C784',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  emptyDesc: { fontSize: 14, color: '#8B949E', textAlign: 'center', lineHeight: 20 },
})
