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
  Pressable,
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
import { useGlowStreak, getGlowTodayKey } from '../services/glowStreak'
import { useActivation } from '../services/ActivationStore'
import { useUserProfile } from '../services/UserProfileStore'
import { useJuiceLog } from '../services/JuiceLogStore'
import { useNutritionScore } from '../services/NutritionScoreStore'
import { USDA_RDA } from '../constants/nutrition'
import { getGreeting } from '../constants/motivationData'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS, SEMANTIC_TYPOGRAPHY, BRAND } from '../constants/tokens'
import { screenHeader, screenTitle, greeting, eyebrow, standardCard, compactSupportingCard, primaryActionLabel, iconOnlyAction, scrollContentPadding } from '../constants/styleRecipes'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import { getSpotlightForDay, getSpotlightState } from '../data/juiceSpotlights'
import { checkAchievements } from '../services/achievements'
import TodaysJuiceSpotlight, { JuiceSpotlightDetailsModal } from '../components/TodaysJuiceSpotlight'
import FocusNutrientCard from '../components/FocusNutrientCard'
import TodaySummaryStats from '../components/TodaySummaryStats'
import WeeklySummaryTeaser from '../components/WeeklySummaryTeaser'
import AchievementOverlay from '../components/AchievementOverlay'

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
  const glowStreak = useGlowStreak()
  const { profile } = useUserProfile()
  const { unlocks, activation, recordLog } = useActivation()
  const { todayEntries, totalLogCount } = useJuiceLog()
  const { momentum, streak: nutritionStreak } = useNutritionScore()
  const [showQuickLogger, setShowQuickLogger] = useState(false)
  const [showRewardSplash, setShowRewardSplash] = useState(false)
  const [showSpotlightDetails, setShowSpotlightDetails] = useState(false)
  const [pendingAchievement, setPendingAchievement] = useState(null)

  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (isReduced) { fadeAnim.setValue(1) } else {
      Animated.timing(fadeAnim, { toValue: 1, duration: DURATION.enter, easing: EASING.decelerate, useNativeDriver: true }).start()
    }
  }, [])

  // ── Spotlight state ──
  const spotlightDayKey = getGlowTodayKey()
  const spotlight = useMemo(() => getSpotlightForDay({ dayKey: spotlightDayKey }), [spotlightDayKey])
  const spotlightState = useMemo(() => getSpotlightState({ todayEntries, totalLogs: totalLogCount }), [todayEntries, totalLogCount])

  const handleOpenSpotlight = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowSpotlightDetails(true)
    trackEvent('juice_spotlight_opened', { spotlight_id: spotlight.id, source: 'today_screen' })
  }, [spotlight.id])

  const handleUseSpotlightBlend = useCallback(() => {
    setShowSpotlightDetails(false)
    navigation.navigate('ScanFlow', {
      screen: 'ScanHome',
      params: {
        manualEntry: true,
        preloadIngredients: spotlight.ingredients,
        source: 'spotlight',
      },
    })
    trackEvent('juice_spotlight_used', { spotlight_id: spotlight.id, source: 'today_screen' })
  }, [navigation, spotlight])

  // ── Daily summary for TodaySummaryStats ──
  const dailySummary = useMemo(() => {
    const todayCount = todayLog.juices.length
    const todayScore = typeof momentum === 'number' ? momentum : 0
    const currentStreak = glowStreak.count

    const todayTotals = {}
    todayEntries.forEach((e) => {
      const ns = e.nutrientSummary || {}
      Object.keys(USDA_RDA).forEach((k) => { todayTotals[k] = (todayTotals[k] || 0) + (ns[k] || 0) })
    })
    const missingNutrients = Object.entries(USDA_RDA)
      .filter(([k, rda]) => rda > 0 && ((todayTotals[k] || 0) / rda) < 0.05)
      .map(([k]) => k === 'vitaminC' ? 'Vitamin C' : k === 'vitaminA' ? 'Vitamin A'
        : k === 'potassium' ? 'Potassium' : k === 'iron' ? 'Iron'
        : k === 'magnesium' ? 'Magnesium' : k === 'folate' ? 'Folate' : k)

    let suggestion = ''
    if (todayCount === 0 && currentStreak > 0) {
      suggestion = `Keep your ${currentStreak}-day streak alive — scan your first juice today!`
    } else if (todayCount === 0) {
      suggestion = 'Start your day with a fresh juice scan!'
    } else if (missingNutrients.length > 0 && missingNutrients.length <= 3) {
      suggestion = `Try adding ${missingNutrients.join(', ')} to boost coverage.`
    } else if (missingNutrients.length > 3) {
      suggestion = `${missingNutrients.length} nutrients still below 5% — add variety!`
    } else {
      suggestion = 'Great coverage today! Keep it up.'
    }

    return { todayCount, todayScore, currentStreak, suggestion }
  }, [todayLog.juices.length, momentum, glowStreak.count, todayEntries])

  // ── Achievement check ──
  useEffect(() => {
    if (glowStreak.count === 0 && totalLogCount === 0) return
    ;(async () => {
      const newlyUnlocked = await checkAchievements({
        totalLogs: totalLogCount,
        streakCount: glowStreak.count,
      })
      if (newlyUnlocked.length > 0) {
        setPendingAchievement(newlyUnlocked[0])
        trackEvent('achievement_unlocked', { id: newlyUnlocked[0].id, source: 'today_screen' })
      }
    })()
  }, [glowStreak.count, totalLogCount])

  // ── Today screen viewed analytics ──
  useEffect(() => {
    trackEvent('today_screen_viewed', { total_logs: totalLogCount, has_logged_today: todayLog.juices.length > 0 })
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
              <Droplets size={18} color={SEMANTIC_COLORS.success} strokeWidth={2.5} />
              <Text style={styles.headerTitle}>Today</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Settings size={18} color={SEMANTIC_COLORS.textMuted} />
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
                      <Text style={styles.heroDay}>Challenge Day {challenge.currentDay}</Text>
                      {glowStreak.count > 0 && (
                        <Text style={styles.heroStreak}>🔥 {glowStreak.count} day Glow Streak</Text>
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
                        colors={BRAND.cta.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.scanAgainGradient}
                      >
                        <Camera size={18} color={SEMANTIC_COLORS.textOnAccent} />
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
                    Challenge Day {challenge.currentDay} of 7
                  </Text>
                </View>

                {/* Today Summary Stats */}
                <TodaySummaryStats
                  todayCount={dailySummary.todayCount}
                  todayScore={dailySummary.todayScore}
                  streakCount={dailySummary.currentStreak}
                  suggestion={dailySummary.suggestion}
                />

                {/* Today's Juice Spotlight */}
                <TodaysJuiceSpotlight
                  spotlight={spotlight}
                  state={spotlightState}
                  onViewBlend={handleOpenSpotlight}
                  onScan={handleScan}
                  onViewToday={() => {}}
                  onAddAnother={handleQuickLog}
                />
                <JuiceSpotlightDetailsModal
                  visible={showSpotlightDetails}
                  spotlight={spotlight}
                  onClose={() => setShowSpotlightDetails(false)}
                  onUseBlend={handleUseSpotlightBlend}
                />

                {/* Today's Focus Nutrient */}
                <FocusNutrientCard onScan={handleScan} isReduced={isReduced} />

                {/* Weekly Summary Teaser (compact, real data only) */}
                <WeeklySummaryTeaser
                  juicesThisWeek={dailySummary.todayCount}
                  glowStreakCount={glowStreak.count}
                  isReduced={isReduced}
                />

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
                    <Compass size={16} color={SEMANTIC_COLORS.accentSecondary} />
                    <Text style={styles.exploreBtnText}>Browse Juice Ideas</Text>
                    <ChevronRight size={14} color={SEMANTIC_COLORS.textMuted} />
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
                    <ChevronRight size={14} color={SEMANTIC_COLORS.textMuted} />
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
                      colors={BRAND.cta.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.scanCtaGradient}
                    >
                      <Camera size={22} color={SEMANTIC_COLORS.textOnAccent} />
                      <Text style={styles.scanCtaText}>Scan My Produce</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Yesterday summary (small) */}
                  {glowStreak.count > 0 && (
                    <View style={styles.yesterdaySummary}>
                      <Text style={styles.yesterdayText}>
                        🔥 {glowStreak.count} day Glow Streak — keep it going
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
                      Challenge Day {challenge.currentDay} of 7
                    </Text>
                  </View>
                )}

                {/* Today's Juice Spotlight (pre-log) */}
                <TodaysJuiceSpotlight
                  spotlight={spotlight}
                  state={spotlightState}
                  onViewBlend={handleOpenSpotlight}
                  onScan={handleScan}
                  onViewToday={() => {}}
                  onAddAnother={handleQuickLog}
                />
                <JuiceSpotlightDetailsModal
                  visible={showSpotlightDetails}
                  spotlight={spotlight}
                  onClose={() => setShowSpotlightDetails(false)}
                  onUseBlend={handleUseSpotlightBlend}
                />

                {/* Today's Focus Nutrient (pre-log) */}
                <FocusNutrientCard onScan={handleScan} isReduced={isReduced} />
              </>
            )}

            <View style={{ height: SEMANTIC_SPACE.xxl }} />
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

      {/* Achievement Overlay */}
      <AchievementOverlay
        achievement={pendingAchievement}
        visible={!!pendingAchievement}
        onDismiss={() => setPendingAchievement(null)}
      />
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SEMANTIC_COLORS.canvas,
  },
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    ...screenHeader,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SEMANTIC_SPACE.sm,
  },
  headerTitle: {
    ...screenTitle,
    fontSize: SEMANTIC_TYPOGRAPHY.screenTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  settingsBtn: {
    ...iconOnlyAction,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    ...scrollContentPadding,
  },

  // ── Post-Log: Section 1 — Today Hero Card (Level 1) ────────
  heroCard: {
    borderRadius: SEMANTIC_RADIUS.large,
    overflow: 'hidden',
    marginBottom: SEMANTIC_SPACE.md,
  },
  heroGradient: {
    padding: SEMANTIC_SPACE.lg,
    borderRadius: SEMANTIC_RADIUS.large,
    borderWidth: 0.5,
    borderColor: SEMANTIC_COLORS.borderStrong,
  },
  heroTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.screenTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: SEMANTIC_SPACE.sm + 2,
    letterSpacing: -0.3,
  },
  heroProduceList: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    marginBottom: SEMANTIC_SPACE.sm + 2,
    lineHeight: 20,
  },
  heroPillars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SEMANTIC_SPACE.md,
  },
  heroPillarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: SEMANTIC_RADIUS.medium,
  },
  heroPillarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroPillarText: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.metadata.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
  },
  heroStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: SEMANTIC_SPACE.sm + 2,
  },
  heroDay: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.metadata.fontWeight,
    color: SEMANTIC_COLORS.textMuted,
    backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: SEMANTIC_RADIUS.medium,
    overflow: 'hidden',
  },
  heroStreak: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.metadata.fontWeight,
    color: SEMANTIC_COLORS.warning,
  },
  heroMessage: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textMuted,
    fontStyle: 'italic',
    marginBottom: SEMANTIC_SPACE.lg,
  },
  scanAgainBtn: {
    borderRadius: SEMANTIC_RADIUS.large,
    overflow: 'hidden',
  },
  scanAgainGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SEMANTIC_SPACE.sm,
    paddingVertical: SEMANTIC_SPACE.md + 2,
    borderRadius: SEMANTIC_RADIUS.large,
  },
  scanAgainText: {
    ...primaryActionLabel,
    fontSize: SEMANTIC_TYPOGRAPHY.buttonLabel.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.buttonLabel.fontWeight,
    color: SEMANTIC_COLORS.textOnAccent,
  },

  // ── Post-Log: Section 2 — Journey Progress (Level 2) ───────
  journeyCard: {
    ...standardCard,
    marginBottom: SEMANTIC_SPACE.md,
  },
  journeyText: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    marginBottom: 4,
  },
  journeyDay: {
    fontSize: SEMANTIC_TYPOGRAPHY.numericEmphasis.fontSize - 4,
    fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
  },

  // ── Post-Log: Section 3 — Optional Explore (Level 3) ───────
  exploreSection: {
    marginTop: 4,
    marginBottom: SEMANTIC_SPACE.md,
  },
  exploreHeader: {
    ...eyebrow,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...compactSupportingCard,
    paddingVertical: SEMANTIC_SPACE.md,
    paddingHorizontal: SEMANTIC_SPACE.md + 2,
    marginBottom: 6,
  },
  exploreBtnText: {
    flex: 1,
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
  },

  // ── Pre-Log State ──────────────────────────────────────────
  preLogCard: {
    marginTop: SEMANTIC_SPACE.xl,
    alignItems: 'center',
  },
  preLogGreeting: {
    ...greeting,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  preLogHeadline: {
    ...screenTitle,
    textAlign: 'center',
    marginBottom: SEMANTIC_SPACE.xl,
    letterSpacing: -0.3,
  },
  scanCta: {
    width: '100%',
    borderRadius: SEMANTIC_RADIUS.large,
    overflow: 'hidden',
    marginBottom: SEMANTIC_SPACE.lg,
  },
  scanCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: SEMANTIC_SPACE.lg,
    borderRadius: SEMANTIC_RADIUS.large,
  },
  scanCtaText: {
    ...primaryActionLabel,
    fontSize: SEMANTIC_TYPOGRAPHY.buttonLabel.fontSize + 4,
    fontWeight: SEMANTIC_TYPOGRAPHY.buttonLabel.fontWeight,
    color: SEMANTIC_COLORS.textOnAccent,
  },
  yesterdaySummary: {
    backgroundColor: 'rgba(255,183,77,0.06)',
    borderRadius: SEMANTIC_RADIUS.medium,
    paddingHorizontal: SEMANTIC_SPACE.md + 2,
    paddingVertical: SEMANTIC_SPACE.sm,
    borderWidth: 0.5,
    borderColor: 'rgba(255,183,77,0.12)',
  },
  yesterdayText: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.warning,
    textAlign: 'center',
  },
})
