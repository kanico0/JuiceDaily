// ─────────────────────────────────────────────────────────────
// HistoryScreen.js — Chronological history of all juice log entries.
// Groups entries by date (descending). Tapping a date section
// expands to show individual entries for that day.
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert, TextInput } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
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
  Droplets,
  Heart,
  BookOpen,
  Target,
  Compass,
  Sun,
  Leaf,
  Beaker,
  Trophy,
  Sparkle,
  Star,
  Pencil,
  Check,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import { useJuiceLog } from '../services/JuiceLogStore'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import {
  formatIngredientPortion,
  computeProduceBalance,
  getTopNutrients,
  getBasicNutritionStats,
} from '../services/detailedHistoryHelpers'
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
import { useRoute } from '@react-navigation/native'

// ── Source provenance maps ───────────────────────────────────
// Maps entry.source to icon, color, and user-facing label.
// Legacy 'photo' entries are mapped to neutral 'unknown' at render
// time — they are NOT falsely labeled Juice Snap.
const SOURCE_ICON = {
  juice_snap: Camera,
  manual: Keyboard,
  wellness_focus: Heart,
  browse_ideas: BookOpen,
  todays_focus: Target,
  today_spotlight: Compass,
  make_again: RefreshCw,
  simple_blend: Sparkle,
  seasonal_glow: Sun,
  produce_recipe: Leaf,
  glow_library: Trophy,
  beginner_glow: Beaker,
  unknown: Droplets,
  // Legacy values — rendered as neutral
  photo: Droplets,
  demo: Eye,
}
const SOURCE_COLOR = {
  juice_snap: '#64B5F6',
  manual: '#CE93D8',
  wellness_focus: '#EF5DA8',
  browse_ideas: '#FFB74D',
  todays_focus: '#4DD0E1',
  today_spotlight: '#81C784',
  make_again: '#AED581',
  simple_blend: '#FFD54F',
  seasonal_glow: '#FF8A65',
  produce_recipe: '#66BB6A',
  glow_library: '#BA68C8',
  beginner_glow: '#4DB6AC',
  unknown: '#90A4AE',
  photo: '#90A4AE',
  demo: '#FFB74D',
}
const SOURCE_LABEL = {
  juice_snap: 'Juice Snap',
  manual: 'Manual Entry',
  wellness_focus: 'Wellness Focus',
  browse_ideas: 'Browse Juice Ideas',
  todays_focus: "Today's Focus",
  today_spotlight: "Today's Juice Spotlight",
  make_again: 'Made Again',
  simple_blend: 'Simple Blend',
  seasonal_glow: 'Seasonal Glow Pack',
  produce_recipe: 'Produce Recipe',
  glow_library: 'Glow Library',
  beginner_glow: 'Beginner Glow Path',
  unknown: 'Juice Entry',
  photo: 'Juice Entry',
  demo: 'Demo',
}

// Neutral fallback for any unrecognized source — never Camera
const NEUTRAL_ICON = Droplets
const NEUTRAL_COLOR = '#90A4AE'
const NEUTRAL_LABEL = 'Juice Entry'

function getSourceIcon(source) {
  return SOURCE_ICON[source] || NEUTRAL_ICON
}
function getSourceColor(source) {
  return SOURCE_COLOR[source] || NEUTRAL_COLOR
}
function getSourceLabel(source) {
  return SOURCE_LABEL[source] || NEUTRAL_LABEL
}

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
        <Text style={ms.previewBannerTitle}>Your Detailed History Preview</Text>
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
        accessibilityLabel="Unlock Detailed History"
      >
        <Text style={ms.previewCtaText}>Unlock Detailed History</Text>
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

      {/* Locked feature previews */}
      <View style={ms.lockedPreviewList}>
        <View style={ms.lockedPreviewItem}>
          <Lock size={12} color={SEMANTIC_COLORS.textMuted} />
          <Text style={ms.lockedPreviewText}>Portions — Recreate this juice accurately.</Text>
        </View>
        <View style={ms.lockedPreviewItem}>
          <Lock size={12} color={SEMANTIC_COLORS.textMuted} />
          <Text style={ms.lockedPreviewText}>Nutrition Details — See more of what was in your juice.</Text>
        </View>
        <View style={ms.lockedPreviewItem}>
          <Lock size={12} color={SEMANTIC_COLORS.textMuted} />
          <Text style={ms.lockedPreviewText}>Produce Balance — See your fruit and vegetable mix.</Text>
        </View>
        <View style={ms.lockedPreviewItem}>
          <Lock size={12} color={SEMANTIC_COLORS.textMuted} />
          <Text style={ms.lockedPreviewText}>Rating & Personal Notes</Text>
        </View>
        <View style={ms.lockedPreviewItem}>
          <Lock size={12} color={SEMANTIC_COLORS.textMuted} />
          <Text style={ms.lockedPreviewText}>Make Again</Text>
        </View>
      </View>

      <Text style={ms.lockedCardSub}>
        Your complete basic Juice History will always remain available.
      </Text>
      <Pressable
        style={({ pressed }) => [ms.lockedCtaBtn, pressed && { opacity: 0.7 }]}
        onPress={onUpgrade}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Unlock Detailed History"
        accessibilityHint="Opens RawLifeFlow Pro subscription options."
      >
        <Text style={ms.lockedCtaText}>Unlock Detailed History</Text>
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
  onSetRating,
  onSetNote,
  onToggleFavorite,
}) {
  const insets = useSafeAreaInsets()
  const previewViewedRef = useRef(false)
  const lockedViewedRef = useRef(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [isEditingNote, setIsEditingNote] = useState(false)

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

  // Sync note draft when entry changes or modal opens
  useEffect(() => {
    if (!visible || !entry) {
      setNoteDraft('')
      setIsEditingNote(false)
      return
    }
    setNoteDraft(entry.note || '')
    setIsEditingNote(false)
  }, [visible, entry])

  if (!entry) return null

  const policy = getHistoryAccessPolicy(isPro, isAdvancedPreview, entitlementInitialized)

  const nutrients = entry.nutrientSummary || {}
  const topNutrients = getTopNutrients(nutrients)
  const basicStats = getBasicNutritionStats(nutrients)
  const produceBalance = computeProduceBalance(entry.ingredients, entry.ingredientDetails)
  const ingredientDetails = Array.isArray(entry.ingredientDetails) ? entry.ingredientDetails : null
  const hasPortionData = ingredientDetails && ingredientDetails.length > 0
  const isFavorite = entry.favorite === true
  const currentRating = typeof entry.rating === 'number' ? entry.rating : 0

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

  const handleRatingPress = (star) => {
    if (!policy.canViewAdvancedDetails) return
    if (!onSetRating) return
    // Toggle off if same star is tapped
    const newRating = currentRating === star ? null : star
    onSetRating(entry.id, newRating)
  }

  const handleSaveNote = () => {
    if (!policy.canViewAdvancedDetails) return
    if (!onSetNote) return
    onSetNote(entry.id, noteDraft)
    setIsEditingNote(false)
  }

  const handleToggleFavorite = () => {
    if (!policy.canViewAdvancedDetails) return
    if (!onToggleFavorite) return
    onToggleFavorite(entry.id)
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={[
          ms.overlay,
          {
            paddingTop: insets.top + SPACE.xl,
            paddingBottom: insets.bottom + SPACE.xl,
          },
        ]}
      >
        {/* Backdrop — separate Pressable behind the card for outside-tap dismissal */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Card — regular View, no Pressable wrapper, no overflow:hidden */}
        <View style={ms.card}>
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
          <ScrollView
            style={ms.cardBody}
            contentContainerStyle={[
              ms.cardBodyContent,
              { paddingBottom: Math.max(insets.bottom, SPACE.lg) + SPACE.md },
            ]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <Text style={ms.entryTitle}>{entry.title}</Text>
            <View style={ms.entrySourceRow}>
              {(() => {
                const SrcIcon = getSourceIcon(entry.source)
                const srcColor = getSourceColor(entry.source)
                return (
                  <View style={[ms.entrySourceBadge, { backgroundColor: srcColor + '18' }]}>
                    <SrcIcon size={11} color={srcColor} />
                    <Text style={[ms.entrySourceLabel, { color: srcColor }]}>
                      {getSourceLabel(entry.source)}
                    </Text>
                  </View>
                )
              })()}
              <Text style={ms.entryMeta}>
                · {formatTime(entry.createdAt)}
              </Text>
            </View>

            {/* Advanced Preview Banner for free newest item */}
            {policy.shouldShowPreviewExplanation && (
              <AdvancedPreviewBanner onUpgrade={handleUpgradeFromPreview} />
            )}

            {/* Ingredients — always visible (basic field) */}
            <Text style={ms.sectionTitle}>Ingredients</Text>
            {(entry.ingredients || []).map((id, i) => {
              const prod = PRODUCE_DATA[id]
              const detail = ingredientDetails?.find((d) => d && d.produceId === id)
              const portionText = policy.canViewAdvancedDetails && detail
                ? formatIngredientPortion(detail)
                : null
              return (
                <View key={`${id}-${i}`} style={ms.ingredientRow}>
                  <View
                    style={[
                      ms.ingredientDot,
                      { backgroundColor: prod?.category === 'fruit' ? '#FFB74D' : '#81C784' },
                    ]}
                  />
                  <Text style={ms.ingredientName}>{prod?.name || id}</Text>
                  {portionText && (
                    <Text style={ms.ingredientPortion}>{portionText}</Text>
                  )}
                </View>
              )
            })}

            {/* Portion not recorded note for Pro entries without portion data */}
            {policy.canViewAdvancedDetails && !hasPortionData && (entry.ingredients || []).length > 0 && (
              <Text style={ms.portionHint}>Portion not recorded</Text>
            )}

            {/* Neutral loading placeholder while entitlement unresolved */}
            {policy.isLoading && (
              <View style={ms.loadingPlaceholder}>
                <Text style={ms.loadingText}>Checking history access…</Text>
              </View>
            )}

            {/* ── Pro Detailed History sections ── */}

            {/* Useful Nutrition — visible for Pro and free preview */}
            {policy.canViewAdvancedDetails && (topNutrients.length > 0 || basicStats.calories > 0) && (
              <>
                <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>Estimated Nutrition</Text>
                {(basicStats.calories > 0 || basicStats.sugar > 0) && (
                  <View style={ms.basicStatsRow}>
                    {basicStats.calories > 0 && (
                      <View style={ms.basicStatItem}>
                        <Text style={ms.basicStatValue}>{basicStats.calories}</Text>
                        <Text style={ms.basicStatLabel}>cal</Text>
                      </View>
                    )}
                    {basicStats.sugar > 0 && (
                      <View style={ms.basicStatItem}>
                        <Text style={ms.basicStatValue}>{basicStats.sugar}g</Text>
                        <Text style={ms.basicStatLabel}>sugar</Text>
                      </View>
                    )}
                  </View>
                )}
                {topNutrients.length > 0 && (
                  <>
                    <Text style={ms.subSectionTitle}>Top Nutrients (% Daily Reference)</Text>
                    {topNutrients.map((n) => (
                      <View key={n.key} style={ms.statRow}>
                        <Text style={ms.statLabel}>{n.label}</Text>
                        <Text style={[ms.statValue, n.pct >= 20 && { color: SEMANTIC_COLORS.success }]}>
                          {n.pct}%
                        </Text>
                      </View>
                    ))}
                    <Text style={ms.estimateNote}>
                      Estimated from produce amounts and food-composition data. Actual values can vary by produce and juicer.
                    </Text>
                  </>
                )}
              </>
            )}

            {/* Produce Balance — visible for Pro and free preview */}
            {policy.canViewAdvancedDetails && (produceBalance.vegCount + produceBalance.fruitCount) > 0 && (
              <>
                <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>Produce Balance</Text>
                {produceBalance.mode === 'weight' ? (
                  <View style={ms.balanceContainer}>
                    <View style={ms.balanceBar}>
                      <View style={[ms.balanceVeg, { flex: produceBalance.vegPercent }]}>
                        <Text style={ms.balanceVegText}>Veg {produceBalance.vegPercent}%</Text>
                      </View>
                      <View style={[ms.balanceFruit, { flex: produceBalance.fruitPercent }]}>
                        <Text style={ms.balanceFruitText}>Fruit {produceBalance.fruitPercent}%</Text>
                      </View>
                    </View>
                    <Text style={ms.balanceBasisLabel}>By ingredient weight</Text>
                  </View>
                ) : (
                  <View>
                    <Text style={ms.balanceCountText}>
                      {produceBalance.vegCount} vegetable{produceBalance.vegCount !== 1 ? 's' : ''}
                      {' · '}
                      {produceBalance.fruitCount} fruit{produceBalance.fruitCount !== 1 ? 's' : ''}
                    </Text>
                    <Text style={ms.balanceBasisLabel}>By ingredient count</Text>
                  </View>
                )}
              </>
            )}

            {/* Rating — visible for Pro and free preview */}
            {policy.canViewAdvancedDetails && (
              <View style={ms.ratingSection}>
                <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>Rating</Text>
                <View style={ms.starRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() => handleRatingPress(star)}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`${star} star${star !== 1 ? 's' : ''}`}
                    >
                      <Star
                        size={24}
                        color={star <= currentRating ? '#FFD54F' : BRAND.text.muted}
                        fill={star <= currentRating ? '#FFD54F' : 'transparent'}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Personal Note — visible for Pro and free preview */}
            {policy.canViewAdvancedDetails && (
              <View style={ms.noteSection}>
                <Text style={[ms.sectionTitle, { marginTop: SPACE.lg }]}>Personal Note</Text>
                {isEditingNote ? (
                  <View>
                    <TextInput
                      style={ms.noteInput}
                      value={noteDraft}
                      onChangeText={setNoteDraft}
                      placeholder="Add a note about this juice…"
                      placeholderTextColor={BRAND.text.muted}
                      multiline
                      maxLength={500}
                      autoFocus
                    />
                    <View style={ms.noteActions}>
                      <Pressable
                        style={({ pressed }) => [ms.noteSaveBtn, pressed && { opacity: 0.7 }]}
                        onPress={handleSaveNote}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Save note"
                      >
                        <Check size={16} color={SEMANTIC_COLORS.success} />
                        <Text style={ms.noteSaveText}>Save</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [ms.noteCancelBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => {
                          setNoteDraft(entry.note || '')
                          setIsEditingNote(false)
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel note edit"
                      >
                        <Text style={ms.noteCancelText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : entry.note ? (
                  <Pressable
                    style={({ pressed }) => [ms.noteDisplay, pressed && { opacity: 0.7 }]}
                    onPress={() => setIsEditingNote(true)}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel="Edit note"
                  >
                    <Text style={ms.noteText}>{entry.note}</Text>
                    <Pencil size={14} color={BRAND.text.muted} />
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [ms.noteAddBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => setIsEditingNote(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Add a note"
                  >
                    <Pencil size={14} color={BRAND.text.muted} />
                    <Text style={ms.noteAddText}>Add a note</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Favorite — visible for Pro and free preview */}
            {policy.canViewAdvancedDetails && (
              <Pressable
                style={({ pressed }) => [ms.favoriteBtn, pressed && { opacity: 0.7 }]}
                onPress={handleToggleFavorite}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  size={18}
                  color={isFavorite ? '#EF5DA8' : BRAND.text.muted}
                  fill={isFavorite ? '#EF5DA8' : 'transparent'}
                />
                <Text style={[ms.favoriteText, isFavorite && { color: '#EF5DA8' }]}>
                  {isFavorite ? 'Favorited' : 'Add to Favorites'}
                </Text>
              </Pressable>
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
        </View>
      </View>
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
            const SrcIcon = getSourceIcon(entry.source)
            const srcColor = getSourceColor(entry.source)
            const isPreview = entitlementInitialized && !isPro && previewEntryId === entry.id
            const isOlderLocked = entitlementInitialized && !isPro && previewEntryId && previewEntryId !== entry.id
            const accessLabel = isPreview
              ? `Detailed History Preview. ${entry.title}, logged ${formatDate(dateKey)}. Complete advanced details are available for this latest juice.`
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
  const route = useRoute()
  const { entries, deleteEntry, setRating, setNote, toggleFavorite } = useJuiceLog()
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
  const pendingOpenEntryIdRef = useRef(null)

  // Open a specific entry when navigated with openEntryId param
  // (e.g. from TodayScreen "View Today's Juice" button)
  useEffect(() => {
    const openEntryId = route?.params?.openEntryId
    if (!openEntryId || pendingOpenEntryIdRef.current === openEntryId) return
    if (entries.length === 0) return
    const entry = entries.find((e) => e.id === openEntryId)
    if (entry) {
      pendingOpenEntryIdRef.current = openEntryId
      setSelectedEntry(entry)
    }
  }, [route?.params?.openEntryId, entries])

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
        onSetRating={setRating}
        onSetNote={setNote}
        onToggleFavorite={toggleFavorite}
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
    maxHeight: '90%',
    flex: 1,
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
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
  },
  cardTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.lg,
  },
  cardBodyContent: {
    flexGrow: 1,
  },
  entryTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    marginBottom: 4,
  },
  entrySourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACE.lg,
  },
  entrySourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  entrySourceLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  entryMeta: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
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
  // ── Pro Detailed History styles ───────────────────────────
  ingredientPortion: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    marginLeft: 'auto',
  },
  portionHint: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    color: BRAND.text.muted,
    fontStyle: 'italic',
    marginTop: SPACE.xs,
  },
  subSectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACE.xs,
    marginTop: SPACE.sm,
  },
  estimateNote: {
    fontSize: FONT_SIZE.xs - 1,
    color: BRAND.text.muted,
    fontStyle: 'italic',
    paddingTop: SPACE.xs,
  },
  basicStatsRow: {
    flexDirection: 'row',
    gap: SPACE.lg,
    marginBottom: SPACE.sm,
  },
  basicStatItem: {
    alignItems: 'center',
  },
  basicStatValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
  },
  basicStatLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  // ── Produce Balance ────────────────────────────────────────
  balanceContainer: {
    marginTop: SPACE.xs,
  },
  balanceBar: {
    flexDirection: 'row',
    height: 32,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  balanceVeg: {
    backgroundColor: '#81C784',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  balanceFruit: {
    backgroundColor: '#FFB74D',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  balanceVegText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: '#1B3A1B',
  },
  balanceFruitText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: '#4A2E00',
  },
  balanceCountText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.secondary,
    marginTop: SPACE.xs,
  },
  balanceBasisLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    color: BRAND.text.muted,
    marginTop: SPACE.xs,
    fontStyle: 'italic',
  },
  // ── Rating ─────────────────────────────────────────────────
  ratingSection: {
    marginTop: SPACE.xs,
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACE.xs,
  },
  // ── Personal Note ──────────────────────────────────────────
  noteSection: {
    marginTop: SPACE.xs,
  },
  noteInput: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    color: BRAND.text.primary,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    marginTop: SPACE.xs,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  noteActions: {
    flexDirection: 'row',
    gap: SPACE.md,
    marginTop: SPACE.sm,
    alignItems: 'center',
  },
  noteSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(129,199,132,0.08)',
  },
  noteSaveText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: SEMANTIC_COLORS.success,
  },
  noteCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: SPACE.md,
  },
  noteCancelText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  noteDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginTop: SPACE.xs,
  },
  noteText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    color: BRAND.text.secondary,
    lineHeight: LINE_HEIGHT.relaxed * FONT_SIZE.sm,
  },
  noteAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACE.sm,
    marginTop: SPACE.xs,
  },
  noteAddText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
  },
  // ── Favorite ───────────────────────────────────────────────
  favoriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACE.lg,
    paddingVertical: 10,
  },
  favoriteText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.muted,
  },
  // ── Locked preview list ────────────────────────────────────
  lockedPreviewList: {
    alignItems: 'flex-start',
    gap: SPACE.xs,
    marginVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
  },
  lockedPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockedPreviewText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    color: BRAND.text.muted,
    textAlign: 'left',
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
