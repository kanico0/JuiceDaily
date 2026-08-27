import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  LayoutAnimation,
  UIManager,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Plus,
  Minus,
  X,
  ChevronDown,
  Droplets,
  Zap,
  Flame,
  Film,
  Search,
  Crown,
  Sparkles,
  Leaf,
  BookOpen,
  Star,
  Check,
} from 'lucide-react-native'
import colors from '../constants/colors'
import NUTRIENT_LIBRARY from '../constants/NutrientLibrary.json'
import { EMPTY_BATCH, USDA_RDA } from '../constants/nutrition'
import SnapButton from '../components/SnapButton'
import SnapIcon from '../components/SnapIcon'
import { useQuota } from '../services/quota/QuotaStore'
import {
  selectQuotaLabel,
  selectQuotaExhausted,
  selectFilmRollLabel,
  selectFilmRollRemaining,
  selectFilmRollIsPro,
} from '../services/subscriptions/subscriptionSelectors'
import NutritionSummary from '../components/NutritionSummary'
import BigSqueezeModal from '../components/BigSqueezeModal'
import SnapGateModal from '../components/SnapGateModal'
import AccountGateModal from '../components/AccountGateModal'
import TrafficLightBadge from '../components/TrafficLightBadge'
import CameraScreen from './CameraScreen'
import { usePro } from '../services/ProStore'
import { useEffectivePlanAccess } from '../hooks/useEffectivePlanAccess'
import MeshGradientBg from '../components/MeshGradientBg'
import { processJuiceBatch, PRODUCE_DATA } from '../services/JuiceEngine'
import AdvancedBlendModal from '../components/AdvancedBlendModal'
import { countDistinctProduceIds, classifyBlend, BlendAllowanceError, FREE_ADVANCED_BLEND_ALLOWANCE, createOperationId, getAdvancedBlendRemaining, fetchEffectiveBlendAllowance } from '../services/quota/blendAllowanceService'
import { authorizeAndProcessBatch } from '../services/quota/blendNutritionGate'
import { authorizeGuestLog, isGuestLogAllowed } from '../services/quota/guestLogGate'
import { checkCameraEligibility } from '../services/cameraEligibilityCoordinator'
import { SUPABASE_CONFIGURED } from '../services/subscriptions/subscriptionConfig'
import { trackEvent } from '../services/AnalyticsService'
import { getQaProSnapRemaining, incrementQaProSnapUsage } from '../services/quota/qaSnapCounter'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import {
  useChallenge,
  classifyJuiceByColors,
  classifyProduceByPillar,
  classifyProduceAllPillars,
  DAILY_PILLARS,
} from '../services/ChallengeStore'
import { useFormatWeight, useWeightUnit } from '../utils/weightFormat'
import { useOrganicPref, getDefaultOrganic } from '../utils/organicPreference'
import { useNutritionScore } from '../services/NutritionScoreStore'
import { useJuiceLog } from '../services/JuiceLogStore'
import { recordMeaningfulActivity } from '../services/DormantReminderService'
import {
  isQuantitySupported as isProduceQuantitySupported,
  getSupportedPortionUnits,
  getSupportedCountUnits,
  getDefaultCountUnit,
  getDefaultSizeForUnit,
  getSupportedSizes,
  recomputeFromQuantityChange,
  restoreQuantityMetadata,
  getPortionRegistryRecord,
} from '../services/producePortionConversion'
import {
  validateIngredientForLog,
  validateBatchForLog,
} from '../services/validateIngredientForLog'
import {
  getPreferredPortionEntryMode,
} from '../services/portionEntryPreference'
import PortionEntryModeToggle from '../components/PortionEntryModeToggle'
import QuantityPortionEditor from '../components/QuantityPortionEditor'
import { PRODUCE_SEARCH_ALIASES, getProduceVariantDisplayName } from '../services/produceFamilies'

const JUICE_METHOD_STORAGE_KEY = '@juicing_juice_method_v1'

const PRODUCE_OPTIONS = Object.entries(PRODUCE_DATA).map(([id, entry]) => ({
  id,
  name: entry.name,
  category: entry.category,
})).sort((a, b) => a.name.localeCompare(b.name))

const PILLAR_ICONS = {
  base: Droplets,
  power: Zap,
  kick: Flame,
}

function buildBatch(scannedIngredients, juiceMethod = 'cold_pressed') {
  const juiceResult = processJuiceBatch(scannedIngredients, juiceMethod)
  return {
    scannedIngredients,
    juiceMethod,
    items: juiceResult.ingredients,
    totals: juiceResult.totals,
    veggieRatio: juiceResult.veggieRatio,
    fruitRatio: juiceResult.fruitRatio,
    warnings: juiceResult.warnings,
    totalRawWeightG: juiceResult.totalRawWeightG,
    totalJuiceWeightG: juiceResult.totalJuiceWeightG,
  }
}

// ── Produce Edit Row ─────────────────────────────────────────

const RDA_NUTRIENT_LABELS = {
  vitaminC: 'Vit C',
  vitaminA: 'Vit A',
  potassium: 'K',
  iron: 'Iron',
  magnesium: 'Mg',
  folate: 'Folate',
}

function computeTopRda(nutrition) {
  if (!nutrition) return []
  const rdaEntries = Object.keys(USDA_RDA)
    .map((key) => {
      const val = nutrition[key] || 0
      const rda = USDA_RDA[key]
      const pct = rda > 0 ? Math.round((val / rda) * 100) : 0
      return { key, pct, label: RDA_NUTRIENT_LABELS[key] || key }
    })
    .filter((e) => e.pct > 0)
    .sort((a, b) => b.pct - a.pct)
  return rdaEntries.slice(0, 3)
}

function ProduceEditRow({
  item,
  index,
  onReplace,
  onRemove,
  onWeightChange,
  onToggleOrganic,
  onModeChange,
  onQuantityChange,
  onUnitChange,
  onSizeChange,
  onEstimatedWeightChange,
  juiceMethod,
  isPrimary,
  onSetPrimary,
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const { fmtG } = useFormatWeight()
  const entry = PRODUCE_DATA[item.produceId]
  const allPillars = classifyProduceAllPillars(item.produceId)
  const pillar = allPillars[0] || null
  const pillarData = pillar ? DAILY_PILLARS[pillar] : null
  const isOrganic = item.isOrganic ?? false

  const portionMeta = item.portionMetadata || null
  const entryMode = item.portionEntryMode || 'weight'
  const quantitySupported = isProduceQuantitySupported(item.produceId)
  const registryRecord = getPortionRegistryRecord(item.produceId)
  const confidence = registryRecord?.confidence || 'high'

  const qtyMeta = portionMeta?.inputMode === 'quantity' ? portionMeta : null
  const currentQuantity = qtyMeta?.enteredQuantity || 1
  // Validate unit key against the produce's supported units to prevent
  // stale unit keys from a previous produce (e.g. 'leaf' from kale)
  // from being displayed for a different produce (e.g. spinach)
  const supportedUnits = getSupportedPortionUnits(item.produceId)
  const countUnits = getSupportedCountUnits(item.produceId)
  const rawUnitKey = qtyMeta?.unitKey || item.pendingUnitKey || getDefaultCountUnit(item.produceId)?.unitKey || null
  const unitIsValid = rawUnitKey && supportedUnits.some((u) => u.unitKey === rawUnitKey)
  const currentUnitKey = unitIsValid ? rawUnitKey : (getDefaultCountUnit(item.produceId)?.unitKey || null)
  const currentSizeKey = qtyMeta?.sizeKey || item.pendingSizeKey || null

  // Canonical validation — same function used by Log button and submission guard
  const validation = validateIngredientForLog(item)
  const rowErrorMessage = validation.valid ? null : validation.message

  return (
    <View style={styles.editRow}>
      {/* Row 1: Pillar dots + full produce name */}
      <TouchableOpacity
        style={styles.editNameRow}
        onPress={() => setIsPickerOpen(true)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {allPillars.length > 0 ? allPillars.map((p) => (
            <View key={p} style={[styles.editPillarDot, { backgroundColor: DAILY_PILLARS[p].color }]} />
          )) : (
            <View style={[styles.editPillarDot, { backgroundColor: '#90A4AE' }]} />
          )}
        </View>
        <Text style={styles.editName} numberOfLines={1} ellipsizeMode="tail">{getProduceVariantDisplayName(item.produceId) || entry?.name || item.produceId}</Text>
        <ChevronDown size={14} color="#90A4AE" />
      </TouchableOpacity>

      {/* Row 1a: Primary produce control */}
      <View style={styles.primaryRow}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onSetPrimary(index)
          }}
          style={[styles.primaryBtn, isPrimary && styles.primaryBtnActive]}
          accessibilityRole="radio"
          accessibilityState={{ selected: isPrimary }}
          accessibilityLabel={isPrimary ? 'Primary produce' : `Make ${entry?.name || item.produceId} the primary produce`}
        >
          {isPrimary ? (
            <Check size={10} color="#64B5F6" />
          ) : (
            <Star size={10} color="#8B949E" />
          )}
          <Text style={[styles.primaryLabel, { color: isPrimary ? '#64B5F6' : '#8B949E' }]}>
            {isPrimary ? 'Primary' : 'Make Primary'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Row 1b: Entry mode toggle */}
      <View style={styles.editModeRow}>
        <PortionEntryModeToggle
          mode={entryMode}
          onModeChange={(mode) => onModeChange(index, mode)}
          quantityDisabled={!quantitySupported}
          quantityDisabledReason={
            !quantitySupported
              ? 'Count estimates are not available for this ingredient yet. Enter its volume instead.'
              : ''
          }
          accessibilityLabelPrefix={`Portion entry for ${entry?.name || item.produceId}`}
        />
      </View>

      {/* Row 2a: Status label — full width */}
      {entryMode === 'weight' && (
        <View style={styles.statusLabelRow}>
          <TrafficLightBadge produceId={item.produceId} isOrganic={isOrganic} juiceMethod={juiceMethod} />
        </View>
      )}

      {/* Row 2b: Organic toggle — full width */}
      {entryMode === 'weight' && (
        <View style={styles.organicRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onToggleOrganic(index)
            }}
            style={[styles.organicBtn, isOrganic && styles.organicBtnActive]}
            accessibilityRole="switch"
            accessibilityState={{ checked: isOrganic }}
            accessibilityLabel={isOrganic ? 'Organic' : 'Non-Organic'}
          >
            <Leaf size={10} color={isOrganic ? '#81C784' : '#90A4AE'} />
            <Text style={[styles.organicLabel, { color: isOrganic ? '#81C784' : '#90A4AE' }]}>
              {isOrganic ? 'Organic' : 'Non-Organic'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Row 2c: Volume adjustment + remove — full width */}
      {entryMode === 'weight' && (
        <View style={styles.adjustmentRow}>
          <View style={styles.editWeightRow}>
            <TouchableOpacity
              onPress={() => onWeightChange(index, Math.max(10, item.weightG - 25))}
              style={styles.editWeightBtn}
              accessibilityLabel="Decrease raw produce weight"
            >
              <Minus size={12} color="#8B949E" />
            </TouchableOpacity>
            <View style={styles.editWeightLabels}>
              <Text style={styles.editWeightText}>
                {item.enteredWeightValue != null && item.enteredWeightUnit
                  ? `${item.enteredWeightValue} ${item.enteredWeightUnit}`
                  : fmtG(item.weightG)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onWeightChange(index, item.weightG + 25)}
              style={styles.editWeightBtn}
              accessibilityLabel="Increase raw produce weight"
            >
              <Plus size={12} color="#8B949E" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onRemove(index)
            }}
            style={styles.editRemoveBtn}
            accessibilityLabel="Remove ingredient"
          >
            <X size={14} color="#E91E63" />
          </TouchableOpacity>
        </View>
      )}

      {/* Row 2a: Status label — full width */}
      {entryMode === 'quantity' && quantitySupported && (
        <View style={styles.statusLabelRow}>
          <TrafficLightBadge produceId={item.produceId} isOrganic={isOrganic} juiceMethod={juiceMethod} />
        </View>
      )}

      {/* Row 2b: Organic toggle — full width */}
      {entryMode === 'quantity' && quantitySupported && (
        <View style={styles.organicRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onToggleOrganic(index)
            }}
            style={[styles.organicBtn, isOrganic && styles.organicBtnActive]}
            accessibilityRole="switch"
            accessibilityState={{ checked: isOrganic }}
            accessibilityLabel={isOrganic ? 'Organic' : 'Non-Organic'}
          >
            <Leaf size={10} color={isOrganic ? '#81C784' : '#90A4AE'} />
            <Text style={[styles.organicLabel, { color: isOrganic ? '#81C784' : '#90A4AE' }]}>
              {isOrganic ? 'Organic' : 'Non-Organic'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Row 2c: Count adjustment controls — full width */}
      {entryMode === 'quantity' && quantitySupported && (
        <View style={styles.editQuantityContainer}>
          <QuantityPortionEditor
            produceId={item.produceId}
            quantity={currentQuantity}
            unitKey={currentUnitKey}
            sizeKey={currentSizeKey}
            onQuantityChange={(qty) => onQuantityChange(index, qty)}
            onUnitChange={(unitKey) => onUnitChange(index, unitKey)}
            onSizeChange={(sizeKey) => onSizeChange(index, sizeKey)}
            onEstimatedWeightChange={(weightG) => onEstimatedWeightChange(index, weightG)}
            confidence={confidence}
          />
          {rowErrorMessage && (
            <View style={styles.rowErrorContainer}>
              <X size={12} color="#F85149" />
              <Text style={styles.rowErrorText}>{rowErrorMessage}</Text>
            </View>
          )}
        </View>
      )}

      {/* Row 2d: Remove button — full width */}
      {entryMode === 'quantity' && quantitySupported && (
        <View style={styles.removeRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onRemove(index)
            }}
            style={styles.editRemoveBtn}
            accessibilityLabel="Remove ingredient"
          >
            <X size={14} color="#E91E63" />
          </TouchableOpacity>
        </View>
      )}

      {/* Produce picker modal */}
      <Modal
        visible={isPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setIsPickerOpen(false)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Replace Produce</Text>
            <FlatList
              data={PRODUCE_OPTIONS}
              keyExtractor={(p) => p.id}
              style={styles.pickerList}
              renderItem={({ item: opt }) => {
                const optAllPillars = classifyProduceAllPillars(opt.id)
                return (
                  <TouchableOpacity
                    style={styles.pickerOption}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      onReplace(index, opt.id)
                      setIsPickerOpen(false)
                    }}
                  >
                    {optAllPillars.length > 0 ? optAllPillars.map((p) => (
                      <View key={p} style={[styles.pickerDot, { backgroundColor: DAILY_PILLARS[p].color }]} />
                    )) : (
                      <View style={[styles.pickerDot, { backgroundColor: '#90A4AE' }]} />
                    )}
                    <Text style={styles.pickerOptionText}>{opt.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {optAllPillars.map((p) => (
                        <Text key={p} style={[styles.pickerPillarTag, { color: DAILY_PILLARS[p].color }]}>
                          {DAILY_PILLARS[p].shortLabel}
                        </Text>
                      ))}
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

// ── Add Produce Picker ───────────────────────────────────────

function AddProducePicker({ onAdd }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Plus size={16} color="#81C784" />
        <Text style={styles.addBtnText}>Add Produce</Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss()
          setIsOpen(false)
        }}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss()
            setIsOpen(false)
          }}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Add Produce</Text>
            <FlatList
              data={PRODUCE_OPTIONS}
              keyExtractor={(p) => p.id}
              style={styles.pickerList}
              renderItem={({ item: opt }) => {
                const optAllPillars = classifyProduceAllPillars(opt.id)
                return (
                  <TouchableOpacity
                    style={styles.pickerOption}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      onAdd(opt.id)
                      setIsOpen(false)
                    }}
                  >
                    {optAllPillars.length > 0 ? optAllPillars.map((p) => (
                      <View key={p} style={[styles.pickerDot, { backgroundColor: DAILY_PILLARS[p].color }]} />
                    )) : (
                      <View style={[styles.pickerDot, { backgroundColor: '#90A4AE' }]} />
                    )}
                    <Text style={styles.pickerOptionText}>{opt.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {optAllPillars.map((p) => (
                        <Text key={p} style={[styles.pickerPillarTag, { color: DAILY_PILLARS[p].color }]}>
                          {DAILY_PILLARS[p].shortLabel}
                        </Text>
                      ))}
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

// ── Visual Ingredient Cloud ───────────────────────────────────

const CATEGORY_COLORS = {
  Base: '#64B5F6',
  Power: '#81C784',
  Kick: '#FFB74D',
}

const SORTED_NUTRIENT_LIBRARY = [...NUTRIENT_LIBRARY].sort((a, b) => a.name.localeCompare(b.name))

function matchesProduceSearch(item, query) {
  const q = query.toLowerCase()
  if (item.name.toLowerCase().includes(q)) return true
  const aliases = PRODUCE_SEARCH_ALIASES[item.id]
  if (aliases) {
    for (const alias of aliases) {
      if (alias.toLowerCase().includes(q)) return true
    }
  }
  return false
}

function IngredientCloud({ searchQuery, onAdd, addedIds }) {
  const filtered = searchQuery.length > 0
    ? SORTED_NUTRIENT_LIBRARY.filter((item) => matchesProduceSearch(item, searchQuery))
    : SORTED_NUTRIENT_LIBRARY

  return (
    <View style={manualStyles.cloudWrap}>
      <View style={manualStyles.cloudGrid}>
        {filtered.map((item) => {
          const isAdded = addedIds.includes(item.id)
          const displayName = getProduceVariantDisplayName(item.id) || item.name
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                manualStyles.bubble,
                isAdded && manualStyles.bubbleAdded,
                { borderColor: isAdded ? CATEGORY_COLORS[item.category] + '40' : 'rgba(255,255,255,0.06)' },
              ]}
              onPress={() => {
                if (!isAdded) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onAdd(item)
                }
              }}
              activeOpacity={isAdded ? 1 : 0.7}
            >
              <Text style={manualStyles.bubbleEmoji}>{item.emoji}</Text>
              <Text style={[
                manualStyles.bubbleName,
                isAdded && { color: CATEGORY_COLORS[item.category] },
              ]}>{displayName}</Text>
              {isAdded && <Text style={manualStyles.bubbleCheck}>✓</Text>}
            </TouchableOpacity>
          )
        })}
      </View>
      {filtered.length === 0 && (
        <Text style={manualStyles.noResults}>No ingredients match "{searchQuery}"</Text>
      )}
    </View>
  )
}

// ── Scan Quota Meter ─────────────────────────────────────────
// Server-authoritative usage display under the Snap button.
// Hidden when Supabase quota is not configured (rollback-safe).

function QuotaMeter({ navigation }) {
  const { quota } = useQuota()
  const { isPro: effectiveIsPro, isQaProSimulation, snapMonthlyLimit } = useEffectivePlanAccess()
  const [qaSnapUsed, setQaSnapUsed] = useState(0)

  useEffect(() => {
    if (isQaProSimulation) {
      getQaProSnapRemaining(snapMonthlyLimit).then((remaining) => {
        setQaSnapUsed(snapMonthlyLimit - remaining)
      })
    }
  }, [isQaProSimulation, snapMonthlyLimit])

  // When QA Pro Simulation is active, show the QA counter
  if (isQaProSimulation) {
    const qaRemaining = snapMonthlyLimit - qaSnapUsed
    const qaExhausted = qaRemaining <= 0
    return (
      <TouchableOpacity
        onPress={() => {
          if (qaExhausted) navigation.navigate('Paywall', { source: 'scan_meter' })
        }}
        activeOpacity={qaExhausted ? 0.7 : 1}
        accessibilityRole="text"
        accessibilityLabel={`QA Pro: ${qaRemaining} of ${snapMonthlyLimit} snaps remaining`}
        style={{ alignItems: 'center', marginTop: 8 }}
      >
        <Text style={{ color: qaExhausted ? '#F0883E' : '#90A4AE', fontSize: 12 }}>
          {qaRemaining} of {snapMonthlyLimit} Juice Snaps remaining
        </Text>
        <Text style={{ color: '#7EE787', fontSize: 11, marginTop: 2 }}>
          QA Pro Simulation — client allowance only
        </Text>
      </TouchableOpacity>
    )
  }

  const label = selectQuotaLabel(quota)
  if (!label) return null

  const exhausted = selectQuotaExhausted(quota)
  const isFree = quota?.plan === 'free'

  return (
    <TouchableOpacity
      onPress={() => {
        if (exhausted && isFree) navigation.navigate('Paywall', { source: 'scan_meter' })
      }}
      activeOpacity={exhausted && isFree ? 0.7 : 1}
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{ alignItems: 'center', marginTop: 8 }}
    >
      <Text style={{ color: exhausted ? '#F0883E' : '#90A4AE', fontSize: 12 }}>
        {label}
      </Text>
      {exhausted && isFree && (
        <Text style={{ color: '#7EE787', fontSize: 12, marginTop: 2 }}>
          Upgrade to Pro for 12 AI Snaps / month — or keep logging manually free
        </Text>
      )}
    </TouchableOpacity>
  )
}

// ── Main Screen ──────────────────────────────────────────────

// Resolve the authoritative log source from route params + camera usage.
// Juice Snap is ONLY assigned when cameraUsedRef is true — meaning a
// successful AI camera/image-recognition operation supplied the ingredients.
// Juice Snap must NEVER be inferred from route name, default route source,
// image presence, generic handleProduceIdentified, preloaded ingredients,
// or nutrition results.
//
// Source-precedence contract:
//   1. Actual successful Juice Snap recognition → juice_snap
//   2. Explicit recognized origin → preserve it
//   3. Genuine manual entry → manual
//   4. Otherwise → unknown
//
// manualEntry:true controls builder behavior; it must NOT overwrite
// known provenance.
const ROUTE_SOURCE_TO_LOG_SOURCE = {
  recipe: 'manual',
  today_spotlight: 'today_spotlight',
  todays_focus: 'todays_focus',
  history_make_again: 'make_again',
  checkin: 'manual',
  browse_ideas: 'browse_ideas',
  wellness_focus: 'wellness_focus',
  simple_blend: 'simple_blend',
  seasonal_glow: 'seasonal_glow',
  produce_recipe: 'produce_recipe',
  glow_library: 'glow_library',
  beginner_glow: 'beginner_glow',
}

function resolveLogSource(routeSource, cameraUsed, manualEntry) {
  if (cameraUsed) return 'juice_snap'
  const mapped = ROUTE_SOURCE_TO_LOG_SOURCE[routeSource]
  if (mapped) return mapped
  if (manualEntry) return 'manual'
  return 'unknown'
}

function seedPreloadIngredients(preload, organicMode) {
  return preload.map((item) => {
    if (typeof item === 'string') {
      return { produceId: item, weightG: 150, isOrganic: getDefaultOrganic(organicMode), portionEntryMode: 'weight' }
    }

    const baseIngredient = {
      produceId: item.produceId,
      weightG: item.weightG || 150,
      isOrganic: typeof item.isOrganic === 'boolean' ? item.isOrganic : getDefaultOrganic(organicMode),
      portionEntryMode: item.portionEntryMode || 'weight',
      portionMetadata: item.portionMetadata || undefined,
      // Preserve original weight display representation for Make Again fidelity
      enteredWeightValue: typeof item.enteredWeightValue === 'number' ? item.enteredWeightValue : undefined,
      enteredWeightUnit: typeof item.enteredWeightUnit === 'string' ? item.enteredWeightUnit : undefined,
    }

    // Normalize quantity-mode ingredients through the canonical
    // recomputeFromQuantityChange path. This ensures portionMetadata
    // has the correct keys (unitKey, sizeKey, enteredQuantity,
    // inputMode, estimatedRawWeightG, etc.) that validation expects.
    // Without this, Make Again reconstruction produces a legacy-shaped
    // portionMetadata ({unit, size, quantity}) that fails validation
    // even though the values are visually correct.
    if (
      baseIngredient.portionEntryMode === 'quantity' &&
      isProduceQuantitySupported(item.produceId)
    ) {
      const meta = item.portionMetadata
      // If metadata already has canonical keys, it's already normalized
      const hasCanonicalKeys = meta && meta.unitKey && meta.enteredQuantity != null
      if (!hasCanonicalKeys) {
        // Extract values from either canonical or legacy metadata shape
        const rawQuantity = meta?.enteredQuantity ?? meta?.quantity ?? item.quantity ?? 1
        const rawUnitKey = meta?.unitKey ?? meta?.unit ?? null
        const rawSizeKey = meta?.sizeKey ?? meta?.size ?? null

        const defaultUnit = getDefaultCountUnit(item.produceId)
        if (defaultUnit) {
          // Validate rawUnitKey against the produce's count units
          // to prevent stale unit keys (e.g. 'leaf' from kale) from
          // being applied to a different produce (e.g. spinach).
          // Use getSupportedCountUnits (not getSupportedPortionUnits)
          // because the QuantityPortionEditor only displays count units.
          const countUnits = getSupportedCountUnits(item.produceId)
          const rawUnitIsValid = rawUnitKey && countUnits.some((u) => u.unitKey === rawUnitKey)
          const unitKey = rawUnitIsValid ? rawUnitKey : defaultUnit.unitKey
          const unit = countUnits.find((u) => u.unitKey === unitKey) || defaultUnit
          const sizeKey = rawSizeKey || getDefaultSizeForUnit(unit)

          const normalizedResult = recomputeFromQuantityChange({
            produceId: item.produceId,
            quantity: rawQuantity,
            unitKey,
            sizeKey: sizeKey || undefined,
          })

          if (normalizedResult) {
            baseIngredient.portionMetadata = normalizedResult.metadata
            baseIngredient.weightG = normalizedResult.weightG
            baseIngredient.pendingUnitKey = unitKey
            baseIngredient.pendingSizeKey = sizeKey
          } else {
            // Fallback: initialize with defaults like the manual-entry path
            const fallbackSizeKey = getDefaultSizeForUnit(defaultUnit)
            const fallbackResult = recomputeFromQuantityChange({
              produceId: item.produceId,
              quantity: 1,
              unitKey: defaultUnit.unitKey,
              sizeKey: fallbackSizeKey || undefined,
            })
            if (fallbackResult) {
              baseIngredient.portionMetadata = fallbackResult.metadata
              baseIngredient.weightG = fallbackResult.weightG
              baseIngredient.pendingUnitKey = defaultUnit.unitKey
              baseIngredient.pendingSizeKey = fallbackSizeKey
            }
          }
        }
      }
    }

    return baseIngredient
  })
}

export default function JuiceSnapScreen({ navigation, route }) {
  const { mode: organicMode } = useOrganicPref()
  const { mode: weightDisplayMode } = useWeightUnit()
  const shouldAutoOpenCamera = route?.params?.openCamera === true
  const preloadIngredients = route?.params?.preloadIngredients || null
  const source = route?.params?.source || 'manual'
  const [batch, setBatch] = useState(() => {
    if (preloadIngredients && preloadIngredients.length > 0) {
      const seeded = seedPreloadIngredients(preloadIngredients, organicMode)
      return buildBatch(seeded, 'centrifugal')
    }
    return { ...EMPTY_BATCH, scannedIngredients: [] }
  })
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isLogged, setIsLogged] = useState(false)
  const [isLogging, setIsLogging] = useState(false)
  const [showBigSqueeze, setShowBigSqueeze] = useState(false)
  const [squeezeColors, setSqueezeColors] = useState([])
  const { logJuice, vitalityScore } = useChallenge()
  const { recordNutritionLog, momentum: preMomentum } = useNutritionScore()
  const { addEntry: addLogEntry, setTasteReaction: setLogTasteReaction } = useJuiceLog()
  const { isPro } = usePro()
  const { isPro: effectiveIsPro, snapMonthlyLimit: effectiveSnapLimit, isQaProSimulation } = useEffectivePlanAccess()
  const { quota: serverQuota, applySnapshot: applyQuotaSnapshot, refresh: refreshQuota, markInstallSnapConsumed, verificationState } = useQuota()
  const filmRollLabel = selectFilmRollLabel(serverQuota)
  const filmRollRemaining = selectFilmRollRemaining(serverQuota)
  const filmRollIsPro = selectFilmRollIsPro(serverQuota)
  const [qaSnapUsed, setQaSnapUsed] = useState(0)
  useEffect(() => {
    if (isQaProSimulation) {
      getQaProSnapRemaining(effectiveSnapLimit).then((r) => setQaSnapUsed(effectiveSnapLimit - r))
    }
  }, [isQaProSimulation, effectiveSnapLimit])
  const [showSnapGate, setShowSnapGate] = useState(false)
  const [showAccountGate, setShowAccountGate] = useState(false)
  const [accountGateMode, setAccountGateMode] = useState('guest')
  const [isPreparingCamera, setIsPreparingCamera] = useState(false)
  const pendingCameraOpenRef = useRef(false)
  const [guestFirstScan, setGuestFirstScan] = useState(false)
  const [showAdvancedBlendModal, setShowAdvancedBlendModal] = useState(false)
  const [advancedBlendStage, setAdvancedBlendStage] = useState('fifth_ingredient_notice')
  const [advancedBlendRemaining, setAdvancedBlendRemaining] = useState(FREE_ADVANCED_BLEND_ALLOWANCE)
  const [blendUsedCount, setBlendUsedCount] = useState(0)
  const [blendAllowanceVerified, setBlendAllowanceVerified] = useState(false)
  const [blendNoticeShown, setBlendNoticeShown] = useState(false)
  const [blendCheckInProgress, setBlendCheckInProgress] = useState(false)
  const blendOperationIdRef = useRef(null)
  const blendApprovedRef = useRef(false)
  const advancedBlendStageRef = useRef(advancedBlendStage)
  const isLoggingRef = useRef(false)
  const analysisCompletedRef = useRef(false)
  const analysisResultRef = useRef(null)
  const analysisBatchUpdateRef = useRef(false)
  const cameraUsedRef = useRef(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [isManualMode, setIsManualMode] = useState(route?.params?.manualEntry === true)
  const [manualSearch, setManualSearch] = useState('')
  const [showUpsellNudge, setShowUpsellNudge] = useState(false)
  const [juiceMethod, setJuiceMethod] = useState('centrifugal')
  const [globalPortionMode, setGlobalPortionMode] = useState('quantity')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [primaryProduceId, setPrimaryProduceId] = useState(null)

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height)
    })
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0)
    })
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  // Hydrate persisted juicer type (cold_pressed | centrifugal)
  // Re-hydrates on focus so changes made in Settings are picked up.
  useEffect(() => {
    const hydrateJuiceMethod = () => {
      AsyncStorage.getItem(JUICE_METHOD_STORAGE_KEY).then((val) => {
        if (val === 'cold_pressed' || val === 'centrifugal') {
          setJuiceMethod(val)
          setBatch((prevBatch) => {
            if ((prevBatch.scannedIngredients || []).length === 0) return prevBatch
            if (prevBatch.juiceMethod === val) return prevBatch
            return buildBatch(prevBatch.scannedIngredients, val)
          })
        }
      }).catch(() => {})
    }
    hydrateJuiceMethod()
    const unsubscribe = navigation?.addListener?.('focus', hydrateJuiceMethod)
    return () => { if (typeof unsubscribe === 'function') unsubscribe() }
  }, [navigation])

  // Hydrate global portion entry preference
  useEffect(() => {
    const hydratePortionMode = () => {
      getPreferredPortionEntryMode().then((mode) => {
        setGlobalPortionMode(mode)
      }).catch(() => {})
    }
    hydratePortionMode()
    const unsubscribe = navigation?.addListener?.('focus', hydratePortionMode)
    return () => { if (typeof unsubscribe === 'function') unsubscribe() }
  }, [navigation])

  // Reset isLogged when returning to this screen (e.g. after ScanSuccess),
  // so the user can log a second juice on the same day.
  // Also reset camera state to ensure "Snap Produce" works on subsequent taps.
  useEffect(() => {
    const resetLoggedOnFocus = () => {
      if (!isLoggingRef.current) {
        setIsLogged(false)
      }
      // Reset stale modal state from prior log/camera attempts
      // but preserve the completion_confirmation modal so the user
      // can explicitly acknowledge the result before dismissal.
      if (advancedBlendStageRef.current !== 'completion_confirmation') {
        setShowAdvancedBlendModal(false)
      }
      setShowAccountGate(false)
      // Increment attempt ID to invalidate any in-flight camera attempt
      // before resetting the guard.  Without this, a stale attempt can
      // resume after the focus reset and race with a new user-initiated
      // attempt, leaving isPreparingCamera stuck on.
      cameraAttemptIdRef.current += 1
      if (cameraAbortRef.current) {
        cameraAbortRef.current.abort()
        cameraAbortRef.current = null
      }
      setIsCameraOpen(false)
      setIsPreparingCamera(false)
      cameraInFlightRef.current = false
    }
    const unsubscribe = navigation?.addListener?.('focus', resetLoggedOnFocus)
    return () => { if (typeof unsubscribe === 'function') unsubscribe() }
  }, [navigation])

  useEffect(() => {
    advancedBlendStageRef.current = advancedBlendStage
  }, [advancedBlendStage])

  // Fetch authoritative Advanced Blend allowance from server on mount and
  // on focus so the pre-analysis modal shows the correct remaining count
  // instead of defaulting to FREE_ADVANCED_BLEND_ALLOWANCE (3).
  // When QA Pro Simulation is active, the client shows Unlimited.
  const refreshBlendAllowance = useCallback(async () => {
    if (effectiveIsPro) {
      // Effective Pro (real or QA simulation) — unlimited Expanded Ingredient
      setBlendUsedCount(0)
      setBlendAllowanceVerified(true)
      return
    }
    const snapshot = await fetchEffectiveBlendAllowance(effectiveIsPro)
    if (snapshot) {
      // Compute effective used from effective remaining so the
      // install guard is reflected in the displayed count.
      const effectiveRemaining = typeof snapshot.remaining === 'number'
        ? snapshot.remaining
        : FREE_ADVANCED_BLEND_ALLOWANCE
      const effectiveUsed = Math.max(0, FREE_ADVANCED_BLEND_ALLOWANCE - effectiveRemaining)
      setBlendUsedCount(effectiveUsed)
      setBlendAllowanceVerified(true)
    } else {
      setBlendAllowanceVerified(false)
    }
  }, [effectiveIsPro])

  useEffect(() => {
    refreshBlendAllowance()
    const unsubscribe = navigation?.addListener?.('focus', refreshBlendAllowance)
    return () => { if (typeof unsubscribe === 'function') unsubscribe() }
  }, [navigation, refreshBlendAllowance])

  // Invalidate cached analysis when the batch materially changes.
  // Skips the update triggered by executeLogToChallenge's setBatch (analysis result).
  useEffect(() => {
    if (analysisBatchUpdateRef.current) {
      analysisBatchUpdateRef.current = false
      return
    }
    if (analysisCompletedRef.current) {
      analysisCompletedRef.current = false
      analysisResultRef.current = null
      blendApprovedRef.current = false
      blendOperationIdRef.current = null
    }
  }, [batch])

  const hasItems = (batch.scannedIngredients || []).length > 0

  const hasInvalidIngredients = useMemo(() => {
    const ingredients = batch.scannedIngredients || []
    if (ingredients.length === 0) return false
    return !validateBatchForLog(ingredients).valid
  }, [batch.scannedIngredients])

  const isSnapDepleted = isQaProSimulation
    ? qaSnapUsed >= effectiveSnapLimit
    : selectQuotaExhausted(serverQuota)

  // Temporary diagnostic for QA7 Snap gate verification
  if (process.env.EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS === '1') {
    console.log(`[SNAP_QA] isQaProSimulation=${isQaProSimulation} qaSnapUsed=${qaSnapUsed} effectiveSnapLimit=${effectiveSnapLimit} isSnapDepleted=${isSnapDepleted} serverQuotaRemaining=${serverQuota?.remaining ?? 'null'}`)
  }

  // Open manual entry when navigated with manualEntry: true
  useEffect(() => {
    if (route?.params?.manualEntry === true) {
      setIsManualMode(true)
    }
  }, [route?.params?.manualEntry])

  // Reseed batch when navigated with new preloadIngredients (e.g. recipe hand-off)
  // Immediately replaces the current draft with the selected historical juice.
  // Reset cameraUsedRef so a preloaded recipe doesn't inherit a prior camera session.
  useEffect(() => {
    const preload = route?.params?.preloadIngredients
    if (!preload || preload.length === 0) return
    const seeded = seedPreloadIngredients(preload, organicMode)
    setBatch(buildBatch(seeded, juiceMethod))
    setIsLogged(false)
    cameraUsedRef.current = false
  }, [route?.params?.preloadIngredients]) // eslint-disable-line react-hooks/exhaustive-deps

  // Unified camera open attempt via eligibility coordinator.
  // Uses the server-authoritative QuotaStore snapshot for the snap
  // eligibility precheck. A stale client cache cannot grant or block
  // access — the server makes the final decision in analyze-scan.
  const cameraInFlightRef = useRef(false)
  const cameraAttemptIdRef = useRef(0)
  const cameraAbortRef = useRef(null)
  const CAMERA_TIMEOUT_MS = 12000

  const attemptCameraOpen = useCallback(async (isAutoOpen = false) => {
    // Guard against double-tap while an eligibility check is in flight
    if (cameraInFlightRef.current) return
    cameraInFlightRef.current = true
    cameraAttemptIdRef.current += 1
    const attemptId = cameraAttemptIdRef.current

    // Abort any previous attempt's pending network work
    if (cameraAbortRef.current) {
      cameraAbortRef.current.abort()
    }
    // eslint-disable-next-line no-undef
    const abortController = new AbortController()
    cameraAbortRef.current = abortController

    // Overall timeout — fires after CAMERA_TIMEOUT_MS and aborts the
    // attempt.  Checked via abortController.signal.aborted in the
    // catch block; the per-stage Promise.race timeouts handle
    // individual async hangs.
    let overallTimer = setTimeout(() => {
      abortController.abort()
    }, CAMERA_TIMEOUT_MS)

    setIsPreparingCamera(true)

    const isStale = () => attemptId !== cameraAttemptIdRef.current

    try {
      let currentQuota = serverQuota

      // ── Quota verification gate ──────────────────────────────
      // When verificationState is UNKNOWN (initial load, fetch
      // failed, or identity changed), block quota-consuming
      // camera operations. The server remains the final authority.
      if (verificationState === 'unknown' && SUPABASE_CONFIGURED) {
        // Attempt one refresh before blocking
        currentQuota = await Promise.race([
          refreshQuota(),
          new Promise(resolve => setTimeout(() => resolve(null), CAMERA_TIMEOUT_MS)),
        ])
        if (isStale()) return
        // If still unknown after refresh, block
        if (verificationState === 'unknown' && currentQuota === null) {
          setIsPreparingCamera(false)
          Alert.alert(
            'Unable to Check Access',
            'We could not verify your scan access. Please check your connection and try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Try Again', onPress: () => attemptCameraOpen(isAutoOpen) },
            ],
          )
          return
        }
      }

      // If quota hasn't loaded yet and Supabase is configured, refresh once
      // and use the returned snapshot directly — no setTimeout, no ref sync.
      // Wrap in a timeout to prevent indefinite hang on unreachable servers.
      if (currentQuota === null && SUPABASE_CONFIGURED) {
        currentQuota = await Promise.race([
          refreshQuota(),
          new Promise(resolve => setTimeout(() => resolve(null), CAMERA_TIMEOUT_MS)),
        ])

        // Ignore late results if a newer attempt started or component unmounted
        if (isStale()) return
      }

      // If quota is still null after refresh (or Supabase not configured),
      // we cannot confirm or deny eligibility.  When Supabase is configured
      // and the refresh failed, show a network/retry alert.  When Supabase
      // is not configured (dev/offline mode), proceed with offline-dev path.
      if (currentQuota === null && SUPABASE_CONFIGURED) {
        setIsPreparingCamera(false)
        Alert.alert(
          'Unable to Check Access',
          'We could not verify your scan access. Please check your connection and try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: () => attemptCameraOpen(isAutoOpen) },
          ],
        )
        return
      }

      // Offline-development path: when Supabase is not configured, allow
      // camera access through an explicit offline-dev eligibility result.
      // Do not fabricate a synthetic quota count.
      if (currentQuota === null && !SUPABASE_CONFIGURED) {
        let offlineTimer = null
        const offlineTimeout = new Promise((resolve) => {
          offlineTimer = setTimeout(() => resolve({ action: 'error', reason: 'timeout', isDurable: false, isPro: false, snapRemaining: 0, guestJourneyStatus: null }), 10000)
        })
        const offlineResult = await Promise.race([
          checkCameraEligibility({
            eligible: true,
            remaining: 0,
            reason: null,
            isPro: false,
          }),
          offlineTimeout,
        ])
        if (offlineTimer) clearTimeout(offlineTimer)

        // Ignore late results if a newer attempt started or component unmounted
        if (isStale()) return

        if (offlineResult.action === 'open_camera') {
          setIsCameraOpen(true)
          if (!isAutoOpen) setIsLogged(false)
        }
        setIsPreparingCamera(false)
        return
      }

      // Use the confirmed quota values for snap eligibility.
      // The effective Pro status (from useEffectivePlanAccess) is used
      // for the UI gate so QA Pro Simulation can open the camera.
      // The server still enforces the real quota when the scan is
      // actually submitted.
      const serverRemaining = selectFilmRollRemaining(currentQuota)
      const serverIsPro = selectFilmRollIsPro(currentQuota)

      // When QA Pro Simulation is active, use the QA-only snap counter
      // with the Pro monthly limit (12). Otherwise use real server quota.
      let snapRemaining
      let snapIsPro
      if (isQaProSimulation) {
        const qaRemaining = await getQaProSnapRemaining(effectiveSnapLimit)
        snapRemaining = qaRemaining
        snapIsPro = true
      } else {
        snapRemaining = serverRemaining
        snapIsPro = effectiveIsPro || serverIsPro
      }

      const snapElig = {
        eligible: snapIsPro || snapRemaining > 0,
        remaining: snapRemaining,
        reason: snapIsPro || snapRemaining > 0 ? null : 'Scan limit reached for this period',
        isPro: snapIsPro,
      }
      let eligibilityTimer = null
      const eligibilityTimeout = new Promise((resolve) => {
        eligibilityTimer = setTimeout(() => resolve({ action: 'error', reason: 'timeout', isDurable: false, isPro: false, snapRemaining: 0, guestJourneyStatus: null }), 10000)
      })
      const result = await Promise.race([
        checkCameraEligibility(snapElig),
        eligibilityTimeout,
      ])
      if (eligibilityTimer) clearTimeout(eligibilityTimer)

      // Ignore late results if a newer attempt started or component unmounted
      if (isStale()) return

      if (result.action === 'open_camera') {
        setIsCameraOpen(true)
        if (!isAutoOpen) setIsLogged(false)
        setIsPreparingCamera(false)
        if (!result.isDurable) {
          setGuestFirstScan(true)
        }
        return
      }

      if (result.action === 'show_snap_gate') {
        setShowSnapGate(true)
        setIsPreparingCamera(false)
        return
      }

      if (result.action === 'show_account_gate') {
        setAccountGateMode('guest')
        setShowAccountGate(true)
        pendingCameraOpenRef.current = true
        setIsPreparingCamera(false)
        return
      }

      if (result.action === 'show_auth_resume') {
        setAccountGateMode('signin')
        setShowAccountGate(true)
        pendingCameraOpenRef.current = true
        setIsPreparingCamera(false)
        return
      }

      // result.action === 'error' — network or server error from coordinator
      setIsPreparingCamera(false)
      Alert.alert(
        'Unable to Check Access',
        'We could not verify your scan access. Please check your connection and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => attemptCameraOpen(isAutoOpen) },
        ],
      )
    } catch (e) {
      // Network, Supabase, or unexpected error — do NOT show the snap gate
      // (that would misrepresent a network failure as quota exhaustion).
      if (abortController.signal.aborted) {
        console.warn('[Camera] attemptCameraOpen aborted:', e?.message || e)
      } else {
        console.warn('[Camera] attemptCameraOpen error:', e?.message || e)
      }
      setIsPreparingCamera(false)
      if (!abortController.signal.aborted) {
        Alert.alert(
          'Unable to Check Access',
          'We could not verify your scan access. Please check your connection and try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: () => attemptCameraOpen(isAutoOpen) },
          ],
        )
      }
    } finally {
      if (overallTimer) clearTimeout(overallTimer)
      if (cameraAbortRef.current === abortController) {
        cameraAbortRef.current = null
      }
      cameraInFlightRef.current = false
      setIsPreparingCamera(false)
    }
  }, [serverQuota, refreshQuota])

  // Auto-open camera when navigated with openCamera: true
  useEffect(() => {
    if (shouldAutoOpenCamera && !isCameraOpen) {
      attemptCameraOpen(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel any in-flight camera eligibility attempt on unmount
  useEffect(() => {
    return () => {
      cameraAttemptIdRef.current += 1
      if (cameraAbortRef.current) {
        cameraAbortRef.current.abort()
        cameraAbortRef.current = null
      }
      cameraInFlightRef.current = false
    }
  }, [])

  // Auto-expand manual mode when snaps are depleted
  const effectiveManualMode = isManualMode || isSnapDepleted

  const handleSnap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    attemptCameraOpen(false)
  }, [attemptCameraOpen, isSnapDepleted])

  // Manual entry: add from NutrientLibrary (no credit consumed)
  const handleManualAdd = useCallback((item) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(
      300,
      LayoutAnimation.Types.spring,
      LayoutAnimation.Properties.opacity
    ))
    const weightG = item.weightG || 150
    const newIngredient = {
      produceId: item.id,
      weightG,
      isOrganic: getDefaultOrganic(organicMode),
      portionEntryMode: globalPortionMode,
    }
    if (globalPortionMode === 'quantity' && isProduceQuantitySupported(item.id)) {
      const defaultUnit = getDefaultCountUnit(item.id)
      if (defaultUnit) {
        const defaultSizeKey = getDefaultSizeForUnit(defaultUnit)
        // Initialize with quantity: 1 so the default passes validation
        const initialResult = recomputeFromQuantityChange({
          produceId: item.id,
          quantity: 1,
          unitKey: defaultUnit.unitKey,
          sizeKey: defaultSizeKey || undefined,
        })
        if (initialResult) {
          newIngredient.portionMetadata = initialResult.metadata
          newIngredient.weightG = initialResult.weightG
        } else {
          newIngredient.portionMetadata = undefined
        }
        newIngredient.pendingUnitKey = defaultUnit.unitKey
        newIngredient.pendingSizeKey = defaultSizeKey
      }
    }
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients, newIngredient]
      if (!primaryProduceId) {
        setPrimaryProduceId(item.id)
      }
      // Show upsell nudge at 7+ manual ingredients
      if (updated.length >= 7 && !effectiveIsPro) {
        setShowUpsellNudge(true)
      }
      // Fifth-ingredient notice for Advanced Blend
      const distinctCount = countDistinctProduceIds(updated)
      if (distinctCount === 5 && !blendNoticeShown && !effectiveIsPro) {
        setAdvancedBlendStage('fifth_ingredient_notice')
        setAdvancedBlendRemaining(getAdvancedBlendRemaining(blendUsedCount, effectiveIsPro) ?? FREE_ADVANCED_BLEND_ALLOWANCE)
        setShowAdvancedBlendModal(true)
        setBlendNoticeShown(true)
        trackEvent('advanced_blend_threshold_reached', {
          plan: 'free',
          ingredient_count: distinctCount,
          source: 'manual_entry',
        })
      }
      // Reset notice when back to Simple
      if (distinctCount <= 4) {
        setBlendNoticeShown(false)
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [effectiveIsPro, blendNoticeShown, globalPortionMode, organicMode, primaryProduceId])

  const handleCameraClose = useCallback(() => {
    setIsCameraOpen(false)
    setGuestFirstScan(false)
    // Stay on JuiceSnap showing manual entry fallback — do NOT goBack()
    // User can type ingredients manually or navigate away via tabs/back
  }, [])

  const handleProduceIdentified = useCallback(async (visionResult) => {
    console.log('[SCAN] handleProduceIdentified —', visionResult.scannedIngredients.length, 'items')
    cameraUsedRef.current = true
    const enriched = visionResult.scannedIngredients.map((ing) => {
      if (isProduceQuantitySupported(ing.produceId)) {
        const defaultUnit = getDefaultCountUnit(ing.produceId)
        if (defaultUnit) {
          const defaultSizeKey = getDefaultSizeForUnit(defaultUnit)
          const initialResult = recomputeFromQuantityChange({
            produceId: ing.produceId,
            quantity: 1,
            unitKey: defaultUnit.unitKey,
            sizeKey: defaultSizeKey || undefined,
          })
          if (initialResult) {
            return {
              ...ing,
              weightG: initialResult.weightG,
              portionMetadata: initialResult.metadata,
              portionEntryMode: 'quantity',
              pendingUnitKey: defaultUnit.unitKey,
              pendingSizeKey: defaultSizeKey,
            }
          }
        }
      }
      return ing
    })
    setBatch(buildBatch(enriched, juiceMethod))
    if (!primaryProduceId && enriched.length > 0 && enriched[0].produceId) {
      setPrimaryProduceId(enriched[0].produceId)
    }
    setIsCameraOpen(false)
    setIsLogged(false)
    setGuestFirstScan(false)

    // The server has already committed the scan quota via the analyze-scan
    // Edge Function (reserve → vision → commit). The server-returned
    // quota snapshot is applied to QuotaStore for the authoritative
    // display. No client-side optimistic counter is needed — both the
    // film-roll counter and QuotaMeter derive from QuotaStore.
    //
    // Additionally, mark the install-level Free Snap guard as consumed.
    // This persistent marker survives logout and new anonymous identity
    // creation, preventing the loophole where a new anonymous UUID
    // receives a fresh 0/1 allowance on the same installation. The
    // marker is only consumed for Free users — Pro bypasses it.
    if (visionResult.quota) {
      applyQuotaSnapshot(visionResult.quota)
      if (visionResult.quota.plan === 'free') {
        markInstallSnapConsumed()
      }
    } else {
      refreshQuota()
    }

    // When QA Pro Simulation is active, increment the QA-only snap counter
    if (isQaProSimulation) {
      await incrementQaProSnapUsage()
      setQaSnapUsed((prev) => prev + 1)
      refreshQuota()
    }

    // Check for Advanced Blend threshold from photo scan
    const distinctCount = countDistinctProduceIds(enriched)
    if (distinctCount >= 5 && !effectiveIsPro) {
      setAdvancedBlendStage('fifth_ingredient_notice')
      setAdvancedBlendRemaining(getAdvancedBlendRemaining(blendUsedCount, effectiveIsPro) ?? FREE_ADVANCED_BLEND_ALLOWANCE)
      setShowAdvancedBlendModal(true)
      setBlendNoticeShown(true)
      trackEvent('advanced_blend_threshold_reached', {
        plan: 'free',
        ingredient_count: distinctCount,
        source: 'photo',
      })
    }
  }, [juiceMethod, effectiveIsPro, primaryProduceId, applyQuotaSnapshot, refreshQuota])

  const handleUpdateItem = useCallback((index, newProduceId, newWeightG) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      const oldItem = updated[index]
      updated[index] = { ...updated[index], produceId: newProduceId, weightG: newWeightG }
      if (oldItem && oldItem.produceId === primaryProduceId && newProduceId !== primaryProduceId) {
        setPrimaryProduceId(newProduceId)
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod, primaryProduceId])

  const handleReplace = useCallback((index, newProduceId) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      const replacedItem = updated[index]
      updated[index] = {
        ...updated[index],
        produceId: newProduceId,
        portionMetadata: undefined,
        portionEntryMode: 'weight',
        pendingUnitKey: undefined,
        pendingSizeKey: undefined,
      }
      if (replacedItem && replacedItem.produceId === primaryProduceId) {
        setPrimaryProduceId(newProduceId)
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod, primaryProduceId])

  const handleRemove = useCallback((index) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(
      300,
      LayoutAnimation.Types.spring,
      LayoutAnimation.Properties.opacity
    ))
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      const removedItem = updated[index]
      updated.splice(index, 1)
      if (updated.length === 0) {
        setPrimaryProduceId(null)
        return { ...EMPTY_BATCH, scannedIngredients: [] }
      }
      if (removedItem && removedItem.produceId === primaryProduceId) {
        setPrimaryProduceId(updated[0].produceId)
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod, primaryProduceId])

  const handleSetPrimary = useCallback((index) => {
    setBatch((prev) => {
      const item = prev.scannedIngredients[index]
      if (item) {
        setPrimaryProduceId(item.produceId)
      }
      return prev
    })
  }, [])

  const handleWeightChange = useCallback((index, newWeight) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      // Clear entered weight representation when user manually adjusts —
      // the display reverts to the current global weight format preference.
      updated[index] = {
        ...updated[index],
        weightG: newWeight,
        enteredWeightValue: undefined,
        enteredWeightUnit: undefined,
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod])

  const handleToggleOrganic = useCallback((index) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      updated[index] = { ...updated[index], isOrganic: !(updated[index].isOrganic ?? false) }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod])

  // ── Portion entry handlers ──────────────────────────────────

  const handleModeChange = useCallback((index, newMode) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      const item = updated[index]
      if (newMode === 'quantity') {
        // Switching to Quantity: restore prior metadata if available
        if (item.portionMetadata?.inputMode === 'quantity') {
          const restored = restoreQuantityMetadata(item.portionMetadata)
          updated[index] = {
            ...item,
            portionEntryMode: 'quantity',
            weightG: restored.weightG,
            portionMetadata: restored.metadata,
          }
        } else {
          // No prior metadata — initialize with quantity: 1
          // Use getDefaultCountUnit (not getDefaultPortionUnit) because
          // the QuantityPortionEditor only displays count units. Using
          // a volume-family default (e.g. kale's loose_cup) causes the
          // editor to fall back to units[0] while the parent state
          // retains the volume unit, breaking size selection.
          const defaultUnit = getDefaultCountUnit(item.produceId)
          if (defaultUnit) {
            const defaultSizeKey = getDefaultSizeForUnit(defaultUnit)
            const initialResult = recomputeFromQuantityChange({
              produceId: item.produceId,
              quantity: 1,
              unitKey: defaultUnit.unitKey,
              sizeKey: defaultSizeKey || undefined,
            })
            if (initialResult) {
              updated[index] = {
                ...item,
                portionEntryMode: 'quantity',
                weightG: initialResult.weightG,
                portionMetadata: initialResult.metadata,
                pendingUnitKey: defaultUnit.unitKey,
                pendingSizeKey: defaultSizeKey,
              }
            } else {
              updated[index] = {
                ...item,
                portionEntryMode: 'quantity',
              }
            }
          } else {
            updated[index] = {
              ...item,
              portionEntryMode: 'quantity',
            }
          }
        }
      } else {
        // Switching to Weight: preserve current weightG, keep metadata for later restore
        updated[index] = {
          ...item,
          portionEntryMode: 'weight',
        }
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod])

  const handleQuantityChange = useCallback((index, qty) => {
    // Store the draft quantity in batch state even when invalid (0, null, NaN).
    // This makes the editor draft authoritative for canonical validation.
    // The validator checks enteredQuantity and flags invalid values,
    // disabling Log to Today. The last valid weightG is preserved
    // separately for display when recomputation fails.
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      const item = updated[index]
      const unitKey = item.portionMetadata?.unitKey || item.pendingUnitKey || getDefaultCountUnit(item.produceId)?.unitKey
      const sizeKey = item.portionMetadata?.sizeKey || item.pendingSizeKey || null
      const input = { produceId: item.produceId, quantity: qty || 0, unitKey, sizeKey: sizeKey || undefined }
      const result = recomputeFromQuantityChange(input)
      if (result) {
        // Recomputation succeeded — update weight and metadata
        updated[index] = {
          ...item,
          weightG: result.weightG,
          portionMetadata: result.metadata,
          portionEntryMode: 'quantity',
        }
      } else {
        // Recomputation failed (qty=0, null, NaN) — still store the draft
        // enteredQuantity so the canonical validator sees the current value.
        // Keep the last valid weightG for display purposes.
        updated[index] = {
          ...item,
          portionEntryMode: 'quantity',
          portionMetadata: {
            ...(item.portionMetadata || {}),
            inputMode: 'quantity',
            enteredQuantity: qty,
            unitKey,
            sizeKey,
            estimatedRawWeightG: item.portionMetadata?.estimatedRawWeightG ?? 0,
            sourceVersion: item.portionMetadata?.sourceVersion || 'draft',
            wasEstimateOverridden: item.portionMetadata?.wasEstimateOverridden || false,
            originalEstimatedRawWeightG: item.portionMetadata?.originalEstimatedRawWeightG ?? 0,
          },
        }
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod])

  const handleUnitChange = useCallback((index, newUnitKey) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      const item = updated[index]
      const qty = item.portionMetadata?.enteredQuantity
      // Use getSupportedCountUnits because the QuantityPortionEditor
      // only displays count units. getSupportedPortionUnits includes
      // volume-family units that are not selectable in the editor.
      const units = getSupportedCountUnits(item.produceId)
      const newUnit = units.find((u) => u.unitKey === newUnitKey)
      const defaultSizeKey = newUnit ? getDefaultSizeForUnit(newUnit) : null
      if (!qty) {
        // Update pending unit AND initialize pending size if the new unit requires it
        updated[index] = {
          ...item,
          pendingUnitKey: newUnitKey,
          pendingSizeKey: defaultSizeKey,
        }
        return { ...prev, scannedIngredients: updated }
      }
      // Recompute with new unit
      const input = { produceId: item.produceId, quantity: qty, unitKey: newUnitKey, sizeKey: defaultSizeKey || undefined }
      const result = recomputeFromQuantityChange(input)
      if (!result) return prev
      updated[index] = {
        ...item,
        weightG: result.weightG,
        portionMetadata: result.metadata,
        portionEntryMode: 'quantity',
        pendingUnitKey: newUnitKey,
        pendingSizeKey: defaultSizeKey,
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod])

  const handleSizeChange = useCallback((index, newSizeKey) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      const item = updated[index]
      const qty = item.portionMetadata?.enteredQuantity
      if (!qty) {
        updated[index] = { ...item, pendingSizeKey: newSizeKey }
        return { ...prev, scannedIngredients: updated }
      }
      const unitKey = item.portionMetadata?.unitKey || item.pendingUnitKey
      const input = { produceId: item.produceId, quantity: qty, unitKey, sizeKey: newSizeKey || undefined }
      const result = recomputeFromQuantityChange(input)
      if (!result) return prev
      updated[index] = {
        ...item,
        weightG: result.weightG,
        portionMetadata: result.metadata,
        portionEntryMode: 'quantity',
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod])

  const handleEstimatedWeightChange = useCallback((index, estimatedWeightG) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      const item = updated[index]
      // Only update if not overridden
      if (item.portionMetadata?.wasEstimateOverridden) return prev
      updated[index] = {
        ...item,
        weightG: estimatedWeightG,
        portionMetadata: item.portionMetadata
          ? { ...item.portionMetadata, estimatedRawWeightG: estimatedWeightG }
          : undefined,
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod])

  const handleAddProduce = useCallback((produceId) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(
      300,
      LayoutAnimation.Types.spring,
      LayoutAnimation.Properties.opacity
    ))
    setBatch((prev) => {
      const newIngredient = {
        produceId,
        weightG: 150,
        isOrganic: getDefaultOrganic(organicMode),
        portionEntryMode: globalPortionMode,
      }
      if (globalPortionMode === 'quantity' && isProduceQuantitySupported(produceId)) {
        const defaultUnit = getDefaultCountUnit(produceId)
        if (defaultUnit) {
          const defaultSizeKey = getDefaultSizeForUnit(defaultUnit)
          newIngredient.pendingUnitKey = defaultUnit.unitKey
          newIngredient.pendingSizeKey = defaultSizeKey

          const initialResult = recomputeFromQuantityChange({
            produceId,
            quantity: 1,
            unitKey: defaultUnit.unitKey,
            sizeKey: defaultSizeKey || undefined,
          })
          if (initialResult) {
            newIngredient.weightG = initialResult.weightG
            newIngredient.portionMetadata = initialResult.metadata
          }
        }
      }
      const updated = [...prev.scannedIngredients, newIngredient]
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod, globalPortionMode, organicMode])

  const handleLogToChallenge = useCallback(async () => {
    if (!hasItems) return
    if (isLoggingRef.current) return
    // Canonical guard — same validator as red-X and Log button
    if (!validateBatchForLog(batch?.scannedIngredients || []).valid) return

    try {
      const ingredients = batch?.scannedIngredients || []
      const distinctCount = countDistinctProduceIds(ingredients)
      const blendType = classifyBlend(distinctCount)

      // Advanced Blend: check allowance for free users
      if (blendType === 'advanced' && !effectiveIsPro && !blendApprovedRef.current) {
        // Create a new operation ID for this analysis attempt
        blendOperationIdRef.current = createOperationId()

        // If Supabase is configured but we could not verify the allowance,
        // show the network retry stage instead of a stale count.
        if (SUPABASE_CONFIGURED && !blendAllowanceVerified) {
          setAdvancedBlendStage('network_retry')
          setShowAdvancedBlendModal(true)
          trackEvent('advanced_blend_allowance_error', {
            plan: 'free',
            error_code: 'allowance_unverified',
            ingredient_count: distinctCount,
            source: effectiveManualMode ? 'manual' : 'photo',
          })
          return
        }

        const currentRemaining = getAdvancedBlendRemaining(blendUsedCount, effectiveIsPro) ?? FREE_ADVANCED_BLEND_ALLOWANCE

        // If server reports zero remaining, show exhausted messaging
        // instead of a confirmation that would immediately fail.
        if (blendAllowanceVerified && currentRemaining <= 0) {
          setAdvancedBlendStage('allowance_exhausted')
          setAdvancedBlendRemaining(0)
          setShowAdvancedBlendModal(true)
          trackEvent('advanced_blend_quota_exhausted', {
            plan: 'free',
            ingredient_count: distinctCount,
            used: blendUsedCount,
            limit: FREE_ADVANCED_BLEND_ALLOWANCE,
            source: effectiveManualMode ? 'manual' : 'photo',
          })
          return
        }

        // Show pre-analysis confirmation first
        setAdvancedBlendStage('pre_analysis_confirmation')
        setAdvancedBlendRemaining(currentRemaining)
        setShowAdvancedBlendModal(true)
        trackEvent('advanced_blend_confirmation_shown', {
          plan: 'free',
          remaining: currentRemaining,
          ingredient_count: distinctCount,
          source: effectiveManualMode ? 'manual' : 'photo',
        })
        return
      }

      // Pro users: create operation ID and proceed directly
      if (blendType === 'advanced' && effectiveIsPro) {
        blendOperationIdRef.current = createOperationId()
      }

      await executeLogToChallenge()
    } catch (err) {
      if (__DEV__) console.warn('[log] handleLogToChallenge failed:', err?.message)
      Alert.alert('Logging Error', 'Could not log your juice. Please try again.')
    }
  }, [hasItems, hasInvalidIngredients, batch, effectiveIsPro, effectiveManualMode, executeLogToChallenge, blendAllowanceVerified, blendUsedCount, refreshBlendAllowance])

  const executeLogToChallenge = useCallback(async () => {
    if (!hasItems) return
    if (isLoggingRef.current) return
    // Canonical submission guard — uses the same validator as the
    // red-X display and the Log button disabled state.
    const batchValidation = validateBatchForLog(batch?.scannedIngredients || [])
    if (!batchValidation.valid) return
    isLoggingRef.current = true
    setIsLogging(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    const ingredients = batch?.scannedIngredients || []
    const distinctCount = countDistinctProduceIds(ingredients)
    const blendType = classifyBlend(distinctCount)
    const logSource = resolveLogSource(source, cameraUsedRef.current, effectiveManualMode)

    let totals = batch?.totals || {}
    let juiceYieldG = batch?.totalJuiceWeightG
    let allowanceResult = null
    let loggingSucceeded = false

    try {
      // ── Guest log gate: pre-check BEFORE consuming blend allowance ──
      // Use non-finalizing check so blend failures don't waste the guest journey.
      const canLog = await isGuestLogAllowed()
      if (!canLog) {
        setShowAccountGate(true)
        return
      }

      // Advanced Blend: go through server-authoritative transaction
      // Skip if analysis already completed (partial-success retry)
      if (blendType === 'advanced' && !analysisCompletedRef.current) {
        setBlendCheckInProgress(true)
        try {
          trackEvent('advanced_blend_analysis_started', {
            plan: effectiveIsPro ? 'pro' : 'free',
            ingredient_count: distinctCount,
            source: logSource,
          })

          const authorized = await authorizeAndProcessBatch(ingredients, batch.juiceMethod || 'cold_pressed', blendOperationIdRef.current || undefined, effectiveIsPro)
          totals = authorized.totals || totals
          if (typeof authorized.totalJuiceWeightG === 'number') {
            juiceYieldG = authorized.totalJuiceWeightG
          }
          allowanceResult = authorized.allowance

          // Preserve successful analysis result for retry
          analysisCompletedRef.current = true
          analysisResultRef.current = { totals, ingredients: authorized.ingredients }

          // Update batch with real nutrition totals
          // Guard against the batch-invalidation effect firing
          analysisBatchUpdateRef.current = true
          setBatch((prev) => ({
            ...prev,
            totals,
            items: authorized.ingredients || prev.items,
          }))

          if (allowanceResult && allowanceResult.plan === 'free') {
            const remaining = allowanceResult.remaining ?? 0
            setBlendUsedCount(allowanceResult.used ?? 0)
            trackEvent('advanced_blend_analysis_completed', {
              plan: 'free',
              ingredient_count: distinctCount,
              remaining,
              used: allowanceResult.used,
              limit: allowanceResult.limit,
              source: logSource,
            })

            // Show completion confirmation — pause here so the user
            // can read the result before we navigate away.
            // The log + navigation will resume when the user dismisses
            // the completion modal (see onDismiss handler).
            setAdvancedBlendStage('completion_confirmation')
            setAdvancedBlendRemaining(remaining)
            setShowAdvancedBlendModal(true)
            return
          }
        } catch (err) {
          if (err instanceof BlendAllowanceError && (err.code === 'advanced_blend_limit_reached' || err.code === 'install_exhausted' || err.code === 'allowance_unknown')) {
            setAdvancedBlendStage('allowance_exhausted')
            setAdvancedBlendRemaining(0)
            if (err.result) {
              setBlendUsedCount(err.result.used ?? FREE_ADVANCED_BLEND_ALLOWANCE)
            }
            setShowAdvancedBlendModal(true)
            trackEvent('advanced_blend_quota_exhausted', {
              plan: 'free',
              ingredient_count: distinctCount,
              used: err.result?.used ?? 0,
              limit: err.result?.limit ?? FREE_ADVANCED_BLEND_ALLOWANCE,
              source: logSource,
              error_code: err.code,
            })
            return
          }

          // Network or server error — fail closed
          if (__DEV__) console.warn('[blend] allowance check failed:', err?.message)
          setAdvancedBlendStage('network_retry')
          setShowAdvancedBlendModal(true)
          trackEvent('advanced_blend_allowance_error', {
            plan: effectiveIsPro ? 'pro' : 'free',
            error_code: err instanceof BlendAllowanceError ? err.code : 'unknown',
            ingredient_count: distinctCount,
            source: logSource,
          })
          trackEvent('advanced_blend_analysis_released', {
            plan: effectiveIsPro ? 'pro' : 'free',
            ingredient_count: distinctCount,
            error_code: err instanceof BlendAllowanceError ? err.code : 'unknown',
            source: logSource,
          })
          return
        } finally {
          setBlendCheckInProgress(false)
        }
      } else if (analysisCompletedRef.current && analysisResultRef.current) {
        // Reuse successful analysis result from prior attempt
        totals = analysisResultRef.current.totals || totals
        if (__DEV__) console.log('[blend] reusing cached analysis result for retry')
      }

      // ── Guest log gate: finalize AFTER blend succeeds ──────────
      const logGate = await authorizeGuestLog()
      if (!logGate.allowed) {
        setShowAccountGate(true)
        if (logGate.reason === 'error') {
          Alert.alert(
            'Connection Error',
            logGate.message ||
              'Could not verify your account. Please check your connection and try again.',
          )
        }
        return
      }

      logJuice(ingredients, { ...batch, totals })

      // Snap was already consumed at analysis success (handleProduceIdentified).
      // Do not consume again at log finalization.

      // Record to Nutrition Score system
      const ingredientIds = ingredients
        .map((i) => i?.produceId)
        .filter((id) => typeof id === 'string' && id.length > 0)
      const prevMomentum = typeof preMomentum === 'number' ? preMomentum : 0
      recordNutritionLog(ingredientIds, totals)

      // Create a JuiceLogEntry for the Today log
      // Include ingredientDetails (portion data) for Pro Detailed History
      // Capture the original weight display unit/value so Make Again can
      // reproduce the user's chosen representation (g vs oz) instead of
      // converting to the current global preference.
      const G_PER_OZ = 28.3495
      const ingredientDetails = ingredients
        .filter((i) => i && typeof i.produceId === 'string')
        .map((i) => {
          const wG = typeof i.weightG === 'number' ? i.weightG : 150
          const detail = {
            produceId: i.produceId,
            weightG: wG,
            portionEntryMode: i.portionEntryMode || 'weight',
            portionMetadata: i.portionMetadata || undefined,
            // Persist per-ingredient organic status for History display
            // and Make Again fidelity. Use undefined (not false) when
            // isOrganic was never set, so legacy entries are not
            // fabricated as conventional.
            isOrganic: typeof i.isOrganic === 'boolean' ? i.isOrganic : undefined,
          }
          // Only capture entered weight for weight-mode ingredients
          // (quantity mode preserves its own representation via portionMetadata)
          if (detail.portionEntryMode === 'weight') {
            if (weightDisplayMode === 'grams') {
              detail.enteredWeightValue = Math.round(wG)
              detail.enteredWeightUnit = 'g'
            } else if (weightDisplayMode === 'oz') {
              detail.enteredWeightValue = parseFloat((wG / G_PER_OZ).toFixed(1))
              detail.enteredWeightUnit = 'oz'
            } else {
              // 'both' mode — preserve grams as the primary representation
              detail.enteredWeightValue = Math.round(wG)
              detail.enteredWeightUnit = 'g'
            }
          }
          return detail
        })
      const logEntry = addLogEntry({
        source: logSource,
        ingredientIds: ingredientIds,
        nutrientSummary: totals,
        ingredientDetails,
        totalJuiceWeightG: juiceYieldG,
      })
      recordMeaningfulActivity().catch(() => {})

      // Developer-tools-only diagnostic: log nutrient keys and values
      // for the newly created entry. Helps QA trace micronutrient
      // persistence without exposing personal information.
      if (process.env.EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS === '1') {
        const supportedKeys = ['calories', 'sugar', 'fiber', 'vitaminC', 'vitaminA', 'potassium', 'iron', 'magnesium', 'folate']
        const keysPresent = Object.keys(totals).filter((k) => supportedKeys.includes(k))
        const values = {}
        supportedKeys.forEach((k) => { values[k] = Number(totals[k]) || 0 })
        // eslint-disable-next-line no-console
        console.log(`[HISTORY_NUTRIENT_QA] logEntryId=${logEntry?.id || 'null'} keys=[${keysPresent.join(',')}] values=${JSON.stringify(values)} totalJuiceWeightG=${juiceYieldG ?? 'null'}`)
      }

      // Navigate to ScanSuccess with session metrics and entry ID
      const nutrientKeys = Object.keys(totals).filter(
        (k) => (Number(totals[k]) || 0) > 0
      )
      navigation.navigate('ScanSuccess', {
        ingredientCount: ingredientIds.length,
        nutrientsFound: nutrientKeys.length,
        previousMomentum: prevMomentum,
        ingredientNames: ingredientIds,
        logEntryId: logEntry?.id || null,
      })

      setIsLogged(true)
      loggingSucceeded = true
    } catch (err) {
      if (__DEV__) console.warn('[log] executeLogToChallenge failed:', err?.message)
      setIsLogged(false)
      Alert.alert('Logging Error', 'Could not log your juice. Please try again.')
    } finally {
      isLoggingRef.current = false
      setIsLogging(false)
      if (loggingSucceeded) {
        // Full success — clear all transient state for next batch
        blendApprovedRef.current = false
        blendOperationIdRef.current = null
        analysisCompletedRef.current = false
        analysisResultRef.current = null
      } else if (!analysisCompletedRef.current) {
        // Analysis did not succeed — reset approval to allow re-authorization
        blendApprovedRef.current = false
        blendOperationIdRef.current = null
      }
      // If analysisCompletedRef.current is true but !loggingSucceeded,
      // preserve analysis state for retry (partial-success)
    }
  }, [hasItems, hasInvalidIngredients, batch, effectiveIsPro, effectiveManualMode, logJuice, recordNutritionLog, preMomentum, navigation, addLogEntry])

  const handleAdvancedBlendConfirm = useCallback(() => {
    blendApprovedRef.current = true
    setShowAdvancedBlendModal(false)
    executeLogToChallenge()
  }, [executeLogToChallenge])

  const handleBigSqueezeDismiss = useCallback(() => {
    setShowBigSqueeze(false)
    navigation.goBack()
  }, [navigation])

  // Compute which pillars this juice would fill
  const pillarPreview = {}
  for (const ing of batch.scannedIngredients) {
    const p = classifyProduceByPillar(ing.produceId)
    if (p) pillarPreview[p] = true
  }

  return (
    <View style={styles.rootWrap}>
    <MeshGradientBg />
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            navigation.goBack()
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Juice Snap</Text>
        <View style={styles.filmRoll}>
          <Film size={14} color={filmRollIsPro ? '#FFD54F' : '#64B5F6'} />
          <Text style={[styles.filmRollText, filmRollIsPro && { color: '#FFD54F' }]}>
            {filmRollLabel}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.scroll}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardShouldPersistTaps="handled"
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pillar preview badges */}
        {hasItems && (
          <View style={styles.pillarPreview}>
            {['base', 'power', 'kick'].map((key) => {
              const data = DAILY_PILLARS[key]
              const isFilled = !!pillarPreview[key]
              const Icon = PILLAR_ICONS[key]
              return (
                <View
                  key={key}
                  style={[
                    styles.pillarBadge,
                    isFilled && { backgroundColor: `${data.color}20`, borderColor: `${data.color}40` },
                  ]}
                >
                  <Icon size={14} color={isFilled ? data.color : '#90A4AE'} />
                  <Text style={[
                    styles.pillarBadgeText,
                    isFilled && { color: data.color },
                  ]}>
                    {data.shortLabel}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Editable produce list */}
        {hasItems && (
          <View style={styles.editCard}>
            <View style={styles.editCardHeader}>
              <Text style={styles.editCardTitle}>Identified Produce</Text>
            </View>
            {batch.scannedIngredients.map((item, i) => (
              <ProduceEditRow
                key={`${item.produceId}-${i}`}
                item={item}
                index={i}
                onReplace={handleReplace}
                onRemove={handleRemove}
                onWeightChange={handleWeightChange}
                onToggleOrganic={handleToggleOrganic}
                onModeChange={handleModeChange}
                onQuantityChange={handleQuantityChange}
                onUnitChange={handleUnitChange}
                onSizeChange={handleSizeChange}
                onEstimatedWeightChange={handleEstimatedWeightChange}
                juiceMethod={juiceMethod}
                isPrimary={item.produceId === primaryProduceId}
                onSetPrimary={handleSetPrimary}
              />
            ))}
            <AddProducePicker onAdd={handleAddProduce} />

            {hasItems && !isLogged && (
              <TouchableOpacity
                style={[styles.findRecipesBtn, !primaryProduceId && styles.findRecipesBtnDisabled]}
                onPress={() => {
                  if (!primaryProduceId) return
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  const ids = (batch.scannedIngredients || []).map((i) => i.produceId)
                  const otherIds = ids.filter((id) => id !== primaryProduceId)
                  navigation.navigate('ProduceRecipeResults', {
                    primaryProduceId,
                    otherSelectedProduceIds: otherIds,
                    selectedProduceIds: ids,
                  })
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={primaryProduceId ? 'Find recipes with my primary produce' : 'Select a primary produce to find recipes'}
              >
                <BookOpen size={18} color={primaryProduceId ? '#64B5F6' : '#90A4AE'} />
                <Text style={[styles.findRecipesBtnText, !primaryProduceId && styles.findRecipesBtnTextDisabled]}>
                  {primaryProduceId ? 'Find Recipes with My Primary Produce' : 'Select a Primary Produce First'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.summarySection}>
          <NutritionSummary
            batch={batch}
            scannedIngredients={batch.scannedIngredients}
            onUpdateItem={handleUpdateItem}
            snapExhausted={isSnapDepleted}
          />
        </View>

        {/* ── Snap Produce (camera) ─────────────────────────── */}
        <View style={styles.buttonSection}>
          {isSnapDepleted ? (
            <View style={styles.depletedSnapContainer}>
              <View style={styles.depletedSnapButton} pointerEvents="none">
                <SnapIcon size={26} disabled style={styles.depletedSnapIcon} />
                <Text style={styles.depletedSnapLabel}>Snap Produce</Text>
              </View>
              <View style={styles.depletedOverlay} pointerEvents="none" />
              <Text style={styles.depletedMessage}>
                {filmRollIsPro
                  ? "You've used your 12 AI Snaps for this month."
                  : "You've used your complimentary AI Snap for this month."}
              </Text>
              <Text style={styles.depletedSubMessage}>
                {filmRollIsPro
                  ? 'Keep adding produce manually for free. Your next 12 AI Snaps arrive at the start of your next quota month.'
                  : 'Keep adding produce manually for free, or upgrade to RawLifeFlow Pro for 12 AI Snaps each month.'}
              </Text>
              <View style={styles.depletedActions}>
                {!filmRollIsPro && (
                  <TouchableOpacity
                    style={styles.depletedUpgradeBtn}
                    onPress={() => navigation.navigate('Paywall', { source: 'snap_exhausted' })}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Upgrade to Pro"
                  >
                    <Text style={styles.depletedUpgradeBtnText}>Upgrade to Pro</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <>
              <SnapButton onPress={handleSnap} />
              {isPreparingCamera && (
                <View style={styles.preparingCameraRow}>
                  <ActivityIndicator size="small" color="#64B5F6" />
                  <Text style={styles.preparingCameraText}>Preparing camera…</Text>
                </View>
              )}
              <QuotaMeter navigation={navigation} />
            </>
          )}
        </View>

        {/* ── Manual Entry: Search + Ingredient Cloud ─────────── */}
        <View style={manualStyles.manualSection}>
          <Text style={manualStyles.manualHelperText}>
            Prefer manual entry? Tap a produce below.
          </Text>
          <Text style={manualStyles.manualLabel}>Or type it in</Text>
          <View style={manualStyles.searchBar}>
            <Search size={16} color="#90A4AE" />
            <TextInput
              style={manualStyles.searchInput}
              placeholder="Search ingredients..."
              placeholderTextColor="#90A4AE"
              value={manualSearch}
              onChangeText={setManualSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {manualSearch.length > 0 && (
              <TouchableOpacity onPress={() => setManualSearch('')}>
                <X size={16} color="#90A4AE" />
              </TouchableOpacity>
            )}
          </View>
          <IngredientCloud
            searchQuery={manualSearch}
            onAdd={handleManualAdd}
            addedIds={batch.scannedIngredients.map((i) => i.produceId)}
          />

          {/* Permanent Search Tips — always visible */}
          <View style={manualStyles.searchTipsCard} accessibilityLabel="Search tips">
            <Text style={manualStyles.searchTipsTitle}>If no ingredients matched your search…</Text>
            <Text style={manualStyles.searchTipsParagraph}>If no ingredients matched your search, don't worry—the ingredient may be listed under a shorter, simpler, or more familiar name in the app.</Text>
            <Text style={manualStyles.searchTipsParagraph}>Check the spelling carefully, remove any unnecessary words, and try entering the ingredient again using the name you would normally use while shopping.</Text>
            <Text style={manualStyles.searchTipsParagraph}>Try using a shorter or more general ingredient name, especially if you entered a color, variety, brand, preparation style, or other descriptive wording.</Text>
            <Text style={manualStyles.searchTipsParagraph}>For example, enter 'pepper' instead of a longer or more specific variety name, then review the available results for the closest matching ingredient.</Text>
            <Text style={manualStyles.searchTipsParagraph}>You can also test the search with a familiar fruit or vegetable such as spinach, carrot, cucumber, apple, celery, or kale to confirm that ingredient matching is working.</Text>
            <Text style={manualStyles.searchTipsParagraph}>If the ingredient still does not appear, clear the search completely, try another ingredient, and return later using a broader or more commonly recognized name.</Text>
            <Text style={manualStyles.searchTipsParagraph}>If you are not seeing the exact ingredient you expected, try thinking of the most common everyday name that shoppers usually use in stores, kitchens, or recipes. A simpler name often makes it easier for the app to find the closest supported fruit, vegetable, herb, or ingredient.</Text>
            <Text style={manualStyles.searchTipsLastParagraph}>Once you find the closest match, add it to your ingredient list and continue building your juice. You can review the full list before continuing, making the produce-entry process practical, flexible, and easier to complete even when an ingredient uses a slightly different name.</Text>
          </View>
        </View>

        {/* ── Pro Upsell Nudge (7+ manual ingredients) ────────── */}
        {showUpsellNudge && !effectiveIsPro && (
          <TouchableOpacity
            style={manualStyles.upsellCard}
            onPress={() => {
              setShowUpsellNudge(false)
              navigation.navigate('Paywall', { source: 'upsell_nudge' })
            }}
            activeOpacity={0.8}
          >
            <View style={manualStyles.upsellIcon}>
              <Sparkles size={18} color="#FFD54F" />
            </View>
            <View style={manualStyles.upsellContent}>
              <Text style={manualStyles.upsellTitle}>That's a lot of typing!</Text>
              <Text style={manualStyles.upsellDesc}>
                Architect Pro members just snap a photo and let the AI do the heavy lifting.
              </Text>
            </View>
            <Crown size={16} color="#FFD54F" />
          </TouchableOpacity>
        )}

        {hasItems && (
          <TouchableOpacity
            style={[
              styles.logButton,
              isLogging && styles.logButtonBusy,
              hasInvalidIngredients && styles.logButtonDisabled,
            ]}
            onPress={handleLogToChallenge}
            activeOpacity={0.7}
            disabled={isLogging || hasInvalidIngredients}
            accessibilityState={{
              busy: isLogging,
              disabled: isLogging || hasInvalidIngredients,
            }}
            accessibilityLabel={
              isLogging
                ? 'Logging your juice, please wait'
                : hasInvalidIngredients
                  ? 'Log to Today — disabled, fix invalid ingredients first'
                  : 'Log to Today'
            }
          >
            <LinearGradient
              colors={
                hasInvalidIngredients
                  ? ['#6B7280', '#4B5563']
                  : ['#4CAF50', '#2E7D32']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logButtonGradient}
            >
              {isLogging ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.logButtonText}>Logging…</Text>
                </>
              ) : (
                <>
                  <CheckCircle size={20} color="#FFFFFF" />
                  <Text style={styles.logButtonText}>Log to Today</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {hasInvalidIngredients && hasItems && !isLogging && (
          <Text style={{ color: '#EF4444', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
            Resolve ingredient errors before logging.
          </Text>
        )}

        {isLogged && (
          <View style={styles.loggedBadge}>
            <CheckCircle size={16} color="#4CAF50" />
            <Text style={styles.loggedText}>Logged to challenge!</Text>
          </View>
        )}

        {/* Secondary exit — always available when items are present */}
        {hasItems && (
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              navigation.goBack()
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {keyboardHeight > 0 && <View style={{ height: keyboardHeight }} />}
      </KeyboardAvoidingView>

      <Modal
        visible={isCameraOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCameraClose}
      >
        <CameraScreen
          onClose={handleCameraClose}
          onProduceIdentified={handleProduceIdentified}
          onManualEntry={() => {
            setIsCameraOpen(false)
            setIsManualMode(true)
            cameraUsedRef.current = false
          }}
          onAccountRequired={() => setShowAccountGate(true)}
          guestFirstScan={guestFirstScan}
          quotaRemaining={filmRollRemaining}
          isProUser={effectiveIsPro}
        />
      </Modal>

      <AccountGateModal
        visible={showAccountGate}
        onClose={() => {
          setShowAccountGate(false)
          pendingCameraOpenRef.current = false
          setIsPreparingCamera(false)
          cameraInFlightRef.current = false
        }}
        onAuthenticated={() => {
          setShowAccountGate(false)
          pendingCameraOpenRef.current = false
          setIsPreparingCamera(false)
          cameraInFlightRef.current = false
        }}
        initialMode={accountGateMode}
      />

      <BigSqueezeModal
        visible={showBigSqueeze}
        onDismiss={handleBigSqueezeDismiss}
        filledColors={squeezeColors}
        juiceData={{
          ingredients: batch.items || [],
          totals: batch.totals || {},
        }}
        vitalityScore={vitalityScore}
      />

      <SnapGateModal
        visible={showSnapGate}
        onDismiss={() => setShowSnapGate(false)}
        onUpgrade={() => navigation.navigate('Paywall', { source: 'snap_gate' })}
        onBuyPack={() => navigation.navigate('Paywall', { source: 'snap_gate_pack' })}
      />

      <AdvancedBlendModal
        visible={showAdvancedBlendModal}
        stage={advancedBlendStage}
        remaining={advancedBlendRemaining}
        isPro={effectiveIsPro}
        onUpgrade={() => {
          setShowAdvancedBlendModal(false)
          trackEvent('today_usage_row_tapped', {
            row: 'advanced_blend_upgrade',
            plan: effectiveIsPro ? 'pro' : 'free',
          })
          navigation.navigate('Paywall', { source: 'advanced_blend' })
        }}
        onDismiss={() => {
          setShowAdvancedBlendModal(false)
          // When the user dismisses the completion confirmation,
          // resume the logging + navigation flow. The analysis result
          // is cached in analysisCompletedRef/analysisResultRef so the
          // retry will skip the blend check and proceed to log.
          if (advancedBlendStage === 'completion_confirmation') {
            executeLogToChallenge()
          }
        }}
        onConfirm={handleAdvancedBlendConfirm}
        onRetry={async () => {
          setShowAdvancedBlendModal(false)
          await refreshBlendAllowance()
          handleLogToChallenge()
        }}
      />
    </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  rootWrap: {
    flex: 1,
    backgroundColor: '#060D0A',
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filmRoll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(100,181,246,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.12)',
  },
  filmRollText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64B5F6',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 80,
  },

  // ── Pillar Preview ─────────────────────────────────────────
  pillarPreview: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pillarBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pillarBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#90A4AE',
  },

  // ── Editable Produce Card ──────────────────────────────────
  editCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  editCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#90A4AE',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  editRow: {
    flexDirection: 'column',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
    gap: 6,
  },
  editModeRow: {
    paddingLeft: 16,
    paddingRight: 4,
  },
  editQuantityContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  rowErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 16,
    paddingRight: 4,
  },
  rowErrorText: {
    fontSize: 11,
    color: '#F85149',
    lineHeight: 16,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editPillarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  editName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#C9D1D9',
  },
  editControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  statusLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    flexWrap: 'wrap',
  },
  organicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
  },
  adjustmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
  },
  organicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  organicBtnActive: {
    backgroundColor: 'rgba(129,199,132,0.12)',
    borderColor: 'rgba(129,199,132,0.25)',
  },
  organicLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  editWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editWeightBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  editWeightLabels: {
    alignItems: 'center',
    minWidth: 48,
  },
  editWeightText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B949E',
    textAlign: 'center',
  },
  editWeightLb: {
    fontSize: 9,
    fontWeight: '600',
    color: '#90A4AE',
    textAlign: 'center',
    marginTop: 1,
  },
  editRemoveBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(233,30,99,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(233,30,99,0.12)',
  },

  // ── Add Button ─────────────────────────────────────────────
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 6,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#81C784',
  },

  // ── Produce Picker ─────────────────────────────────────────
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6,13,10,0.92)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: 'rgba(22,27,34,0.95)',
    borderRadius: 28,
    padding: 18,
    maxHeight: 400,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerList: {
    maxHeight: 340,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  pickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  pickerOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#C9D1D9',
  },
  pickerPillarTag: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Existing ───────────────────────────────────────────────
  summarySection: {
    marginBottom: 20,
  },
  buttonSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  findRecipesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(100,181,246,0.25)',
    backgroundColor: 'rgba(100,181,246,0.06)',
    marginBottom: 12,
  },
  findRecipesBtnText: {
    color: '#64B5F6',
    fontSize: 15,
    fontWeight: '600',
  },
  findRecipesBtnDisabled: {
    borderColor: 'rgba(72,79,88,0.3)',
    backgroundColor: 'rgba(72,79,88,0.04)',
    opacity: 0.6,
  },
  findRecipesBtnTextDisabled: {
    color: '#90A4AE',
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(72,79,88,0.08)',
  },
  primaryBtnActive: {
    backgroundColor: 'rgba(100,181,246,0.12)',
  },
  primaryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  logButton: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  logButtonBusy: {
    opacity: 0.7,
  },
  logButtonDisabled: {
    opacity: 0.5,
  },
  preparingCameraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  preparingCameraText: {
    color: '#64B5F6',
    fontSize: 14,
    fontWeight: '500',
  },
  // ── Snap depleted (exhausted) state ──
  depletedSnapContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  depletedSnapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    width: '100%',
    opacity: 0.4,
  },
  depletedSnapIcon: {
    // Render the full-color artwork at reduced opacity (set on parent)
  },
  depletedOverlay: {
    // Visual lock indicator is achieved via opacity on the button container
  },
  depletedSnapLabel: {
    color: '#8B949E',
    fontSize: 16,
    fontWeight: '700',
  },
  depletedMessage: {
    color: '#C9D1D9',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 6,
  },
  depletedSubMessage: {
    color: '#90A4AE',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  depletedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  depletedManualBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(129,199,132,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129,199,132,0.3)',
  },
  depletedManualBtnText: {
    color: '#81C784',
    fontSize: 14,
    fontWeight: '600',
  },
  depletedUpgradeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(100,181,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(100,181,246,0.3)',
  },
  depletedUpgradeBtnText: {
    color: '#64B5F6',
    fontSize: 14,
    fontWeight: '600',
  },
  logButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  loggedText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  doneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  doneBtnText: {
    color: '#8B949E',
    fontSize: 15,
    fontWeight: '600',
  },
})

// ── Manual Entry Styles ─────────────────────────────────────

const manualStyles = StyleSheet.create({
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(129,199,132,0.08)',
    borderColor: 'rgba(129,199,132,0.2)',
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#90A4AE',
  },
  modeBtnTextActive: {
    color: '#81C784',
  },
  depletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,183,77,0.06)',
    borderRadius: 24,
    padding: 14,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,183,77,0.15)',
  },
  depletedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFB74D',
    lineHeight: 18,
  },
  manualSection: {
    marginBottom: 16,
  },
  manualHelperText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#78909C',
    marginBottom: 6,
    textAlign: 'center',
  },
  manualLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#90A4AE',
    marginBottom: 10,
    textAlign: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    padding: 0,
  },
  cloudWrap: {
    marginBottom: 8,
  },
  cloudGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 0.5,
  },
  bubbleAdded: {
    backgroundColor: 'rgba(129,199,132,0.06)',
  },
  bubbleEmoji: {
    fontSize: 18,
  },
  bubbleName: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  bubbleCheck: {
    fontSize: 12,
    fontWeight: '800',
    color: '#81C784',
    marginLeft: 2,
  },
  noResults: {
    fontSize: 14,
    color: '#90A4AE',
    textAlign: 'center',
    paddingVertical: 20,
  },
  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,213,79,0.04)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,213,79,0.12)',
  },
  upsellIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,213,79,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upsellContent: {
    flex: 1,
  },
  upsellTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFD54F',
    marginBottom: 2,
  },
  upsellDesc: {
    fontSize: 12,
    color: '#8B949E',
    lineHeight: 17,
  },
  searchTipsCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  searchTipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B949E',
    marginBottom: 16,
  },
  searchTipsParagraph: {
    fontSize: 11,
    color: '#90A4AE',
    lineHeight: 16,
    marginBottom: 16,
  },
  searchTipsLastParagraph: {
    fontSize: 11,
    color: '#90A4AE',
    lineHeight: 16,
  },
})
