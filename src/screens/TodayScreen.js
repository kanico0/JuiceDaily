// ─────────────────────────────────────────────────────────────
// TodayScreen.js — Minimal, focused post-log / pre-log view
// Post-log: Today Hero Card → Journey Progress → Optional Explore
// Pre-log:  Scan prompt → yesterday summary
// Progressive reveal: Halo (≥3 logs), Weekly (≥5), Optimize (≥7)
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  Camera,
  Settings,
  Droplets,
  Compass,
  Target,
  ChevronRight,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import NutrientHaloCard from '../components/NutrientHaloCard'
import WeeklyPillarView from '../components/WeeklyPillarView'
import QuickLogger from '../components/QuickLogger'
import RewardSplash from '../components/RewardSplash'
import { useChallenge, DAILY_PILLARS } from '../services/ChallengeStore'
import { useFlags } from '../services/FeatureFlags'
import { useStreak } from '../services/StreakEngine'
import { useActivation } from '../services/ActivationStore'
import { useUserProfile } from '../services/UserProfileStore'
import { getGreeting } from '../constants/motivationData'
import { DARK, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'

// ── Supportive messages (calm, encouraging, not urgent) ──────

const POST_LOG_MESSAGES = [
  'Nice work — your body will thank you.',
  'Another great juice in the books.',
  'Keep going, one juice at a time.',
  'You showed up today. That matters.',
  'Nutrients absorbed. Day well spent.',
]

function getSupportiveMessage() {
  return POST_LOG_MESSAGES[Math.floor(Math.random() * POST_LOG_MESSAGES.length)]
}

// ── Top nutrient highlights from today's juices ──────────────

function getTopNutrients(todayLog) {
  if (!todayLog.juices || todayLog.juices.length === 0) return []
  const pillars = new Set()
  todayLog.juices.forEach((j) => {
    ;(j.pillars || j.colors || []).forEach((p) => pillars.add(p))
  })
  return Array.from(pillars).slice(0, 3)
}

// ── Produce names from today's juices ────────────────────────

function getProduceList(todayLog) {
  if (!todayLog.juices || todayLog.juices.length === 0) return []
  const names = []
  todayLog.juices.forEach((j) => {
    ;(j.ingredients || []).forEach((ing) => {
      const name = ing.name || ing.produceId || ''
      if (name && !names.includes(name)) names.push(name)
    })
  })
  return names.slice(0, 6)
}

export default function TodayScreen({ navigation }) {
  const isReduced = useReducedMotion()
  const { isEnabled } = useFlags()
  const { challenge, logJuice, todayLog, vitalityScore } = useChallenge()
  const streakCtx = useStreak()
  const { profile } = useUserProfile()
  const { unlocks, activation, recordLog } = useActivation()
  const [showQuickLogger, setShowQuickLogger] = useState(false)
  const [showRewardSplash, setShowRewardSplash] = useState(false)

  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (isReduced) { fadeAnim.setValue(1) } else {
      Animated.timing(fadeAnim, { toValue: 1, duration: DURATION.enter, easing: EASING.decelerate, useNativeDriver: true }).start()
    }
  }, [])

  const greeting = useMemo(() => {
    const base = getGreeting()
    return profile.name ? `${base}, ${profile.name}` : base
  }, [profile.name])

  const supportiveMsg = useMemo(() => getSupportiveMessage(), [todayLog.juices.length])

  const handleScan = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    // Open ScanFlow modal (root-level) with camera auto-open
    navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { openCamera: true } })
  }, [navigation])

  const handleQuickLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    if (isEnabled('ff_3step_logger')) {
      setShowQuickLogger(true)
    } else {
      navigation.navigate('ScanFlow')
    }
  }, [navigation, isEnabled])

  const handleQuickLogComplete = useCallback((scannedIngredients, batchResult) => {
    logJuice(scannedIngredients, batchResult)
    recordLog()
    if (isEnabled('ff_reward_splash')) setShowRewardSplash(true)
  }, [logJuice, recordLog, isEnabled])

  const hasLoggedToday = todayLog.juices.length > 0
  const totalLogs = unlocks.totalLogsCount
  const topNutrients = useMemo(() => getTopNutrients(todayLog), [todayLog])
  const produceList = useMemo(() => getProduceList(todayLog), [todayLog])

  // Progressive unlock checks (log-count based + feature flag)
  const showHalo = unlocks.nutrientHalo && isEnabled('ff_nutrient_halo_progress')
  const showWeeklyPillar = unlocks.weeklyPillar && isEnabled('ff_weekly_pillar_view')

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Droplets size={18} color="#81C784" strokeWidth={2.5} />
              <Text style={styles.headerTitle}>Today</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Settings size={16} color="#484F58" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ═══ POST-LOG STATE ═══════════════════════════════ */}
            {hasLoggedToday && (
              <>
                {/* SECTION 1 — Today Hero Card */}
                <View style={styles.heroCard}>
                  <LinearGradient
                    colors={['#1B3A2D', '#0F2419', '#0D1117']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroGradient}
                  >
                    <Text style={styles.heroTitle}>Today's Juice</Text>

                    {/* Produce used */}
                    {produceList.length > 0 && (
                      <Text style={styles.heroProduceList}>
                        {produceList.join(', ')}
                      </Text>
                    )}

                    {/* Top nutrient pillars */}
                    {topNutrients.length > 0 && (
                      <View style={styles.heroPillars}>
                        {topNutrients.map((p) => (
                          <View key={p} style={styles.heroPillarChip}>
                            <View style={[styles.heroPillarDot, { backgroundColor: DAILY_PILLARS[p]?.color || '#ccc' }]} />
                            <Text style={styles.heroPillarText}>{DAILY_PILLARS[p]?.shortLabel || p}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Streak indicator */}
                    <View style={styles.heroStreakRow}>
                      <Text style={styles.heroDay}>Day {challenge.currentDay}</Text>
                      {challenge.streak > 0 && (
                        <Text style={styles.heroStreak}>🔥 {challenge.streak} day streak</Text>
                      )}
                    </View>

                    {/* Supportive message */}
                    <Text style={styles.heroMessage}>{supportiveMsg}</Text>

                    {/* Scan Again button */}
                    <TouchableOpacity
                      style={styles.scanAgainBtn}
                      onPress={handleScan}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Scan again"
                    >
                      <LinearGradient
                        colors={['#4CAF50', '#2E7D32']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.scanAgainGradient}
                      >
                        <Camera size={18} color="#FFFFFF" />
                        <Text style={styles.scanAgainText}>Scan Again</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>

                {/* SECTION 2 — Journey Progress */}
                <View style={styles.journeyCard}>
                  <Text style={styles.journeyText}>
                    You've started tracking your nutrients.
                  </Text>
                  <Text style={styles.journeyDay}>
                    Day {challenge.currentDay} of 7
                  </Text>
                </View>

                {/* Nutrient Halo (≥3 logs) */}
                {showHalo && <NutrientHaloCard todayLog={todayLog} />}

                {/* Weekly Pillar View (≥5 logs) */}
                {showWeeklyPillar && <WeeklyPillarView challengeDays={challenge.days} />}

                {/* SECTION 3 — Optional Explore */}
                <View style={styles.exploreSection}>
                  <Text style={styles.exploreHeader}>Want to explore more?</Text>
                  <TouchableOpacity
                    style={styles.exploreBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      navigation.navigate('FridgeForager')
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Browse juice ideas"
                  >
                    <Compass size={16} color="#64B5F6" />
                    <Text style={styles.exploreBtnText}>Browse Juice Ideas</Text>
                    <ChevronRight size={14} color={DARK.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.exploreBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      navigation.navigate('JuiceCalculator')
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Set nutrient goal"
                  >
                    <Target size={16} color="#CE93D8" />
                    <Text style={styles.exploreBtnText}>Set Nutrient Goal</Text>
                    <ChevronRight size={14} color={DARK.textMuted} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ═══ PRE-LOG STATE ════════════════════════════════ */}
            {!hasLoggedToday && (
              <>
                {/* Primary Scan Prompt */}
                <View style={styles.preLogCard}>
                  <Text style={styles.preLogGreeting}>{greeting}</Text>
                  <Text style={styles.preLogHeadline}>Ready for today's juice?</Text>

                  <TouchableOpacity
                    style={styles.scanCta}
                    onPress={handleScan}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Scan my produce"
                  >
                    <LinearGradient
                      colors={['#4CAF50', '#2E7D32']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.scanCtaGradient}
                    >
                      <Camera size={22} color="#FFFFFF" />
                      <Text style={styles.scanCtaText}>Scan My Produce</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Yesterday summary (small) */}
                  {challenge.streak > 0 && (
                    <View style={styles.yesterdaySummary}>
                      <Text style={styles.yesterdayText}>
                        🔥 {challenge.streak} day streak — keep it going
                      </Text>
                    </View>
                  )}
                </View>

                {/* Journey progress (pre-log) */}
                {totalLogs > 0 && (
                  <View style={styles.journeyCard}>
                    <Text style={styles.journeyText}>
                      {totalLogs} juice{totalLogs !== 1 ? 's' : ''} logged so far. Nice work.
                    </Text>
                    <Text style={styles.journeyDay}>
                      Day {challenge.currentDay} of 7
                    </Text>
                  </View>
                )}
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>

      {/* Quick Logger */}
      <QuickLogger
        visible={showQuickLogger}
        onDismiss={() => setShowQuickLogger(false)}
        onLogComplete={handleQuickLogComplete}
        onCustomIngredients={(mode) => {
          if (mode === 'camera') {
            navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { openCamera: true } })
          } else {
            navigation.navigate('ScanFlow')
          }
        }}
      />

      {/* Reward Splash */}
      <RewardSplash
        visible={showRewardSplash}
        onDismiss={() => setShowRewardSplash(false)}
      />
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060D0A',
  },
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  settingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  // ── Post-Log: Section 1 — Today Hero Card ──────────────────
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
  },
  heroGradient: {
    padding: 22,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  heroProduceList: {
    fontSize: 14,
    fontWeight: '500',
    color: DARK.textSecondary,
    marginBottom: 10,
    lineHeight: 20,
  },
  heroPillars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  heroPillarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroPillarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroPillarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C9D1D9',
  },
  heroStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  heroDay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B949E',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroStreak: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF9800',
  },
  heroMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: DARK.textMuted,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  scanAgainBtn: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  scanAgainGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
  },
  scanAgainText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.heavy,
    color: '#FFFFFF',
  },

  // ── Post-Log: Section 2 — Journey Progress ─────────────────
  journeyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  journeyText: {
    fontSize: 14,
    fontWeight: '500',
    color: DARK.textSecondary,
    marginBottom: 4,
  },
  journeyDay: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // ── Post-Log: Section 3 — Optional Explore ─────────────────
  exploreSection: {
    marginTop: 4,
    marginBottom: 12,
  },
  exploreHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK.textMuted,
    marginBottom: 8,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  exploreBtnText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
  },

  // ── Pre-Log State ──────────────────────────────────────────
  preLogCard: {
    marginTop: 24,
    alignItems: 'center',
  },
  preLogGreeting: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK.textSecondary,
    marginBottom: 8,
  },
  preLogHeadline: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  scanCta: {
    width: '100%',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    marginBottom: 16,
  },
  scanCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
  },
  scanCtaText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.heavy,
    color: '#FFFFFF',
  },
  yesterdaySummary: {
    backgroundColor: 'rgba(255,152,0,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,152,0,0.12)',
  },
  yesterdayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9800',
    textAlign: 'center',
  },
})
