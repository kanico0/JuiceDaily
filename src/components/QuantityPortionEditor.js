import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import {
  isQuantitySupported,
  getSupportedCountUnits,
  getSupportedSizes,
  estimateRawWeightGrams,
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
}) {
  const [localQuantity, setLocalQuantity] = useState(String(quantity || ''))
  const [validationError, setValidationError] = useState('')

  const supported = isQuantitySupported(produceId)
  const units = useMemo(() => getSupportedCountUnits(produceId), [produceId])
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
          placeholderTextColor="#90A4AE"
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

      {/* Read-only estimated weight display */}
      <View style={styles.estimateRow} accessibilityLiveRegion="polite">
        <Text style={styles.estimateLabel}>
          Estimated raw produce weight: {estimateOz}
        </Text>
      </View>

      {/* Helper text */}
      <Text style={styles.helperText}>
        To change this estimate, adjust the quantity, unit, or size. To enter a specific volume, switch to Volume.
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
  helperText: {
    fontSize: 11,
    color: '#90A4AE',
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
