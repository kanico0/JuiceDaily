// ─────────────────────────────────────────────────────────────
// JuiceCalculatorScreen.js — Nutrient goal calculator
// Select nutrients + targets → get produce recommendations.
// Gated behind ff_juice_calculator feature flag.
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Switch,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft,
  Calculator,
  Search,
  X,
  ChevronRight,
  Check,
  Beaker,
  Leaf,
  Save,
  Zap,
} from 'lucide-react-native'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import { useTemplates } from '../services/TemplateStore'
import {
  NUTRIENT_CATALOG,
  NUTRIENT_MAP,
  TARGET_PRESETS,
  runCalculator,
  cacheCalculatorRun,
  gramsToOz,
} from '../services/JuiceCalculatorEngine'

const MAX_NUTRIENTS = 5

// ── Timeframe Toggle ─────────────────────────────────────────

function TimeframeToggle({ value, onChange }) {
  return (
    <View style={tfStyles.row}>
      {['day', 'week'].map((tf) => (
        <TouchableOpacity
          key={tf}
          style={[tfStyles.btn, value === tf && tfStyles.btnActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onChange(tf)
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: value === tf }}
          accessibilityLabel={`Per ${tf}`}
        >
          <Text style={[tfStyles.btnText, value === tf && tfStyles.btnTextActive]}>
            Per {tf === 'day' ? 'Day' : 'Week'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const tfStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.xl,
    padding: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: 'rgba(129,199,132,0.15)',
  },
  btnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
  },
  btnTextActive: {
    color: '#81C784',
  },
})

// ── Nutrient Picker Row ──────────────────────────────────────

function NutrientPickerRow({ nutrient, isSelected, onToggle }) {
  return (
    <TouchableOpacity
      style={[npStyles.row, isSelected && npStyles.rowSelected]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onToggle(nutrient.id)
      }}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${nutrient.label} (${nutrient.unit})`}
    >
      <View style={[npStyles.check, isSelected && npStyles.checkActive]}>
        {isSelected && <Check size={12} color="#FFFFFF" />}
      </View>
      <Text style={npStyles.label}>{nutrient.label}</Text>
      <Text style={npStyles.unit}>{nutrient.unit}</Text>
      {nutrient.dv && (
        <Text style={npStyles.dv}>DV: {nutrient.dv}</Text>
      )}
    </TouchableOpacity>
  )
}

const npStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  rowSelected: {
    backgroundColor: 'rgba(129,199,132,0.06)',
    borderColor: 'rgba(129,199,132,0.15)',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkActive: {
    backgroundColor: '#81C784',
    borderColor: '#81C784',
  },
  label: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
  },
  unit: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    minWidth: 30,
  },
  dv: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
  },
})

// ── Target Input Row ─────────────────────────────────────────

function TargetInputRow({ nutrientId, target, timeframe, onChange }) {
  const meta = NUTRIENT_MAP[nutrientId]
  if (!meta) return null

  const dvLabel = meta.dv
    ? (timeframe === 'week' ? meta.dv * 7 : meta.dv)
    : null

  return (
    <View style={tiStyles.wrap}>
      <View style={tiStyles.header}>
        <Text style={tiStyles.label}>{meta.label}</Text>
        <Text style={tiStyles.unit}>{meta.unit}</Text>
      </View>

      <View style={tiStyles.inputRow}>
        <TextInput
          style={tiStyles.input}
          value={String(target || '')}
          onChangeText={(txt) => {
            const num = parseFloat(txt) || 0
            onChange(nutrientId, num)
          }}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#484F58"
          accessibilityLabel={`${meta.label} target in ${meta.unit}`}
        />

        {meta.dv && (
          <View style={tiStyles.presets}>
            {Object.entries(TARGET_PRESETS).map(([key, mult]) => {
              const val = Math.round(dvLabel * mult)
              const isActive = target === val
              return (
                <TouchableOpacity
                  key={key}
                  style={[tiStyles.presetBtn, isActive && tiStyles.presetBtnActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onChange(nutrientId, val)
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${key} preset: ${val} ${meta.unit}`}
                >
                  <Text style={[tiStyles.presetText, isActive && tiStyles.presetTextActive]}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </View>

      {dvLabel && (
        <Text style={tiStyles.dvHint}>
          Recommended daily value: {meta.dv} {meta.unit}
        </Text>
      )}
    </View>
  )
}

const tiStyles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  unit: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
    textAlign: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  presets: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(129,199,132,0.12)',
    borderColor: 'rgba(129,199,132,0.25)',
  },
  presetText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textSecondary,
  },
  presetTextActive: {
    color: '#81C784',
  },
  dvHint: {
    fontSize: FONT_SIZE.xs,
    color: DARK.textMuted,
    marginTop: 8,
  },
})

// ── Coverage Bar ─────────────────────────────────────────────

function CoverageBar({ nutrientId, target, achieved, pct, isReduced }) {
  const meta = NUTRIENT_MAP[nutrientId]
  const widthAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isReduced) {
      widthAnim.setValue(pct)
    } else {
      Animated.timing(widthAnim, {
        toValue: pct,
        duration: DURATION.standard,
        easing: EASING.decelerate,
        useNativeDriver: false,
      }).start()
    }
  }, [pct, isReduced])

  const barColor = pct >= 90 ? '#81C784' : pct >= 50 ? '#FFB74D' : '#E57373'

  return (
    <View
      style={cbStyles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      accessibilityLabel={`${meta?.label || nutrientId}: ${Math.round(pct)}% of target`}
    >
      <View style={cbStyles.header}>
        <Text style={cbStyles.label}>{meta?.label || nutrientId}</Text>
        <Text style={cbStyles.values}>
          {Math.round(achieved)} / {Math.round(target)} {meta?.unit || ''}
        </Text>
        <Text style={[cbStyles.pct, { color: barColor }]}>{Math.round(pct)}%</Text>
      </View>
      <View style={cbStyles.track}>
        <Animated.View
          style={[
            cbStyles.fill,
            {
              backgroundColor: barColor,
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>
    </View>
  )
}

const cbStyles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
  },
  values: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
    marginRight: 8,
  },
  pct: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    minWidth: 40,
    textAlign: 'right',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
})

// ── Result Card ──────────────────────────────────────────────

function ResultCard({ result, index, isReduced, onSaveTemplate }) {
  const isMulti = result.resultType === 'multi'
  const items = isMulti ? result.items : [result]
  const coverage = isMulti ? result.coverage : result.coverage
  const avgCov = isMulti ? result.avgCoverage : result.avgCoverage

  return (
    <View style={rcStyles.card}>
      <View style={rcStyles.header}>
        <View style={rcStyles.badge}>
          <Text style={rcStyles.badgeText}>
            {index === 0 ? '🏆 Best Match' : `#${index + 1}`}
          </Text>
        </View>
        <Text style={rcStyles.type}>
          {isMulti ? 'Mix' : 'Single'} • {Math.round(avgCov)}% coverage
        </Text>
      </View>

      {items.map((item, i) => (
        <View key={`${item.produceId}-${i}`} style={rcStyles.itemRow}>
          <View style={[rcStyles.catDot, { backgroundColor: item.category === 'fruit' ? '#FFB74D' : '#81C784' }]} />
          <Text style={rcStyles.itemName}>{item.produceName}</Text>
          <View style={rcStyles.itemAmounts}>
            <Text style={rcStyles.itemGrams}>{item.rawGrams}g</Text>
            <Text style={rcStyles.itemOz}>≈ {item.juiceOz} oz</Text>
          </View>
        </View>
      ))}

      {isMulti && (
        <Text style={rcStyles.totalOz}>
          Total: {result.totalJuiceOz} oz juice
        </Text>
      )}

      <View style={rcStyles.coverageSection}>
        <Text style={rcStyles.coverageTitle}>Nutrient Coverage</Text>
        {coverage.map((c) => (
          <CoverageBar
            key={c.nutrientId}
            nutrientId={c.nutrientId}
            target={c.target}
            achieved={c.achieved}
            pct={c.pct}
            isReduced={isReduced}
          />
        ))}
      </View>

      {result.explanation && (
        <Text style={rcStyles.explanation}>{result.explanation}</Text>
      )}

      <View style={rcStyles.actions}>
        {onSaveTemplate && (
          <TouchableOpacity
            style={rcStyles.actionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onSaveTemplate(items)
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Save as juice template"
          >
            <Save size={14} color="#64B5F6" />
            <Text style={rcStyles.actionText}>Save Template</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const rcStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: 'rgba(129,199,132,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: '#81C784',
  },
  type: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemName: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
  },
  itemAmounts: {
    alignItems: 'flex-end',
  },
  itemGrams: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  itemOz: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
  },
  totalOz: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: '#64B5F6',
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 4,
  },
  coverageSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  coverageTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  explanation: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(100,181,246,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.15)',
  },
  actionText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#64B5F6',
  },
})

// ── Main Screen ──────────────────────────────────────────────

export default function JuiceCalculatorScreen({ navigation }) {
  const isReduced = useReducedMotion()
  const { saveTemplate } = useTemplates()
  const fadeAnim = useRef(new Animated.Value(0)).current

  // State
  const [phase, setPhase] = useState('setup') // 'setup' | 'results'
  const [timeframe, setTimeframe] = useState('day')
  const [selectedNutrients, setSelectedNutrients] = useState([])
  const [targets, setTargets] = useState({})
  const [allowMulti, setAllowMulti] = useState(true)
  const [maxJuiceOz, setMaxJuiceOz] = useState(24)
  const [excludeSearch, setExcludeSearch] = useState('')
  const [excludeIds, setExcludeIds] = useState([])
  const [nutrientSearch, setNutrientSearch] = useState('')
  const [results, setResults] = useState(null)

  useEffect(() => {
    trackEvent('juice_calculator_opened', { source: 'navigation' })
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: isReduced ? DURATION.crossfade : DURATION.enter,
      easing: EASING.decelerate,
      useNativeDriver: true,
    }).start()
  }, [])

  const filteredNutrients = useMemo(() => {
    if (!nutrientSearch.trim()) return NUTRIENT_CATALOG
    const q = nutrientSearch.toLowerCase()
    return NUTRIENT_CATALOG.filter((n) => n.label.toLowerCase().includes(q))
  }, [nutrientSearch])

  const toggleNutrient = useCallback((id) => {
    setSelectedNutrients((prev) => {
      if (prev.includes(id)) return prev.filter((n) => n !== id)
      if (prev.length >= MAX_NUTRIENTS) return prev
      // Auto-set DV as default target
      const meta = NUTRIENT_MAP[id]
      if (meta?.dv && !targets[id]) {
        const dvTarget = timeframe === 'week' ? meta.dv * 7 : meta.dv
        setTargets((t) => ({ ...t, [id]: dvTarget }))
      }
      trackEvent('nutrient_goal_selected', { nutrient_id: id, timeframe })
      return [...prev, id]
    })
  }, [targets, timeframe])

  const updateTarget = useCallback((id, value) => {
    setTargets((prev) => ({ ...prev, [id]: value }))
  }, [])

  const handleCalculate = useCallback(() => {
    if (selectedNutrients.length === 0) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    const inputs = {
      selectedNutrients: selectedNutrients.map((id) => ({
        nutrientId: id,
        target: targets[id] || 0,
      })),
      timeframe,
      allowMulti,
      excludeIds,
      maxJuiceOz,
    }

    const calcResults = runCalculator(inputs)
    setResults(calcResults)
    setPhase('results')

    trackEvent('calculator_run', {
      timeframe,
      nutrients_count: selectedNutrients.length,
      allow_multi_produce: allowMulti,
      max_volume_oz: maxJuiceOz,
    })

    cacheCalculatorRun(inputs, calcResults)
  }, [selectedNutrients, targets, timeframe, allowMulti, excludeIds, maxJuiceOz])

  const handleSaveTemplate = useCallback((items) => {
    const ingredients = items.map((item) => ({
      produceId: item.produceId,
      weightG: item.rawGrams,
      isOrganic: false,
    }))

    const name = `Calc: ${items.map((i) => i.produceName).join(' + ')}`
    saveTemplate(name, ingredients, 'cold_pressed')

    trackEvent('calculator_result_applied_to_plan', {
      result_type: items.length > 1 ? 'multi' : 'single',
      items_count: items.length,
      action_enum: 'save_template',
    })

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [saveTemplate])

  const handleBackToSetup = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPhase('setup')
  }, [])

  // Track result viewed
  useEffect(() => {
    if (phase === 'results' && results) {
      const bestResult = results.multiResults?.[0] || results.singleResults?.[0]
      if (bestResult) {
        trackEvent('calculator_result_viewed', {
          result_type: bestResult.resultType,
          items_count: bestResult.items?.length || 1,
          coverage_pct_avg: bestResult.avgCoverage,
        })
      }
    }
  }, [phase, results])

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              if (phase === 'results') {
                handleBackToSetup()
              } else {
                navigation.goBack()
              }
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={phase === 'results' ? 'Back to setup' : 'Go back'}
          >
            <ArrowLeft size={20} color={DARK.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Calculator size={18} color="#81C784" />
            <Text style={styles.headerTitle}>Juice Calculator</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {phase === 'setup' ? (
            <>
              {/* Timeframe */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Timeframe</Text>
                <TimeframeToggle value={timeframe} onChange={setTimeframe} />
              </View>

              {/* Nutrient Picker */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Select Nutrients ({selectedNutrients.length}/{MAX_NUTRIENTS})
                </Text>
                <View style={styles.searchRow}>
                  <Search size={14} color="#484F58" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search nutrients..."
                    placeholderTextColor="#484F58"
                    value={nutrientSearch}
                    onChangeText={setNutrientSearch}
                    accessibilityLabel="Search nutrients"
                  />
                  {nutrientSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setNutrientSearch('')}>
                      <X size={14} color="#8B949E" />
                    </TouchableOpacity>
                  )}
                </View>
                {filteredNutrients.map((n) => (
                  <NutrientPickerRow
                    key={n.id}
                    nutrient={n}
                    isSelected={selectedNutrients.includes(n.id)}
                    onToggle={toggleNutrient}
                  />
                ))}
              </View>

              {/* Targets */}
              {selectedNutrients.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Set Targets</Text>
                  {selectedNutrients.map((id) => (
                    <TargetInputRow
                      key={id}
                      nutrientId={id}
                      target={targets[id] || 0}
                      timeframe={timeframe}
                      onChange={updateTarget}
                    />
                  ))}
                </View>
              )}

              {/* Preferences */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferences</Text>

                <View style={styles.prefRow}>
                  <View style={styles.prefLabel}>
                    <Beaker size={14} color={DARK.textSecondary} />
                    <Text style={styles.prefText}>Allow produce combos</Text>
                  </View>
                  <Switch
                    value={allowMulti}
                    onValueChange={setAllowMulti}
                    trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(129,199,132,0.3)' }}
                    thumbColor={allowMulti ? '#81C784' : '#484F58'}
                    accessibilityLabel="Allow multi-produce combinations"
                  />
                </View>

                <View style={styles.prefRow}>
                  <View style={styles.prefLabel}>
                    <Zap size={14} color={DARK.textSecondary} />
                    <Text style={styles.prefText}>Max juice volume (oz)</Text>
                  </View>
                  <TextInput
                    style={styles.prefInput}
                    value={String(maxJuiceOz)}
                    onChangeText={(txt) => {
                      const num = parseInt(txt, 10)
                      if (!isNaN(num) && num > 0 && num <= 64) setMaxJuiceOz(num)
                    }}
                    keyboardType="numeric"
                    accessibilityLabel="Maximum juice volume in ounces"
                  />
                </View>
              </View>

              {/* Calculate Button */}
              <TouchableOpacity
                style={[styles.calcBtn, selectedNutrients.length === 0 && { opacity: 0.4 }]}
                onPress={handleCalculate}
                disabled={selectedNutrients.length === 0}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Calculate best produce matches"
              >
                <LinearGradient
                  colors={['#4CAF50', '#2E7D32']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.calcBtnGradient}
                >
                  <Calculator size={18} color="#FFFFFF" />
                  <Text style={styles.calcBtnText}>Calculate</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Results Phase */}
              {results?.warnings?.length > 0 && (
                <View style={styles.warningsSection}>
                  {results.warnings.map((w, i) => (
                    <Text key={i} style={styles.warningText}>⚠️ {w}</Text>
                  ))}
                </View>
              )}

              {/* Multi-produce results */}
              {results?.multiResults?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Best Mixes ({results.multiResults.length})
                  </Text>
                  {results.multiResults.map((r, i) => (
                    <ResultCard
                      key={i}
                      result={r}
                      index={i}
                      isReduced={isReduced}
                      onSaveTemplate={handleSaveTemplate}
                    />
                  ))}
                </View>
              )}

              {/* Single-produce results */}
              {results?.singleResults?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Top Single Produce ({results.singleResults.length})
                  </Text>
                  {results.singleResults.map((r, i) => (
                    <ResultCard
                      key={r.produceId}
                      result={r}
                      index={i}
                      isReduced={isReduced}
                      onSaveTemplate={handleSaveTemplate}
                    />
                  ))}
                </View>
              )}

              {/* Recalculate */}
              <TouchableOpacity
                style={styles.recalcBtn}
                onPress={handleBackToSetup}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Adjust targets and recalculate"
              >
                <Text style={styles.recalcText}>← Adjust & Recalculate</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  container: {
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: DARK.textPrimary,
    padding: 0,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  prefLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prefText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textPrimary,
  },
  prefInput: {
    width: 56,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
    textAlign: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  calcBtn: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    marginTop: 8,
  },
  calcBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
  },
  calcBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.heavy,
    color: '#FFFFFF',
  },
  warningsSection: {
    backgroundColor: 'rgba(255,183,77,0.06)',
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,183,77,0.15)',
  },
  warningText: {
    fontSize: FONT_SIZE.sm,
    color: '#FFB74D',
    lineHeight: 18,
    marginBottom: 4,
  },
  recalcBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  recalcText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#64B5F6',
  },
})
