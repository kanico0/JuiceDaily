// -------------------------------------------------------------
// TodayScreen.js - Minimal, focused post-log / pre-log view
// Post-log: Today Hero Card > Journey Progress > Optional Explore
// Pre-log:  Scan prompt > yesterday summary
// Progressive reveal: Halo (>=3 logs), Weekly (>=5), Optimize (>=7)
// -------------------------------------------------------------

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  Settings,
  Droplets,
  Compass,
  Target,
  ChevronRight,
  Heart,
  Edit3,
  Sparkles,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import SnapIcon from '../components/SnapIcon'
import NutrientHaloCard from '../components/NutrientHaloCard'
import WeeklyPillarView from '../components/WeeklyPillarView'
import QuickLogger from '../components/QuickLogger'
import RewardSplash from '../components/RewardSplash'
import FreePlanUsageCard from '../components/FreePlanUsageCard'
import { useChallenge, DAILY_PILLARS } from '../services/ChallengeStore'
import { useFlags } from '../services/FeatureFlags'
import { useGlowStreak, getGlowTodayKey } from '../services/glowStreak'
import { useActivation } from '../services/ActivationStore'
import { useUserProfile } from '../services/UserProfileStore'
import { useJuiceLog } from '../services/JuiceLogStore'
import { authorizeGuestLog } from '../services/quota/guestLogGate'
import AccountGateModal from '../components/AccountGateModal'
import { useNutritionScore } from '../services/NutritionScoreStore'
import { USDA_RDA } from '../constants/nutrition'
import { getGreeting } from '../constants/motivationData'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS, SEMANTIC_TYPOGRAPHY, BRAND } from '../constants/tokens'
import { screenHeader, screenTitle, greeting, eyebrow, standardCard, compactSupportingCard, primaryActionLabel, secondaryAction, secondaryActionLabel, iconOnlyAction, scrollContentPadding } from '../constants/styleRecipes'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import { RECIPES } from '../constants/recipeData'
import { getSpotlightForDay, getSpotlightState } from '../data/juiceSpotlights'
import { checkAchievements } from '../services/achievements'
import TodaysJuiceSpotlight, { JuiceSpotlightDetailsModal } from '../components/TodaysJuiceSpotlight'
import FocusNutrientCard from '../components/FocusNutrientCard'
import TodaySummaryStats from '../components/TodaySummaryStats'
import WeeklySummaryTeaser from '../components/WeeklySummaryTeaser'
import AchievementOverlay from '../components/AchievementOverlay'
import GlowJourneyDrop from '../components/GlowJourneyDrop'
import GlowJourneyDetail from '../components/GlowJourneyDetail'
import GlowJourneyCelebrationOverlay from '../components/GlowJourneyCelebrationOverlay'
import GardenCard from '../components/GardenCard'
import GardenDetail from '../components/GardenDetail'
import GardenCelebrationOverlay from '../components/GardenCelebrationOverlay'
import {
  getWeeklyLeafStates,
  getWeeklyQualifyingDays,
  getLifetimeQualifyingDays,
  getJourneyStage,
  shouldCelebrateStage,
  markStageCelebrated,
  shouldCelebrateWeekly,
  markWeeklyCelebrated,
  initializeBaseline,
} from '../services/glowJourneyService'
import {
  getGardenSummary,
  initializeGardenBaseline,
  detectNewDiscoveries,
  detectBedMilestones,
  detectRainbowHarvest,
  shouldCelebrateBed,
  shouldCelebrateColor,
  shouldCelebrateRainbow,
  markBedCelebrated,
  markColorCelebrated,
  markRainbowCelebrated,
} from '../services/gardenService'
import { CELEBRATION_TYPES } from '../hooks/useCelebrationCoordinator'
import { getBedForProduce, getColorForProduce } from '../constants/gardenTaxonomy'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import { getUnlockedIds } from '../services/achievements'

// -- Top nutrient highlights from today's juices --------------

function getTopNutrients(todayLog) {
  if (!todayLog.juices || todayLog.juices.length === 0) return []
  const pillars = new Set()
  todayLog.juices.forEach((j) => {
    ;(j.pillars || j.colors || []).forEach((p) => pillars.add(p))
  })
  return Array.from(pillars).slice(0, 3)
}

// -- Produce names from today's juices ------------------------

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
  const { challenge, logJuice, todayLog, vitalityScore, weeklyStats } = useChallenge()
  const glowStreak = useGlowStreak()
  const { profile } = useUserProfile()
  const { unlocks, activation, recordLog } = useActivation()
  const { todayEntries, totalLogCount, diversityStats, entries } = useJuiceLog()
  const { momentum, streak: nutritionStreak } = useNutritionScore()
  const [showQuickLogger, setShowQuickLogger] = useState(false)
  const [showRewardSplash, setShowRewardSplash] = useState(false)
  const [showAccountGate, setShowAccountGate] = useState(false)
  const [usageRefreshTrigger, setUsageRefreshTrigger] = useState(0)
  const [showSpotlightDetails, setShowSpotlightDetails] = useState(false)
  const [pendingAchievement, setPendingAchievement] = useState(null)
  const [showGlowJourneyDetail, setShowGlowJourneyDetail] = useState(false)
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState([])
  const [stageCelebration, setStageCelebration] = useState(null)
  const [showGardenDetail, setShowGardenDetail] = useState(false)
  const [gardenCelebration, setGardenCelebration] = useState(null)
  const glowJourneyViewedRef = useRef(false)
  const gardenViewedRef = useRef(false)
  const prevLifetimeDaysRef = useRef(0)
  const prevGardenEntriesRef = useRef([])

  const fadeAnim = useRef(new Animated.Value(0)).current
  const isNavigating = useRef(false)
  const isFocusedRef = useRef(false)

  useEffect(() => {
    if (isReduced) { fadeAnim.setValue(1) } else {
      Animated.timing(fadeAnim, { toValue: 1, duration: DURATION.enter, easing: EASING.decelerate, useNativeDriver: true }).start()
    }
  }, [])

  // -- Spotlight state --
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
        source: 'today_spotlight',
      },
    })
    trackEvent('juice_spotlight_used', { spotlight_id: spotlight.id, source: 'today_screen' })
  }, [navigation, spotlight])

  // Refresh usage card on navigation focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      isFocusedRef.current = true
      setUsageRefreshTrigger((t) => t + 1)
    })
    const unsubscribeBlur = navigation.addListener('blur', () => {
      isFocusedRef.current = false
    })
    return () => {
      unsubscribe()
      unsubscribeBlur()
    }
  }, [navigation])

  // -- Daily summary for TodaySummaryStats --
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
      suggestion = `Keep your ${currentStreak}-day streak alive - scan your first juice today!`
    } else if (todayCount === 0) {
      suggestion = 'Start your day with a fresh juice scan!'
    } else if (missingNutrients.length > 0 && missingNutrients.length <= 3) {
      suggestion = `Try adding ${missingNutrients.join(', ')} to boost coverage.`
    } else if (missingNutrients.length > 3) {
      suggestion = `${missingNutrients.length} nutrients still below 5% - add variety!`
    } else {
      suggestion = 'Great coverage today! Keep it up.'
    }

    return { todayCount, todayScore, currentStreak, suggestion }
  }, [todayLog.juices.length, momentum, glowStreak.count, todayEntries])

  // -- Achievement check --
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

  // -- Glow Journey Drop computed values --
  const glowJourneyEntries = entries
  const weeklyLeafStates = useMemo(() => getWeeklyLeafStates(glowJourneyEntries), [glowJourneyEntries])
  const weeklyQualifyingDays = useMemo(() => getWeeklyQualifyingDays(glowJourneyEntries), [glowJourneyEntries])
  const lifetimeQualifyingDays = useMemo(() => getLifetimeQualifyingDays(glowJourneyEntries), [glowJourneyEntries])
  const journeyStage = useMemo(() => getJourneyStage(lifetimeQualifyingDays), [lifetimeQualifyingDays])

  // -- Glow Journey baseline initialization (existing-user protection) --
  useEffect(() => {
    ;(async () => {
      await initializeBaseline(glowJourneyEntries)
      prevLifetimeDaysRef.current = lifetimeQualifyingDays
    })()
  }, [])

  // -- Glow Journey analytics (once per mount) --
  useEffect(() => {
    if (glowJourneyViewedRef.current) return
    glowJourneyViewedRef.current = true
    trackEvent('glow_journey_viewed', {
      journey_stage_key: journeyStage?.key || 'none',
      weekly_goal: 3,
      weekly_completed_days: weeklyQualifyingDays,
      has_active_streak: glowStreak.count > 0,
    })
  }, [])

  // Check for stage celebration on data change (only after baseline)
  useEffect(() => {
    if (lifetimeQualifyingDays < 1) return
    const prevDays = prevLifetimeDaysRef.current
    ;(async () => {
      const stageToCelebrate = await shouldCelebrateStage(lifetimeQualifyingDays, prevDays)
      if (stageToCelebrate) {
        trackEvent('glow_journey_stage_reached', {
          journey_stage_key: stageToCelebrate.key,
          lifetime_days: lifetimeQualifyingDays,
        })
        await markStageCelebrated(stageToCelebrate.key)
        if (!pendingAchievement) {
          setStageCelebration({ stage: stageToCelebrate, lifetimeDays: lifetimeQualifyingDays })
        }
      }
      const weeklyCelebrate = await shouldCelebrateWeekly(glowJourneyEntries)
      if (weeklyCelebrate) {
        trackEvent('weekly_glow_completed', {
          weekly_completed_days: weeklyCelebrate.days,
          weekly_goal: 3,
        })
        await markWeeklyCelebrated(weeklyCelebrate.weekStart)
      }
    })()
    prevLifetimeDaysRef.current = lifetimeQualifyingDays
  }, [lifetimeQualifyingDays, glowJourneyEntries, pendingAchievement])

  // -- Garden baseline initialization (existing-user protection) --
  useEffect(() => {
    ;(async () => {
      await initializeGardenBaseline(entries)
      prevGardenEntriesRef.current = entries
    })()
  }, [])

  // -- Garden analytics (once per mount) --
  useEffect(() => {
    if (gardenViewedRef.current) return
    gardenViewedRef.current = true
    const gardenSummary = getGardenSummary(entries)
    trackEvent('garden_viewed', {
      discovered_count: gardenSummary.discoveredCount,
      beds_started: gardenSummary.bedsStarted,
      colors_discovered: gardenSummary.discoveredColorCount,
      rainbow_complete: gardenSummary.rainbowComplete,
    })
  }, [])

  // -- Garden celebration detection on entries change --
  useEffect(() => {
    const prevEntries = prevGardenEntriesRef.current
    if (prevEntries === entries) return

    const { newProduce, newColors } = detectNewDiscoveries(prevEntries, entries)
    const bedMilestones = detectBedMilestones(prevEntries, entries)
    const rainbowDetected = detectRainbowHarvest(prevEntries, entries)

    ;(async () => {
      let pendingCelebration = null
      let pendingPriority = 0

      // New produce discovery celebration (priority 1, lowest)
      if (newProduce.length > 0) {
        const firstPid = newProduce[0]
        const bedKey = getBedForProduce(firstPid)
        const colorKey = getColorForProduce(firstPid)
        const produceEntry = PRODUCE_DATA[firstPid]
        const gardenSummary = getGardenSummary(entries)
        trackEvent('garden_produce_discovered', {
          bed_key: bedKey,
          color_key: colorKey,
          discovered_count: gardenSummary.discoveredCount,
        })
        if (await shouldCelebrateBed(bedKey, 'seed')) {
          pendingCelebration = {
            type: CELEBRATION_TYPES.GARDEN_DISCOVERY,
            data: {
              bedKey,
              produceName: produceEntry ? produceEntry.name : firstPid,
            },
          }
          pendingPriority = 1
        }
      }

      // New color celebration (priority 2)
      if (newColors.length > 0) {
        const firstColor = newColors[0]
        const gardenSummary = getGardenSummary(entries)
        trackEvent('garden_color_discovered', {
          color_key: firstColor,
          colors_discovered: gardenSummary.discoveredColorCount,
        })
        if (await shouldCelebrateColor(firstColor)) {
          if (pendingPriority < 2) {
            pendingCelebration = {
              type: CELEBRATION_TYPES.GARDEN_COLOR,
              data: {
                colorKey: firstColor,
                colorsDiscovered: gardenSummary.discoveredColorCount,
              },
            }
            pendingPriority = 2
          }
          await markColorCelebrated(firstColor)
        }
      }

      // Bed milestone celebrations (priority 3)
      for (const milestone of bedMilestones) {
        trackEvent('garden_bed_stage_reached', {
          bed_key: milestone.bedKey,
          stage_key: milestone.toStage,
          produce_count: milestone.stage ? milestone.stage.threshold : 0,
        })
        if (await shouldCelebrateBed(milestone.bedKey, milestone.toStage)) {
          if (pendingPriority < 3) {
            const gardenSummary = getGardenSummary(entries)
            pendingCelebration = {
              type: CELEBRATION_TYPES.GARDEN_BED_MILESTONE,
              data: {
                bedKey: milestone.bedKey,
                stage: milestone.stage,
                produceCount: gardenSummary.bedCounts[milestone.bedKey],
              },
            }
            pendingPriority = 3
          }
          await markBedCelebrated(milestone.bedKey, milestone.toStage)
          break
        }
      }

      // Rainbow Harvest celebration (priority 4, highest among Garden)
      if (rainbowDetected) {
        const gardenSummary = getGardenSummary(entries)
        trackEvent('garden_rainbow_harvest', {
          discovered_count: gardenSummary.discoveredCount,
          colors_discovered: gardenSummary.discoveredColorCount,
        })
        if (await shouldCelebrateRainbow()) {
          pendingCelebration = {
            type: CELEBRATION_TYPES.GARDEN_RAINBOW,
            data: {
              discoveredCount: gardenSummary.discoveredCount,
              colorsDiscovered: gardenSummary.discoveredColorCount,
            },
          }
          pendingPriority = 4
          await markRainbowCelebrated()
        }
      }

      if (pendingCelebration) {
        // Delay mounting the celebration overlay until Today is
        // focused. This prevents the transparent Modal backdrop
        // from mounting during a navigation transition (e.g. after
        // logging a juice from ScanSuccessScreen), which on iOS
        // can cause the fade animation to not complete and leave
        // an invisible touch-blocking layer.
        const mountCelebration = () => {
          if (isFocusedRef.current) {
            setGardenCelebration(pendingCelebration)
          } else {
            // Retry shortly — navigation transition should complete
            setTimeout(mountCelebration, 150)
          }
        }
        mountCelebration()
      }
    })()

    prevGardenEntriesRef.current = entries
  }, [entries])

  // Load unlocked achievement IDs for detail modal
  useEffect(() => {
    ;(async () => {
      const ids = await getUnlockedIds()
      setUnlockedAchievementIds(ids)
    })()
  }, [])

  const handleGlowJourneyPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    trackEvent('glow_journey_tapped', {
      journey_stage_key: journeyStage?.key || 'none',
      destination: 'glow_journey_detail',
    })
    setShowGlowJourneyDetail(true)
  }, [journeyStage])

  const handleGardenPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const gardenSummary = getGardenSummary(entries)
    trackEvent('garden_card_tapped', {
      discovered_count: gardenSummary.discoveredCount,
    })
    setShowGardenDetail(true)
  }, [entries])

  // -- Today screen viewed analytics --
  useEffect(() => {
    trackEvent('today_screen_viewed', { total_logs: totalLogCount, has_logged_today: todayLog.juices.length > 0 })
  }, [])

  const greeting = useMemo(() => {
    const base = getGreeting()
    return profile.name ? `${base}, ${profile.name}` : base
  }, [profile.name])

  const handleScan = useCallback(() => {
    if (isNavigating.current) return
    isNavigating.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    // Open ScanFlow modal (root-level) with camera auto-open
    navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { openCamera: true } })
    setTimeout(() => { isNavigating.current = false }, 500)
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
    authorizeGuestLog().then((gate) => {
      if (!gate.allowed) {
        setShowAccountGate(true)
        return
      }
      logJuice(scannedIngredients, batchResult)
      recordLog()
      if (isEnabled('ff_reward_splash')) setShowRewardSplash(true)
    })
  }, [logJuice, recordLog, isEnabled])

  const hasLoggedToday = todayLog.juices.length > 0
  const totalLogs = unlocks.totalLogsCount
  const isNewUser = totalLogCount === 0
  const isReturningPreLog = totalLogCount > 0 && !hasLoggedToday
  const topNutrients = useMemo(() => getTopNutrients(todayLog), [todayLog])
  const produceList = useMemo(() => getProduceList(todayLog), [todayLog])

  // -- View Today's Juice: navigate to History entry details --
  // Uses spotlightState.latestEntry.id — the exact entry the card is
  // displaying — rather than independently inferring from
  // todayEntries[0]. This guarantees the button always opens the same
  // juice the card shows, even if another juice is logged later that
  // day (the card and handler update together via spotlightState).
  const handleViewTodayJuice = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const entryId = spotlightState.latestEntry?.id
    if (!entryId) return
    navigation.navigate('HistoryTab', {
      screen: 'HistoryHome',
      params: { openEntryId: entryId },
    })
  }, [navigation, spotlightState.latestEntry])

  // -- Simple Blend selection (deterministic daily from RECIPES) --
  const simpleBlend = useMemo(() => {
    const dayKey = getGlowTodayKey()
    const dayIndex = parseInt(dayKey.replace(/-/g, ''), 10)
    const candidates = RECIPES
      .filter(r => {
        if (!r.id || !r.title) return false
        const produceIds = (r.ingredients || [])
          .map(i => (i.produceId || '').toLowerCase())
          .filter(Boolean)
        const distinctIds = [...new Set(produceIds)]
        return distinctIds.length >= 2 && distinctIds.length <= 4
      })
      .sort((a, b) => a.id.localeCompare(b.id))
    if (candidates.length === 0) return null
    return candidates[dayIndex % candidates.length]
  }, [])

  // -- Post-log factual highlight (no fabricated stats) --
  const postLogHighlight = useMemo(() => {
    if (diversityStats.uniqueToday > 0) {
      return `${diversityStats.uniqueToday} distinct plant${diversityStats.uniqueToday !== 1 ? 's' : ''} in today's juice`
    }
    if (glowStreak.count > 0) {
      return `${glowStreak.count} day Glow Streak`
    }
    if (weeklyStats && weeklyStats.totalLogs > 0) {
      return `${weeklyStats.totalLogs} juice${weeklyStats.totalLogs !== 1 ? 's' : ''} this week`
    }
    return null
  }, [diversityStats.uniqueToday, glowStreak.count, weeklyStats])

  // -- Navigation callbacks for new engagement cards --
  const handleManualEntry = useCallback(() => {
    if (isNavigating.current) return
    isNavigating.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { manualEntry: true } })
    trackEvent('today_manual_entry_tapped', { source: 'today_screen' })
    setTimeout(() => { isNavigating.current = false }, 500)
  }, [navigation])

  const handleEasyStep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    trackEvent('today_easy_step_tapped', { source: 'today_screen' })
    if (isNewUser) {
      navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { manualEntry: true } })
    } else {
      handleScan()
    }
  }, [navigation, isNewUser, handleScan])

  const handleWellnessFocus = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    trackEvent('today_wellness_focus_tapped', { source: 'today_screen' })
    navigation.navigate('WellnessFocus')
  }, [navigation])

  const handleUseFocusCombo = useCallback((produceIds) => {
    navigation.navigate('ScanFlow', {
      screen: 'ScanHome',
      params: {
        manualEntry: true,
        preloadIngredients: produceIds,
        source: 'todays_focus',
      },
    })
  }, [navigation])

  const handleSimpleBlend = useCallback(() => {
    if (!simpleBlend) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    trackEvent('simple_blend_tapped', { source: 'today_screen' })
    navigation.navigate('RecipeDetail', { recipeId: simpleBlend.id, origin: 'simpleBlend' })
  }, [navigation, simpleBlend])

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
            {/* === RAWLIFE GARDEN CARD =================== */}
            <GardenCard
              entries={entries}
              onPress={handleGardenPress}
              isReduced={isReduced}
              journeyStageKey={journeyStage?.key || null}
              unlockedAchievementIds={unlockedAchievementIds}
            />

            {/* === POST-LOG STATE ========================= */}
            {hasLoggedToday && (
              <>
                {/* SECTION 1 - Today Hero Card */}
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

                    {/* Factual highlight */}
                    {postLogHighlight && (
                      <Text style={styles.heroMessage}>{postLogHighlight}</Text>
                    )}

                    {/* Log Another Juice button */}
                    <TouchableOpacity
                      style={styles.scanAgainBtn}
                      onPress={handleScan}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Log another juice"
                    >
                      <LinearGradient
                        colors={BRAND.cta.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.scanAgainGradient}
                      >
                        <SnapIcon size={36} color={SEMANTIC_COLORS.textOnAccent} />
                        <Text style={styles.scanAgainText}>Log Another Juice</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>

                {/* SECTION 2 - Journey Progress */}
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
                  onViewToday={handleViewTodayJuice}
                  onAddAnother={handleQuickLog}
                />
                <JuiceSpotlightDetailsModal
                  visible={showSpotlightDetails}
                  spotlight={spotlight}
                  onClose={() => setShowSpotlightDetails(false)}
                  onUseBlend={handleUseSpotlightBlend}
                />

                {/* Today's Focus Nutrient */}
                <FocusNutrientCard onScan={handleScan} onUseCombo={handleUseFocusCombo} isReduced={isReduced} />

                {/* Weekly Summary Teaser (compact, real data only) */}
                <WeeklySummaryTeaser
                  juicesThisWeek={dailySummary.todayCount}
                  glowStreakCount={glowStreak.count}
                  isReduced={isReduced}
                />

                {/* Nutrient Halo (>=3 logs) */}
                {showHalo && <NutrientHaloCard todayLog={todayLog} />}

                {/* Weekly Pillar View (>=5 logs) */}
                {showWeeklyPillar && <WeeklyPillarView challengeDays={challenge.days} />}

                {/* Today's Easy Step (post-log) */}
                <View style={styles.easyStepCard}>
                  <Text style={styles.easyStepTitle}>Today's juice is logged</Text>
                  {postLogHighlight && (
                    <Text style={styles.easyStepBody}>{postLogHighlight}</Text>
                  )}
                  <TouchableOpacity
                    style={styles.easyStepCta}
                    onPress={handleScan}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Log another juice"
                  >
                    <Text style={styles.easyStepCtaText}>Log Another Juice</Text>
                    <ChevronRight size={14} color={SEMANTIC_COLORS.accentSecondary} />
                  </TouchableOpacity>
                </View>

                {/* SECTION 3 - Optional Explore */}
                <View style={styles.exploreSection}>
                  <Text style={styles.exploreHeader}>Want to explore more?</Text>
                  <TouchableOpacity
                    style={styles.exploreBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      // Navigate directly into the Juice Ideas modal within
                      // Explore, rather than merely switching tabs and
                      // requiring a second tap. ExploreHome (ScanScreen)
                      // consumes the openBrowseIdeas param and opens
                      // BrowseIdeasModal immediately on arrival.
                      navigation.navigate('ExploreTab', {
                        screen: 'ExploreHome',
                        params: { openBrowseIdeas: true },
                      })
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

                {/* Wellness Focus discovery (post-log) */}
                <TouchableOpacity
                  style={styles.wellnessCard}
                  onPress={handleWellnessFocus}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Explore wellness focuses"
                >
                  <View style={styles.wellnessIconWrap}>
                    <Heart size={18} color={SEMANTIC_COLORS.success} />
                  </View>
                  <View style={styles.wellnessContent}>
                    <Text style={styles.wellnessTitle}>Find Juices by Wellness Focus</Text>
                    <Text style={styles.wellnessBody}>Explore recipes through ingredient and nutrient associations.</Text>
                  </View>
                  <ChevronRight size={16} color={SEMANTIC_COLORS.textMuted} />
                </TouchableOpacity>
              </>
            )}

            {/* === PRE-LOG STATE ========================== */}
            {!hasLoggedToday && (
              <>
                {/* Greeting + Headline + Supporting Copy */}
                <View style={styles.preLogCard}>
                  <Text style={styles.preLogGreeting}>{greeting}</Text>
                  <Text style={styles.preLogHeadline}>
                    {isNewUser ? 'Ready to add more raw today?' : "Ready for today's juice?"}
                  </Text>
                  {isNewUser && (
                    <Text style={styles.preLogSupporting}>
                      Scan your produce or enter ingredients manually to explore its nutrition.
                    </Text>
                  )}

                  {/* Primary: Scan My Produce */}
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
                      <SnapIcon size={48} color={SEMANTIC_COLORS.textOnAccent} />
                      <Text style={styles.scanCtaText}>Scan My Produce</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Secondary: Enter Ingredients Manually */}
                  <TouchableOpacity
                    style={styles.manualEntryBtn}
                    onPress={handleManualEntry}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Enter ingredients manually"
                  >
                    <Edit3 size={18} color={SEMANTIC_COLORS.accentSecondary} />
                    <Text style={styles.manualEntryText}>Enter Ingredients Manually</Text>
                  </TouchableOpacity>

                  {/* Streak badge (returning users only) */}
                  {glowStreak.count > 0 && (
                    <View style={styles.yesterdaySummary}>
                      <Text style={styles.yesterdayText}>
                        {'🔥 '} {glowStreak.count} day Glow Streak - keep it going
                      </Text>
                    </View>
                  )}
                </View>

                {/* Today's Easy Step */}
                <View style={styles.easyStepCard}>
                  <Text style={styles.easyStepTitle}>Today’s Easy Step</Text>
                  {isNewUser ? (
                    <>
                      <Text style={styles.easyStepBody}>
                        Create your first Simple Blend with up to four ingredients. We’ll help you explore its nutrition and begin tracking your progress.
                      </Text>
                      <TouchableOpacity
                        style={styles.easyStepCta}
                        onPress={handleEasyStep}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Start my first blend"
                      >
                        <Text style={styles.easyStepCtaText}>Start My First Blend</Text>
                        <ChevronRight size={14} color={SEMANTIC_COLORS.accentSecondary} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.easyStepBody}>
                        {glowStreak.count > 0
                          ? 'Log today’s juice to keep your Glow going.'
                          : 'Scan or enter your ingredients to log today’s juice.'}
                      </Text>
                      <TouchableOpacity
                        style={styles.easyStepCta}
                        onPress={handleEasyStep}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Log today's juice"
                      >
                        <Text style={styles.easyStepCtaText}>Log Today’s Juice</Text>
                        <ChevronRight size={14} color={SEMANTIC_COLORS.accentSecondary} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Recipe Discovery: Simple Blend (new user) or Spotlight (returning) */}
                {isNewUser && simpleBlend ? (
                  <TouchableOpacity
                    style={styles.simpleBlendCard}
                    onPress={handleSimpleBlend}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Simple blend to try: ${simpleBlend.title}`}
                  >
                    <Text style={styles.simpleBlendLabel}>Simple Blend to Try</Text>
                    <Text style={styles.simpleBlendTitle}>{simpleBlend.title}</Text>
                    <Text style={styles.simpleBlendIngredients}>
                      {[...new Set((simpleBlend.ingredients || [])
                        .map(i => i.name)
                        .filter(Boolean))]
                        .slice(0, 4)
                        .join(' · ')}
                    </Text>
                    <View style={styles.simpleBlendCtaRow}>
                      <Text style={styles.simpleBlendCtaText}>View Recipe</Text>
                      <ChevronRight size={14} color={SEMANTIC_COLORS.accentSecondary} />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TodaysJuiceSpotlight
                      spotlight={spotlight}
                      state={spotlightState}
                      onViewBlend={handleOpenSpotlight}
                      onScan={handleScan}
                      onViewToday={handleViewTodayJuice}
                      onAddAnother={handleQuickLog}
                    />
                    <JuiceSpotlightDetailsModal
                      visible={showSpotlightDetails}
                      spotlight={spotlight}
                      onClose={() => setShowSpotlightDetails(false)}
                      onUseBlend={handleUseSpotlightBlend}
                    />
                  </>
                )}

                {/* Journey card (new user) or compact progress (returning) */}
                {isNewUser ? (
                  <View style={styles.journeyCard}>
                    <Text style={styles.journeyTitle}>Your RawLifeFlow Journey</Text>
                    <View style={styles.journeySteps}>
                      <View style={styles.journeyStep}>
                        <View style={[styles.journeyStepDot, styles.journeyStepActive]} />
                        <Text style={styles.journeyStepText}>Add your ingredients</Text>
                      </View>
                      <View style={styles.journeyStep}>
                        <View style={styles.journeyStepDot} />
                        <Text style={styles.journeyStepText}>Explore their nutrition</Text>
                      </View>
                      <View style={styles.journeyStep}>
                        <View style={styles.journeyStepDot} />
                        <Text style={styles.journeyStepText}>Log your first juice</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.journeyCard}>
                    {glowStreak.count > 0 && (
                      <Text style={styles.journeyText}>
                        {'🔥 '} {glowStreak.count} day Glow Streak
                      </Text>
                    )}
                    {weeklyStats && weeklyStats.totalLogs > 0 && (
                      <Text style={styles.journeyDay}>
                        {weeklyStats.totalLogs} juice{weeklyStats.totalLogs !== 1 ? 's' : ''} this week
                      </Text>
                    )}
                    {diversityStats.uniqueWeek > 0 && (
                      <Text style={styles.journeyDay}>
                        {diversityStats.uniqueWeek} plant variet{diversityStats.uniqueWeek !== 1 ? 'ies' : 'y'} this week
                      </Text>
                    )}
                  </View>
                )}

                {/* Wellness Focus discovery (pre-log) */}
                <TouchableOpacity
                  style={styles.wellnessCard}
                  onPress={handleWellnessFocus}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Explore wellness focuses"
                >
                  <View style={styles.wellnessIconWrap}>
                    <Heart size={18} color={SEMANTIC_COLORS.success} />
                  </View>
                  <View style={styles.wellnessContent}>
                    <Text style={styles.wellnessTitle}>Find Juices by Wellness Focus</Text>
                    <Text style={styles.wellnessBody}>Explore recipes through ingredient and nutrient associations.</Text>
                  </View>
                  <ChevronRight size={16} color={SEMANTIC_COLORS.textMuted} />
                </TouchableOpacity>

                {/* Today's Focus Nutrient (pre-log) */}
                <FocusNutrientCard onScan={handleScan} onUseCombo={handleUseFocusCombo} isReduced={isReduced} />

                {/* Explore Juicing Lessons discovery card */}
                <TouchableOpacity
                  style={styles.juicingDiscoveryCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    const parent = navigation.getParent()
                    if (parent) {
                      parent.navigate('JuicingExperience')
                    } else {
                      navigation.navigate('JuicingExperience')
                    }
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Explore Juicing Lessons"
                >
                  <View style={styles.juicingDiscoveryIconWrap}>
                    <Sparkles size={18} color={BRAND.accent?.vitaminC || '#FFB74D'} />
                  </View>
                  <View style={styles.juicingDiscoveryContent}>
                    <Text style={styles.juicingDiscoveryTitle}>Explore Juicing Lessons</Text>
                    <Text style={styles.juicingDiscoveryBody}>
                      New to juicing, casual, or experienced — choose a lesson that fits you.
                    </Text>
                    <Text style={styles.juicingDiscoveryCta}>Browse Lessons</Text>
                  </View>
                  <ChevronRight size={16} color={SEMANTIC_COLORS.textMuted} />
                </TouchableOpacity>
              </>
            )}

            {/* Free Plan Usage Card */}
            <FreePlanUsageCard
              onUpgrade={() => navigation.navigate('Paywall', { source: 'today_usage' })}
              refreshTrigger={usageRefreshTrigger}
            />

            <View style={{ height: SEMANTIC_SPACE.xxl }} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>

      {/* Quick Logger */}
      <QuickLogger
        visible={showQuickLogger}
        onDismiss={() => setShowQuickLogger(false)}
        onLogComplete={handleQuickLogComplete}
        onAccountRequired={() => setShowAccountGate(true)}
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

      {/* Stage Celebration Overlay — renders the GlowJourney
          celebration so stageCelebration state has a visible
          Modal that can be dismissed. Without this, the
          stageCelebration guard at line ~1128 blocks the
          garden celebration invisibly. */}
      {!pendingAchievement && stageCelebration && (
        <GlowJourneyCelebrationOverlay
          visible={true}
          stage={stageCelebration.stage}
          lifetimeDays={stageCelebration.lifetimeDays}
          onDismiss={() => setStageCelebration(null)}
          isReduced={isReduced}
        />
      )}

      <AccountGateModal
        visible={showAccountGate}
        onClose={() => setShowAccountGate(false)}
        onAuthenticated={() => setShowAccountGate(false)}
        initialMode="guest"
      />

      <GardenDetail
        visible={showGardenDetail}
        onClose={() => setShowGardenDetail(false)}
        entries={entries}
        isReduced={isReduced}
        unlockedAchievementIds={unlockedAchievementIds}
      />

      {/* Garden Celebration (only when no achievement or stage celebration showing) */}
      {!pendingAchievement && !stageCelebration && gardenCelebration && (
        <GardenCelebrationOverlay
          visible={true}
          celebration={gardenCelebration}
          onDismiss={() => setGardenCelebration(null)}
          isReduced={isReduced}
        />
      )}
    </View>
  )
}

// -- Styles ---------------------------------------------------

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

  // -- Post-Log: Section 1 - Today Hero Card (Level 1) --------
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

  // -- Post-Log: Section 2 - Journey Progress (Level 2) -------
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

  // -- Post-Log: Section 3 - Optional Explore (Level 3) -------
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

  // -- Pre-Log State ------------------------------------------
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

  // -- Pre-Log: Supporting copy ------------------------------
  preLogSupporting: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SEMANTIC_SPACE.lg,
    paddingHorizontal: SEMANTIC_SPACE.md,
    lineHeight: 20,
  },

  // -- Pre-Log: Manual Entry Button --------------------------
  manualEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SEMANTIC_SPACE.sm,
    paddingVertical: SEMANTIC_SPACE.md,
    paddingHorizontal: SEMANTIC_SPACE.lg,
    borderRadius: SEMANTIC_RADIUS.large,
    borderWidth: 1,
    borderColor: SEMANTIC_COLORS.borderStrong,
    backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
    marginBottom: SEMANTIC_SPACE.md,
  },
  manualEntryText: {
    ...secondaryActionLabel,
    fontSize: SEMANTIC_TYPOGRAPHY.buttonLabel.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.buttonLabel.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
  },

  // -- Easy Step Card (shared pre-log + post-log) -------------
  easyStepCard: {
    ...standardCard,
    marginBottom: SEMANTIC_SPACE.md,
  },
  easyStepTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  easyStepBody: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SEMANTIC_SPACE.md,
  },
  easyStepCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SEMANTIC_SPACE.sm,
  },
  easyStepCtaText: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.accentSecondary,
  },

  // -- Simple Blend Card (new user recipe discovery) ----------
  simpleBlendCard: {
    ...standardCard,
    marginBottom: SEMANTIC_SPACE.md,
  },
  simpleBlendLabel: {
    ...eyebrow,
    marginBottom: 4,
  },
  simpleBlendTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.screenTitle.fontSize - 2,
    fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  simpleBlendIngredients: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    marginBottom: SEMANTIC_SPACE.md,
    lineHeight: 20,
  },
  simpleBlendCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SEMANTIC_SPACE.sm,
  },
  simpleBlendCtaText: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.accentSecondary,
  },

  // -- Journey Card (new user steps) --------------------------
  journeyTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: SEMANTIC_SPACE.md,
  },
  journeySteps: {
    gap: SEMANTIC_SPACE.sm + 2,
  },
  journeyStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SEMANTIC_SPACE.sm,
  },
  journeyStepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
    borderWidth: 1,
    borderColor: SEMANTIC_COLORS.borderStrong,
  },
  journeyStepActive: {
    backgroundColor: SEMANTIC_COLORS.success,
    borderColor: SEMANTIC_COLORS.success,
  },
  journeyStepText: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
  },

  // -- Wellness Focus Discovery Card --------------------------
  wellnessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SEMANTIC_SPACE.md,
    ...standardCard,
    marginBottom: SEMANTIC_SPACE.md,
  },
  wellnessIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76,175,80,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellnessContent: {
    flex: 1,
  },
  wellnessTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: 2,
  },
  wellnessBody: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textMuted,
    lineHeight: 16,
  },
  juicingDiscoveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SEMANTIC_SPACE.md,
    ...standardCard,
    marginBottom: SEMANTIC_SPACE.md,
  },
  juicingDiscoveryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,183,77,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  juicingDiscoveryContent: {
    flex: 1,
  },
  juicingDiscoveryTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: 2,
  },
  juicingDiscoveryBody: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textMuted,
    lineHeight: 16,
    marginBottom: 4,
  },
  juicingDiscoveryCta: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: '700',
    color: SEMANTIC_COLORS.accentSecondary,
  },
  stageCelebrationOverlay: {
    flex: 1,
    backgroundColor: SEMANTIC_COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SEMANTIC_SPACE.lg,
  },
  stageCelebrationCard: {
    backgroundColor: SEMANTIC_COLORS.surfaceElevated,
    borderRadius: SEMANTIC_RADIUS.xl,
    padding: SEMANTIC_SPACE.xl,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  stageCelebrationEmoji: {
    fontSize: 48,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  stageCelebrationTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: SEMANTIC_COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  stageCelebrationSubtitle: {
    fontSize: 14,
    color: SEMANTIC_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SEMANTIC_SPACE.lg,
  },
  stageCelebrationButton: {
    backgroundColor: SEMANTIC_COLORS.success,
    borderRadius: SEMANTIC_RADIUS.pill,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  stageCelebrationButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D1510',
  },
})
