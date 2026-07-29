import React from 'react'
import {
  View,
  Text,
  StyleSheet,
} from 'react-native'
import { Droplets as DropIcon, TrendingUp, Flame, AlertCircle } from 'lucide-react-native'
import { SEMANTIC_COLORS, SEMANTIC_TYPOGRAPHY, FONT_WEIGHT } from '../constants/tokens'
import { card, sectionHeading } from '../constants/styleRecipes'

export default function TodaySummaryStats({ todayCount, todayScore, streakCount, suggestion }) {
  return (
    <>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Today</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <DropIcon size={16} color={SEMANTIC_COLORS.accentSecondary} />
            <Text style={styles.summaryValue}>{todayCount}</Text>
            <Text style={styles.summaryLabel}>juices</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <TrendingUp size={16} color={SEMANTIC_COLORS.success} />
            <Text style={styles.summaryValue}>{todayScore}</Text>
            <Text style={styles.summaryLabel}>score</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Flame size={16} color={SEMANTIC_COLORS.warning} />
            <Text style={styles.summaryValue}>{streakCount}d</Text>
            <Text style={styles.summaryLabel}>streak</Text>
          </View>
        </View>
      </View>

      {suggestion ? (
        <View style={styles.suggestionRow}>
          <AlertCircle size={14} color={SEMANTIC_COLORS.textMuted} />
          <Text style={styles.suggestionText}>{suggestion}</Text>
        </View>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  summaryCard: {
    ...card,
    width: '100%',
    marginBottom: 10,
  },
  summaryTitle: {
    ...sectionHeading,
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
    fontSize: SEMANTIC_TYPOGRAPHY.numericEmphasis.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.numericEmphasis.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
  },
  summaryLabel: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.textMuted,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: SEMANTIC_COLORS.borderSubtle,
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
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.textMuted,
    fontStyle: 'italic',
  },
})
