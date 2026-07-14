// ─────────────────────────────────────────────────────────────
// HistoryScreen.js — Chronological history of all juice log entries.
// Groups entries by date (descending). Tapping a date section
// expands to show individual entries for that day.
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft, ChevronDown, ChevronUp, X,
  Camera, Keyboard, Eye, Trash2, Clock,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import { useJuiceLog } from '../services/JuiceLogStore'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import { USDA_RDA } from '../constants/nutrition'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE, RADIUS } from '../constants/tokens'
import { getDevNow, onDevClockChange } from '../utils/DevClock'

// ── Source icon helper ───────────────────────────────────────
const SOURCE_ICON = { photo: Camera, manual: Keyboard, demo: Eye }
const SOURCE_COLOR = { photo: '#64B5F6', manual: '#CE93D8', demo: '#FFB74D' }

function formatDate(dateKey) {
  const [y, m, d] = dateKey.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  const today = getDevNow()
  const yesterday = getDevNow()
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateKey === formatDateKey(today)) return 'Today'
  if (dateKey === formatDateKey(yesterday)) return 'Yesterday'

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTime(isoStr) {
  const d = new Date(isoStr)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m} ${ampm}`
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
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable style={ms.card} onPress={(e) => e.stopPropagation()}>
          <View style={ms.cardHeader}>
            <Text style={ms.cardTitle}>Entry Details</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color={BRAND.text.muted} />
            </Pressable>
          </View>
          <ScrollView style={ms.cardBody} showsVerticalScrollIndicator={false}>
            <Text style={ms.entryTitle}>{entry.title}</Text>
            <Text style={ms.entryMeta}>
              {entry.source} · {formatTime(entry.createdAt)}
            </Text>

            <Text style={ms.sectionTitle}>Ingredients</Text>
            {(entry.ingredients || []).map((id, i) => {
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
                  <View key={n.key} style={ms.statRow}>
                    <Text style={ms.statLabel}>{n.label}</Text>
                    <Text style={[ms.statValue, n.pct >= 20 && { color: '#81C784' }]}>{n.pct}%</Text>
                  </View>
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
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Day Section ──────────────────────────────────────────────
function DaySection({ dateKey, entries, onEntryPress, devClockTick }) {
  const [expanded, setExpanded] = useState(dateKey === formatDateKey(getDevNow()))
  const totalIngredients = entries.reduce((sum, e) => sum + (e.ingredients?.length || 0), 0)

  useEffect(() => {
    const isToday = dateKey === formatDateKey(getDevNow())
    setExpanded(isToday)
  }, [dateKey, devClockTick])

  return (
    <View style={s.daySection}>
      <Pressable
        style={({ pressed }) => [s.dayHeader, pressed && { opacity: 0.7 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          setExpanded((prev) => !prev)
        }}
        accessibilityRole="button"
        accessibilityLabel={`${formatDate(dateKey)}, ${entries.length} juices`}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.dayTitle}>{formatDate(dateKey)}</Text>
          <Text style={s.daySub}>
            {entries.length} juice{entries.length !== 1 ? 's' : ''} · {totalIngredients} ingredients
          </Text>
        </View>
        {expanded
          ? <ChevronUp size={18} color={BRAND.text.muted} />
          : <ChevronDown size={18} color={BRAND.text.muted} />
        }
      </Pressable>

      {expanded && (
        <View style={s.dayEntries}>
          {entries.map((entry) => {
            const SrcIcon = SOURCE_ICON[entry.source] || Camera
            const srcColor = SOURCE_COLOR[entry.source] || '#64B5F6'
            return (
              <Pressable
                key={entry.id}
                style={({ pressed }) => [s.entryRow, pressed && { opacity: 0.7 }]}
                onPress={() => onEntryPress(entry)}
                hitSlop={4}
              >
                <View style={[s.entrySrcIcon, { backgroundColor: srcColor + '18' }]}>
                  <SrcIcon size={14} color={srcColor} />
                </View>
                <View style={s.entryContent}>
                  <Text style={s.entryTitle} numberOfLines={1}>{entry.title}</Text>
                  <Text style={s.entryMeta}>{formatTime(entry.createdAt)} · {(entry.ingredients || []).length} ingredients</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

// ── Main Screen ──────────────────────────────────────────────

export default function HistoryScreen({ navigation }) {
  const { entries, deleteEntry } = useJuiceLog()
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [devClockTick, setDevClockTick] = useState(0)

  useEffect(() => {
    return onDevClockChange(() => setDevClockTick((t) => t + 1))
  }, [])

  // Group entries by dateKey, descending
  const groupedDays = useMemo(() => {
    const groups = {}
    entries.forEach((e) => {
      const key = e.dateKey || 'unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(e)
    })
    // Sort date keys descending
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a))
    return sortedKeys.map((key) => ({
      dateKey: key,
      entries: groups[key].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }))
  }, [entries, devClockTick])

  const totalEntries = entries.length
  const totalDays = groupedDays.length

  return (
    <View style={s.root}>
      <MeshGradientBg />

      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
              <ArrowLeft size={22} color={BRAND.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>History</Text>
              <Text style={s.headerSub}>
                {totalEntries} juice{totalEntries !== 1 ? 's' : ''} across {totalDays} day{totalDays !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {groupedDays.length === 0 ? (
            <View style={s.emptyState}>
              <Clock size={32} color={BRAND.text.muted} />
              <Text style={s.emptyTitle}>No history yet</Text>
              <Text style={s.emptyDesc}>Your juice log entries will appear here.</Text>
            </View>
          ) : (
            groupedDays.map((group) => (
              <DaySection
                key={group.dateKey}
                dateKey={group.dateKey}
                entries={group.entries}
                onEntryPress={setSelectedEntry}
                devClockTick={devClockTick}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <EntryDetailsModal
        entry={selectedEntry}
        visible={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onDelete={deleteEntry}
      />
    </View>
  )
}

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
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACE.sm,
    marginTop: SPACE.sm,
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
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  headerSub: {
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
    gap: SPACE.sm,
  },
  daySection: {
    backgroundColor: BRAND.glass.surfaceElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: BRAND.glass.border,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACE.md,
  },
  dayTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
  },
  daySub: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    marginTop: 2,
  },
  dayEntries: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACE.md,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  entrySrcIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryContent: {
    flex: 1,
  },
  entryTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.primary,
  },
  entryMeta: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACE.xxl * 2,
    gap: SPACE.sm,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
  },
  emptyDesc: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
})
