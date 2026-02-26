// ─────────────────────────────────────────────────────────────
// SecondaryCards.tsx — Dashboard secondary action cards
// "Today's Nutrients" and "Juice Log" side-by-side cards.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Droplets, BookOpen, ChevronRight } from 'lucide-react-native'

interface SecondaryCardsProps {
  hasLoggedToday: boolean
  onLogPress: () => void
}

export function SecondaryCards({ hasLoggedToday, onLogPress }: SecondaryCardsProps) {
  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
        onPress={() => {}}
        accessibilityRole="button"
        accessibilityLabel="Today's Nutrients"
      >
        <Droplets size={22} color="#64B5F6" strokeWidth={2} />
        <Text style={styles.title}>Today's Nutrients</Text>
        <Text style={styles.subtext}>
          {hasLoggedToday ? 'View your intake' : 'Scan to see results'}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
        onPress={onLogPress}
        accessibilityRole="button"
        accessibilityLabel="Juice Log"
      >
        <BookOpen size={22} color="#CE93D8" strokeWidth={2} />
        <Text style={styles.title}>Juice Log</Text>
        <Text style={styles.subtext}>View your history</Text>
        <View style={styles.chevron} pointerEvents="none">
          <ChevronRight size={14} color="rgba(240,246,252,0.3)" />
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F0F6FC',
  },
  subtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.4)',
  },
  chevron: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
})
