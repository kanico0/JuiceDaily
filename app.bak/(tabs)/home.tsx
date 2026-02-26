// ─────────────────────────────────────────────────────────────
// app/(tabs)/home.tsx — Habit-first daily dashboard
// Greeting, streak, ScanCTA with pulse highlight, secondary cards.
// If arriving from onboarding with ?highlight=scan, the scan
// button pulses 2-3 times then stops.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Flame, Leaf, HelpCircle } from 'lucide-react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useUserProfile } from '../../src/services/UserProfileStore'
import { useDailyHabit } from '../../src/hooks/useDailyHabit'
import { ScanCTA } from '../../components/dashboard/ScanCTA'
import { SecondaryCards } from '../../components/dashboard/SecondaryCards'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

export default function HomeScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ highlight?: string }>()
  const { profile } = useUserProfile() as { profile: { name?: string } }
  const { currentStreak, weeklyCount, hasLoggedToday } = useDailyHabit()

  const fadeIn = useSharedValue(0)

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
  }, [])

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }))

  const greeting = useMemo(() => {
    const base = getGreeting()
    const name = profile?.name || 'there'
    return `${base}, ${name}`
  }, [profile?.name])

  const weekSummary = useMemo(() => {
    if (weeklyCount === 0) return 'No juices logged this week'
    if (weeklyCount === 1) return '1 juice logged this week'
    return `${weeklyCount} juices logged this week`
  }, [weeklyCount])

  const handleScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    router.push('/scan')
  }

  const handleLog = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/log')
  }

  const handleHowItWorks = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/onboarding?mode=preview')
  }

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
            <Text style={styles.greeting}>{greeting} 🌿</Text>
            <View style={styles.streakRow}>
              <Flame size={18} color="#FFB74D" strokeWidth={2.5} />
              <Text style={styles.streakText}>
                {currentStreak > 0 ? `Day ${currentStreak} Streak` : 'Start your streak!'}
              </Text>
            </View>
            <Text style={styles.weekSummary}>{weekSummary}</Text>
          </View>

          {/* Primary CTA */}
          <ScanCTA
            highlight={params.highlight === 'scan'}
            onPress={handleScan}
          />

          {/* Secondary Cards */}
          <SecondaryCards
            hasLoggedToday={hasLoggedToday}
            onLogPress={handleLog}
          />

          {/* See how it works */}
          <Pressable
            onPress={handleHowItWorks}
            hitSlop={12}
            style={({ pressed }) => [
              styles.howItWorksRow,
              pressed && { opacity: 0.5 },
            ]}
            accessibilityRole="link"
            accessibilityLabel="See how it works"
          >
            <HelpCircle size={14} color="rgba(240, 246, 252, 0.4)" strokeWidth={2} />
            <Text style={styles.howItWorksText}>See how it works</Text>
          </Pressable>

          {/* Footer */}
          <View style={styles.footer}>
            <Leaf size={14} color="rgba(129, 199, 132, 0.4)" />
            <Text style={styles.footerText}>
              One juice at a time. You've got this.
            </Text>
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
    marginBottom: 28,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F0F6FC',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFB74D',
  },
  weekSummary: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.45)',
    marginTop: 4,
  },
  howItWorksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 4,
  },
  howItWorksText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(240, 246, 252, 0.4)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.25)',
  },
})
