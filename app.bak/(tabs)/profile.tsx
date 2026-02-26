// ─────────────────────────────────────────────────────────────
// app/profile.tsx — Profile & Settings screen
// Shows user avatar, stats, preferences, and nuclear reset.
// ─────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  User,
  Settings,
  Shield,
  Leaf,
  ChevronRight,
  Trash2,
  RotateCcw,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useUserProfile, resetAllUserData } from '../../src/services/UserProfileStore'
import { useChallenge } from '../../src/services/ChallengeStore'
import { useStreak } from '../../src/services/StreakEngine'
import { useNutritionScore } from '../../src/services/NutritionScoreStore'
import { useDailyHabit } from '../../src/hooks/useDailyHabit'
import { clearJuiceLog } from '../../lib/storage'
import { clearOnboardingComplete } from '../../lib/onboarding'
import { useActivation } from '../../src/services/ActivationStore'

export default function ProfileScreen() {
  const { profile } = useUserProfile() as { profile: { name?: string, goal?: string } }
  const { resetChallenge } = useChallenge() as { resetChallenge: () => void }
  const streakCtx = useStreak() as { resetStreak: () => void }
  const { resetScore } = useNutritionScore() as { resetScore: () => void }
  const { resetHabit, currentStreak, weeklyCount } = useDailyHabit()
  const { resetActivation } = useActivation() as { resetActivation: () => void }
  const fadeIn = useSharedValue(0)

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
  }, [])

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }))

  const handleNuclearReset = () => {
    Alert.alert(
      'Reset All Data',
      'This will permanently delete all your juicing data, streaks, and preferences. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            try {
              await resetAllUserData()
              resetChallenge()
              streakCtx.resetStreak()
              resetScore()
              await resetHabit()
              await clearJuiceLog()
            } catch (e) {
              console.warn('[ProfileScreen] nuclear reset failed:', e)
            }
          },
        },
      ],
    )
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
          {/* Header / avatar */}
          <View style={styles.header}>
            <View style={styles.avatarCircle}>
              <User size={28} color="#81C784" strokeWidth={1.8} />
            </View>
            <Text style={styles.name}>{profile?.name || 'Juicer'}</Text>
            {profile?.goal ? (
              <Text style={styles.goal}>Goal: {profile.goal}</Text>
            ) : null}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{currentStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{weeklyCount}</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
          </View>

          {/* Settings sections */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <SettingsRow
              icon={<Leaf size={18} color="#81C784" />}
              label="Wellness Goals"
              onPress={() => {}}
            />
            <SettingsRow
              icon={<Settings size={18} color="#64B5F6" />}
              label="Notifications"
              onPress={() => {}}
            />
            <SettingsRow
              icon={<Shield size={18} color="#CE93D8" />}
              label="Privacy"
              onPress={() => {}}
            />
          </View>

          {/* Developer section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer</Text>
            <Pressable
              style={({ pressed }) => [styles.settingsRow, pressed && { opacity: 0.6 }]}
              onPress={async () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                await clearOnboardingComplete()
                resetActivation()
                Alert.alert('Onboarding Reset', 'Restart the app to see onboarding again.')
              }}
            >
              <RotateCcw size={18} color="#64B5F6" />
              <Text style={styles.settingsLabel}>Reset Onboarding</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.dangerRow, pressed && { opacity: 0.6 }]}
              onPress={handleNuclearReset}
            >
              <Trash2 size={18} color="#EF5350" />
              <Text style={styles.dangerText}>Reset All Data</Text>
            </Pressable>
          </View>

          <Text style={styles.version}>Juicing Daily v1.0.0</Text>
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  )
}

function SettingsRow({ icon, label, onPress }: { icon: React.ReactNode, label: string, onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={styles.settingsLabel}>{label}</Text>
      <ChevronRight size={16} color="rgba(240,246,252,0.2)" />
    </TouchableOpacity>
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
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 6,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(129, 199, 132, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129, 199, 132, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F0F6FC',
  },
  goal: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.45)',
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
    marginBottom: 24,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(240, 246, 252, 0.35)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    marginBottom: 6,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#F0F6FC',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(239, 83, 80, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 83, 80, 0.15)',
    padding: 14,
  },
  dangerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF5350',
  },
  version: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.15)',
    textAlign: 'center',
    marginTop: 16,
  },
})
