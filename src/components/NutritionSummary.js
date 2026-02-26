import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Pressable,
  Animated,
} from 'react-native'
import { Flame, CandyOff, Wheat, Citrus, Eye, ChevronDown, Minus, Plus, Zap, Droplets, Atom, Pill } from 'lucide-react-native'
import colors from '../constants/colors'
import { BRAND } from '../constants/tokens'
import { VEGGIE_FRUIT_TARGET, USDA_RDA } from '../constants/nutrition'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import { useReducedMotion, EASING, DURATION } from '../utils/motion'
import NutritionRow from './NutritionRow'
import { useFormatWeight } from '../utils/weightFormat'

const PRODUCE_OPTIONS = Object.entries(PRODUCE_DATA).map(([id, entry]) => ({
  id,
  name: entry.name,
  category: entry.category,
})).sort((a, b) => a.name.localeCompare(b.name))

function ProduceItemRow({ item, scannedItem, index, onUpdateItem }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isWeightOpen, setIsWeightOpen] = useState(false)
  const { fmtG } = useFormatWeight()
  const [tempWeight, setTempWeight] = useState(String(Math.round(scannedItem.weightG)))

  const handleSelectProduce = useCallback((produceId) => {
    setIsPickerOpen(false)
    onUpdateItem(index, produceId, scannedItem.weightG)
  }, [index, scannedItem.weightG, onUpdateItem])

  const handleWeightChange = useCallback((delta) => {
    const newWeight = Math.max(5, Math.round(scannedItem.weightG + delta))
    setTempWeight(String(newWeight))
    onUpdateItem(index, scannedItem.produceId, newWeight)
  }, [index, scannedItem, onUpdateItem])

  const handleWeightSubmit = useCallback(() => {
    const parsed = parseInt(tempWeight, 10)
    if (!isNaN(parsed) && parsed > 0) {
      onUpdateItem(index, scannedItem.produceId, parsed)
    } else {
      setTempWeight(String(Math.round(scannedItem.weightG)))
    }
    setIsWeightOpen(false)
  }, [tempWeight, index, scannedItem, onUpdateItem])

  const rawFmt = fmtG(item.rawWeightG)
  const juiceFmt = fmtG(item.juiceWeightG)

  return (
    <View style={styles.itemCard}>
      {/* Produce type selector */}
      <TouchableOpacity
        style={styles.itemNameRow}
        onPress={() => setIsPickerOpen(true)}
        activeOpacity={0.6}
      >
        <View style={[
          styles.itemDot,
          item.category === 'fruit' ? styles.itemDotFruit : styles.itemDotVeggie,
        ]} />
        <Text style={styles.itemName}>{item.name}</Text>
        <ChevronDown size={14} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Weight display + adjuster */}
      <View style={styles.weightSection}>
        <TouchableOpacity
          style={styles.weightAdjustBtn}
          onPress={() => handleWeightChange(-25)}
        >
          <Minus size={14} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.weightDisplay}
          onPress={() => { setTempWeight(String(Math.round(scannedItem.weightG))); setIsWeightOpen(true) }}
          activeOpacity={0.6}
        >
          <Text style={styles.weightText}>
            {rawFmt}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.weightAdjustBtn}
          onPress={() => handleWeightChange(25)}
        >
          <Plus size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Juice yield */}
      <Text style={styles.yieldText}>
        Juice: {juiceFmt}
      </Text>

      {/* Produce type picker modal */}
      <Modal visible={isPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIsPickerOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Change Produce Type</Text>
            <FlatList
              data={PRODUCE_OPTIONS}
              keyExtractor={(opt) => opt.id}
              style={styles.pickerList}
              renderItem={({ item: opt }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    opt.id === scannedItem.produceId && styles.pickerOptionActive,
                  ]}
                  onPress={() => handleSelectProduce(opt.id)}
                >
                  <View style={[
                    styles.pickerDot,
                    opt.category === 'fruit' ? styles.itemDotFruit : styles.itemDotVeggie,
                  ]} />
                  <Text style={[
                    styles.pickerOptionText,
                    opt.id === scannedItem.produceId && styles.pickerOptionTextActive,
                  ]}>
                    {opt.name}
                  </Text>
                  <Text style={styles.pickerCategory}>
                    {opt.category}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Weight edit modal */}
      <Modal visible={isWeightOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIsWeightOpen(false)}>
          <Pressable style={styles.weightEditCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Adjust Weight (grams)</Text>
            <TextInput
              style={styles.weightInput}
              value={tempWeight}
              onChangeText={setTempWeight}
              keyboardType="numeric"
              selectTextOnFocus
              autoFocus
              onSubmitEditing={handleWeightSubmit}
            />
            <Text style={styles.weightInputHint}>
              = {fmtG(parseInt(tempWeight, 10) || 0)}
            </Text>
            <TouchableOpacity style={styles.weightSaveBtn} onPress={handleWeightSubmit}>
              <Text style={styles.weightSaveBtnText}>Save</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

// ── Nutrient row config with brand accent colors ────────────

const NUTRIENT_ROWS = [
  { icon: Flame, label: 'Calories', key: 'calories', unit: 'kcal', accent: null },
  { icon: CandyOff, label: 'Sugar', key: 'sugar', unit: 'g', accent: null },
  { icon: Wheat, label: 'Fiber', key: 'fiber', unit: 'g', accent: BRAND.accent.chlorophyll },
  { icon: Citrus, label: 'Vitamin C', key: 'vitaminC', unit: 'mg', accent: BRAND.accent.vitaminC },
  { icon: Eye, label: 'Vitamin A', key: 'vitaminA', unit: 'mcg', accent: BRAND.accent.vitaminA },
  { icon: Zap, label: 'Potassium', key: 'potassium', unit: 'mg', accent: BRAND.accent.potassium },
  { icon: Atom, label: 'Iron', key: 'iron', unit: 'mg', accent: BRAND.accent.iron },
  { icon: Droplets, label: 'Magnesium', key: 'magnesium', unit: 'mg', accent: BRAND.accent.magnesium },
  { icon: Pill, label: 'Folate', key: 'folate', unit: 'mcg', accent: BRAND.accent.folate },
]

export default function NutritionSummary({ batch, scannedIngredients = [], onUpdateItem }) {
  const items = batch.items || batch.ingredients || []
  const { totals, veggieRatio } = batch
  const isEmpty = items.length === 0
  const isRatioHealthy = veggieRatio >= VEGGIE_FRUIT_TARGET
  const isReduced = useReducedMotion()

  // ── Reveal animation state ──
  const cardOpacity = useRef(new Animated.Value(0)).current
  const cardSlide = useRef(new Animated.Value(8)).current
  const rowOpacities = useRef(NUTRIENT_ROWS.map(() => new Animated.Value(0))).current
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!isEmpty && !hasAnimated.current) {
      hasAnimated.current = true

      if (isReduced) {
        cardOpacity.setValue(1)
        cardSlide.setValue(0)
        rowOpacities.forEach((o) => o.setValue(1))
        return
      }

      // Step 1+4: Card rises with liquidFade (250ms)
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 250,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(cardSlide, {
          toValue: 0,
          duration: 250,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Step 3: Nutrient rows stagger in (100ms apart)
        Animated.stagger(
          100,
          rowOpacities.map((opacity) =>
            Animated.timing(opacity, {
              toValue: 1,
              duration: 200,
              easing: EASING.decelerate,
              useNativeDriver: true,
            })
          )
        ).start()
      })
    }

    // Reset when emptied so re-adding triggers animation again
    if (isEmpty) {
      hasAnimated.current = false
      cardOpacity.setValue(0)
      cardSlide.setValue(8)
      rowOpacities.forEach((o) => o.setValue(0))
    }
  }, [isEmpty, isReduced])

  return (
    <Animated.View style={[
      styles.card,
      {
        opacity: isEmpty ? 1 : cardOpacity,
        transform: isEmpty ? [] : [{ translateY: cardSlide }],
      },
    ]}>
      <View style={styles.header}>
        <Text style={styles.title}>Current Batch</Text>
        <View style={[
          styles.badge,
          isEmpty
            ? styles.badgeEmpty
            : isRatioHealthy
              ? styles.badgeHealthy
              : styles.badgeWarning
        ]}>
          <Text style={[
            styles.badgeText,
            isEmpty
              ? styles.badgeTextEmpty
              : isRatioHealthy
                ? styles.badgeTextHealthy
                : styles.badgeTextWarning
          ]}>
            {isEmpty
              ? 'No items'
              : isRatioHealthy
                ? '80/20 ✓'
                : '80/20 ✗'}
          </Text>
        </View>
      </View>

      {isEmpty ? (
        <View style={styles.emptyState}>
          <Citrus size={48} color={colors.border} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No produce yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap "Snap Produce" to scan your first item
          </Text>
        </View>
      ) : (
        <View style={styles.rows}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnHeaderText}>Nutrient</Text>
            <View style={styles.columnHeaderRight}>
              <Text style={styles.columnHeaderText}>Amount</Text>
              <Text style={[styles.columnHeaderText, styles.columnHeaderRda]}>%RDA</Text>
            </View>
          </View>
          {NUTRIENT_ROWS.map((row, i) => {
            const rda = USDA_RDA[row.key]
            const rdaPct = rda > 0 ? Math.round(((totals[row.key] || 0) / rda) * 100) : 0
            return (
              <Animated.View key={row.key} style={{ opacity: rowOpacities[i] }}>
                <NutritionRow
                  icon={row.icon}
                  label={row.label}
                  value={totals[row.key]}
                  unit={row.unit}
                  accentColor={row.accent}
                  rdaPct={rdaPct}
                />
              </Animated.View>
            )
          })}
        </View>
      )}

      {!isEmpty && (
        <View style={styles.footer}>
          <Text style={styles.footerLabel}>
            {items.length} item{items.length !== 1 ? 's' : ''} in batch
          </Text>
          <Text style={styles.footerRatio}>
            Veggie ratio: {Math.round(veggieRatio * 100)}%
          </Text>
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.glass.surfaceElevated,
    borderRadius: 20,
    padding: 20,
    borderWidth: 0.5,
    borderColor: BRAND.glass.border,
    ...BRAND.glass.shadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeEmpty: {
    backgroundColor: '#21262D',
  },
  badgeHealthy: {
    backgroundColor: 'rgba(76,175,80,0.15)',
  },
  badgeWarning: {
    backgroundColor: 'rgba(255,152,0,0.15)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextEmpty: {
    color: '#8B949E',
  },
  badgeTextHealthy: {
    color: '#4CAF50',
  },
  badgeTextWarning: {
    color: '#FF9800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B949E',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#484F58',
    marginTop: 4,
    textAlign: 'center',
  },
  rows: {
    marginBottom: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  columnHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  columnHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  columnHeaderRda: {
    minWidth: 48,
    textAlign: 'center',
  },
  itemsList: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262D',
  },
  itemsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B949E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  itemsHint: {
    fontSize: 11,
    color: '#484F58',
    marginBottom: 10,
  },
  itemCard: {
    backgroundColor: '#0D1117',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  itemDotVeggie: {
    backgroundColor: colors.primary,
  },
  itemDotFruit: {
    backgroundColor: colors.warning,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  weightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  weightAdjustBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#21262D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightDisplay: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#21262D',
    minWidth: 80,
  },
  weightText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  weightLb: {
    fontSize: 11,
    color: '#8B949E',
    fontWeight: '500',
  },
  yieldText: {
    fontSize: 12,
    color: '#8B949E',
    textAlign: 'center',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: 400,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerList: {
    maxHeight: 320,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  pickerOptionActive: {
    backgroundColor: '#21262D',
  },
  pickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  pickerOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#C9D1D9',
  },
  pickerOptionTextActive: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  pickerCategory: {
    fontSize: 11,
    color: '#484F58',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  weightEditCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  weightInput: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
    paddingVertical: 8,
    minWidth: 120,
    marginBottom: 4,
  },
  weightInputHint: {
    fontSize: 13,
    color: '#8B949E',
    marginBottom: 16,
  },
  weightSaveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  weightSaveBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262D',
  },
  footerLabel: {
    fontSize: 12,
    color: '#8B949E',
    fontWeight: '500',
  },
  footerRatio: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
})
