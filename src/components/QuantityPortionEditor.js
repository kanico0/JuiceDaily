import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native'
import * as Haptics from 'expo-haptics'
import {
  isQuantitySupported,
  getSupportedPortionUnits,
  getDefaultPortionUnit,
  getSupportedSizes,
  estimateRawWeightGrams,
  formatQuantityDescription,
  GRAMS_PER_OZ,
} from '../services/producePortionConversion'
import { PRODUCE_DATA } from '../services/JuiceEngine'

const G_PER_OZ = GRAMS_PER_OZ

function formatOz(grams) {
  return `${(grams / G_PER_OZ).toFixed(1)} oz`
}

export default function QuantityPortionEditor({
  produceId,
  quantity,
  unitKey,
  sizeKey,
  onQuantityChange,
  onUnitChange,
  onSizeChange,
  onEstimatedWeightChange,
  confidence = 'high',
  wasOverridden = false,
  onOverrideWeight,
}) {
  const [localQuantity, setLocalQuantity] = useState(String(quantity || ''))
  const [validationError, setValidationError] = useState('')
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [adjustText, setAdjustText] = useState('')

  const supported = isQuantitySupported(produceId)
  const units = useMemo(() => getSupportedPortionUnits(produceId), [produceId])
  const currentUnit = useMemo(
    () => units.find((u) => u.unitKey === unitKey) || units[0] || null,
    [units, unitKey],
  )

  const hasMultipleSizes = useMemo(() => {
    if (!currentUnit) return false
    return currentUnit.sizes.some((s) => s.sizeKey !== 'standard')
  }, [currentUnit])

  const sizes = useMemo(
    () => (currentUnit ? getSupportedSizes(produceId, currentUnit.unitKey) : []),
    [produceId, currentUnit],
  )

  // Recompute estimate when inputs change
  useEffect(() => {
    if (!supported || !currentUnit) return
    const qty = parseFloat(localQuantity)
    if (!qty || qty <= 0 || isNaN(qty)) {
      setValidationError('Enter a quantity greater than zero')
      return
    }

    const input = {
      produceId,
      quantity: qty,
      unitKey: currentUnit.unitKey,
      sizeKey: hasMultipleSizes ? sizeKey : undefined,
    }

    const result = estimateRawWeightGrams(input)
    if (!result.ok) {
      setValidationError(result.message)
      return
    }

    setValidationError('')
    onEstimatedWeightChange(result.estimatedRawWeightG)
  }, [localQuantity, currentUnit, sizeKey, hasMultipleSizes, supported, produceId])

  const handleQuantitySubmit = useCallback(() => {
    const qty = parseFloat(localQuantity)
    if (!qty || qty <= 0 || isNaN(qty)) {
      setValidationError('Enter a quantity greater than zero')
      return
    }
    onQuantityChange(qty)
  }, [localQuantity, onQuantityChange])

  const handleUnitSelect = useCallback((newUnitKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onUnitChange(newUnitKey)
    // Reset size when unit changes
    const newUnit = units.find((u) => u.unitKey === newUnitKey)
    if (newUnit) {
      const newHasSML = newUnit.sizes.some((s) => s.sizeKey !== 'standard')
      if (newHasSML) {
        const defaultSize = newUnit.sizes.find((s) => s.sizeKey === 'medium') || newUnit.sizes[0]
        onSizeChange(defaultSize?.sizeKey || null)
      } else {
        onSizeChange(null)
      }
    }
  }, [units, onUnitChange, onSizeChange])

  const handleSizeSelect = useCallback((newSizeKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSizeChange(newSizeKey)
  }, [onSizeChange])

  const handleOverrideWeight = useCallback((deltaG) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onOverrideWeight(deltaG)
  }, [onOverrideWeight])

  const handleToggleAdjust = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true)
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setIsAdjustOpen((prev) => {
      if (!prev && estimateResult?.ok) {
        setAdjustText((estimateResult.estimatedRawWeightG / G_PER_OZ).toFixed(1))
      }
      return !prev
    })
  }, [estimateResult])

  const handleAdjustSubmit = useCallback(() => {
    const oz = parseFloat(adjustText)
    if (isNaN(oz) || oz <= 0) {
      setValidationError('Enter a weight greater than zero')
      return
    }
    const targetG = oz * G_PER_OZ
    const currentG = estimateResult?.ok ? estimateResult.estimatedRawWeightG : 0
    const deltaG = targetG - currentG
    if (Math.abs(deltaG) >= 0.5) {
      onOverrideWeight(deltaG)
    }
  }, [adjustText, estimateResult, onOverrideWeight])

  const handleResetToEstimate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (estimateResult?.ok) {
      const currentG = estimateResult.estimatedRawWeightG
      const overriddenG = currentG
      const originalEstimateG = currentG
      onOverrideWeight(-overriddenG + originalEstimateG)
      setAdjustText((originalEstimateG / G_PER_OZ).toFixed(1))
    }
  }, [estimateResult, onOverrideWeight])

  if (!supported) {
    return (
      <View style={styles.container}>
        <Text style={styles.unavailableText}>
          Quantity estimates are not available for this ingredient yet. Enter its raw weight instead.
        </Text>
      </View>
    )
  }

  if (!currentUnit) return null

  const produceName = PRODUCE_DATA[produceId]?.name || produceId
  const isSingular = parseFloat(localQuantity) === 1
  const unitLabel = isSingular ? currentUnit.displaySingular : currentUnit.displayPlural
  const keyboardType = currentUnit.allowDecimal ? 'decimal-pad' : 'number-pad'

  // Compute current estimate for display
  const qty = parseFloat(localQuantity)
  const input = {
    produceId,
    quantity: qty || 0,
    unitKey: currentUnit.unitKey,
    sizeKey: hasMultipleSizes ? sizeKey : undefined,
  }
  const estimateResult = qty > 0 && !isNaN(qty) ? estimateRawWeightGrams(input) : null
  const estimateOz = estimateResult?.ok ? formatOz(estimateResult.estimatedRawWeightG) : '—'

  return (
    <View style={styles.container}>
      {/* Quantity input + unit selector */}
      <View style={styles.quantityRow}>
        <TextInput
          style={styles.quantityInput}
          value={localQuantity}
          onChangeText={setLocalQuantity}
          onEndEditing={handleQuantitySubmit}
          keyboardType={keyboardType}
          placeholder="0"
          placeholderTextColor="#484F58"
          accessibilityLabel={`Quantity of ${produceName}`}
          accessibilityHint={`Enter the number of ${unitLabel}`}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        />
        <View style={styles.unitSelector} accessibilityRole="list" accessibilityLabel={`Unit for ${produceName}`}>
          {units.map((u) => {
            const isActive = u.unitKey === currentUnit.unitKey
            const color = '#81C784'
            return (
              <TouchableOpacity
                key={u.unitKey}
                style={[
                  styles.unitOption,
                  isActive && { borderColor: color, backgroundColor: `${color}15` },
                ]}
                onPress={() => handleUnitSelect(u.unitKey)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                accessibilityLabel={`Unit: ${u.displayPlural}`}
                hitSlop={{ top: 4, bottom: 4 }}
              >
                <Text style={[styles.unitOptionText, isActive && { color }]}>
                  {isSingular ? u.displaySingular : u.displayPlural}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Size selector — vertical full-width rows */}
      {hasMultipleSizes && (
        <View style={styles.sizeContainer} accessibilityRole="list" accessibilityLabel={`Size selector for ${produceName}`}>
          <Text style={styles.sizeLabel}>Size</Text>
          {sizes.map((s) => {
            const isActive = s.sizeKey === sizeKey
            const color = '#81C784'
            return (
              <TouchableOpacity
                key={s.sizeKey}
                style={[
                  styles.sizeRowItem,
                  isActive && { borderColor: color, backgroundColor: `${color}15` },
                ]}
                onPress={() => handleSizeSelect(s.sizeKey)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                accessibilityLabel={`Size: ${s.displaySize}${isActive ? ', selected' : ''}`}
              >
                <Text style={[styles.sizeRowItemText, isActive && { color, fontWeight: '700' }]}>
                  {s.displaySize}
                </Text>
                {isActive && <Text style={styles.sizeCheck}>✓</Text>}
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Estimated weight display */}
      <View style={styles.estimateRow} accessibilityLiveRegion="polite">
        <Text style={styles.estimateLabel}>
          {wasOverridden ? 'Adjusted raw weight:' : 'Estimated raw produce weight:'}
        </Text>
        <Text style={styles.estimateValue}>{estimateOz}</Text>
      </View>

      {/* Quantity context above adjust editor */}
      {qty > 0 && !isNaN(qty) && currentUnit && (
        <Text style={styles.quantityContext}>
          Quantity: {localQuantity} {isSingular ? currentUnit.displaySingular : currentUnit.displayPlural}
          {hasMultipleSizes && sizeKey ? ` (${sizes.find((s) => s.sizeKey === sizeKey)?.displaySize || ''})` : ''}
        </Text>
      )}

      {/* Adjust raw weight button */}
      <TouchableOpacity
        onPress={handleToggleAdjust}
        style={styles.adjustBtn}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Adjust raw produce weight"
      >
        <Text style={styles.adjustBtnText}>
          {wasOverridden ? 'Adjusted raw weight' : 'Adjust raw weight'}
        </Text>
        <Text style={styles.adjustBtnArrow}>{isAdjustOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Inline raw weight editor */}
      {isAdjustOpen && (
        <View style={styles.adjustEditor} accessibilityLabel="Raw produce weight editor">
          <Text style={styles.adjustEditorLabel}>Raw produce weight (oz)</Text>
          <View style={styles.adjustInputRow}>
            <TextInput
              style={styles.adjustInput}
              value={adjustText}
              onChangeText={setAdjustText}
              onEndEditing={handleAdjustSubmit}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor="#484F58"
              accessibilityLabel="Raw produce weight in ounces"
              accessibilityHint="Changing this weight updates the estimated calories and nutrition"
            />
            <TouchableOpacity
              onPress={handleAdjustSubmit}
              style={styles.adjustApplyBtn}
              accessibilityRole="button"
              accessibilityLabel="Apply adjusted raw weight"
            >
              <Text style={styles.adjustApplyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.adjustHelperText}>
            Changing this weight updates the estimated calories and nutrition. It does not change the quantity, unit, or produce size you selected.
          </Text>
          {wasOverridden && (
            <TouchableOpacity
              onPress={handleResetToEstimate}
              style={styles.resetBtn}
              accessibilityRole="button"
              accessibilityLabel="Reset to estimated raw weight"
            >
              <Text style={styles.resetBtnText}>Reset to estimate</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Helper text */}
      <Text style={styles.helperText}>
        {confidence === 'medium'
          ? 'Average portion estimate. Size can vary; adjust the raw weight if needed.'
          : 'Estimated from average produce size. Actual weight may vary.'}
      </Text>

      {/* Validation error */}
      {validationError ? (
        <Text style={styles.errorText} accessibilityLiveRegion="assertive">
          {validationError}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 4,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityInput: {
    width: 56,
    height: 36,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: '#C9D1D9',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  unitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  unitOption: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    minHeight: 36,
    justifyContent: 'center',
  },
  unitOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B949E',
  },
  sizeContainer: {
    flexDirection: 'column',
    gap: 6,
  },
  sizeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B949E',
    marginBottom: 2,
  },
  sizeRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    minHeight: 44,
    width: '100%',
  },
  sizeRowItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B949E',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  sizeCheck: {
    fontSize: 14,
    fontWeight: '700',
    color: '#81C784',
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  estimateLabel: {
    fontSize: 11,
    color: '#8B949E',
  },
  estimateValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C9D1D9',
  },
  quantityContext: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B949E',
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    minHeight: 40,
  },
  adjustBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C9D1D9',
  },
  adjustBtnArrow: {
    fontSize: 10,
    color: '#8B949E',
  },
  adjustEditor: {
    flexDirection: 'column',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  adjustEditorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C9D1D9',
  },
  adjustInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: '#C9D1D9',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  adjustApplyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(129,199,132,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.3)',
  },
  adjustApplyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#81C784',
  },
  adjustHelperText: {
    fontSize: 11,
    color: '#484F58',
    lineHeight: 16,
  },
  resetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignSelf: 'flex-start',
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B949E',
  },
  helperText: {
    fontSize: 11,
    color: '#484F58',
    lineHeight: 16,
  },
  errorText: {
    fontSize: 11,
    color: '#F85149',
    lineHeight: 16,
  },
  unavailableText: {
    fontSize: 11,
    color: '#8B949E',
    lineHeight: 16,
    paddingLeft: 16,
  },
})
