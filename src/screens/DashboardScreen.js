// ─────────────────────────────────────────────────────────────
// DashboardScreen.js — RawLifeFlow: Juicing Daily high-engagement dashboard
// Hero Card + Vitality Rings + Social Proof + Smart Action Dock
// Glassmorphism dark-mode palette
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Animated,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Search, Wine, Droplets, Lightbulb, Award, Snowflake, Settings, Clock, Lock, Crown, BookOpen } from 'lucide-react-native'
import SpectrumRings from '../components/SpectrumRings'
import WeeklySpectrumBar from '../components/WeeklySpectrumBar'
import MeshGradientBg from '../components/MeshGradientBg'
import { MercyModal, ThawRecipeSuggestion } from '../components/FreezerPassModal'
import WelcomeModal from '../components/WelcomeModal'
import PaywallModal from '../components/PaywallModal'
import { useChallenge, DAILY_PILLARS, WEEKLY_COLORS } from '../services/ChallengeStore'
import { usePro } from '../services/ProStore'
import { useFlags } from '../services/FeatureFlags'
import TodayHubCard from '../components/TodayHubCard'
import QuickLogger from '../components/QuickLogger'
import RewardSplash from '../components/RewardSplash'
import UseSoonCards from '../components/UseSoonCards'
import WeeklyInsightsCard from '../components/WeeklyInsightsCard'
import { usePantry } from '../services/PantryStore'
import { useStreak } from '../services/StreakEngine'
import FirstLaunchOrchestrator, { hasCompletedFirstLaunch, markFirstLaunchDone } from '../components/FirstLaunchOrchestrator'
import StreakVisualCard from '../components/StreakVisualCard'
import NutrientHaloCard from '../components/NutrientHaloCard'
import WeeklyPillarView from '../components/WeeklyPillarView'
import MonthlyHeatmap from '../components/MonthlyHeatmap'
import LivingBackground from '../components/LivingBackground'
import { useUserProfile } from '../services/UserProfileStore'
import { processJuiceBatch } from '../services/JuiceEngine'
import { generateSuggestions } from '../services/AISuggestionService'
import {
  getGreeting,
  getDailyWisdom,
  getIdentityTitle,
  getStarterTip,
  SOCIAL_PROOF_USERS,
} from '../constants/motivationData'

// ── Social Proof Avatar ──────────────────────────────────────

const JUICE_RING_COLORS = {
  base: '#64B5F6',
  power: '#81C784',
  kick: '#FFB74D',
}

function SocialAvatar({ user, onClink, index }) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  // Entrance: staggered fade-in from right
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      delay: 600 + index * 80,
      useNativeDriver: true,
    }).start()
  }, [index])

  // Idle: periodic pulse for active juicers (every 30-60s, staggered)
  useEffect(() => {
    if (!user.hasJuicedToday) return
    const baseDelay = 30000 + Math.random() * 30000
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
      ]).start()
    }, baseDelay)
    return () => clearInterval(interval)
  }, [user.hasJuicedToday])

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start()
    onClink(user)
  }, [user, onClink, scaleAnim])

  const ringColor = user.hasJuicedToday
    ? JUICE_RING_COLORS[user.juiceColor] || '#4CAF50'
    : 'transparent'

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.avatarWrap}>
        <Animated.View style={[
          styles.avatarRing,
          {
            borderColor: ringColor,
            borderWidth: user.hasJuicedToday ? 2.5 : 0,
            transform: [{ scale: scaleAnim }],
            shadowColor: ringColor,
            shadowOpacity: user.hasJuicedToday ? 0.6 : 0,
            shadowRadius: 8,
            elevation: user.hasJuicedToday ? 6 : 0,
          },
        ]}>
          <LinearGradient
            colors={user.hasJuicedToday ? ['#1A2332', '#0D1117'] : ['#161B22', '#0D1117']}
            style={styles.avatarInner}
          >
            <Text style={[
              styles.avatarLetter,
              user.hasJuicedToday && { color: ringColor },
            ]}>
              {user.avatar}
            </Text>
          </LinearGradient>
        </Animated.View>
        <Text style={styles.avatarName}>{user.name}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Toast Notification ───────────────────────────────────────

function ClinkToast({ visible, userName }) {
  if (!visible) return null
  return (
    <View style={styles.toastContainer}>
      <BlurView intensity={40} tint="dark" style={styles.toastBlur}>
        <Text style={styles.toastText}>🥂 Clinked with {userName}!</Text>
      </BlurView>
    </View>
  )
}

// ── Main Dashboard ───────────────────────────────────────────

export default function DashboardScreen({ navigation }) {
  const { challenge, todayLog, vitalityScore, weeklyDiversity, weeklyStats, useFreezerPass, completeOnboarding, logJuice } = useChallenge()
  const { isPro, hasFeatureAccess, pro } = usePro()
  const { isEnabled } = useFlags()
  const { useSoonItems } = usePantry()
  const showOnboarding = !challenge.hasOnboarded
  const [showPaywall, setShowPaywall] = useState(false)
  const paywallShownRef = useRef(false)
  const [clinkUser, setClinkUser] = React.useState(null)
  const [showMercy, setShowMercy] = useState(false)
  const toastTimer = useRef(null)
  const isFrozen = challenge.isFrozen || false
  const freezerPasses = challenge.freezerPasses || 0
  const [showQuickLogger, setShowQuickLogger] = useState(false)
  const [showRewardSplash, setShowRewardSplash] = useState(false)
  const [showFirstLaunch, setShowFirstLaunch] = useState(false)
  const streakCtx = useStreak()
  const streak = isEnabled('ff_streaks_grace') ? streakCtx : null
  const { profile, updateSession } = useUserProfile()

  // Update session timestamp on mount
  useEffect(() => { updateSession() }, [])

  // Entrance animation refs
  const heroSlide = useRef(new Animated.Value(30)).current
  const heroOpacity = useRef(new Animated.Value(0)).current
  const ringsOpacity = useRef(new Animated.Value(0)).current
  const ringsScale = useRef(new Animated.Value(0.9)).current
  const identityGlow = useRef(new Animated.Value(0.7)).current

  const greeting = useMemo(() => {
    const base = getGreeting()
    return profile.name ? `${base}, ${profile.name}` : base
  }, [profile.name])
  const wisdom = useMemo(() => getDailyWisdom(), [])
  const identity = useMemo(() => getIdentityTitle(), [])

  // Check if first-launch orchestrator should show (on mount + on focus)
  const checkFirstLaunch = useCallback(() => {
    if (!isEnabled('ff_first_launch_orchestrator')) return
    if (!challenge.hasOnboarded) return
    hasCompletedFirstLaunch().then((done) => {
      if (!done) setShowFirstLaunch(true)
    })
  }, [isEnabled, challenge.hasOnboarded])

  useEffect(() => {
    checkFirstLaunch()
  }, [checkFirstLaunch])

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', checkFirstLaunch)
    return unsubscribe
  }, [navigation, checkFirstLaunch])

  // Grand Entrance choreography — spring physics
  useEffect(() => {
    // Phase 1: Hero card slides up with spring
    Animated.parallel([
      Animated.spring(heroOpacity, { toValue: 1, damping: 20, stiffness: 80, useNativeDriver: true }),
      Animated.spring(heroSlide, { toValue: 0, damping: 15, stiffness: 100, useNativeDriver: true }),
    ]).start()

    // Phase 2: Rings fade in + scale with spring
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(ringsOpacity, { toValue: 1, damping: 20, stiffness: 80, useNativeDriver: true }),
        Animated.spring(ringsScale, { toValue: 1, damping: 15, stiffness: 100, useNativeDriver: true }),
      ]),
    ]).start()

    // Idle: Identity title breathing glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(identityGlow, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(identityGlow, { toValue: 0.7, duration: 2500, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  const handleClink = useCallback((user) => {
    setClinkUser(user)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setClinkUser(null), 2000)
  }, [])

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
    markFirstLaunchDone()
    if (isEnabled('ff_reward_splash')) {
      setShowRewardSplash(true)
    }
  }, [logJuice, isEnabled])

  const handleFirstLaunchLog = useCallback((scannedIngredients) => {
    const batchResult = processJuiceBatch(scannedIngredients, 'cold_pressed')
    logJuice(scannedIngredients, {
      ...batchResult,
      scannedIngredients,
      totals: batchResult.totals,
    })
    markFirstLaunchDone()
  }, [logJuice])

  const handleFirstLaunchReward = useCallback(() => {
    if (isEnabled('ff_reward_splash')) setShowRewardSplash(true)
  }, [isEnabled])

  const handleFirstLaunchStreak = useCallback(() => {
    if (streak && streak.recordLog) streak.recordLog()
  }, [streak])

  const handleFirstLaunchComplete = useCallback(() => {
    setShowFirstLaunch(false)
  }, [])

  const emotionalCopy = isEnabled('ff_emotional_copy')
  const isPaywallDisabled = isEnabled('ff_dev_disable_paywalls')
  const isPaywallForced = isEnabled('ff_dev_force_paywalls')
  const unclosedRings = ['base', 'power', 'kick'].filter((c) => !todayLog[c])
  const starterTip = useMemo(() => getStarterTip(challenge.currentDay, todayLog), [challenge.currentDay, todayLog])

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <LivingBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ═══ 1. IMMEDIATE WIN HERO CARD ═══════════════════ */}
          <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroSlide }] }}>
          <LinearGradient
            colors={['#1B3A2D', '#0F2419', '#0D1117']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroHeader}>
              <View style={styles.heroLeft}>
                <Droplets size={20} color="#81C784" strokeWidth={2.5} />
                <Text style={styles.heroAppName}>RawLifeFlow: Juicing Daily</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Settings')}
                  style={styles.settingsBtn}
                  activeOpacity={0.7}
                >
                  <Settings size={16} color="#484F58" />
                </TouchableOpacity>
              </View>
              <View style={styles.heroBadges}>
                <View style={styles.dayPill}>
                  <Text style={styles.dayPillText}>Day {challenge.currentDay}</Text>
                </View>
                <Text style={styles.streakText}>
                  {emotionalCopy
                    ? `🔥 ${challenge.streak} day streak`
                    : `🔥 ${challenge.streak}`}
                </Text>
                {freezerPasses > 0 && (
                  <View style={styles.freezerPill}>
                    <Snowflake size={10} color="#90CAF9" />
                    <Text style={styles.freezerPillText}>×{freezerPasses}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.heroBody}>
              <Animated.Text style={[styles.identityLabel, { opacity: identityGlow }]}>{identity}</Animated.Text>
              <Text style={styles.greetingText}>{greeting}</Text>
              <View style={styles.wisdomWrap}>
                <Text style={styles.wisdomText}>"{wisdom}"</Text>
              </View>
            </View>
          </LinearGradient>
          </Animated.View>

          {/* ═══ 2. VITALITY RINGS ════════════════════════════ */}
          <Animated.View style={{ opacity: ringsOpacity, transform: [{ scale: ringsScale }] }}>
          <View style={styles.ringsCard}>
            <SpectrumRings
              todayLog={todayLog}
              vitalityScore={vitalityScore}
            />

            {/* Unclosed rings hint */}
            {unclosedRings.length > 0 && unclosedRings.length < 3 && (
              <View style={styles.hintRow}>
                <Text style={styles.hintText}>
                  {emotionalCopy ? 'Keep going! Close your' : 'Close your'}{' '}
                  {unclosedRings.map((c, i) => (
                    <Text key={c}>
                      {i > 0 ? ' & ' : ''}
                      <Text style={{ color: DAILY_PILLARS[c].color, fontWeight: '700' }}>
                        {DAILY_PILLARS[c].shortLabel}
                      </Text>
                    </Text>
                  ))}
                  {' '}ring{unclosedRings.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
          </Animated.View>

          {/* ═══ NUTRIENT HALO (behind ff_nutrient_halo_progress) ═ */}
          {isEnabled('ff_nutrient_halo_progress') && (
            <NutrientHaloCard todayLog={todayLog} />
          )}

          {/* ═══ TODAY HUB (behind ff_today_hub) ═══════════════ */}
          {isEnabled('ff_today_hub') && (
            <TodayHubCard
              todayLog={todayLog}
              vitalityScore={vitalityScore}
              streak={challenge.streak}
              onLogJuice={(target) => {
                if (target === 'recipes') navigation.navigate('FridgeForager')
                else handleQuickLog()
              }}
            />
          )}

          {/* ═══ STREAK VISUAL (behind ff_streak_visual) ════ */}
          {isEnabled('ff_streak_visual') && streakCtx && (
            <StreakVisualCard streakData={streakCtx} />
          )}

          {/* ═══ USE-SOON CARDS (behind ff_use_soon_cards) ═══ */}
          {isEnabled('ff_use_soon_cards') && (
            <UseSoonCards
              useSoonItems={useSoonItems}
              onSuggestRecipe={(item) => {
                if (isEnabled('ff_pantry_ai_priority')) {
                  // Generate AI suggestions prioritizing expiring pantry items
                  const aiSuggestions = generateSuggestions({
                    pantryItems: useSoonItems,
                    weeklyStats,
                    weeklyDiversity,
                  })
                  navigation.navigate('FridgeForager', {
                    suggestFor: item.produceId,
                    aiSuggestions,
                    prioritizeExpiring: true,
                  })
                } else {
                  navigation.navigate('FridgeForager', { suggestFor: item.produceId })
                }
              }}
            />
          )}

          {/* ═══ WEEKLY INSIGHTS (behind ff_insights) ══════ */}
          {isEnabled('ff_insights') && (
            <WeeklyInsightsCard
              weeklyStats={weeklyStats}
              weeklyDiversity={weeklyDiversity}
              onViewFull={() => navigation.navigate('WeeklyReport')}
            />
          )}

          {/* ═══ WEEKLY PILLAR VIEW (behind ff_weekly_pillar_view) ═ */}
          {isEnabled('ff_weekly_pillar_view') && (
            <WeeklyPillarView challengeDays={challenge.days} />
          )}

          {/* ═══ STARTER TIP NUDGE ═══════════════════════════ */}
          {starterTip && (
            <TouchableOpacity
              style={styles.tipBubble}
              onPress={() => navigation.navigate('FridgeForager')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(129,199,132,0.12)', 'rgba(129,199,132,0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tipGradient}
              >
                <View style={styles.tipIconWrap}>
                  <Lightbulb size={18} color="#FFD54F" />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipLabel}>Day {challenge.currentDay} Tip</Text>
                  <Text style={styles.tipText}>{starterTip.tip}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ═══ WEEKLY SPECTRUM BAR (tappable → Weekly Report) ═ */}
          <TouchableOpacity
            onPress={() => {
              if (isPaywallDisabled) {
                navigation.navigate('WeeklyReport')
                return
              }
              if (isPaywallForced || !hasFeatureAccess('weeklyReports')) {
                setShowPaywall(true)
                return
              }
              navigation.navigate('WeeklyReport')
            }}
            activeOpacity={0.8}
          >
            <View>
              <WeeklySpectrumBar weeklyDiversity={weeklyDiversity} />
              {!hasFeatureAccess('weeklyReports') && (
                <View style={styles.lockOverlay}>
                  <Lock size={14} color="#FFD54F" />
                  <Text style={styles.lockText}>Pro</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* ═══ FROZEN STATE: Thaw recipe suggestion ═══════════ */}
          {isFrozen && (
            <ThawRecipeSuggestion
              onPress={() => navigation.navigate('ScanFlow')}
            />
          )}

          {/* ═══ LEARN — NOVICE JOURNEY ═══════════════════════ */}
          <TouchableOpacity
            style={styles.hallLink}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              navigation.navigate('NoviceJourney')
            }}
            activeOpacity={0.7}
          >
            <BookOpen size={16} color="#81C784" />
            <Text style={styles.hallLinkText}>Learn — Juice Smarter</Text>
            <Text style={styles.hallLinkArrow}>→</Text>
          </TouchableOpacity>

          {/* ═══ HALL OF VITALITY LINK ══════════════════════════ */}
          <TouchableOpacity
            style={styles.hallLink}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              navigation.navigate('HallOfVitality')
            }}
            activeOpacity={0.7}
          >
            <Award size={16} color="#FFD54F" />
            <Text style={styles.hallLinkText}>Hall of Vitality</Text>
            <Text style={styles.hallLinkArrow}>→</Text>
          </TouchableOpacity>

          {/* ═══ JUICE CALCULATOR (behind ff_juice_calculator) ═══ */}
          {isEnabled('ff_juice_calculator') && (
            <TouchableOpacity
              style={styles.hallLink}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                navigation.navigate('JuiceCalculator')
              }}
              activeOpacity={0.7}
            >
              <Lightbulb size={16} color="#CE93D8" />
              <Text style={styles.hallLinkText}>Juice Calculator</Text>
              <Text style={styles.hallLinkArrow}>→</Text>
            </TouchableOpacity>
          )}

          {/* ═══ MONTHLY HEATMAP (behind ff_monthly_heatmap) ═══ */}
          {isEnabled('ff_monthly_heatmap') && (
            <MonthlyHeatmap challengeDays={challenge.days} />
          )}

          {/* ═══ VITALITY HISTORY LINK ══════════════════════ */}
          <TouchableOpacity
            style={styles.historyLink}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              navigation.navigate('VitalityHistory')
            }}
            activeOpacity={0.7}
          >
            <Clock size={16} color="#90CAF9" />
            <Text style={styles.historyLinkText}>Vitality History</Text>
            <Text style={styles.historyLinkArrow}>→</Text>
          </TouchableOpacity>

          {/* ═══ THE VAULT LINK ═══════════════════════════ */}
          {!isPro && (
            <TouchableOpacity
              style={styles.vaultLink}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                navigation.navigate('Vault')
              }}
              activeOpacity={0.7}
            >
              <Crown size={16} color="#FFD54F" />
              <Text style={styles.vaultLinkText}>Unlock Architect Pro</Text>
              <Text style={styles.vaultLinkArrow}>→</Text>
            </TouchableOpacity>
          )}

          {/* ═══ 3. SOCIAL PROOF FEED ═════════════════════════ */}
          <View style={styles.socialSection}>
            <Text style={styles.socialTitle}>Juice Community</Text>
            <FlatList
              data={SOCIAL_PROOF_USERS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(u) => u.id}
              contentContainerStyle={styles.socialList}
              renderItem={({ item, index }) => (
                <SocialAvatar user={item} onClink={handleClink} index={index} />
              )}
            />
          </View>

          {/* ═══ TODAY'S JUICES LOG ═══════════════════════════ */}
          {todayLog.juices.length > 0 && (
            <View style={styles.todayCard}>
              <Text style={styles.todayTitle}>
                {emotionalCopy ? 'My Juices Today' : "Today's Juices"}
              </Text>
              {todayLog.juices.map((juice, i) => (
                <View key={i} style={styles.juiceLogRow}>
                  <View style={styles.juiceLogColors}>
                    {(juice.pillars || juice.colors || []).map((c) => (
                      <View
                        key={c}
                        style={[styles.juiceLogDot, { backgroundColor: DAILY_PILLARS[c]?.color || '#ccc' }]}
                      />
                    ))}
                  </View>
                  <Text style={styles.juiceLogText}>
                    {juice.ingredients.length} ingredient{juice.ingredients.length !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.juiceLogCal}>
                    {Math.round(juice.totals.calories)} kcal
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Bottom spacer for action dock */}
          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ═══ 4. SMART ACTION DOCK (sticky bottom) ═══════════ */}
      <View style={styles.dockOuter}>
        <BlurView intensity={60} tint="dark" style={styles.dockBlur}>
          <View style={styles.dockInner}>
            <TouchableOpacity
              style={styles.dockBtnSecondary}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                navigation.navigate('FridgeForager')
              }}
              activeOpacity={0.7}
            >
              <Search size={22} color="#8B949E" />
              <Text style={styles.dockBtnSecondaryText}>
                {emotionalCopy ? 'Explore Recipes' : 'Find a Recipe'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockBtnPrimary}
              onPress={handleQuickLog}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4CAF50', '#2E7D32']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dockBtnGradient}
              >
                <Wine size={22} color="#FFFFFF" />
                <Text style={styles.dockBtnPrimaryText}>
                  {emotionalCopy
                    ? (challenge.streak > 0 ? 'Keep My Streak Alive' : 'Build My First Juice')
                    : 'I Just Juiced!'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>

      {/* Clink toast */}
      <ClinkToast visible={!!clinkUser} userName={clinkUser?.name || ''} />

      {/* Mercy modal (Freezer Pass used) */}
      <MercyModal
        visible={showMercy}
        onDismiss={() => setShowMercy(false)}
        streak={challenge.streak}
        passesRemaining={freezerPasses}
      />

      {/* Onboarding Welcome Modal */}
      <WelcomeModal
        visible={showOnboarding}
        onComplete={(userName) => completeOnboarding(userName)}
      />

      {/* First Launch Orchestrator (behind ff_first_launch_orchestrator) */}
      {isEnabled('ff_first_launch_orchestrator') && (
        <FirstLaunchOrchestrator
          visible={showFirstLaunch}
          onComplete={handleFirstLaunchComplete}
          onLogJuice={handleFirstLaunchLog}
          onTriggerReward={handleFirstLaunchReward}
          onRecordStreak={handleFirstLaunchStreak}
          onQuickLog={handleQuickLog}
        />
      )}

      {/* Quick Logger (behind ff_3step_logger) */}
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

      {/* Reward Splash (behind ff_reward_splash) */}
      <RewardSplash
        visible={showRewardSplash}
        onDismiss={() => setShowRewardSplash(false)}
      />

      {/* Strategic Paywall Modal */}
      <PaywallModal
        visible={!isPaywallDisabled && showPaywall}
        onDismiss={() => setShowPaywall(false)}
        trigger={challenge.streak >= 3 ? 'streak_3' : 'feature_gate'}
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // ── Hero Card ──────────────────────────────────────────────
  heroCard: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroAppName: {
    fontSize: 18,
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
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heroBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B949E',
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF9800',
  },
  freezerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(100,181,246,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.15)',
  },
  freezerPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#90CAF9',
  },
  heroBody: {
    alignItems: 'center',
  },
  identityLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#81C784',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  wisdomWrap: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  wisdomText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#8B949E',
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },

  // ── Rings Card ─────────────────────────────────────────────
  ringsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 28,
    padding: 12,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  hintRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 19,
  },

  // ── Starter Tip ───────────────────────────────────────────
  tipBubble: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  tipGradient: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 18,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,213,79,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFD54F',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    color: '#C9D1D9',
    lineHeight: 20,
  },

  // ── Hall of Vitality Link ─────────────────────────────────
  hallLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,213,79,0.1)',
  },
  hallLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD54F',
  },
  hallLinkArrow: {
    fontSize: 16,
    color: '#484F58',
  },

  // ── Vitality History Link ───────────────────────────────────
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.1)',
  },
  historyLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#90CAF9',
  },
  historyLinkArrow: {
    fontSize: 16,
    color: '#484F58',
  },

  // ── Vault Link ──────────────────────────────────────────────
  vaultLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,213,79,0.04)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,213,79,0.1)',
  },
  vaultLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD54F',
  },
  vaultLinkArrow: {
    fontSize: 16,
    color: '#484F58',
  },

  // ── Lock Overlay ────────────────────────────────────────────
  lockOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6,13,10,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,213,79,0.15)',
  },
  lockText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFD54F',
    letterSpacing: 0.5,
  },

  // ── Social Proof ───────────────────────────────────────────
  socialSection: {
    marginBottom: 16,
  },
  socialTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  socialList: {
    paddingRight: 16,
    gap: 12,
  },
  avatarWrap: {
    alignItems: 'center',
    width: 60,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarInner: {
    flex: 1,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: '#484F58',
  },
  avatarName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#484F58',
    marginTop: 4,
  },

  // ── Today's Juices ─────────────────────────────────────────
  todayCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  todayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  juiceLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#21262D',
  },
  juiceLogColors: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 10,
  },
  juiceLogDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  juiceLogText: {
    flex: 1,
    fontSize: 13,
    color: '#8B949E',
    fontWeight: '500',
  },
  juiceLogCal: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // ── Smart Action Dock ──────────────────────────────────────
  dockOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  dockBlur: {
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 16,
  },
  dockInner: {
    flexDirection: 'row',
    gap: 12,
  },
  dockBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dockBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B949E',
  },
  dockBtnPrimary: {
    flex: 1.3,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  dockBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dockBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // ── Toast ──────────────────────────────────────────────────
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 40,
    right: 40,
    alignItems: 'center',
    zIndex: 100,
  },
  toastBlur: {
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 14,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toastText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
})
