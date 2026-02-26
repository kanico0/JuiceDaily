// ─────────────────────────────────────────────────────────────
// QuickLogger.js — 3-step bottom-sheet logger
// Step 1: Type (base / power / kick presets)
// Step 2: Edit Ingredients
// Step 3: Confirm & Log
// Offline-first: persists to AsyncStorage immediately.
// Gated behind ff_3step_logger feature flag.
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
  TextInput,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  Droplets, Zap, Flame, ChevronLeft, Check, X, Camera, PenLine, Plus, Minus, Search, Leaf,
} from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { processJuiceBatch, PRODUCE_DATA } from '../services/JuiceEngine'
import { trackEvent } from '../services/AnalyticsService'
import { useFlags } from '../services/FeatureFlags'
import { useFormatWeight } from '../utils/weightFormat'
import { useOrganicPref, getDefaultOrganic } from '../utils/organicPreference'

const { height: SCREEN_H } = Dimensions.get('window')
const PENDING_LOG_KEY = '@juicing_pending_quick_logs'
const FIRST_LOG_KEY = '@juicing_first_log_done'

const ALL_PRODUCE = Object.entries(PRODUCE_DATA).map(([id, entry]) => ({
  id,
  name: entry.name,
  category: entry.category,
})).sort((a, b) => a.name.localeCompare(b.name))

const DEFAULT_VOLUME_G = 475

// ── Type Presets ─────────────────────────────────────────────

const TYPE_OPTIONS = [
  {
    id: 'green_classic',
    label: 'Green Classic',
    sublabel: 'Cucumber, Celery, Kale, Lemon',
    icon: Droplets,
    color: '#81C784',
    pillar: 'base',
    ingredients: [
      { produceId: 'cucumber', ratio: 0.35 },
      { produceId: 'celery', ratio: 0.25 },
      { produceId: 'kale', ratio: 0.25 },
      { produceId: 'lemon', ratio: 0.15 },
    ],
  },
  {
    id: 'power_greens',
    label: 'Power Greens',
    sublabel: 'Spinach, Kale, Ginger, Apple',
    icon: Zap,
    color: '#4CAF50',
    pillar: 'power',
    ingredients: [
      { produceId: 'spinach', ratio: 0.30 },
      { produceId: 'kale', ratio: 0.25 },
      { produceId: 'ginger', ratio: 0.10 },
      { produceId: 'apple', ratio: 0.35 },
    ],
  },
  {
    id: 'citrus_kick',
    label: 'Citrus Kick',
    sublabel: 'Orange, Lemon, Ginger, Turmeric',
    icon: Flame,
    color: '#FFB74D',
    pillar: 'kick',
    ingredients: [
      { produceId: 'orange', ratio: 0.40 },
      { produceId: 'lemon', ratio: 0.25 },
      { produceId: 'ginger', ratio: 0.15 },
      { produceId: 'turmeric', ratio: 0.20 },
    ],
  },
  {
    id: 'root_boost',
    label: 'Root Boost',
    sublabel: 'Carrot, Beet, Apple, Ginger',
    icon: Zap,
    color: '#E57373',
    pillar: 'power',
    ingredients: [
      { produceId: 'carrot', ratio: 0.30 },
      { produceId: 'beet', ratio: 0.25 },
      { produceId: 'apple', ratio: 0.30 },
      { produceId: 'ginger', ratio: 0.15 },
    ],
  },
]

// ── Offline Persistence ──────────────────────────────────────

async function savePendingLog(logEntry) {
  try {
    const raw = await AsyncStorage.getItem(PENDING_LOG_KEY)
    const pending = raw ? JSON.parse(raw) : []
    pending.push(logEntry)
    await AsyncStorage.setItem(PENDING_LOG_KEY, JSON.stringify(pending))
  } catch (e) {
    // Non-fatal: log will still be in ChallengeStore
  }
}

export async function getPendingLogs() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_LOG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export async function clearPendingLogs() {
  try {
    await AsyncStorage.removeItem(PENDING_LOG_KEY)
  } catch (e) {
    // Non-fatal
  }
}

// ── Step Indicator ───────────────────────────────────────────

function StepIndicator({ current, total }) {
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            stepStyles.dot,
            i === current && stepStyles.dotActive,
            i < current && stepStyles.dotDone,
          ]}
        />
      ))}
    </View>
  )
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACE.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dotActive: {
    backgroundColor: DARK.green,
    width: 24,
  },
  dotDone: {
    backgroundColor: 'rgba(129,199,132,0.4)',
  },
})

// ── Main QuickLogger Component ───────────────────────────────

export default function QuickLogger({ visible, onDismiss, onLogComplete, onCustomIngredients }) {
  const [step, setStep] = useState(0)
  const [selectedType, setSelectedType] = useState(null)
  const [editIngredients, setEditIngredients] = useState([])
  const [showAddProduce, setShowAddProduce] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const { fmtG } = useFormatWeight()
  const { mode: organicMode } = useOrganicPref()
  const isReduced = useReducedMotion()
  const { isEnabled } = useFlags()
  const emotionalCopy = isEnabled('ff_emotional_copy')
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current

  useEffect(() => {
    if (visible) {
      setStep(0)
      setSelectedType(null)
      setEditIngredients([])
      setShowAddProduce(false)
      setAddSearch('')
      // Fire first_log_started analytics
      AsyncStorage.getItem(FIRST_LOG_KEY).then((done) => {
        if (!done) {
          trackEvent('first_log_started', {
            surface: 'quick_logger',
            logger_variant: '3step',
          })
        }
      })
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: isReduced ? DURATION.crossfade : DURATION.standard,
        easing: isReduced ? EASING.linear : EASING.decelerate,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: isReduced ? DURATION.crossfade : DURATION.exit,
        easing: isReduced ? EASING.linear : EASING.accelerate,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, isReduced])

  const handleTypeSelect = useCallback((type) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSelectedType(type)
    setEditIngredients(type.ingredients.map((ing) => {
      const entry = PRODUCE_DATA[ing.produceId]
      return {
        produceId: ing.produceId,
        name: entry?.name || ing.produceId,
        weightG: Math.round(DEFAULT_VOLUME_G * ing.ratio),
        isOrganic: getDefaultOrganic(organicMode),
      }
    }))
    setStep(1)
  }, [])

  const handleIngWeightChange = useCallback((index, delta) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditIngredients((prev) => prev.map((ing, i) => {
      if (i !== index) return ing
      return { ...ing, weightG: Math.max(10, ing.weightG + delta) }
    }))
  }, [])

  const handleIngRemove = useCallback((index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setEditIngredients((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleIngToggleOrganic = useCallback((index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditIngredients((prev) => prev.map((ing, i) => {
      if (i !== index) return ing
      return { ...ing, isOrganic: !ing.isOrganic }
    }))
  }, [])

  const handleIngAdd = useCallback((produceItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const entry = PRODUCE_DATA[produceItem.id]
    setEditIngredients((prev) => [...prev, {
      produceId: produceItem.id,
      name: entry?.name || produceItem.name,
      weightG: 100,
      isOrganic: getDefaultOrganic(organicMode),
    }])
    setShowAddProduce(false)
    setAddSearch('')
  }, [])

  const existingIngIds = new Set(editIngredients.map((i) => i.produceId))
  const filteredAddProduce = ALL_PRODUCE.filter((p) => {
    if (existingIngIds.has(p.id)) return false
    if (addSearch.trim()) return p.name.toLowerCase().includes(addSearch.toLowerCase())
    return true
  })

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (step > 0) setStep(step - 1)
  }, [step])

  const handleConfirm = useCallback(async () => {
    if (editIngredients.length === 0) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    // Build scannedIngredients from edited list
    const scannedIngredients = editIngredients.map((ing) => ({
      produceId: ing.produceId,
      weightG: ing.weightG,
      isOrganic: ing.isOrganic ?? false,
    }))

    // Process through JuiceEngine
    const batchResult = processJuiceBatch(scannedIngredients, 'cold_pressed')

    // Persist offline immediately
    const logId = `ql_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const logEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      volume: 'medium',
      type: selectedType.id,
      scannedIngredients,
      totals: batchResult.totals,
      offline: true,
    }
    await savePendingLog(logEntry)

    // Analytics: log_completed (every log)
    trackEvent('log_completed', {
      log_id_opaque: logId,
      log_type: 'quick_3step',
      volume_bucket: 'medium',
      offline: true,
      source: 'manual',
    })

    // Analytics: first_log_completed (one-time)
    const isFirstLog = !(await AsyncStorage.getItem(FIRST_LOG_KEY))
    if (isFirstLog) {
      trackEvent('first_log_completed', {
        log_type: 'quick_3step',
        volume_bucket: 'medium',
        juice_type_enum: selectedType.id,
        offline: true,
      })
      await AsyncStorage.setItem(FIRST_LOG_KEY, 'true')
    }

    // Callback to parent (which calls ChallengeStore.logJuice)
    if (onLogComplete) {
      onLogComplete(scannedIngredients, {
        ...batchResult,
        scannedIngredients,
        totals: batchResult.totals,
      })
    }

    onDismiss()
  }, [editIngredients, selectedType, onLogComplete, onDismiss])

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDismiss()
  }, [onDismiss])

  const summaryText = selectedType ? selectedType.label : ''

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={qlStyles.overlay}>
        <TouchableOpacity style={qlStyles.backdrop} onPress={handleClose} activeOpacity={1} />
        <Animated.View style={[qlStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={['#1C2128', '#161B22', '#0D1117']}
            style={qlStyles.sheetGradient}
          >
            {/* Header */}
            <View style={qlStyles.header}>
              {step > 0 ? (
                <TouchableOpacity onPress={handleBack} style={qlStyles.headerBtn}>
                  <ChevronLeft size={20} color={DARK.textSecondary} />
                </TouchableOpacity>
              ) : (
                <View style={qlStyles.headerBtn} />
              )}
              <Text style={qlStyles.headerTitle}>
                {step === 0
                  ? (emotionalCopy ? 'Choose Your Blend' : 'What kind?')
                  : step === 1
                    ? (emotionalCopy ? 'Tweak Your Mix' : 'Edit Ingredients')
                    : (emotionalCopy ? 'Log This Juice' : 'Log it!')}
              </Text>
              <TouchableOpacity onPress={handleClose} style={qlStyles.headerBtn}>
                <X size={20} color={DARK.textSecondary} />
              </TouchableOpacity>
            </View>

            <StepIndicator current={step} total={3} />

            {/* Step 0: Type */}
            {step === 0 && (
              <View style={qlStyles.typeList}>
                {TYPE_OPTIONS.map((type) => {
                  const Icon = type.icon
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        qlStyles.typeCard,
                        selectedType?.id === type.id && { borderColor: type.color },
                      ]}
                      onPress={() => handleTypeSelect(type)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`${type.label}: ${type.sublabel}`}
                    >
                      <View style={[qlStyles.typeIcon, { backgroundColor: `${type.color}15` }]}>
                        <Icon size={18} color={type.color} />
                      </View>
                      <View style={qlStyles.typeContent}>
                        <Text style={qlStyles.typeLabel}>{type.label}</Text>
                        <Text style={qlStyles.typeSub}>{type.sublabel}</Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}

                {/* Divider */}
                <View style={qlStyles.typeDivider}>
                  <View style={qlStyles.typeDividerLine} />
                  <Text style={qlStyles.typeDividerText}>or</Text>
                  <View style={qlStyles.typeDividerLine} />
                </View>

                {/* Custom options */}
                <TouchableOpacity
                  style={qlStyles.customCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    onDismiss()
                    if (onCustomIngredients) onCustomIngredients('manual')
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Enter your own ingredients manually"
                >
                  <View style={[qlStyles.typeIcon, { backgroundColor: 'rgba(100,181,246,0.1)' }]}>
                    <PenLine size={18} color="#64B5F6" />
                  </View>
                  <View style={qlStyles.typeContent}>
                    <Text style={qlStyles.typeLabel}>Enter My Ingredients</Text>
                    <Text style={qlStyles.typeSub}>Pick from the full produce list</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={qlStyles.customCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    onDismiss()
                    if (onCustomIngredients) onCustomIngredients('camera')
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Snap a photo of your juice ingredients"
                >
                  <View style={[qlStyles.typeIcon, { backgroundColor: 'rgba(206,147,216,0.1)' }]}>
                    <Camera size={18} color="#CE93D8" />
                  </View>
                  <View style={qlStyles.typeContent}>
                    <Text style={qlStyles.typeLabel}>Snap a Photo</Text>
                    <Text style={qlStyles.typeSub}>Use camera to identify ingredients</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 1: Edit Ingredients */}
            {step === 1 && (
              <View style={qlStyles.editSection}>
                <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                  {editIngredients.map((ing, i) => (
                    <View key={`${ing.produceId}-${i}`} style={qlStyles.editRow}>
                      <Text style={qlStyles.editName} numberOfLines={1}>{ing.name}</Text>
                      <View style={qlStyles.editWeightRow}>
                        <TouchableOpacity
                          style={qlStyles.editWeightBtn}
                          onPress={() => handleIngWeightChange(i, -25)}
                          activeOpacity={0.7}
                        >
                          <Minus size={10} color="#8B949E" />
                        </TouchableOpacity>
                        <Text style={qlStyles.editWeightText}>{fmtG(ing.weightG)}</Text>
                        <TouchableOpacity
                          style={qlStyles.editWeightBtn}
                          onPress={() => handleIngWeightChange(i, 25)}
                          activeOpacity={0.7}
                        >
                          <Plus size={10} color="#8B949E" />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={[qlStyles.editOrganicBtn, ing.isOrganic && qlStyles.editOrganicBtnActive]}
                        onPress={() => handleIngToggleOrganic(i)}
                        activeOpacity={0.7}
                      >
                        <Leaf size={10} color={ing.isOrganic ? '#81C784' : '#484F58'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={qlStyles.editRemoveBtn}
                        onPress={() => handleIngRemove(i)}
                        activeOpacity={0.7}
                      >
                        <X size={12} color="#E91E63" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                {/* Add ingredient */}
                {!showAddProduce ? (
                  <TouchableOpacity
                    style={qlStyles.editAddBtn}
                    onPress={() => setShowAddProduce(true)}
                    activeOpacity={0.7}
                  >
                    <Plus size={14} color="#81C784" />
                    <Text style={qlStyles.editAddText}>Add Ingredient</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={qlStyles.editAddPanel}>
                    <View style={qlStyles.editSearchRow}>
                      <Search size={14} color="#484F58" />
                      <TextInput
                        style={qlStyles.editSearchInput}
                        placeholder="Search produce..."
                        placeholderTextColor="#484F58"
                        value={addSearch}
                        onChangeText={setAddSearch}
                        autoFocus
                      />
                      <TouchableOpacity onPress={() => { setShowAddProduce(false); setAddSearch('') }}>
                        <X size={14} color="#8B949E" />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                      {filteredAddProduce.slice(0, 20).map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={qlStyles.editAddItem}
                          onPress={() => handleIngAdd(p)}
                          activeOpacity={0.7}
                        >
                          <Text style={qlStyles.editAddItemText}>{p.name}</Text>
                          <Plus size={14} color="#81C784" />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Continue to confirm */}
                <TouchableOpacity
                  style={[qlStyles.editContinueBtn, editIngredients.length === 0 && { opacity: 0.4 }]}
                  onPress={() => { if (editIngredients.length > 0) setStep(2) }}
                  activeOpacity={0.8}
                  disabled={editIngredients.length === 0}
                >
                  <Text style={qlStyles.editContinueText}>Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Confirm */}
            {step === 2 && (
              <View style={qlStyles.confirmSection}>
                <View style={qlStyles.confirmSummary}>
                  <Text style={qlStyles.confirmEmoji}>🧃</Text>
                  <View>
                    <Text style={qlStyles.confirmTitle}>{summaryText}</Text>
                    <Text style={qlStyles.confirmSub}>
                      {editIngredients.length} ingredient{editIngredients.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={qlStyles.confirmBtn}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={emotionalCopy ? 'Log this juice to your daily flow' : 'Confirm and log this juice'}
                >
                  <LinearGradient
                    colors={['#4CAF50', '#2E7D32']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={qlStyles.confirmBtnGradient}
                  >
                    <Check size={20} color="#FFFFFF" />
                    <Text style={qlStyles.confirmBtnText}>
                      {emotionalCopy ? 'Log This Juice' : 'Log It!'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  )
}

// ── Styles ───────────────────────────────────────────────────

const qlStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    maxHeight: SCREEN_H * 0.7,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    overflow: 'hidden',
  },
  sheetGradient: {
    padding: SPACE.xl,
    paddingTop: SPACE.lg,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.lg,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },

  // Volume grid
  optionsGrid: {
    flexDirection: 'row',
    gap: SPACE.md,
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.xl,
    padding: SPACE.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  optionCardSelected: {
    borderColor: DARK.green,
    backgroundColor: 'rgba(129,199,132,0.08)',
  },
  optionEmoji: {
    fontSize: 32,
    marginBottom: SPACE.sm,
  },
  optionLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginBottom: 2,
  },
  optionSub: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },

  // Type list
  typeList: {
    gap: SPACE.sm,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.xl,
    padding: SPACE.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: SPACE.md,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeContent: {
    flex: 1,
  },
  typeLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginBottom: 2,
  },
  typeSub: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
  },
  typeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    marginVertical: SPACE.xs,
  },
  typeDividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  typeDividerText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  customCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: RADIUS.xl,
    padding: SPACE.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderStyle: 'dashed',
    gap: SPACE.md,
  },

  // Confirm
  confirmSection: {
    alignItems: 'center',
    gap: SPACE.xl,
    paddingVertical: SPACE.lg,
  },
  confirmSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.xl,
    padding: SPACE.lg,
    alignSelf: 'stretch',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  confirmEmoji: {
    fontSize: 40,
  },
  confirmTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginBottom: 2,
  },
  confirmSub: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
  },
  confirmBtn: {
    alignSelf: 'stretch',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  confirmBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.xl,
  },
  confirmBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.heavy,
    color: '#FFFFFF',
  },

  // Edit Ingredients step
  editSection: {
    gap: SPACE.md,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  editName: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
  },
  editWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editWeightBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editWeightText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
    minWidth: 50,
    textAlign: 'center',
  },
  editOrganicBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  editOrganicBtnActive: {
    backgroundColor: 'rgba(129,199,132,0.12)',
    borderColor: 'rgba(129,199,132,0.25)',
  },
  editRemoveBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(233,30,99,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  editAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(129,199,132,0.2)',
    borderStyle: 'dashed',
  },
  editAddText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#81C784',
  },
  editAddPanel: {
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: SPACE.sm,
  },
  editSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 4,
  },
  editSearchInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: DARK.textPrimary,
    padding: 0,
  },
  editAddItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  editAddItemText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
  },
  editContinueBtn: {
    backgroundColor: 'rgba(129,199,132,0.15)',
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editContinueText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: '#81C784',
  },
})
