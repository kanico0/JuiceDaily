import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'

const MODES = [
  { key: 'weight', label: 'Weight (oz)' },
  { key: 'quantity', label: 'Quantity' },
]

export default function PortionEntryModeToggle({
  mode,
  onModeChange,
  quantityDisabled = false,
  quantityDisabledReason = '',
  accessibilityLabelPrefix = 'Portion entry mode',
}) {
  return (
    <View style={styles.container}>
      <View
        style={styles.segmentRow}
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabelPrefix}
      >
        {MODES.map((m) => {
          const isActive = mode === m.key
          const isDisabled = m.key === 'quantity' && quantityDisabled
          const color = '#81C784'

          return (
            <TouchableOpacity
              key={m.key}
              style={[
                styles.segment,
                isActive && !isDisabled && { borderColor: color, backgroundColor: `${color}15` },
                isDisabled && styles.segmentDisabled,
              ]}
              onPress={() => {
                if (isDisabled || isActive) return
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onModeChange(m.key)
              }}
              activeOpacity={0.7}
              disabled={isDisabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive, disabled: isDisabled }}
              accessibilityLabel={`${accessibilityLabelPrefix}: ${m.label}`}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  isActive && !isDisabled && { color },
                  isDisabled && styles.segmentLabelDisabled,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      {quantityDisabled && quantityDisabledReason ? (
        <Text
          style={styles.disabledReason}
          accessibilityLiveRegion="polite"
        >
          {quantityDisabledReason}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 6,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    minHeight: 44,
    justifyContent: 'center',
  },
  segmentDisabled: {
    opacity: 0.35,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B949E',
  },
  segmentLabelDisabled: {
    color: '#90A4AE',
  },
  disabledReason: {
    fontSize: 11,
    color: '#8B949E',
    lineHeight: 16,
  },
})
