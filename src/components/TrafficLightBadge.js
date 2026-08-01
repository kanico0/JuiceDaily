// ─────────────────────────────────────────────────────────────
// TrafficLightBadge.js — Green/Orange/Red scoring indicator
// Green:  Organic + Cold-pressed + Low-sugar
// Orange: Conventional (Clean 15) or Centrifugal-made
// Red:    High-sugar or Dirty Dozen conventional
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { getTrafficLight } from '../constants/educationContent'

export default function TrafficLightBadge({ produceId, isOrganic, juiceMethod }) {
  const light = useMemo(
    () => getTrafficLight(produceId, { isOrganic, juiceMethod }),
    [produceId, isOrganic, juiceMethod],
  )

  const a11yLabel = light.reason
    ? `${light.label} — ${light.reason === 'high-sugar' ? 'high sugar content' : 'conventional dirty dozen produce'}`
    : light.label

  return (
    <View
      style={[styles.badge, { backgroundColor: `${light.hex}18`, borderColor: `${light.hex}40` }]}
      accessibilityLabel={a11yLabel}
      accessibilityRole="text"
    >
      <View style={[styles.dot, { backgroundColor: light.hex }]} />
      <Text style={[styles.label, { color: light.hex }]}>{light.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})
