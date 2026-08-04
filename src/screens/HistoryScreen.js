// ─────────────────────────────────────────────────────────────
// HistoryScreen.js — Chronological history of all juice log entries.
// Groups entries by date (descending). Tapping a date section
// expands to show individual entries for that day.
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  X,
  Camera,
  Keyboard,
  Eye,
  Trash2,
  Clock,
  Sparkles,
  Lock,
  RefreshCw,
  ChevronRight,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import { useJuiceLog } from '../services/JuiceLogStore'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import { USDA_RDA } from '../constants/nutrition'
import {
  BRAND,
  FONT_SIZE,
  FONT_WEIGHT,
  SPACE,
  RADIUS,
  LINE_HEIGHT,
  SEMANTIC_COLORS,
} from '../constants/tokens'
import { getDevNow, onDevClockChange } from '../utils/DevClock'
import { useSubscription } from '../services/subscriptions/SubscriptionStore'
import {
  getHistoryAccessPolicy,
  getAccessType,
  getEntryPosition,
} from '../services/historyAccessPolicy'
import { getAdvancedPreviewEntryId } from '../services/historyPreviewEntry'
import {
  createEditableDraftFromHistoryEntry,
  draftToPreloadIngredients,
} from '../services/makeAgainHelper'
import { trackEvent } from '../services/AnalyticsService'
import { TASTE_REACTIONS } from '../constants/recipeData'

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

// ── Encouragement Card Data ─────────────────────────────────
export const ENCOURAGEMENT_COPY = [
  {
    title: 'Start your juice journey',
    body: 'Your juice history will appear here as you begin logging. Tracking your juices can help you notice progress, build consistency, and learn which fruits, vegetables, and juice combinations work best for your routine.',
  },
  {
    title: 'Great start',
    body: 'Every juice you log stays in your complete basic Juice History. Free members can explore full advanced details for their latest juice, while RawLifeFlow Pro unlocks detailed history for every juice you have logged.',
  },
  {
    title: 'You\u2019re building momentum',
    body: 'Two logged days is a strong beginning. Each new entry adds more meaning to your history and gives you a clearer picture of how raw fruits and vegetables are becoming part of your routine.',
  },
  {
    title: 'A habit is taking shape',
    body: 'Three days of logging is meaningful progress. Staying aware of what you juice can make consistency easier and help you recognize the combinations you enjoy and return to most often.',
  },
  {
    title: 'You\u2019re creating consistency',
    body: 'Four logged days shows that you are continuing to make room for fresh produce in your routine. Keep recording your juices so this screen becomes a useful, personal record of your progress.',
  },
  {
    title: 'Nice progress',
    body: 'Five days of history gives you a solid foundation to build on. As you continue, your juice log can help you remember favorites, notice patterns, and celebrate the simple steps you are taking.',
  },
]

export function countDistinctLoggedDays(entries) {
  const validKeys = new Set()
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue
    const key = e.dateKey
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
    validKeys.add(key)
  }
  return validKeys.size
}

export function getEncouragementCopy(distinctDays) {
  if (distinctDays < 0 || distinctDays > 5) return null
  return ENCOURAGEMENT_COPY[distinctDays]
}

// ── Encouragement Card ───────────────────────────────────────
function EncouragementCard({ title, body }) {
  return (
    <View style={s.encouragementCard} accessibilityRole="summary">
      <View style={s.encouragementHeader}>
        <Sparkles size={16} color={BRAND.cta.primary} />
        <Text style={s.encouragementTitle}>{title}</Text>
      </View>
      <Text style={s.encouragementBody}>{body}</Text>
    </View>
  )
}

function formatTime(isoStr) {
  const d = new Date(isoStr)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m} ${ampm}`
}

// ── Ingredient count bucket for analytics ───────────────────
function getIngredientCountBucket(count) {
  if (count <= 0) return '0'
  if (count <= 2) return '1-2'
  if (count <= 4) return '3-4'
  if (count <= 6) return '5-6'
  return '7+'
}

function getEntryCountBucket(count) {
  if (count <= 0) return '0'
  if (count <= 5) return '1-5'
  if (count <= 20) return '6-20'
  if (count <= 50) return '21-50'
  return '50+'
}

// ── Advanced Preview Banner ──────────────────────────────────
function AdvancedPreviewBanner({ onUpgrade }) {
  return (
    <View style={ms.previewBanner}>
      <View style={ms.previewBannerHeader}>
        <Sparkles size={16} color={SEMANTIC_COLORS.accentPrimary} />
        <Text style={ms.previewBannerTitle}>Your Advanced History Preview</Text>
      </View>
      <Text style={ms.previewBannerBody}>
        Your latest juice includes the complete history experience. Upgrade to RawLifeFlow Pro to
        revisit detailed insights for every juice you have logged.
      </Text>
      <Pressable
        style={({ pressed }) => [ms.previewCtaBtn, pressed && { opacity: 0.7 }]}
        onPress={onUpgrade}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Unlock Advanced History"
      >
        <Text style={ms.previewCtaText}>Unlock Advanced History</Text>
        <ChevronRight size={16} color={SEMANTIC_COLORS.textOnAccent} />
      </Pressable>
    </View>
  )
}

// ── Locked Advanced Card ─────────────────────────────────────
function LockedAdvancedCard({ onUpgrade, onMakeAgainLocked }) {
  return (
    <View style={ms.lockedCard}>
      <View style={ms.lockedCardHeader}>
        <Lock size={16} color={SEMANTIC_COLORS.textMuted} />
        <Text style={ms.lockedCardTitle}>Your juice is safely saved</Text>
      </View>
      <Text style={ms.lockedCardBody}>
        Upgrade to RawLifeFlow Pro to reopen its detailed nutrition, insights, and comparisons.
      </Text>
      <Text style={ms.lockedCardSub}>
        Your complete basic Juice History will always remain available.
      </Text>
      <Pressable
        style={({ pressed }) => [ms.lockedCtaBtn, pressed && { opacity: 0.7 }]}
        onPress={onUpgrade}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Unlock Advanced History"
        accessibilityHint="Opens RawLifeFlow Pro subscription options."
      >
        <Text style={ms.lockedCtaText}>Unlock Advanced History</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [ms.makeAgainLockedBtn, pressed && { opacity: 0.7 }]}
        onPress={onMakeAgainLocked}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Make This Juice Again"
        accessibilityHint="Requires RawLifeFlow Pro for older history entries."
      >
        <RefreshCw size={16} color={SEMANTIC_COLORS.textMuted} />
        <Text style={ms.makeAgainLockedText}>Make This Juice Again</Text>
        <Lock size={12} color={SEMANTIC_COLORS.textMuted} />
      </Pressable>
    </View>
  )
}

// ── Make Again Button ────────────────────────────────────────
function MakeAgainButton({ onPress, disabled }) {
  return (
    <Pressable
      style={({ pressed }) => [
        ms.makeAgainBtn,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.5 },
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Make This Juice Again"
      accessibilityHint="Starts a new editable juice using ingredients from this past juice."
    >
      <RefreshCw size={16} color={SEMANTIC_COLORS.success} />
      <Text style={ms.makeAgainText}>Make This Juice Again</Text>
    </Pressable>
  )
}

// ── Entry Details Modal ──────────────────────────────────────
function EntryDetailsModal({
  entry,
  visible,
  onClose,
  onDelete,
  isPro,
  isAdvancedPreview,
  entitlementInitialized,
  onUpgrade,
  onMakeAgain,
  makeAgainInProgress,
}) {
  const previewViewedRef = useRef(false)
  const lockedViewedRef = useRef(false)

  useEffect(() => {
    if (!visible || !entry) {
      previewViewedRef.current = false
      lockedViewedRef.current = false
      return
    }
    // Suppress all access analytics while entitlement is loading
    if (!entitlementInitialized) return
    const policy = getHistoryAccessPolicy(isPro, isAdvancedPreview, entitlementInitialized)
    const ingredientCount = (entry.ingredients || []).length
    const entryPosition = getEntryPosition(isAdvancedPreview)

    if (policy.isAdvancedPreview && !previewViewedRef.current) {
      previewViewedRef.current = true
      trackEvent('advanced_history_preview_viewed', {
        entry_position: entryPosition,
        ingredient_count_bucket: getIngredientCountBucket(ingredientCount),
      })
    }
    if (policy.shouldShowAdvancedUpgrade && !lockedViewedRef.current) {
      lockedViewedRef.current = true
      trackEvent('advanced_history_locked_viewed', {
        entry_position: entryPosition,
        ingredient_count_bucket: getIngredientCountBucket(ingredientCount),
      })
    }
  }, [visible, entry, isPro, isAdvancedPreview, entitlementInitialized])

  if (!entry) return null

  const policy = getHistoryAccessPolicy(isPro, isAdvancedPreview, entitlementInitialized)

  const nutrients = entry.nutrientSummary || {}
  const topNutrients = Object.entries(USDA_RDA)
    .map(([key, rda]) => {
      const val = nutrients[key] || 0
      const pct = rda > 0 ? Math.round((val / rda) * 100) : 0
      const label =
        key === 'vitaminC'
          ? 'Vitamin C'
          : key === 'vitaminA'
            ? 'Vitamin A'
            : key === 'potassium'
              ? 'Potassium'
              : key === 'iron'
                ? 'Iron'
                : key === 'magnesium'
                  ? 'Magnesium'
                  : key === 'folate'
                    ? 'Folate'
                    : key
      return { key, label, pct }
    })
    .filter((n) => n.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)

  const handleMakeAgain = () => {
    if (policy.canMakeAgain && onMakeAgain) {
      onMakeAgain(entry)
    }
  }

  const handleMakeAgainLocked = () => {
    if (!entitlementInitialized) return
    trackEvent('history_make_again_locked', {
      paywall_source: 'history_make_again_locked',
      entry_position: getEntryPosition(isAdvancedPreview),
    })
    onUpgrade('history_make_again_locked')
  }

  const handleUpgradeFromPreview = () => {
    if (!entitlementInitialized) return
    trackEvent('advanced_history_preview_cta_tapped', {
      source: 'history_preview_banner',
      paywall_source: 'history_preview_upgrade',
    })
    onUpgrade('history_preview_upgrade')
  }

  const handleUpgradeFromLocked = () => {
    if (!entitlementInitialized) return
    trackEvent('advanced_history_upgrade_tapped', {
      source: 'history_advanced_locked',
      paywall_source: 'history_advanced_locked',
    })
    onUpgrade('history_advanced_locked')
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable style={ms.card} onPress={(e) => e.stopPropagation()}>
          <View style={ms.cardHeader}>
            <Text style={ms.cardTitle}>Entry Details</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close details"
            >
              <X size={20} color={BRAND.text.muted} />
            </Pressable>
          </View>
          <ScrollView style={ms.cardBody} showsVerticalScrollIndicator={false}>
            <Text style={ms.entryTitle}>{entry.title}</Text>
            <Text style={ms.entryMeta}>
              {entry.source} · {formatTime(entry.createdAt)}
            </Text>

            {/* Advanced Preview Banner for free newest item */}
            {policy.shouldShowPreviewExplanation && (
              <AdvancedPreviewBanner onUpgrade={handleUpgradeFromPreview} />
            )}

            {/* Ingredients — always visible (basic field) */}
            <Text style={ms.sectionTitle}>Ingredients</Text>
            {(entry.ingredients || []).map((id, i) => {
              const prod = PRODUCE_DATA[id]
              return (
                <View key={`${id}-${i}`} style={ms.ingredientRow}>
                  <View
                    style={[
                      ms.ingredientDot,
                      { backgroundColor: prod?.category === 'fruit' ? '#FFB74D' : '#81C784' },
                    ]}
                  />
                  <Text style={ms.ingredientName}>{prod?.name || id}</Text>
                </View>
              )
            })}

            {/* Neutral loading placeholder while entitlement unresolved */}
            {policy.isLoading && (
              <View style={ms.loadingPlaceholder}>
                <Text style={ms.loadingText}>Checking history access…</Text>
              </View>
            )}

            {/* Advanced details — visible for Pro and free preview */}
            {policy.canViewAdvancedDetails && topNutrients.length > 0 && (
              <>
                <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>Top Nutrients (% DV)</Text>
                {topNutrients.map((n) => (
                  <View key={n.key} style={ms.statRow}>
                    <Text style={ms.statLabel}>{n.label}</Text>
                    <Text style={[ms.statValue, n.pct >= 20 && { color: SEMANTIC_COLORS.success }]}>
                      {n.pct}%
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* Taste vote — visible for Pro and free preview */}
            {policy.canViewAdvancedDetails && entry.tasteReaction && (
              <View style={ms.tasteVoteRow}>
                <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>Taste Vote</Text>
                <View style={ms.tasteVoteCard}>
                  <Text style={ms.tasteVoteEmoji}>{entry.tasteReaction.emoji}</Text>
                  <View style={ms.tasteVoteContent}>
                    <Text style={ms.tasteVoteLabel}>{entry.tasteReaction.label}</Text>
                    <Text style={ms.tasteVoteResponse}>{entry.tasteReaction.response}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Locked advanced card for older free items */}
            {policy.shouldShowAdvancedUpgrade && (
              <LockedAdvancedCard
                onUpgrade={handleUpgradeFromLocked}
                onMakeAgainLocked={handleMakeAgainLocked}
              />
            )}

            {/* Make Again — enabled for Pro and free preview */}
            {policy.canMakeAgain && (
              <MakeAgainButton onPress={handleMakeAgain} disabled={makeAgainInProgress} />
            )}

            {/* Supporting copy for preview Make Again */}
            {policy.isAdvancedPreview && (
              <Text style={ms.makeAgainHint}>
                We added the ingredients from your past juice. Adjust anything before analyzing or
                logging this new batch.
              </Text>
            )}

            <Pressable
              style={({ pressed }) => [ms.deleteBtn, pressed && { opacity: 0.7 }]}
              onPress={() => {
                onDelete(entry.id)
                onClose()
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Delete entry"
            >
              <Trash2 size={16} color={SEMANTIC_COLORS.danger} />
              <Text style={ms.deleteBtnText}>Delete Entry</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Day Section ──────────────────────────────────────────────
function DaySection({ dateKey, entries, onEntryPress, devClockTick, previewEntryId, isPro, entitlementInitialized }) {
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
        {expanded ? (
          <ChevronUp size={18} color={BRAND.text.muted} />
        ) : (
          <ChevronDown size={18} color={BRAND.text.muted} />
        )}
      </Pressable>

      {expanded && (
        <View style={s.dayEntries}>
          {entries.map((entry) => {
            const SrcIcon = SOURCE_ICON[entry.source] || Camera
            const srcColor = SOURCE_COLOR[entry.source] || '#64B5F6'
            const isPreview = entitlementInitialized && !isPro && previewEntryId === entry.id
            const isOlderLocked = entitlementInitialized && !isPro && previewEntryId && previewEntryId !== entry.id
            const accessLabel = isPreview
              ? `Advanced History Preview. ${entry.title}, logged ${formatDate(dateKey)}. Complete advanced details are available for this latest juice.`
              : isOlderLocked
                ? `Opens basic juice details. Advanced historical insights require RawLifeFlow Pro.`
                : undefined
            return (
              <Pressable
                key={entry.id}
                style={({ pressed }) => [s.entryRow, pressed && { opacity: 0.7 }]}
                onPress={() => onEntryPress(entry)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={accessLabel || `${entry.title}, ${formatTime(entry.createdAt)}`}
              >
                <View style={[s.entrySrcIcon, { backgroundColor: srcColor + '18' }]}>
                  <SrcIcon size={14} color={srcColor} />
                </View>
                <View style={s.entryContent}>
                  <View style={s.entryTitleRow}>
                    <Text style={s.entryTitle} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    {isPreview && (
                      <View style={s.previewBadge}>
                        <Sparkles size={10} color={SEMANTIC_COLORS.accentPrimary} />
                        <Text style={s.previewBadgeText}>ADVANCED PREVIEW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.entryMeta}>
                    {formatTime(entry.createdAt)} · {(entry.ingredients || []).length} ingredients
                  </Text>
                  {isPreview && (
                    <Text style={s.previewHint}>
                      Explore the complete details from your latest juice.
                    </Text>
                  )}
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
  const { isPro: isProActive, state: subState } = useSubscription()
  const entitlementInitialized = subState.initialized
  const isPro = entitlementInitialized ? isProActive : false
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [devClockTick, setDevClockTick] = useState(0)
  const [makeAgainInProgress, setMakeAgainInProgress] = useState(false)
  const makeAgainRef = useRef(false)
  const historyViewedRef = useRef(false)
  // Tracks resolved entitlement state for Free→Pro transition detection.
  // Starts as null (unknown) so initialization to Pro is NOT treated as a transition.
  const resolvedEntitlementRef = useRef(null)

  useEffect(() => {
    return onDevClockChange(() => setDevClockTick((t) => t + 1))
  }, [])

  // Determine the rotating preview entry ID for free users
  // Suppressed while entitlement is loading — no preview badge until resolved
  const previewEntryId = useMemo(() => {
    if (!entitlementInitialized || isPro) return null
    return getAdvancedPreviewEntryId(entries)
  }, [entries, isPro, entitlementInitialized])

  // Track history_viewed once per mount (not on every rerender)
  useEffect(() => {
    if (historyViewedRef.current) return
    historyViewedRef.current = true
    trackEvent('history_viewed', {
      has_history_entries: entries.length > 0,
      history_entry_count_bucket: getEntryCountBucket(entries.length),
    })
  }, [entries.length])

  // Fire advanced_history_unlocked only on a real observed Free → Pro transition.
  // Initialization to Pro (loading → Pro) does NOT fire the event.
  // Rerenders, remounts, and entry changes do NOT fire the event.
  useEffect(() => {
    if (!entitlementInitialized) return
    const prev = resolvedEntitlementRef.current
    // Only fire if we had a resolved Free state and now have a resolved Pro state
    if (prev === false && isPro) {
      trackEvent('advanced_history_unlocked', {
        access_type: 'pro',
      })
    }
    // Update ref to the current resolved state
    resolvedEntitlementRef.current = isPro
  }, [isPro, entitlementInitialized])

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
  const distinctLoggedDays = useMemo(() => countDistinctLoggedDays(entries), [entries])
  const encouragement = useMemo(
    () => getEncouragementCopy(distinctLoggedDays),
    [distinctLoggedDays],
  )

  // Check if selected entry is the preview
  const isSelectedPreview = useMemo(() => {
    if (!selectedEntry || !entitlementInitialized || isPro) return false
    return previewEntryId === selectedEntry.id
  }, [selectedEntry, isPro, previewEntryId, entitlementInitialized])

  const handleUpgrade = useCallback(
    (source) => {
      if (!entitlementInitialized) return
      navigation.navigate('Paywall', { source })
    },
    [navigation, entitlementInitialized],
  )

  const handleMakeAgain = useCallback(
    (entry) => {
      if (makeAgainRef.current) return
      if (!entitlementInitialized) return
      makeAgainRef.current = true
      setMakeAgainInProgress(true)

      const policy = getHistoryAccessPolicy(isPro, previewEntryId === entry.id, entitlementInitialized)
      const accessType = getAccessType(policy)
      const entryPosition = getEntryPosition(previewEntryId === entry.id)
      const ingredientCount = (entry.ingredients || []).length

      trackEvent('history_make_again_tapped', {
        access_type: accessType,
        entry_position: entryPosition,
        ingredient_count_bucket: getIngredientCountBucket(ingredientCount),
      })

      const result = createEditableDraftFromHistoryEntry(entry)

      if (result.ingredients.length === 0) {
        trackEvent('history_make_again_failed', {
          access_type: accessType,
          failure_category: 'no_valid_ingredients',
          ingredient_count_bucket: getIngredientCountBucket(ingredientCount),
          skipped_ingredient_count_bucket: getIngredientCountBucket(
            result.skippedIngredients.length,
          ),
        })
        Alert.alert(
          'Unable to recreate juice',
          'Some ingredients from this past juice are no longer available and could not be added.',
          [
            {
              text: 'OK',
              onPress: () => {
                makeAgainRef.current = false
                setMakeAgainInProgress(false)
              },
            },
          ],
        )
        return
      }

      trackEvent('history_make_again_draft_created', {
        access_type: accessType,
        entry_position: entryPosition,
        ingredient_count_bucket: getIngredientCountBucket(ingredientCount),
        skipped_ingredient_count_bucket: getIngredientCountBucket(result.skippedIngredients.length),
      })

      const preload = draftToPreloadIngredients(result.ingredients)

      const navigateToEditor = () => {
        navigation.navigate('ScanFlow', {
          screen: 'ScanHome',
          params: {
            manualEntry: true,
            preloadIngredients: preload,
            source: 'history_make_again',
          },
        })
        setSelectedEntry(null)
        makeAgainRef.current = false
        setMakeAgainInProgress(false)
      }

      if (result.skippedIngredients.length > 0) {
        Alert.alert(
          'Some ingredients could not be added',
          'Some ingredients from this past juice are no longer available and could not be added.',
          [
            {
              text: 'Cancel',
              onPress: () => {
                makeAgainRef.current = false
                setMakeAgainInProgress(false)
              },
            },
            { text: 'Continue', onPress: navigateToEditor },
          ],
        )
      } else {
        navigateToEditor()
      }
    },
    [isPro, previewEntryId, navigation, entitlementInitialized],
  )

  // Track item opened — suppress access analytics while loading
  const handleEntryPress = useCallback(
    (entry) => {
      if (entitlementInitialized) {
        const policy = getHistoryAccessPolicy(isPro, previewEntryId === entry.id, entitlementInitialized)
        trackEvent('history_item_opened', {
          access_type: getAccessType(policy),
          entry_position: getEntryPosition(previewEntryId === entry.id),
        })
      }
      setSelectedEntry(entry)
    },
    [isPro, previewEntryId, entitlementInitialized],
  )

  return (
    <View style={s.root}>
      <MeshGradientBg />

      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={s.backBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={22} color={BRAND.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>History</Text>
              <Text style={s.headerSub}>
                {totalEntries} juice{totalEntries !== 1 ? 's' : ''} across {totalDays} day
                {totalDays !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {encouragement && (
            <EncouragementCard title={encouragement.title} body={encouragement.body} />
          )}
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
                onEntryPress={handleEntryPress}
                devClockTick={devClockTick}
                previewEntryId={previewEntryId}
                isPro={isPro}
                entitlementInitialized={entitlementInitialized}
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
        isPro={isPro}
        isAdvancedPreview={isSelectedPreview}
        entitlementInitialized={entitlementInitialized}
        onUpgrade={handleUpgrade}
        onMakeAgain={handleMakeAgain}
        makeAgainInProgress={makeAgainInProgress}
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
    color: SEMANTIC_COLORS.danger,
  },
  // ── Advanced Preview Banner ────────────────────────────────
  previewBanner: {
    backgroundColor: 'rgba(61,139,64,0.08)',
    borderRadius: RADIUS.md,
    borderWidth: 0.5,
    borderColor: 'rgba(61,139,64,0.15)',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    marginBottom: SPACE.lg,
  },
  previewBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACE.xs,
  },
  previewBannerTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: SEMANTIC_COLORS.accentPrimary,
  },
  previewBannerBody: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    color: BRAND.text.secondary,
    lineHeight: LINE_HEIGHT.relaxed * FONT_SIZE.xs,
    marginBottom: SPACE.sm,
  },
  previewCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: SEMANTIC_COLORS.accentPrimary,
  },
  previewCtaText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: SEMANTIC_COLORS.textOnAccent,
  },
  // ── Locked Advanced Card ───────────────────────────────────
  lockedCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.md,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.lg,
    marginTop: SPACE.lg,
    alignItems: 'center',
  },
  lockedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACE.xs,
  },
  lockedCardTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
  },
  lockedCardBody: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    color: BRAND.text.secondary,
    textAlign: 'center',
    lineHeight: LINE_HEIGHT.relaxed * FONT_SIZE.xs,
    marginBottom: SPACE.xs,
  },
  lockedCardSub: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    textAlign: 'center',
    marginBottom: SPACE.md,
  },
  lockedCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: SEMANTIC_COLORS.accentPrimary,
    marginBottom: SPACE.sm,
    minWidth: 200,
  },
  lockedCtaText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: SEMANTIC_COLORS.textOnAccent,
  },
  makeAgainLockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    minWidth: 200,
  },
  makeAgainLockedText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  // ── Make Again Button ──────────────────────────────────────
  makeAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACE.lg,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(129,199,132,0.08)',
  },
  makeAgainText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: SEMANTIC_COLORS.success,
  },
  makeAgainHint: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    color: BRAND.text.muted,
    lineHeight: LINE_HEIGHT.relaxed * FONT_SIZE.xs,
    marginTop: SPACE.sm,
    textAlign: 'center',
  },
  loadingPlaceholder: {
    paddingVertical: SPACE.lg,
    alignItems: 'center',
    marginTop: SPACE.md,
  },
  loadingText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  // ── Taste Vote Card ────────────────────────────────────────
  tasteVoteRow: {
    marginTop: SPACE.sm,
  },
  tasteVoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    marginTop: SPACE.xs,
  },
  tasteVoteEmoji: {
    fontSize: 28,
  },
  tasteVoteContent: {
    flex: 1,
  },
  tasteVoteLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    marginBottom: 2,
  },
  tasteVoteResponse: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    color: BRAND.text.secondary,
    lineHeight: LINE_HEIGHT.relaxed * FONT_SIZE.xs,
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
  entryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.primary,
    flex: 1,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(61,139,64,0.12)',
  },
  previewBadgeText: {
    fontSize: 9,
    fontWeight: FONT_WEIGHT.bold,
    color: SEMANTIC_COLORS.accentPrimary,
    letterSpacing: 0.3,
  },
  previewHint: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: SEMANTIC_COLORS.accentPrimary,
    marginTop: 3,
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
  encouragementCard: {
    backgroundColor: BRAND.glass.surfaceElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: BRAND.glass.border,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    marginBottom: SPACE.xs,
  },
  encouragementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    marginBottom: SPACE.xs,
  },
  encouragementTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    flex: 1,
  },
  encouragementBody: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    color: SEMANTIC_COLORS.textSecondary,
    lineHeight: LINE_HEIGHT.relaxed * FONT_SIZE.sm,
  },
})
