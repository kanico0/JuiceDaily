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
  Search,
  Crown,
  Sparkles,
  Leaf,
} from 'lucide-react-native'
import colors from '../constants/colors'
import NUTRIENT_LIBRARY from '../constants/NutrientLibrary.json'
import { EMPTY_BATCH, USDA_RDA } from '../constants/nutrition'
import SnapButton from '../components/SnapButton'
import { useQuota } from '../services/quota/QuotaStore'
import { selectQuotaLabel, selectQuotaExhausted, getQuotaDisplay, formatCanonicalQuotaLabel } from '../services/subscriptions/subscriptionSelectors'
import { useIsFocused } from '@react-navigation/native'
import NutritionSummary from '../components/NutritionSummary'
import BigSqueezeModal from '../components/BigSqueezeModal'
import ScanQuotaReachedModal from '../components/ScanQuotaReachedModal'
import AccountGateModal from '../components/AccountGateModal'
import TrafficLightBadge from '../components/TrafficLightBadge'
import CameraScreen from './CameraScreen'
import { useSubscription } from '../services/subscriptions/SubscriptionStore'
import { trackEvent } from '../services/AnalyticsService'
import ScanPlanModal from '../components/ScanPlanModal'
import MeshGradientBg from '../components/MeshGradientBg'
import { processJuiceBatch, PRODUCE_DATA } from '../services/JuiceEngine'

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

function ProduceEditRow({ item, index, onReplace, onRemove, onWeightChange, onToggleOrganic, juiceMethod }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const { fmtG } = useFormatWeight()
  const entry = PRODUCE_DATA[item.produceId]
  const allPillars = classifyProduceAllPillars(item.produceId)
  const pillar = allPillars[0] || null
  const pillarData = pillar ? DAILY_PILLARS[pillar] : null
  const isOrganic = item.isOrganic ?? false

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
        <Text style={styles.editName} numberOfLines={1} ellipsizeMode="tail">{entry?.name || item.produceId}</Text>
        <ChevronDown size={14} color="#484F58" />
      </TouchableOpacity>

      {/* Row 2: Controls */}
      <View style={styles.editControlsRow}>
        <TrafficLightBadge produceId={item.produceId} isOrganic={isOrganic} juiceMethod={juiceMethod} />
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onToggleOrganic(index)
          }}
          style={[styles.organicBtn, isOrganic && styles.organicBtnActive]}
        >
          <Leaf size={12} color={isOrganic ? '#81C784' : '#484F58'} />
        </TouchableOpacity>

        <View style={styles.editWeightRow}>
          <TouchableOpacity
            onPress={() => onWeightChange(index, Math.max(10, item.weightG - 25))}
            style={styles.editWeightBtn}
          >
            <Minus size={12} color="#8B949E" />
          </TouchableOpacity>
          <View style={styles.editWeightLabels}>
            <Text style={styles.editWeightText}>{fmtG(item.weightG)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onWeightChange(index, item.weightG + 25)}
            style={styles.editWeightBtn}
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
        >
          <X size={14} color="#E91E63" />
        </TouchableOpacity>
      </View>

      {/* Produce picker modal */}
      <Modal visible={isPickerOpen} transparent animationType="fade">
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

      <Modal visible={isOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
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

function IngredientCloud({ searchQuery, onAdd, addedIds, onResultsLayout }) {
  const filtered = searchQuery.length > 0
    ? SORTED_NUTRIENT_LIBRARY.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : SORTED_NUTRIENT_LIBRARY

  return (
    <View style={manualStyles.cloudWrap}>
      <View style={manualStyles.cloudGrid} onLayout={onResultsLayout}>
        {filtered.map((item) => {
          const isAdded = addedIds.includes(item.id)
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
              ]}>{item.name}</Text>
              {isAdded && <Text style={manualStyles.bubbleCheck}>✓</Text>}
            </TouchableOpacity>
          )
        })}
      </View>
      {filtered.length === 0 && searchQuery.length > 0 && (
        <Text style={manualStyles.noMatchStatus}>
          No matching ingredient found.
        </Text>
      )}
      <View style={manualStyles.tipsWrap}>
        <Text style={manualStyles.tipsHeading}>Ingredient Entry Tips</Text>
        <Text style={manualStyles.tipsPara}>
          Start typing the name of the fruit or vegetable you want to add.
        </Text>
        <Text style={manualStyles.tipsPara}>
          You can enter a full ingredient name or begin with only the first few letters.
        </Text>
        <Text style={manualStyles.tipsPara}>
          For example, typing 'carr' should help you find carrot.
        </Text>
        <Text style={manualStyles.tipsPara}>
          If too many results appear, continue typing to narrow the list.
        </Text>
        <Text style={manualStyles.tipsPara}>
          If no ingredient matches, check the spelling or try a shorter, more general name.
        </Text>
        <Text style={manualStyles.tipsPara}>
          You can also try a familiar ingredient such as spinach, carrot, cucumber, apple, celery, or kale.
        </Text>
      </View>
    </View>
  )
}

// ── Scan Quota Meter ─────────────────────────────────────────
// Server-authoritative usage display under the Snap button.
// Hidden when Supabase quota is not configured (rollback-safe).

function QuotaMeter({ navigation }) {
  const { quota, loading: quotaLoading } = useQuota()
  const { isPro } = useSubscription()
  const quotaDisplay = getQuotaDisplay(quota, isPro, quotaLoading)

  if (quotaDisplay.loading) {
    return (
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Text style={{ color: '#6E7681', fontSize: 12 }}>Loading Juice Snap allowance…</Text>
      </View>
    )
  }

  if (quotaDisplay.error || quotaDisplay.effectiveRemaining == null) {
    return (
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Text style={{ color: '#6E7681', fontSize: 12 }}>Allowance temporarily unavailable</Text>
      </View>
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
      return { produceId: item, weightG: 150, isOrganic: getDefaultOrganic(organicMode) }
    }
    return {
      produceId: item.produceId,
      weightG: item.weightG || 150,
      isOrganic: typeof item.isOrganic === 'boolean' ? item.isOrganic : getDefaultOrganic(organicMode),
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
  const { isPro } = useSubscription()
  const { quota, loading: quotaLoading, refresh: refreshQuota } = useQuota()
  const quotaDisplay = getQuotaDisplay(quota, isPro, quotaLoading)
  const isScreenFocused = useIsFocused()
  const [showSnapGate, setShowSnapGate] = useState(false)
  const [showAccountGate, setShowAccountGate] = useState(false)
  const [showScanPlan, setShowScanPlan] = useState(false)
  const [isManualMode, setIsManualMode] = useState(route?.params?.manualEntry === true)
  const [manualSearch, setManualSearch] = useState('')
  const [showUpsellNudge, setShowUpsellNudge] = useState(false)
  const [juiceMethod, setJuiceMethod] = useState('centrifugal')
  const manualSearchOffsetRef = useRef(0)
  const scrollRef = useRef(null)
  const manualSearchFocusedRef = useRef(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (e) => {
      const kbHeight = e.endCoordinates.height
      setKeyboardHeight(kbHeight)
      if (manualSearchFocusedRef.current) {
        const targetY = Math.max(0, manualSearchOffsetRef.current - kbHeight * 0.65)
        scrollRef.current?.scrollTo({
          y: targetY,
          animated: true,
        })
      }
    })
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0)
      manualSearchFocusedRef.current = false
    })
    return () => {
      showListener.remove()
      hideListener.remove()
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

  // Refresh quota when screen regains focus (after camera, settings, paywall, etc.)
  useEffect(() => {
    if (isScreenFocused) refreshQuota().catch(() => {})
  }, [isScreenFocused, refreshQuota])

  const hasItems = (batch.scannedIngredients || []).length > 0
  const isQuotaExhausted = quotaDisplay.effectiveRemaining != null && quotaDisplay.effectiveRemaining <= 0
  const canUseAuthoritativeQuota = quotaDisplay.effectiveRemaining != null

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
      setIsCameraOpen(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveManualMode = isManualMode

  const handleSnap = useCallback(() => {
    if (canUseAuthoritativeQuota && isQuotaExhausted) {
      setShowSnapGate(true)
      return
    }
    setIsCameraOpen(true)
    setIsLogged(false)
  }, [canUseAuthoritativeQuota, isQuotaExhausted])

  // Manual entry: add from NutrientLibrary (no credit consumed)
  const handleManualAdd = useCallback((item) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(
      300,
      LayoutAnimation.Types.spring,
      LayoutAnimation.Properties.opacity
    ))
    const weightG = item.weightG || 150
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients, { produceId: item.id, weightG, isOrganic: getDefaultOrganic(organicMode) }]
      // Show upsell nudge at 7+ manual ingredients
      if (updated.length >= 7 && !isPro) {
        setShowUpsellNudge(true)
      }
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [isPro])

  const handleManualSearchFocus = useCallback(() => {
    manualSearchFocusedRef.current = true
    const effectiveKbHeight = keyboardHeight || 0
    const targetY = Math.max(0, manualSearchOffsetRef.current - effectiveKbHeight * 0.65)
    scrollRef.current?.scrollTo({
      y: targetY,
      animated: true,
    })
  }, [keyboardHeight])

  const handleManualSearchBlur = useCallback(() => {
    manualSearchFocusedRef.current = false
  }, [])

  const handleResultsLayout = useCallback(() => {
    if (!manualSearchFocusedRef.current || keyboardHeight === 0) return
    requestAnimationFrame(() => {
      if (!manualSearchFocusedRef.current) return
      const targetY = Math.max(0, manualSearchOffsetRef.current - keyboardHeight * 0.65)
      scrollRef.current?.scrollTo({
        y: targetY,
        animated: true,
      })
    })
  }, [keyboardHeight])

  const handleManualSearchSubmit = useCallback(() => {
    const normalizedQuery = manualSearch.trim().toLowerCase()
    if (!normalizedQuery) return

    const existingIds = batch.scannedIngredients.map((item) => item.produceId)
    const matchingIngredient = SORTED_NUTRIENT_LIBRARY.find((item) => {
      return !existingIds.includes(item.id) && item.name.toLowerCase().includes(normalizedQuery)
    })
    if (!matchingIngredient) return

    handleManualAdd(matchingIngredient)
    setManualSearch('')
  }, [batch.scannedIngredients, handleManualAdd, manualSearch])

  const handleCameraClose = useCallback(() => {
    setIsCameraOpen(false)
    refreshQuota().catch(() => {})
  }, [refreshQuota])

  const handleCameraHeaderPress = useCallback(() => {
    const plan = quotaDisplay.isPro ? 'pro' : (quota?.plan || 'free')
    const used = quotaDisplay.effectiveUsed ?? 0
    const limit = quotaDisplay.displayLimit ?? (isPro ? 60 : 5)
    const exhausted = isQuotaExhausted
    trackEvent('scan_plan_icon_tapped', {
      plan,
      scans_used: used,
      scans_limit: limit,
      quota_exhausted: exhausted,
      placement: 'camera_header_icon',
    }).catch(() => {})

    if (exhausted) {
      setShowSnapGate(true)
      return
    }

    setShowScanPlan(true)
    refreshQuota().catch(() => {})
  }, [isPro, quota, quotaDisplay, isQuotaExhausted, refreshQuota])

  const handleScanPlanUpgrade = useCallback(() => {
    setShowScanPlan(false)
    navigation.navigate('Paywall', { source: 'camera_header_icon' })
  }, [navigation])

  const handleScanPlanManage = useCallback(() => {
    setShowScanPlan(false)
    navigation.navigate('Settings')
  }, [navigation])

  const handleScanPlanContinue = useCallback(() => {
    setShowScanPlan(false)
  }, [])

  const handleQuotaManualEntry = useCallback(() => {
    setShowSnapGate(false)
    setIsManualMode(true)
  }, [])

  const handleQuotaUpgrade = useCallback(() => {
    setShowSnapGate(false)
    navigation.navigate('Paywall', { source: 'scan_quota_exhausted' })
  }, [navigation])

  const handleProduceIdentified = useCallback((visionResult) => {
    console.log('[SCAN] handleProduceIdentified —', visionResult.scannedIngredients.length, 'items')
    setBatch(buildBatch(visionResult.scannedIngredients, juiceMethod))
    setIsCameraOpen(false)
    setIsLogged(false)
  }, [juiceMethod])

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
      updated[index] = { ...updated[index], produceId: newProduceId }
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

  const handleAddProduce = useCallback((produceId) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(
      300,
      LayoutAnimation.Types.spring,
      LayoutAnimation.Properties.opacity
    ))
    setBatch((prev) => {
      const updated = [...prev.scannedIngredients, { produceId, weightG: 150, isOrganic: getDefaultOrganic(organicMode) }]
      return buildBatch(updated, juiceMethod)
    })
    setIsLogged(false)
  }, [])

  const handleLogToChallenge = useCallback(() => {
    if (!hasItems) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    const ingredients = batch?.scannedIngredients || []
    const totals = batch?.totals || {}

    logJuice(ingredients, batch)

    // Record to Nutrition Score system
    const ingredientIds = ingredients
      .map((i) => i?.produceId)
      .filter((id) => typeof id === 'string' && id.length > 0)
    const prevMomentum = typeof preMomentum === 'number' ? preMomentum : 0
    recordNutritionLog(ingredientIds, totals)

    // Create a JuiceLogEntry for the Today log
    const logSource = effectiveManualMode ? 'manual' : 'photo'
    addLogEntry({
      source: logSource,
      ingredientIds: ingredientIds,
      nutrientSummary: totals,
    })
    recordMeaningfulActivity().catch(() => {})

    setIsLogged(true)

    // Navigate to ScanSuccess with session metrics (replaces BigSqueeze celebration)
    const nutrientKeys = Object.keys(totals).filter(
      (k) => (Number(totals[k]) || 0) > 0
    )
    navigation.navigate('ScanSuccess', {
      ingredientCount: ingredientIds.length,
      nutrientsFound: nutrientKeys.length,
      previousMomentum: prevMomentum,
      ingredientNames: ingredientIds,
    })
  }, [hasItems, batch, logJuice, recordNutritionLog, preMomentum, navigation])

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
        <TouchableOpacity
          style={styles.filmRoll}
          onPress={handleCameraHeaderPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={(() => {
            if (quotaDisplay.loading) return 'Juice Snap plan loading.'
            if (quotaDisplay.error || quotaDisplay.effectiveRemaining == null) return 'Juice Snap plan unavailable. Double tap to view plan details.'
            const canonical = formatCanonicalQuotaLabel(quotaDisplay)
            const planName = isPro ? 'RawLifeFlow Pro' : 'Juice Snap plan'
            return `${planName}. ${canonical}. Double tap to view plan details.`
          })()}
          accessibilityHint="Shows your current scan allowance and RawLifeFlow Pro options."
          accessibilityState={{ busy: quotaDisplay.loading }}
          hitSlop={4}
        >
          {quotaDisplay.loading ? (
            <>
              <Camera size={14} color={colors.white} />
              <Text style={styles.quotaBadgeText}>…</Text>
            </>
          ) : quotaDisplay.error || quotaDisplay.effectiveRemaining == null ? (
            <>
              <Camera size={14} color={colors.white} />
              <Text style={styles.quotaBadgeText}>Plan</Text>
            </>
          ) : (
            <>
              <Camera size={12} color={isPro ? '#FFD54F' : '#64B5F6'} />
              <Text style={[styles.quotaBadgeText, { color: isPro ? '#FFD54F' : '#64B5F6' }]}>
                {quotaDisplay.effectiveRemaining}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        enabled
      >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
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

        {/* Editable produce list */}
        {hasItems && (
          <View style={styles.editCard}>
            <View style={styles.editCardHeader}>
              <Text style={styles.editCardTitle}>Identified Produce</Text>
              <View style={styles.organicLegend}>
                <Leaf size={10} color="#81C784" />
                <Text style={styles.organicLegendText}>= organic</Text>
              </View>
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
                juiceMethod={juiceMethod}
              />
            ))}
            <AddProducePicker onAdd={handleAddProduce} />
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
        <View style={styles.buttonSection}>
          <SnapButton onPress={handleSnap} />
          <QuotaMeter navigation={navigation} />
        </View>

        {/* ── Manual Entry: Search + Ingredient Cloud ─────────── */}
        <View
          style={manualStyles.manualSection}
          onLayout={(event) => {
            manualSearchOffsetRef.current = event.nativeEvent.layout.y
          }}
        >
          <Text style={manualStyles.manualLabel}>Or type it in</Text>
          <View style={manualStyles.searchBar}>
            <Search size={16} color="#484F58" />
            <TextInput
              style={manualStyles.searchInput}
              placeholder="Search ingredients..."
              placeholderTextColor="#484F58"
              value={manualSearch}
              onChangeText={setManualSearch}
              onFocus={handleManualSearchFocus}
              onBlur={handleManualSearchBlur}
              onSubmitEditing={handleManualSearchSubmit}
              returnKeyType="done"
              blurOnSubmit={false}
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
            onResultsLayout={handleResultsLayout}
          />
        </View>

        {/* ── Pro Upsell Nudge (7+ manual ingredients) ────────── */}
        {showUpsellNudge && !isPro && (
          <TouchableOpacity
            style={manualStyles.upsellCard}
            onPress={() => {
              setShowUpsellNudge(false)
              navigation.navigate('Paywall', { source: 'manual_entry_upsell' })
            }}
            activeOpacity={0.8}
          >
            <View style={manualStyles.upsellIcon}>
              <Sparkles size={18} color="#FFD54F" />
            </View>
            <View style={manualStyles.upsellContent}>
              <Text style={manualStyles.upsellTitle}>That's a lot of typing!</Text>
              <Text style={manualStyles.upsellDesc}>
                RawLifeFlow Pro members just snap a photo and let the AI do the heavy lifting.
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
      </KeyboardAvoidingView>

      <Modal
        visible={isCameraOpen}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <CameraScreen
          onClose={handleCameraClose}
          onProduceIdentified={handleProduceIdentified}
          onManualEntry={() => {
            setIsCameraOpen(false)
            setIsManualMode(true)
          }}
          onAccountRequired={() => setShowAccountGate(true)}
          onQuotaUpgrade={() => navigation.navigate('Paywall', { source: 'scan_quota_exhausted' })}
          onViewScanUsage={() => setIsCameraOpen(false)}
        />

        <AccountGateModal
          visible={showAccountGate}
          onClose={() => setShowAccountGate(false)}
          onAuthenticated={() => {
            setShowAccountGate(false)
            refreshQuota().catch(() => {})
          }}
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

      <ScanPlanModal
        visible={showScanPlan}
        quota={quota}
        isPro={isPro}
        onUpgrade={handleScanPlanUpgrade}
        onContinue={handleScanPlanContinue}
        onManage={handleScanPlanManage}
        onDismiss={handleScanPlanContinue}
      />

      <ScanQuotaReachedModal
        visible={showSnapGate}
        quota={quota}
        isOpeningPaywall={false}
        onUpgrade={handleQuotaUpgrade}
        onManualEntry={handleQuotaManualEntry}
        onViewUsage={handleQuotaManualEntry}
        onDismiss={() => setShowSnapGate(false)}
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
    minWidth: 44,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(100,181,246,0.06)',
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.12)',
  },
  quotaBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
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
  organicLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  organicLegendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#81C784',
  },
  editRow: {
    flexDirection: 'column',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
    gap: 6,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  organicBtnActive: {
    backgroundColor: 'rgba(129,199,132,0.12)',
    borderColor: 'rgba(129,199,132,0.25)',
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
  noMatchStatus: {
    fontSize: 14,
    color: '#484F58',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  tipsWrap: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  tipsHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#484F58',
    textAlign: 'center',
    marginBottom: 14,
  },
  tipsPara: {
    fontSize: 14,
    color: '#484F58',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
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
})
