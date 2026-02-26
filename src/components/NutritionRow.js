import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import colors from '../constants/colors'

export default function NutritionRow({ icon: Icon, label, value, unit, accentColor, rdaPct }) {
  const iconColor = accentColor || colors.primaryLight
  const hasRda = typeof rdaPct === 'number'
  const isHighRda = hasRda && rdaPct >= 20

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.value, accentColor && { color: accentColor }]}>
          {value}
          <Text style={styles.unit}> {unit}</Text>
        </Text>
        {hasRda && (
          <View style={[styles.rdaBadge, isHighRda && styles.rdaBadgeHigh]}>
            <Text style={[styles.rdaText, isHighRda && styles.rdaTextHigh]}>{rdaPct}%</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rdaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(139,148,158,0.12)',
    minWidth: 48,
    alignItems: 'center',
  },
  rdaBadgeHigh: {
    backgroundColor: 'rgba(76,175,80,0.15)',
  },
  rdaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B949E',
  },
  rdaTextHigh: {
    color: '#81C784',
  },
  label: {
    fontSize: 14,
    color: '#8B949E',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#484F58',
  },
})
