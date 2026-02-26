// ─────────────────────────────────────────────────────────────
// PerformanceDashboardScreen.js — Today dashboard.
// Layout: MomentumCard → LifetimeScoreCard → Tappable Category
// Cards → Today's Log → WeekIngredientsList → Scan FAB.
// Includes drill-down modals for each category + entry details.
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  ScanLine, ArrowLeft, X, Leaf, Shield, Flame, CalendarDays,
  BarChart3, Clock, Trash2, Camera, Keyboard, Eye, History,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import GlassSurface from '../components/GlassSurface'
import MomentumCard from '../components/performance-dashboard/MomentumCard'
import LifetimeScoreCard from '../components/performance-dashboard/LifetimeScoreCard'
import PerformanceRow from '../components/performance-dashboard/PerformanceRow'
import WeekIngredientsList from '../components/performance-dashboard/WeekIngredientsList'
import ScoreBreakdownModal from '../components/performance-dashboard/ScoreBreakdownModal'
import { useNutritionScore } from '../services/NutritionScoreStore'
import { useJuiceLog } from '../services/JuiceLogStore'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import { USDA_RDA } from '../constants/nutrition'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE, RADIUS, SHADOW } from '../constants/tokens'

// ── Source icon helper ───────────────────────────────────────
const SOURCE_ICON = { photo: Camera, manual: Keyboard, demo: Eye }
const SOURCE_COLOR = { photo: '#64B5F6', manual: '#CE93D8', demo: '#FFB74D' }

// ── Drill-Down Modal Shell ───────────────────────────────────
function DrillDownModal({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable style={ms.card} onPress={(e) => e.stopPropagation()}>
          <View style={ms.cardHeader}>
            <Text style={ms.cardTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color={BRAND.text.muted} />
            </Pressable>
          </View>
          <ScrollView style={ms.cardBody} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function StatRow({ label, value, accent }) {
  return (
    <View style={ms.statRow}>
      <Text style={ms.statLabel}>{label}</Text>
      <Text style={[ms.statValue, accent && { color: accent }]}>{value}</Text>
    </View>
  )
}

// ── Category Card (tappable) ─────────────────────────────────
function CategoryCard({ icon: Icon, iconColor, label, value, sub, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [s.catCard, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={[s.catIcon, { backgroundColor: iconColor + '18' }]}>
        <Icon size={18} color={iconColor} />
      </View>
      <Text style={s.catValue}>{value}</Text>
      <Text style={s.catLabel}>{label}</Text>
      {sub ? <Text style={s.catSub}>{sub}</Text> : null}
    </Pressable>
  )
}

// ── Today's Log Entry Row ────────────────────────────────────
function LogEntryRow({ entry, onPress }) {
  const time = useMemo(() => {
    const d = new Date(entry.createdAt)
    const h = d.getHours()
    const m = String(d.getMinutes()).padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${m} ${ampm}`
  }, [entry.createdAt])
  const SrcIcon = SOURCE_ICON[entry.source] || Camera
  const srcColor = SOURCE_COLOR[entry.source] || '#64B5F6'

  return (
    <Pressable
      style={({ pressed }) => [s.logRow, pressed && { opacity: 0.7 }]}
      onPress={() => onPress(entry)}
      hitSlop={4}
    >
      <View style={[s.logSrcIcon, { backgroundColor: srcColor + '18' }]}>
        <SrcIcon size={14} color={srcColor} />
      </View>
      <View style={s.logContent}>
        <Text style={s.logTitle} numberOfLines={1}>{entry.title}</Text>
        <Text style={s.logMeta}>{time} · {entry.ingredients.length} ingredients</Text>
      </View>
    </Pressable>
  )
}

// ── Entry Details Modal ──────────────────────────────────────
function EntryDetailsModal({ entry, visible, onClose, onDelete }) {
  if (!entry) return null
  const nutrients = entry.nutrientSummary || {}
  const topNutrients = Object.entries(USDA_RDA)
    .map(([key, rda]) => {
      const val = nutrients[key] || 0
      const pct = rda > 0 ? Math.round((val / rda) * 100) : 0
      const label = key === 'vitaminC' ? 'Vitamin C'
        : key === 'vitaminA' ? 'Vitamin A'
        : key === 'potassium' ? 'Potassium'
        : key === 'iron' ? 'Iron'
        : key === 'magnesium' ? 'Magnesium'
        : key === 'folate' ? 'Folate' : key
      return { key, label, pct }
    })
    .filter((n) => n.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)

  return (
    <DrillDownModal visible={visible} onClose={onClose} title="Entry Details">
      <Text style={ms.entryTitle}>{entry.title}</Text>
      <Text style={ms.entryMeta}>
        {entry.source} · {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>

      <Text style={ms.sectionTitle}>Ingredients</Text>
      {entry.ingredients.map((id, i) => {
        const prod = PRODUCE_DATA[id]
        return (
          <View key={`${id}-${i}`} style={ms.ingredientRow}>
            <View style={[ms.ingredientDot, { backgroundColor: prod?.category === 'fruit' ? '#FFB74D' : '#81C784' }]} />
            <Text style={ms.ingredientName}>{prod?.name || id}</Text>
          </View>
        )
      })}

      {topNutrients.length > 0 && (
        <>
          <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>Top Nutrients (% DV)</Text>
          {topNutrients.map((n) => (
            <StatRow key={n.key} label={n.label} value={`${n.pct}%`} accent={n.pct >= 20 ? '#81C784' : undefined} />
          ))}
        </>
      )}

      <Pressable
        style={({ pressed }) => [ms.deleteBtn, pressed && { opacity: 0.7 }]}
        onPress={() => { onDelete(entry.id); onClose() }}
        hitSlop={8}
      >
        <Trash2 size={16} color="#E91E63" />
        <Text style={ms.deleteBtnText}>Delete Entry</Text>
      </Pressable>
    </DrillDownModal>
  )
}

// ── Main Screen ──────────────────────────────────────────────

export default function PerformanceDashboardScreen({ navigation }) {
  const {
    breakdown,
    momentum,
    lifetime,
    cycleProgress,
    completedCycles,
    diversity,
    coverage,
    streak,
    weeklyActivity,
    totalLifetimeScans,
    scoreState,
  } = useNutritionScore()

  const {
    todayEntries,
    last7DaysEntries,
    diversityStats,
    consistencyStats,
    deleteEntry,
  } = useJuiceLog()

  const [showBreakdown, setShowBreakdown] = useState(false)
  const [activeModal, setActiveModal] = useState(null) // 'diversity' | 'coverage' | 'consistency' | 'weekly'
  const [selectedEntry, setSelectedEntry] = useState(null)

  const handleOpenBreakdown = useCallback(() => setShowBreakdown(true), [])
  const handleCloseBreakdown = useCallback(() => setShowBreakdown(false), [])
  const handleScan = useCallback(() => navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { openCamera: true } }), [navigation])

  // Coverage drill-down stats
  const coverageDetail = useMemo(() => {
    const allNutrients = Object.keys(USDA_RDA)
    const todayTotals = {}
    todayEntries.forEach((e) => {
      const ns = e.nutrientSummary || {}
      allNutrients.forEach((k) => { todayTotals[k] = (todayTotals[k] || 0) + (ns[k] || 0) })
    })
    const achieved = allNutrients
      .map((k) => {
        const rda = USDA_RDA[k]
        const pct = rda > 0 ? Math.round(((todayTotals[k] || 0) / rda) * 100) : 0
        const label = k === 'vitaminC' ? 'Vitamin C' : k === 'vitaminA' ? 'Vitamin A'
          : k === 'potassium' ? 'Potassium' : k === 'iron' ? 'Iron'
          : k === 'magnesium' ? 'Magnesium' : k === 'folate' ? 'Folate' : k
        return { key: k, label, pct }
      })
      .sort((a, b) => b.pct - a.pct)
    const hit = achieved.filter((n) => n.pct >= 20).length
    const missing = achieved.filter((n) => n.pct < 5)
    return { achieved, hit, total: allNutrients.length, missing }
  }, [todayEntries])

  return (
    <View style={s.root}>
      <MeshGradientBg />

      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
              <ArrowLeft size={22} color={BRAND.text.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>Today</Text>
              <Text style={s.headerCycle}>
                Cycle {cycleProgress.cycleId} · {cycleProgress.daysRemaining}d remaining
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('HistoryScreen')}
              style={s.headerAction}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="View history"
            >
              <History size={20} color={BRAND.text.muted} />
            </Pressable>
          </View>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. Momentum Card */}
          <MomentumCard
            momentum={momentum}
            breakdown={breakdown}
            cycleProgress={cycleProgress}
            weeklyActivity={weeklyActivity}
            onPress={handleOpenBreakdown}
          />

          {/* 2. Lifetime Score */}
          <LifetimeScoreCard
            lifetime={lifetime}
            completedCycles={completedCycles}
            totalLifetimeScans={totalLifetimeScans}
          />

          {/* 3. Tappable Category Cards */}
          <Text style={s.sectionLabel}>Categories</Text>
          <View style={s.catGrid}>
            <CategoryCard
              icon={Leaf}
              iconColor="#81C784"
              label="Diversity"
              value={`${diversityStats.uniqueToday} unique`}
              sub={`${diversityStats.uniqueWeek} this week`}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveModal('diversity') }}
            />
            <CategoryCard
              icon={Shield}
              iconColor="#64B5F6"
              label="Coverage"
              value={`${coverageDetail.hit}/${coverageDetail.total}`}
              sub="nutrients hit"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveModal('coverage') }}
            />
            <CategoryCard
              icon={Flame}
              iconColor="#FFB74D"
              label="Consistency"
              value={`${streak?.currentCycleStreak || 0}d streak`}
              sub={`${consistencyStats.activeDaysWeek}/7 days`}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveModal('consistency') }}
            />
            <CategoryCard
              icon={CalendarDays}
              iconColor="#CE93D8"
              label="Weekly"
              value={`${consistencyStats.totalEntriesWeek} entries`}
              sub={`${consistencyStats.activeDaysWeek} active days`}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveModal('weekly') }}
            />
          </View>

          {/* 4. Today's Log */}
          <Text style={s.sectionLabel}>Today's Log</Text>
          {todayEntries.length === 0 ? (
            <View style={s.emptyLog}>
              <Clock size={24} color={BRAND.text.muted} />
              <Text style={s.emptyLogText}>No juices logged today</Text>
            </View>
          ) : (
            <View style={s.logCard}>
              {todayEntries.map((entry) => (
                <LogEntryRow key={entry.id} entry={entry} onPress={setSelectedEntry} />
              ))}
            </View>
          )}

          {/* 5. This Week's Ingredients */}
          <WeekIngredientsList activeCycle={scoreState?.activeCycle} />

          <View style={s.fabSpacer} />
        </ScrollView>
      </SafeAreaView>

      {/* Floating Scan FAB */}
      <TouchableOpacity style={s.fab} onPress={handleScan} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Scan ingredients">
        <ScanLine size={24} color="#FFFFFF" strokeWidth={2} />
      </TouchableOpacity>

      {/* Score Breakdown Modal */}
      <ScoreBreakdownModal visible={showBreakdown} onClose={handleCloseBreakdown} breakdown={breakdown} momentum={momentum} />

      {/* Entry Details Modal */}
      <EntryDetailsModal
        entry={selectedEntry}
        visible={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onDelete={deleteEntry}
      />

      {/* Diversity Drill-Down */}
      <DrillDownModal visible={activeModal === 'diversity'} onClose={() => setActiveModal(null)} title="Ingredient Diversity">
        <StatRow label="Unique today" value={diversityStats.uniqueToday} accent="#81C784" />
        <StatRow label="Repeats today" value={diversityStats.repeatsToday} />
        <StatRow label="Unique this week" value={diversityStats.uniqueWeek} accent="#81C784" />
        {diversityStats.topRepeated && (
          <StatRow label="Most used" value={`${diversityStats.topRepeated.name} (×${diversityStats.topRepeated.count})`} />
        )}
        <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>By Category</Text>
        {Object.entries(diversityStats.groupBreakdown).map(([cat, count]) => (
          <StatRow key={cat} label={cat} value={count} accent={cat === 'vegetable' ? '#81C784' : '#FFB74D'} />
        ))}
      </DrillDownModal>

      {/* Coverage Drill-Down */}
      <DrillDownModal visible={activeModal === 'coverage'} onClose={() => setActiveModal(null)} title="Nutrient Coverage">
        <StatRow label="Nutrients hit (≥20%)" value={`${coverageDetail.hit}/${coverageDetail.total}`} accent="#64B5F6" />
        <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>All Nutrients</Text>
        {coverageDetail.achieved.map((n) => (
          <StatRow key={n.key} label={n.label} value={`${n.pct}%`} accent={n.pct >= 20 ? '#81C784' : undefined} />
        ))}
        {coverageDetail.missing.length > 0 && (
          <>
            <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>Missing ({'<'}5%)</Text>
            {coverageDetail.missing.map((n) => (
              <StatRow key={n.key} label={n.label} value={`${n.pct}%`} />
            ))}
          </>
        )}
      </DrillDownModal>

      {/* Consistency Drill-Down */}
      <DrillDownModal visible={activeModal === 'consistency'} onClose={() => setActiveModal(null)} title="Consistency">
        <StatRow label="Current streak" value={streak?.currentCycleStreak ? `${streak.currentCycleStreak} days` : 'No streak yet'} accent="#FFB74D" />
        <StatRow label="Logged today" value={consistencyStats.totalEntriesToday} />
        <StatRow label="Days active (7d)" value={`${consistencyStats.activeDaysWeek}/7`} />
        <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>Logging Pattern (Today)</Text>
        <StatRow label="Morning" value={consistencyStats.loggingTimePattern.morning} />
        <StatRow label="Afternoon" value={consistencyStats.loggingTimePattern.afternoon} />
        <StatRow label="Evening" value={consistencyStats.loggingTimePattern.evening} />
      </DrillDownModal>

      {/* Weekly Activity Drill-Down */}
      <DrillDownModal visible={activeModal === 'weekly'} onClose={() => setActiveModal(null)} title="Weekly Activity">
        <StatRow label="Total entries (7d)" value={consistencyStats.totalEntriesWeek} accent="#CE93D8" />
        <StatRow label="Active days (7d)" value={`${consistencyStats.activeDaysWeek}/7`} />
        <StatRow label="Avg entries/day" value={consistencyStats.avgEntriesPerDay} />
        <StatRow label="Unique ingredients" value={diversityStats.uniqueWeek} accent="#81C784" />
      </DrillDownModal>
    </View>
  )
}

const FAB_SIZE = 56

// ── Modal Styles ─────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.xl,
  },
  card: {
    backgroundColor: BRAND.background.elevated || '#161B22',
    borderRadius: RADIUS.xl,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.md,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
  },
  cardBody: {
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.lg,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  statLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.secondary,
  },
  statValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACE.sm,
    marginTop: SPACE.sm,
  },
  entryTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    marginBottom: 4,
  },
  entryMeta: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    marginBottom: SPACE.lg,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  ingredientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ingredientName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.secondary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACE.xxl,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(233,30,99,0.08)',
  },
  deleteBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#E91E63',
  },
})

// ── Main Styles ──────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.background.primary,
  },
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  headerCycle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xxl,
    gap: SPACE.md,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACE.sm,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
  },
  catCard: {
    width: '48%',
    backgroundColor: BRAND.glass.surfaceElevated,
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    borderWidth: 0.5,
    borderColor: BRAND.glass.border,
  },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
  catValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
  },
  catLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.muted,
    marginTop: 2,
  },
  catSub: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    opacity: 0.7,
    marginTop: 1,
  },
  logCard: {
    backgroundColor: BRAND.glass.surfaceElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: BRAND.glass.border,
    overflow: 'hidden',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACE.md,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  logSrcIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logContent: {
    flex: 1,
  },
  logTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.primary,
  },
  logMeta: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    marginTop: 2,
  },
  emptyLog: {
    alignItems: 'center',
    paddingVertical: SPACE.xxl,
    gap: SPACE.sm,
  },
  emptyLogText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  fabSpacer: {
    height: FAB_SIZE + SPACE.xxl,
  },
  fab: {
    position: 'absolute',
    bottom: SPACE.xxl,
    alignSelf: 'center',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: BRAND.cta.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.lg,
    shadowColor: BRAND.cta.shadow,
  },
})
