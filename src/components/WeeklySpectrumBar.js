// ─────────────────────────────────────────────────────────────
// WeeklySpectrumBar.js — 7-Day Rainbow Diversity tracker
// 6 phytonutrient color segments that fill over the week
// Feels like a "Long-Term Trophy" vs the daily rings "To-Do"
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { WEEKLY_COLORS } from '../services/ChallengeStore'

const COLOR_ORDER = ['red', 'orange', 'yellow', 'green', 'purple', 'white']

export default function WeeklySpectrumBar({ weeklyDiversity }) {
  const filledCount = COLOR_ORDER.filter((c) => weeklyDiversity[c]).length
  const allFilled = filledCount === 6

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly Spectrum</Text>
        <Text style={styles.counter}>
          {filledCount}
          <Text style={styles.counterMax}>/6</Text>
        </Text>
      </View>

      <View style={styles.bar}>
        {COLOR_ORDER.map((colorKey, i) => {
          const data = WEEKLY_COLORS[colorKey]
          const isFilled = !!weeklyDiversity[colorKey]
          return (
            <BarSegment
              key={colorKey}
              color={data.color}
              label={data.label}
              isFilled={isFilled}
              index={i}
              isFirst={i === 0}
              isLast={i === COLOR_ORDER.length - 1}
            />
          )
        })}
      </View>

      {/* Labels under bar */}
      <View style={styles.labels}>
        {COLOR_ORDER.map((colorKey) => {
          const data = WEEKLY_COLORS[colorKey]
          const isFilled = !!weeklyDiversity[colorKey]
          return (
            <Text
              key={colorKey}
              style={[
                styles.label,
                isFilled && { color: data.color, fontWeight: '700' },
              ]}
            >
              {data.label}
            </Text>
          )
        })}
      </View>

      {allFilled && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🌈 Rainbow Master</Text>
        </View>
      )}

      {!allFilled && filledCount > 0 && (
        <Text style={styles.hint}>
          {6 - filledCount} color{6 - filledCount > 1 ? 's' : ''} to go — juice intentionally!
        </Text>
      )}
    </View>
  )
}

function BarSegment({ color, isFilled, index, isFirst, isLast }) {
  const fillAnim = useRef(new Animated.Value(isFilled ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: isFilled ? 1 : 0,
      duration: 500,
      delay: isFilled ? index * 80 : 0,
      useNativeDriver: false,
    }).start()
  }, [isFilled, index])

  const bgColor = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#161B22', color],
  })

  return (
    <Animated.View
      style={[
        styles.segment,
        {
          backgroundColor: bgColor,
          borderTopLeftRadius: isFirst ? 6 : 0,
          borderBottomLeftRadius: isFirst ? 6 : 0,
          borderTopRightRadius: isLast ? 6 : 0,
          borderBottomRightRadius: isLast ? 6 : 0,
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(22,27,34,0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  counter: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  counterMax: {
    fontSize: 13,
    fontWeight: '600',
    color: '#484F58',
  },
  bar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 2,
  },
  segment: {
    flex: 1,
    height: '100%',
  },
  labels: {
    flexDirection: 'row',
    marginTop: 6,
  },
  label: {
    flex: 1,
    fontSize: 9,
    fontWeight: '600',
    color: '#484F58',
    textAlign: 'center',
  },
  badge: {
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(156,39,176,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(156,39,176,0.2)',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#CE93D8',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 11,
    color: '#484F58',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
})
