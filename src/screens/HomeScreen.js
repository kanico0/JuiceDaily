import React, { useState, useCallback, useEffect, useRef } from 'react'
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
  Cog,
  BookOpen,
} from 'lucide-react-native'
import colors from '../constants/colors'
import NUTRIENT_LIBRARY from '../constants/NutrientLibrary.json'
import { EMPTY_BATCH, USDA_RDA } from '../constants/nutrition'
import SnapButton from '../components/SnapButton'
import { useQuota } from '../services/quota/QuotaStore'
import { selectQuotaLabel, selectQuotaExhausted } from '../services/subscriptions/subscriptionSelectors'
import NutritionSummary from '../components/NutritionSummary'
import BigSqueezeModal from '../components/BigSqueezeModal'
import SnapGateModal from '../components/SnapGateModal'
import AccountGateModal from '../components/AccountGateModal'
import TrafficLightBadge from '../components/TrafficLightBadge'
import CameraScreen from './CameraScreen'
import { usePro } from '../services/ProStore'
import MeshGradientBg from '../components/MeshGradientBg'
import { processJuiceBatch, PRODUCE_DATA } from '../services/JuiceEngine'
import AdvancedBlendModal from '../components/AdvancedBlendModal'
import { countDistinctProduceIds, classifyBlend, BlendAllowanceError, FREE_ADVANCED_BLEND_ALLOWANCE, createOperationId } from '../services/quota/blendAllowanceService'
import { authorizeAndProcessBatch } from '../services/quota/blendNutritionGate'
import { authorizeGuestLog } from '../services/quota/guestLogGate'
import { trackEvent } from '../services/AnalyticsService'

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
import { useFormatWeight } from '../utils/weightFormat'
import { useOrganicPref, getDefaultOrganic } from '../utils/organicPreference'
import { useNutritionScore } from '../services/NutritionScoreStore'
import { useJuiceLog } from '../services/JuiceLogStore'
import { recordMeaningfulActivity } from '../services/DormantReminderService'
import {
  isQuantitySupported as isProduceQuantitySupported,
  getSupportedPortionUnits,
  getDefaultPortionUnit,
  getSupportedSizes,
  estimateRawWeightGrams,
  createQuantityMetadata,
  recomputeFromQuantityChange,
  restoreQuantityMetadata,
  getPortionRegistryRecord,
} from '../services/producePortionConversion'
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
  const currentQuantity = qtyMeta?.enteredQuantity || ''
  const currentUnitKey = qtyMeta?.unitKey || getDefaultPortionUnit(item.produceId)?.unitKey || null
  const currentSizeKey = qtyMeta?.sizeKey || null

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
            <View style={[styles.editPillarDot, { backgroundColor: '#484F58' }]} />
          )}
        </View>
        <Text style={styles.editName} numberOfLines={1} ellipsizeMode="tail">{getProduceVariantDisplayName(item.produceId) || entry?.name || item.produceId}</Text>
        <ChevronDown size={14} color="#484F58" />
      </TouchableOpacity>

      {/* Row 1b: Entry mode toggle */}
      <View style={styles.editModeRow}>
        <PortionEntryModeToggle
          mode={entryMode}
          onModeChange={(mode) => onModeChange(index, mode)}
          quantityDisabled={!quantitySupported}
          quantityDisabledReason={
            !quantitySupported
              ? 'Quantity estimates are not available for this ingredient yet. Enter its raw weight instead.'
              : ''
          }
          accessibilityLabelPrefix={`Portion entry for ${entry?.name || item.produceId}`}
        />
      </View>

      {/* Row 2: Controls — Weight mode */}
      {entryMode === 'weight' && (
        <View style={styles.editControlsRow}>
          <TrafficLightBadge produceId={item.produceId} isOrganic={isOrganic} juiceMethod={juiceMethod} />
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
            <Leaf size={10} color={isOrganic ? '#81C784' : '#484F58'} />
            <Text style={[styles.organicLabel, { color: isOrganic ? '#81C784' : '#484F58' }]}>
              {isOrganic ? 'Organic' : 'Non-Organic'}
            </Text>
          </TouchableOpacity>

          <View style={styles.editWeightRow}>
            <TouchableOpacity
              onPress={() => onWeightChange(index, Math.max(10, item.weightG - 25))}
              style={styles.editWeightBtn}
              accessibilityLabel="Decrease raw produce weight"
            >
              <Minus size={12} color="#8B949E" />
            </TouchableOpacity>
            <View style={styles.editWeightLabels}>
              <Text style={styles.editWeightText}>{fmtG(item.weightG)}</Text>
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

      {/* Row 2: Controls — Quantity mode */}
      {entryMode === 'quantity' && quantitySupported && (
        <View style={styles.editQuantityContainer}>
          <View style={styles.editControlsRow}>
            <TrafficLightBadge produceId={item.produceId} isOrganic={isOrganic} juiceMethod={juiceMethod} />
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
              <Leaf size={10} color={isOrganic ? '#81C784' : '#484F58'} />
              <Text style={[styles.organicLabel, { color: isOrganic ? '#81C784' : '#484F58' }]}>
                {isOrganic ? 'Organic' : 'Non-Organic'}
              </Text>
            </TouchableOpacity>
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
                      <View style={[styles.pickerDot, { backgroundColor: '#484F58' }]} />
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
                      <View style={[styles.pickerDot, { backgroundColor: '#484F58' }]} />
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
      <Text style={{ color: exhausted ? '#F0883E' : '#6E7681', fontSize: 12 }}>
        {label}
      </Text>
      {exhausted && isFree && (
        <Text style={{ color: '#7EE787', fontSize: 12, marginTop: 2 }}>
          Upgrade to Pro for 60 scans / month — or keep logging manually free
        </Text>
      )}
    </TouchableOpacity>
  )
}

// ── Main Screen ──────────────────────────────────────────────

function seedPreloadIngredients(preload, organicMode) {
  return preload.map((item) => {
    if (typeof item === 'string') {
      return { produceId: item, weightG: 150, isOrganic: getDefaultOrganic(organicMode), portionEntryMode: 'weight' }
    }
    return {
      produceId: item.produceId,
      weightG: item.weightG || 150,
      isOrganic: typeof item.isOrganic === 'boolean' ? item.isOrganic : getDefaultOrganic(organicMode),
      portionEntryMode: item.portionEntryMode || 'weight',
      portionMetadata: item.portionMetadata || undefined,
    }
  })
}

export default function JuiceSnapScreen({ navigation, route }) {
  const { mode: organicMode } = useOrganicPref()
  const shouldAutoOpenCamera = route?.params?.openCamera === true
  const preloadIngredients = route?.params?.preloadIngredients || null
  const source = route?.params?.source || 'camera'
  const [batch, setBatch] = useState(() => {
    if (preloadIngredients && preloadIngredients.length > 0) {
      const seeded = seedPreloadIngredients(preloadIngredients, organicMode)
      return buildBatch(seeded, 'centrifugal')
    }
    return { ...EMPTY_BATCH, scannedIngredients: [] }
  })
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isLogged, setIsLogged] = useState(false)
  const [showBigSqueeze, setShowBigSqueeze] = useState(false)
  const [squeezeColors, setSqueezeColors] = useState([])
  const { logJuice, vitalityScore } = useChallenge()
  const { recordNutritionLog, momentum: preMomentum } = useNutritionScore()
  const { addEntry: addLogEntry } = useJuiceLog()
  const { checkSnapEligibility, useSnap, snapInfo, isPro } = usePro()
  const [showSnapGate, setShowSnapGate] = useState(false)
  const [showAccountGate, setShowAccountGate] = useState(false)
  const [showAdvancedBlendModal, setShowAdvancedBlendModal] = useState(false)
  const [advancedBlendStage, setAdvancedBlendStage] = useState('fifth_ingredient_notice')
  const [advancedBlendRemaining, setAdvancedBlendRemaining] = useState(FREE_ADVANCED_BLEND_ALLOWANCE)
  const [blendNoticeShown, setBlendNoticeShown] = useState(false)
  const [blendCheckInProgress, setBlendCheckInProgress] = useState(false)
  const blendOperationIdRef = useRef(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const [isManualMode, setIsManualMode] = useState(route?.params?.manualEntry === true)
  const [manualSearch, setManualSearch] = useState('')
  const [showUpsellNudge, setShowUpsellNudge] = useState(false)
  const [juiceMethod, setJuiceMethod] = useState('centrifugal')
  const [globalPortionMode, setGlobalPortionMode] = useState('quantity')
  const [keyboardHeight, setKeyboardHeight] = useState(0)

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

  const hasItems = (batch.scannedIngredients || []).length > 0
  const snapEligibility = checkSnapEligibility()
  const isSnapDepleted = !snapEligibility.eligible && !isPro

  // Open manual entry when navigated with manualEntry: true
  useEffect(() => {
    if (route?.params?.manualEntry === true) {
      setIsManualMode(true)
    }
  }, [route?.params?.manualEntry])

  // Reseed batch when navigated with new preloadIngredients (e.g. recipe hand-off)
  useEffect(() => {
    const preload = route?.params?.preloadIngredients
    if (preload && preload.length > 0) {
      const seeded = seedPreloadIngredients(preload, organicMode)
      setBatch(buildBatch(seeded, juiceMethod))
      setIsLogged(false)
    }
  }, [route?.params?.preloadIngredients]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open camera when navigated with openCamera: true
  useEffect(() => {
    if (shouldAutoOpenCamera && !isCameraOpen) {
      const eligibility = checkSnapEligibility()
      if (eligibility.eligible) {
        useSnap()
        setIsCameraOpen(true)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand manual mode when snaps are depleted
  const effectiveManualMode = isManualMode || isSnapDepleted

  const handleSnap = useCallback(() => {
    const eligibility = checkSnapEligibility()
    if (!eligibility.eligible) {
      setShowSnapGate(true)
      return
    }
    useSnap()
    setIsCameraOpen(true)
    setIsLogged(false)
  }, [checkSnapEligibility, useSnap])

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
      const defaultUnit = getDefaultPortionUnit(item.id)
      if (defaultUnit) {
        const hasSML = defaultUnit.sizes.some((s) => s.sizeKey !== 'standard')
        const defaultSize = hasSML
          ? (defaultUnit.sizes.find((s) => s.sizeKey === 'medium') || defaultUnit.sizes[0])
          : null
        // Don't fabricate a quantity — leave metadata empty until user enters one
        newIngredient.portionMetadata = undefined
        newIngredient.pendingUnitKey = defaultUnit.unitKey
        newIngredient.pendingSizeKey = defaultSize?.sizeKey || null
      }
    }
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients, newIngredient]
      // Show upsell nudge at 7+ manual ingredients
      if (updated.length >= 7 && !isPro) {
        setShowUpsellNudge(true)
      }
      // Fifth-ingredient notice for Advanced Blend
      const distinctCount = countDistinctProduceIds(updated)
      if (distinctCount === 5 && !blendNoticeShown && !isPro) {
        setAdvancedBlendStage('fifth_ingredient_notice')
        setAdvancedBlendRemaining(FREE_ADVANCED_BLEND_ALLOWANCE)
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
  }, [isPro, blendNoticeShown, globalPortionMode, organicMode])

  const handleCameraClose = useCallback(() => {
    setIsCameraOpen(false)
    // Stay on JuiceSnap showing manual entry fallback — do NOT goBack()
    // User can type ingredients manually or navigate away via tabs/back
  }, [])

  const handleProduceIdentified = useCallback((visionResult) => {
    console.log('[SCAN] handleProduceIdentified —', visionResult.scannedIngredients.length, 'items')
    const enriched = visionResult.scannedIngredients.map((ing) => {
      if (isProduceQuantitySupported(ing.produceId)) {
        const defaultUnit = getDefaultPortionUnit(ing.produceId)
        if (defaultUnit) {
          const hasSML = defaultUnit.sizes.some((s) => s.sizeKey !== 'standard')
          const defaultSize = hasSML
            ? (defaultUnit.sizes.find((s) => s.sizeKey === 'medium') || defaultUnit.sizes[0])
            : null
          const initialResult = recomputeFromQuantityChange({
            produceId: ing.produceId,
            quantity: 1,
            unitKey: defaultUnit.unitKey,
            sizeKey: defaultSize?.sizeKey || undefined,
          })
          if (initialResult) {
            return {
              ...ing,
              weightG: initialResult.weightG,
              portionMetadata: initialResult.metadata,
              portionEntryMode: 'quantity',
              pendingUnitKey: defaultUnit.unitKey,
              pendingSizeKey: defaultSize?.sizeKey || null,
            }
          }
        }
      }
      return ing
    })
    setBatch(buildBatch(enriched, juiceMethod))
    setIsCameraOpen(false)
    setIsLogged(false)
    // Check for Advanced Blend threshold from photo scan
    const distinctCount = countDistinctProduceIds(enriched)
    if (distinctCount >= 5 && !isPro) {
      setAdvancedBlendStage('fifth_ingredient_notice')
      setAdvancedBlendRemaining(FREE_ADVANCED_BLEND_ALLOWANCE)
      setShowAdvancedBlendModal(true)
      setBlendNoticeShown(true)
      trackEvent('advanced_blend_threshold_reached', {
        plan: 'free',
        ingredient_count: distinctCount,
        source: 'photo',
      })
    }
  }, [juiceMethod, isPro])

  const handleUpdateItem = useCallback((index, newProduceId, newWeightG) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      updated[index] = { ...updated[index], produceId: newProduceId, weightG: newWeightG }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod])

  const handleReplace = useCallback((index, newProduceId) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      updated[index] = {
        ...updated[index],
        produceId: newProduceId,
        portionMetadata: undefined,
        portionEntryMode: 'weight',
        pendingUnitKey: undefined,
        pendingSizeKey: undefined,
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod])

  const handleRemove = useCallback((index) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(
      300,
      LayoutAnimation.Types.spring,
      LayoutAnimation.Properties.opacity
    ))
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      updated.splice(index, 1)
      if (updated.length === 0) return { ...EMPTY_BATCH, scannedIngredients: [] }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [juiceMethod])

  const handleWeightChange = useCallback((index, newWeight) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      updated[index] = { ...updated[index], weightG: newWeight }
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

  const handleToggleJuiceMethod = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setJuiceMethod((prev) => {
      const next = prev === 'cold_pressed' ? 'centrifugal' : 'cold_pressed'
      AsyncStorage.setItem(JUICE_METHOD_STORAGE_KEY, next).catch(() => {})
      setBatch((prevBatch) => {
        if ((prevBatch.scannedIngredients || []).length === 0) return prevBatch
        return buildBatch(prevBatch.scannedIngredients, next)
      })
      return next
    })
    setIsLogged(false)
  }, [])

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
          // No prior metadata — don't invent a count, just switch mode
          updated[index] = {
            ...item,
            portionEntryMode: 'quantity',
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
    const safeQty = Math.max(0, qty)
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      const item = updated[index]
      const unitKey = item.portionMetadata?.unitKey || item.pendingUnitKey || getDefaultPortionUnit(item.produceId)?.unitKey
      const sizeKey = item.portionMetadata?.sizeKey || item.pendingSizeKey || null
      const input = { produceId: item.produceId, quantity: safeQty, unitKey, sizeKey: sizeKey || undefined }
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

  const handleUnitChange = useCallback((index, newUnitKey) => {
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients]
      const item = updated[index]
      const qty = item.portionMetadata?.enteredQuantity
      if (!qty) {
        // Just update pending unit if no quantity entered yet
        updated[index] = { ...item, pendingUnitKey: newUnitKey }
        return { ...prev, scannedIngredients: updated }
      }
      // Recompute with new unit
      const units = getSupportedPortionUnits(item.produceId)
      const newUnit = units.find((u) => u.unitKey === newUnitKey)
      const hasSML = newUnit?.sizes.some((s) => s.sizeKey !== 'standard') || false
      const defaultSize = hasSML
        ? (newUnit.sizes.find((s) => s.sizeKey === 'medium') || newUnit.sizes[0])
        : null
      const sizeKey = defaultSize?.sizeKey || undefined
      const input = { produceId: item.produceId, quantity: qty, unitKey: newUnitKey, sizeKey }
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
        const defaultUnit = getDefaultPortionUnit(produceId)
        if (defaultUnit) {
          const hasSML = defaultUnit.sizes.some((s) => s.sizeKey !== 'standard')
          const defaultSize = hasSML
            ? (defaultUnit.sizes.find((s) => s.sizeKey === 'medium') || defaultUnit.sizes[0])
            : null
          newIngredient.pendingUnitKey = defaultUnit.unitKey
          newIngredient.pendingSizeKey = defaultSize?.sizeKey || null

          const initialResult = recomputeFromQuantityChange({
            produceId,
            quantity: 1,
            unitKey: defaultUnit.unitKey,
            sizeKey: defaultSize?.sizeKey || undefined,
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

    const ingredients = batch?.scannedIngredients || []
    const distinctCount = countDistinctProduceIds(ingredients)
    const blendType = classifyBlend(distinctCount)

    // Advanced Blend: check allowance for free users
    if (blendType === 'advanced' && !isPro) {
      // Create a new operation ID for this analysis attempt
      blendOperationIdRef.current = createOperationId()
      // Show pre-analysis confirmation first
      setAdvancedBlendStage('pre_analysis_confirmation')
      setAdvancedBlendRemaining(FREE_ADVANCED_BLEND_ALLOWANCE)
      setShowAdvancedBlendModal(true)
      trackEvent('advanced_blend_confirmation_shown', {
        plan: 'free',
        remaining: FREE_ADVANCED_BLEND_ALLOWANCE,
        ingredient_count: distinctCount,
        source: effectiveManualMode ? 'manual' : 'photo',
      })
      return
    }

    // Pro users: create operation ID and proceed directly
    if (blendType === 'advanced' && isPro) {
      blendOperationIdRef.current = createOperationId()
    }

    await executeLogToChallenge()
  }, [hasItems, batch, isPro, effectiveManualMode])

  const executeLogToChallenge = useCallback(async () => {
    if (!hasItems) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    const ingredients = batch?.scannedIngredients || []
    const distinctCount = countDistinctProduceIds(ingredients)
    const blendType = classifyBlend(distinctCount)
    const logSource = effectiveManualMode ? 'manual' : 'photo'

    let totals = batch?.totals || {}
    let allowanceResult = null

    // Advanced Blend: go through server-authoritative transaction
    if (blendType === 'advanced') {
      setBlendCheckInProgress(true)
      try {
        trackEvent('advanced_blend_analysis_started', {
          plan: isPro ? 'pro' : 'free',
          ingredient_count: distinctCount,
          source: logSource,
        })

        const authorized = await authorizeAndProcessBatch(ingredients, batch.juiceMethod || 'cold_pressed', blendOperationIdRef.current || undefined)
        totals = authorized.totals || totals
        allowanceResult = authorized.allowance

        // Update batch with real nutrition totals
        setBatch((prev) => ({
          ...prev,
          totals,
          items: authorized.ingredients || prev.items,
        }))

        if (allowanceResult && allowanceResult.plan === 'free') {
          const remaining = allowanceResult.remaining ?? 0
          trackEvent('advanced_blend_analysis_completed', {
            plan: 'free',
            ingredient_count: distinctCount,
            remaining,
            used: allowanceResult.used,
            limit: allowanceResult.limit,
            source: logSource,
          })

          // Show completion confirmation
          setAdvancedBlendStage('completion_confirmation')
          setAdvancedBlendRemaining(remaining)
          setShowAdvancedBlendModal(true)
          blendOperationIdRef.current = null
        }
      } catch (err) {
        if (err instanceof BlendAllowanceError && err.code === 'advanced_blend_limit_reached') {
          setAdvancedBlendStage('allowance_exhausted')
          setAdvancedBlendRemaining(0)
          setShowAdvancedBlendModal(true)
          blendOperationIdRef.current = null
          trackEvent('advanced_blend_quota_exhausted', {
            plan: 'free',
            ingredient_count: distinctCount,
            used: err.result?.used ?? 0,
            limit: err.result?.limit ?? FREE_ADVANCED_BLEND_ALLOWANCE,
            source: logSource,
          })
          setBlendCheckInProgress(false)
          return
        }

        // Network or server error — fail closed
        if (__DEV__) console.warn('[blend] allowance check failed:', err?.message)
        setAdvancedBlendStage('network_retry')
        setShowAdvancedBlendModal(true)
        trackEvent('advanced_blend_allowance_error', {
          plan: isPro ? 'pro' : 'free',
          error_code: err instanceof BlendAllowanceError ? err.code : 'unknown',
          ingredient_count: distinctCount,
          source: logSource,
        })
        trackEvent('advanced_blend_analysis_released', {
          plan: isPro ? 'pro' : 'free',
          ingredient_count: distinctCount,
          error_code: err instanceof BlendAllowanceError ? err.code : 'unknown',
          source: logSource,
        })
        setBlendCheckInProgress(false)
        return
      }
      setBlendCheckInProgress(false)
    }

    // ── Guest log gate: authorize before writing ───────────
    const logGate = await authorizeGuestLog()
    if (!logGate.allowed) {
      setShowAccountGate(true)
      return
    }

    logJuice(ingredients, { ...batch, totals })

    // Record to Nutrition Score system
    const ingredientIds = ingredients
      .map((i) => i?.produceId)
      .filter((id) => typeof id === 'string' && id.length > 0)
    const prevMomentum = typeof preMomentum === 'number' ? preMomentum : 0
    recordNutritionLog(ingredientIds, totals)

    // Create a JuiceLogEntry for the Today log
    addLogEntry({
      source: logSource,
      ingredientIds: ingredientIds,
      nutrientSummary: totals,
    })
    recordMeaningfulActivity().catch(() => {})

    setIsLogged(true)

    // Navigate to ScanSuccess with session metrics
    const nutrientKeys = Object.keys(totals).filter(
      (k) => (Number(totals[k]) || 0) > 0
    )
    navigation.navigate('ScanSuccess', {
      ingredientCount: ingredientIds.length,
      nutrientsFound: nutrientKeys.length,
      previousMomentum: prevMomentum,
      ingredientNames: ingredientIds,
    })
  }, [hasItems, batch, isPro, effectiveManualMode, logJuice, recordNutritionLog, preMomentum, navigation])

  const handleAdvancedBlendConfirm = useCallback(() => {
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
          <Film size={14} color={isPro ? '#FFD54F' : '#64B5F6'} />
          <Text style={[styles.filmRollText, isPro && { color: '#FFD54F' }]}>
            {snapInfo.label}
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
                  <Icon size={14} color={isFilled ? data.color : '#484F58'} />
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

        {/* Juice Method Toggle */}
        <View style={styles.juiceMethodRow}>
          <TouchableOpacity
            style={[
              styles.juiceMethodBtn,
              juiceMethod === 'cold_pressed' && styles.juiceMethodBtnActive,
            ]}
            onPress={() => juiceMethod !== 'cold_pressed' && handleToggleJuiceMethod()}
            activeOpacity={0.7}
          >
            <Cog size={14} color={juiceMethod === 'cold_pressed' ? '#81C784' : '#484F58'} />
            <Text style={[
              styles.juiceMethodText,
              juiceMethod === 'cold_pressed' && styles.juiceMethodTextActive,
            ]}>Cold Pressed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.juiceMethodBtn,
              juiceMethod === 'centrifugal' && styles.juiceMethodBtnActive,
            ]}
            onPress={() => juiceMethod !== 'centrifugal' && handleToggleJuiceMethod()}
            activeOpacity={0.7}
          >
            <Cog size={14} color={juiceMethod === 'centrifugal' ? '#FFB74D' : '#484F58'} />
            <Text style={[
              styles.juiceMethodText,
              juiceMethod === 'centrifugal' && styles.juiceMethodTextActive,
            ]}>Centrifugal</Text>
          </TouchableOpacity>
        </View>

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
              />
            ))}
            <AddProducePicker onAdd={handleAddProduce} />

            {hasItems && !isLogged && (
              <TouchableOpacity
                style={styles.findRecipesBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  const ids = (batch.scannedIngredients || []).map((i) => i.produceId)
                  navigation.navigate('ProduceRecipeResults', { selectedProduceIds: ids })
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Find recipes with my produce"
              >
                <BookOpen size={18} color="#64B5F6" />
                <Text style={styles.findRecipesBtnText}>Find Recipes With My Produce</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.summarySection}>
          <NutritionSummary
            batch={batch}
            scannedIngredients={batch.scannedIngredients}
            onUpdateItem={handleUpdateItem}
          />
        </View>

        {/* ── Snap Produce (camera) ─────────────────────────── */}
        {!isSnapDepleted && (
          <View style={styles.buttonSection}>
            <SnapButton onPress={handleSnap} />
            <QuotaMeter navigation={navigation} />
          </View>
        )}

        {/* ── Manual Entry: Search + Ingredient Cloud ─────────── */}
        <View style={manualStyles.manualSection}>
          <Text style={manualStyles.manualLabel}>Or type it in</Text>
          <View style={manualStyles.searchBar}>
            <Search size={16} color="#484F58" />
            <TextInput
              style={manualStyles.searchInput}
              placeholder="Search ingredients..."
              placeholderTextColor="#484F58"
              value={manualSearch}
              onChangeText={setManualSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {manualSearch.length > 0 && (
              <TouchableOpacity onPress={() => setManualSearch('')}>
                <X size={16} color="#484F58" />
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
        {showUpsellNudge && !isPro && (
          <TouchableOpacity
            style={manualStyles.upsellCard}
            onPress={() => {
              setShowUpsellNudge(false)
              navigation.navigate('Vault')
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

        {hasItems && !isLogged && (
          <TouchableOpacity
            style={styles.logButton}
            onPress={handleLogToChallenge}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#4CAF50', '#2E7D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logButtonGradient}
            >
              <CheckCircle size={20} color="#FFFFFF" />
              <Text style={styles.logButtonText}>Log to Today</Text>
            </LinearGradient>
          </TouchableOpacity>
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
          }}
          onAccountRequired={() => setShowAccountGate(true)}
        />

        <AccountGateModal
          visible={showAccountGate}
          onClose={() => setShowAccountGate(false)}
          onAuthenticated={() => setShowAccountGate(false)}
          initialMode="guest"
        />
      </Modal>

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
        onUpgrade={() => navigation.navigate('Vault')}
        onBuyPack={() => navigation.navigate('Vault')}
      />

      <AdvancedBlendModal
        visible={showAdvancedBlendModal}
        stage={advancedBlendStage}
        remaining={advancedBlendRemaining}
        onUpgrade={() => {
          setShowAdvancedBlendModal(false)
          trackEvent('today_usage_row_tapped', {
            row: 'advanced_blend_upgrade',
            plan: isPro ? 'pro' : 'free',
          })
          navigation.navigate('Paywall', { source: 'advanced_blend' })
        }}
        onDismiss={() => setShowAdvancedBlendModal(false)}
        onConfirm={handleAdvancedBlendConfirm}
        onRetry={() => {
          setShowAdvancedBlendModal(false)
          executeLogToChallenge()
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
    color: '#484F58',
  },

  // ── Juice Method Toggle ───────────────────────────────────
  juiceMethodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  juiceMethodBtn: {
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
  juiceMethodBtnActive: {
    backgroundColor: 'rgba(129,199,132,0.08)',
    borderColor: 'rgba(129,199,132,0.2)',
  },
  juiceMethodText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#484F58',
  },
  juiceMethodTextActive: {
    color: '#81C784',
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
    color: '#484F58',
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
  organicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginRight: 6,
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
    marginRight: 8,
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
    color: '#484F58',
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
  logButton: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
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
    color: '#484F58',
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
  manualLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#484F58',
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
    color: '#484F58',
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
    color: '#484F58',
    lineHeight: 16,
    marginBottom: 16,
  },
  searchTipsLastParagraph: {
    fontSize: 11,
    color: '#484F58',
    lineHeight: 16,
  },
})
