import React from 'react'
import {
  View,
  Text,
  StyleSheet,
} from 'react-native'
import { Droplets as DropIcon, TrendingUp, Flame, AlertCircle } from 'lucide-react-native'
import { DARK, FONT_SIZE, FONT_WEIGHT } from '../constants/tokens'

export default function TodaySummaryStats({ todayCount, todayScore, streakCount, suggestion }) {
  return (
    <>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Today</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <DropIcon size={16} color="#64B5F6" />
            <Text style={styles.summaryValue}>{todayCount}</Text>
            <Text style={styles.summaryLabel}>juices</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <TrendingUp size={16} color="#81C784" />
            <Text style={styles.summaryValue}>{todayScore}</Text>
            <Text style={styles.summaryLabel}>score</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Flame size={16} color="#FFB74D" />
            <Text style={styles.summaryValue}>{streakCount}d</Text>
            <Text style={styles.summaryLabel}>streak</Text>
          </View>
        </View>
      </View>

      {suggestion ? (
        <View style={styles.suggestionRow}>
          <AlertCircle size={14} color={DARK.textMuted} />
          <Text style={styles.suggestionText}>{suggestion}</Text>
        </View>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  summaryCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    fontStyle: 'italic',
  },
})
