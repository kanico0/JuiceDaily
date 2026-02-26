// ─────────────────────────────────────────────────────────────
// app/log.tsx — Juice history / log screen
// Shows past juice entries from lib/storage.ts.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { BookOpen, Droplets } from 'lucide-react-native'
import { useFocusEffect } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useDailyHabit } from '../../src/hooks/useDailyHabit'
import { getJuiceLogEntries } from '../../lib/storage'
import type { JuiceLogEntry } from '../../lib/storage'

export default function LogScreen() {
  const { weeklyCount, currentStreak } = useDailyHabit()
  const [entries, setEntries] = useState<JuiceLogEntry[]>([])
  const fadeIn = useSharedValue(0)

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
  }, [])

  // Reload entries when screen gains focus
  useFocusEffect(
    useCallback(() => {
      getJuiceLogEntries().then(setEntries)
    }, [])
  )

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }))

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0D1117', '#131B26', '#0D1117']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.ScrollView
          style={[styles.scroll, fadeStyle]}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <BookOpen size={20} color="#CE93D8" strokeWidth={2} />
            <Text style={styles.headerTitle}>Juice Log</Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{entries.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{weeklyCount}</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{currentStreak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
          </View>

          {/* Log entries */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {entries.length > 0 ? (
              entries.slice(0, 20).map((entry, i) => (
                <View key={entry.id || i} style={styles.logEntry}>
                  <Droplets size={16} color="#81C784" strokeWidth={2} />
                  <View style={styles.logEntryContent}>
                    <Text style={styles.logEntryTitle}>
                      {entry.ingredients.map(ing => ing.name).join(', ')}
                    </Text>
                    <Text style={styles.logEntryDetail}>
                      {entry.nutrients.join(' · ')}
                    </Text>
                    <Text style={styles.logEntryTime}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Droplets size={32} color="rgba(240,246,252,0.1)" strokeWidth={1.5} />
                <Text style={styles.emptyText}>No juices logged yet</Text>
                <Text style={styles.emptySubtext}>
                  Head to the Home tab and tap Scan Produce
                </Text>
              </View>
            )}
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F0F6FC',
    letterSpacing: -0.3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F0F6FC',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(240, 246, 252, 0.4)',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(240, 246, 252, 0.6)',
    marginBottom: 4,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
  },
  logEntryContent: {
    flex: 1,
    gap: 2,
  },
  logEntryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F0F6FC',
  },
  logEntryDetail: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.45)',
  },
  logEntryTime: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.25)',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(240, 246, 252, 0.4)',
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.25)',
    textAlign: 'center',
  },
})
