// ─────────────────────────────────────────────────────────────
// ScanSuccessScreen.js — Post-scan success screen showing
// session metrics from the Nutrition Score system.
//
// Shows: Ingredient Diversity, Nutrients Discovered,
// Score Increase, New Total Momentum Score.
//
// Subtle celebration: soft glow + light haptic. No loud anims.
// Updates streak and metrics in real time via NutritionScoreStore.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  BackHandler,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Check, Leaf, Beaker, TrendingUp, Flame, X, Star, Heart } from 'lucide-react-native'
import { TASTE_REACTIONS } from '../constants/recipeData'
import MeshGradientBg from '../components/MeshGradientBg'
import GlassSurface from '../components/GlassSurface'
import { useNutritionScore } from '../services/NutritionScoreStore'
import { useJuiceLog } from '../services/JuiceLogStore'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE, RADIUS, SHADOW } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import { checkInToday } from '../services/glowStreak'
import { checkAchievements } from '../services/achievements'
import { refreshNudges } from '../services/NotificationNudges'
import { useActivation } from '../services/ActivationStore'
import AchievementOverlay from '../components/AchievementOverlay'

export default function ScanSuccessScreen({ route, navigation }) {
  const {
    ingredientCount = 0,
    nutrientsFound = 0,
    previousMomentum = 0,
    ingredientNames = [],
    logEntryId = null,
  } = route.params || {}

  const { momentum, streak, diversity, coverage } = useNutritionScore()
  const { activation } = useActivation()
  const { entries, setTasteReaction, setRating, setNote, toggleFavorite, setFavorite, updateEntryMetadata, markTasteFeedbackResolved } = useJuiceLog()

  // Compute live score increase from pre-log snapshot
  const scoreIncrease = Math.max(0, momentum - previousMomentum)
  const reducedMotion = useReducedMotion()

  // ── Glow Streak auto check-in + Achievement check ──
  const [glowToast, setGlowToast] = useState(null)
  const [pendingAchievement, setPendingAchievement] = useState(null)
  const [showTasteFeedback, setShowTasteFeedback] = useState(false)
  const [pendingIndicator, setPendingIndicator] = useState(true)
  // Session Logged content is hidden until taste feedback is resolved.
  // This enforces the required order:
  //   juice saved → pending → taste feedback → resolve → Session Logged
  const [sessionLoggedVisible, setSessionLoggedVisible] = useState(false)
  // Post-juice enrichment state (rating, note, favorite)
  const [enrichRating, setEnrichRating] = useState(0)
  const [enrichNote, setEnrichNote] = useState('')
  const [enrichFavorite, setEnrichFavorite] = useState(false)
  const achievementCheckedRef = useRef(false)
  const hasAchievementRef = useRef(false)
  const achievementTimerRef = useRef(null)
  // Track whether taste feedback is eligible for this entry.
  // Currently always eligible — no Pro gate on the feedback panel.
  // If a Pro gate is added later, set this to false for ineligible users
  // and sessionLoggedVisible will be set immediately.
  const tasteFeedbackEligible = true

  useEffect(() => {
    // QA11: If this entry's taste feedback was already resolved
    // (e.g., screen re-mounted after app restart or navigation
    // back to ScanSuccess), skip directly to Session Logged.
    if (logEntryId) {
      const existing = entries.find((e) => e.id === logEntryId)
      if (existing && existing.tasteFeedbackResolved === true) {
        setPendingIndicator(false)
        setSessionLoggedVisible(true)
        return
      }
    }
    // If user is not eligible for taste feedback, skip directly to
    // Session Logged confirmation.
    if (!tasteFeedbackEligible) {
      setPendingIndicator(false)
      setSessionLoggedVisible(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const result = await checkInToday()
        if (cancelled) return
        if (result.wasIncremented) {
          setGlowToast(`Glow streak: ${result.count} day${result.count !== 1 ? 's' : ''}`)
        }
        // Check achievements after log + streak update
        const totalLogs = (activation?.totalLogsCount || 0) + 1
        const streakCount = result.count || 0
        const newlyUnlocked = await checkAchievements({ totalLogs, streakCount })
        if (cancelled) return
        achievementCheckedRef.current = true
        if (newlyUnlocked.length > 0) {
          hasAchievementRef.current = true
          // Delay slightly so toast shows first
          achievementTimerRef.current = setTimeout(() => {
            if (cancelled) return
            setPendingAchievement(newlyUnlocked[0])
          }, 1500)
        } else {
          // No achievement — show taste feedback
          hasAchievementRef.current = false
          // If no glow toast was shown (e.g., second juice same day,
          // checkInToday was not incremented), show taste feedback
          // immediately instead of waiting for a toast that will
          // never appear.
          if (!result.wasIncremented) {
            setShowTasteFeedback(true)
            setPendingIndicator(false)
          }
          // Otherwise, the glow toast auto-dismiss useEffect will
          // trigger taste feedback after 3 seconds.
        }
      } catch (e) {
        console.warn('[GlowStreak] auto check-in failed:', e)
        achievementCheckedRef.current = true
        hasAchievementRef.current = false
        // On error, still show taste feedback — don't block the user
        setShowTasteFeedback(true)
        setPendingIndicator(false)
      }
    })()
    return () => {
      cancelled = true
      if (achievementTimerRef.current) {
        clearTimeout(achievementTimerRef.current)
        achievementTimerRef.current = null
      }
    }
  }, [])

  // Show taste feedback after achievement overlay is dismissed
  // (explicit queue completion — no timer race)
  const handleAchievementDismiss = useCallback(() => {
    setPendingAchievement(null)
    setShowTasteFeedback(true)
    setPendingIndicator(false)
  }, [])

  // Centralized resolution of the taste feedback step.
  // Called when the user taps Save/Continue, Skip, or the X button.
  // This reveals the Session Logged confirmation content.
  // QA11: Also marks the entry's taste feedback as resolved in the
  // persisted store, so no other screen (e.g., RecipeDetailScreen
  // focus listener) can re-prompt for the same entry.
  const resolveTasteFeedback = useCallback(() => {
    if (logEntryId) {
      markTasteFeedbackResolved(logEntryId)
    }
    setShowTasteFeedback(false)
    setPendingIndicator(false)
    setSessionLoggedVisible(true)
  }, [logEntryId, markTasteFeedbackResolved])

  // Auto-dismiss toast
  useEffect(() => {
    if (!glowToast) return
    const t = setTimeout(() => {
      setGlowToast(null)
      // If no achievement pending, show taste feedback after toast dismisses
      if (achievementCheckedRef.current && !hasAchievementRef.current) {
        setShowTasteFeedback(true)
        setPendingIndicator(false)
      }
    }, 3000)
    return () => clearTimeout(t)
  }, [glowToast])

  // ── Animations ──
  const glowAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const checkScale = useRef(new Animated.Value(0)).current

  // Track event on mount
  useEffect(() => {
    trackEvent('scan_success_viewed', {
      ingredient_count: ingredientCount,
      nutrients_found: nutrientsFound,
      score_increase: scoreIncrease,
      new_momentum: momentum,
    })
  }, [])

  // Entrance animation — runs when Session Logged content becomes visible
  useEffect(() => {
    if (!sessionLoggedVisible) return

    // Light haptic when Session Logged is revealed
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    if (reducedMotion) {
      glowAnim.setValue(1)
      fadeAnim.setValue(1)
      slideAnim.setValue(0)
      checkScale.setValue(1)
      return
    }

    // Staggered entrance
    const entranceAnim = Animated.sequence([
      // Check icon scales in
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      // Content fades + slides up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
      ]),
    ])
    entranceAnim.start()

    // Soft glow pulse
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 2000,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
      ]),
    )
    glowLoop.start()

    return () => {
      entranceAnim.stop()
      glowLoop.stop()
    }
  }, [sessionLoggedVisible, reducedMotion])

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.2],
  })

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.navigate('PerformanceDashboard')
  }

  const handleScanAnother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.replace('ScanHome', { openCamera: true, source: 'camera' })
  }

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // ScanFlow is a modal in RootStack — walk up to RootStack and goBack
    // to dismiss the modal and land on MainTabs.
    // If we're inside a tab stack instead, pop to root then switch tab.
    let nav = navigation
    // Walk up to the RootStack (the one that owns 'Main' and 'ScanFlow')
    while (nav.getParent?.()) {
      nav = nav.getParent()
    }
    // If the root can go back (ScanFlow modal is on top of Main), do it
    if (nav.canGoBack?.()) {
      nav.goBack()
    } else {
      // Fallback: navigate to TodayTab
      nav.navigate('Main', { screen: 'TodayTab' })
    }
  }, [navigation])

  // Android hardware back → go home
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleDone()
      return true
    })
    return () => sub.remove()
  }, [handleDone])

  const metrics = useMemo(
    () => [
      {
        icon: Leaf,
        iconColor: BRAND.accent.chlorophyll,
        dimColor: BRAND.accentDim.chlorophyll,
        value: ingredientCount,
        label: 'Ingredients',
        sub: `${diversity.cycleUnique} unique this cycle`,
      },
      {
        icon: Beaker,
        iconColor: BRAND.accent.potassium,
        dimColor: BRAND.accentDim.potassium,
        value: nutrientsFound,
        label: 'Nutrients',
        sub: `${coverage.cycleNutrients}/8 discovered`,
      },
      {
        icon: TrendingUp,
        iconColor: BRAND.accent.vitaminC,
        dimColor: BRAND.accentDim.vitaminC,
        value: `+${scoreIncrease}`,
        label: 'Score Increase',
        sub: null,
      },
      {
        icon: Flame,
        iconColor: BRAND.accent.vitaminA,
        dimColor: BRAND.accentDim.vitaminA,
        value: `${streak.currentCycleStreak}d`,
        label: 'Streak',
        sub: null,
      },
    ],
    [ingredientCount, nutrientsFound, scoreIncrease, diversity, coverage, streak],
  )

  return (
    <View style={s.root}>
      <MeshGradientBg />

      {/* Soft glow behind check icon — only when Session Logged is visible */}
      {sessionLoggedVisible && (
        <Animated.View style={[s.glowOrb, { opacity: glowOpacity }]}>
          <LinearGradient
            colors={['rgba(61,139,64,0.35)', 'rgba(61,139,64,0.0)']}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* Close button — top-right (always available) */}
        <Pressable
          onPress={handleDone}
          style={s.closeBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={22} color={BRAND.text.muted} />
        </Pressable>

        {/* ── Pending state: shown before Session Logged is revealed ── */}
        {!sessionLoggedVisible && (
          <View style={s.pendingContainer}>
            <ActivityIndicator size="large" color={BRAND.accent} />
            <Text style={s.pendingTitle}>
              {pendingAchievement
                ? 'Achievement unlocked!'
                : 'Saving your juice…'}
            </Text>
            <Text style={s.pendingSubtitle}>
              {pendingAchievement
                ? 'Taste check coming up…'
                : 'Taste check coming up…'}
            </Text>
          </View>
        )}

        {/* ── Session Logged content: only after taste feedback is resolved ── */}
        {sessionLoggedVisible && (
          <>
            {/* Check icon */}
            <View style={s.checkArea}>
              <Animated.View style={[s.checkCircle, { transform: [{ scale: checkScale }] }]}>
                <Check size={32} color="#FFFFFF" strokeWidth={2.5} />
              </Animated.View>
              <Text style={s.headline}>Session Logged</Text>
            </View>

            {/* Momentum score */}
            <Animated.View
              style={[
                s.momentumWrap,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <GlassSurface elevated style={s.momentumCard}>
                <Text style={s.momentumLabel}>Nutrition Momentum</Text>
                <Text style={s.momentumScore}>{momentum}</Text>
                <View style={s.momentumBar}>
                  <View style={[s.momentumFill, { width: `${Math.min(momentum / 1000, 1) * 100}%` }]} />
                </View>
              </GlassSurface>
            </Animated.View>

            {/* Metrics grid */}
            <Animated.View
              style={[
                s.metricsGrid,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {metrics.map((m) => (
                <GlassSurface key={m.label} style={s.metricCell} borderRadius={RADIUS.lg}>
                  <View style={[s.metricIcon, { backgroundColor: m.dimColor }]}>
                    <m.icon size={16} color={m.iconColor} strokeWidth={2} />
                  </View>
                  <Text style={s.metricValue}>{m.value}</Text>
                  <Text style={s.metricLabel}>{m.label}</Text>
                  {m.sub && <Text style={s.metricSub}>{m.sub}</Text>}
                </GlassSurface>
              ))}
            </Animated.View>

            {/* Actions */}
            <Animated.View style={[s.actions, { opacity: fadeAnim }]}>
              <TouchableOpacity
                onPress={handleContinue}
                activeOpacity={0.85}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="View Today"
              >
                <LinearGradient
                  colors={BRAND.cta.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.primaryBtn}
                >
                  <Text style={s.primaryBtnText}>View Today</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleScanAnother}
                activeOpacity={0.7}
                hitSlop={4}
                style={s.secondaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Scan Another"
              >
                <Text style={s.secondaryBtnText}>Scan Another</Text>
              </TouchableOpacity>

              <Pressable
                onPress={handleDone}
                style={({ pressed }) => [s.doneBtn, pressed && { opacity: 0.6 }]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Done — return to home"
              >
                <Text style={s.doneBtnText}>Done</Text>
              </Pressable>
            </Animated.View>
          </>
        )}
      </SafeAreaView>

      {/* Glow Streak toast */}
      {glowToast && (
        <View style={s.glowToast}>
          <Flame size={14} color="#FFB74D" />
          <Text style={s.glowToastText}>{glowToast}</Text>
        </View>
      )}

      {/* Lightweight pending indicator — shown while post-juice feedback is queued */}
      {pendingIndicator && !showTasteFeedback && !pendingAchievement && (
        <View style={s.pendingIndicator} pointerEvents="none">
          <ActivityIndicator size="small" color={BRAND.accent} />
          <Text style={s.pendingIndicatorText}>
            {hasAchievementRef.current
              ? 'Taste check queued…'
              : 'Saving your juice…'}
          </Text>
        </View>
      )}

      {/* Achievement Overlay */}
      <AchievementOverlay
        achievement={pendingAchievement}
        visible={!!pendingAchievement}
        onDismiss={handleAchievementDismiss}
      />

      {/* Taste Feedback Modal — enhanced with optional rating, note, favorite */}
      <Modal
        visible={showTasteFeedback}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={resolveTasteFeedback}
      >
        <View style={s.tasteOverlay}>
          <View style={s.tasteCard}>
            <View style={s.tasteHeader}>
              <Text style={s.tasteTitle}>How was the taste?</Text>
              <TouchableOpacity
                style={s.tasteCloseBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  resolveTasteFeedback()
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close without answering"
              >
                <X size={18} color="#8B949E" />
              </TouchableOpacity>
            </View>
            <View style={s.tasteOptions}>
              {TASTE_REACTIONS.map((r) => (
                <TouchableOpacity
                  key={r.emoji}
                  style={s.tasteBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    trackEvent('taste_feedback_submitted', {
                      reaction: r.label,
                      ingredient_count: ingredientCount,
                      log_entry_id: logEntryId,
                    })
                    if (logEntryId) {
                      setTasteReaction(logEntryId, r)
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={s.tasteEmoji}>{r.emoji}</Text>
                  <Text style={s.tasteBtnLabel}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Optional enrichment: rating, note, favorite */}
            <View style={s.enrichSection}>
              <Text style={s.enrichLabel}>Rate this juice (optional)</Text>
              <View style={s.enrichStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setEnrichRating((prev) => (prev === star ? 0 : star))
                    }}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`${star} star${star !== 1 ? 's' : ''}`}
                  >
                    <Star
                      size={22}
                      color={star <= enrichRating ? '#FFD54F' : '#8B949E'}
                      fill={star <= enrichRating ? '#FFD54F' : 'transparent'}
                    />
                  </Pressable>
                ))}
              </View>

              <Text style={[s.enrichLabel, { marginTop: 12 }]}>Add a note (optional)</Text>
              <TextInput
                style={s.enrichNoteInput}
                value={enrichNote}
                onChangeText={setEnrichNote}
                placeholder="Great morning juice. Use a little less ginger next time."
                placeholderTextColor="#8B949E"
                multiline
                maxLength={500}
              />

              <Pressable
                style={({ pressed }) => [s.enrichFavoriteBtn, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setEnrichFavorite((prev) => !prev)
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={enrichFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  size={16}
                  color={enrichFavorite ? '#EF5DA8' : '#8B949E'}
                  fill={enrichFavorite ? '#EF5DA8' : 'transparent'}
                />
                <Text style={[s.enrichFavoriteText, enrichFavorite && { color: '#EF5DA8' }]}>
                  {enrichFavorite ? 'Added to Favorites' : 'Add to Favorites'}
                </Text>
              </Pressable>
            </View>

            <View style={s.tasteActions}>
              <TouchableOpacity
                style={s.tasteSaveBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  if (logEntryId) {
                    // Atomic single-dispatch save — prevents stale-closure
                    // races that occurred when calling setRating + setNote +
                    // toggleFavorite separately.
                    const metadataUpdates = {}
                    if (enrichRating > 0) metadataUpdates.rating = enrichRating
                    if (enrichNote.trim().length > 0) metadataUpdates.note = enrichNote.trim()
                    if (enrichFavorite) metadataUpdates.favorite = true
                    if (Object.keys(metadataUpdates).length > 0) {
                      updateEntryMetadata(logEntryId, metadataUpdates)
                    }
                  }
                  trackEvent('post_juice_enrichment_saved', {
                    has_rating: enrichRating > 0,
                    has_note: enrichNote.trim().length > 0,
                    is_favorite: enrichFavorite,
                    log_entry_id: logEntryId,
                  })
                  resolveTasteFeedback()
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Save and continue"
              >
                <Text style={s.tasteSaveText}>Save / Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.tasteSkipBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  resolveTasteFeedback()
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Skip enrichment"
              >
                <Text style={s.tasteSkipText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.background.primary,
  },
  safe: {
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    top: SPACE.xl,
    right: SPACE.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowOrb: {
    position: 'absolute',
    top: '10%',
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
  },
  checkArea: {
    alignItems: 'center',
    paddingTop: SPACE.xxxl,
    marginBottom: SPACE.xl,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BRAND.cta.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACE.lg,
    ...SHADOW.glow,
  },
  headline: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    letterSpacing: -0.5,
  },
  momentumWrap: {
    paddingHorizontal: SPACE.xl,
    marginBottom: SPACE.lg,
  },
  momentumCard: {
    alignItems: 'center',
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.xl,
  },
  momentumLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: SPACE.xs,
  },
  momentumScore: {
    fontSize: 48,
    fontWeight: FONT_WEIGHT.heavy,
    color: BRAND.text.primary,
    letterSpacing: -2,
    marginBottom: SPACE.md,
  },
  momentumBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  momentumFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: BRAND.cta.primary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACE.xl,
    gap: SPACE.sm,
    marginBottom: SPACE.xl,
  },
  metricCell: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.sm,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
  metricValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.secondary,
    marginBottom: 2,
  },
  metricSub: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xxl,
    gap: SPACE.md,
  },
  primaryBtn: {
    height: 56,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.md,
    shadowColor: BRAND.cta.shadow,
  },
  primaryBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.muted,
  },
  doneBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.secondary,
  },
  glowToast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30,30,30,0.92)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,179,0,0.2)',
  },
  glowToastText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#FFB74D',
  },
  pendingIndicator: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30,30,30,0.88)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pendingIndicatorText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.secondary,
  },
  pendingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
    gap: SPACE.md,
  },
  pendingTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.primary,
    letterSpacing: -0.3,
  },
  pendingSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: BRAND.text.muted,
    letterSpacing: 0.3,
  },
  tasteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tasteCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#161B22',
    borderRadius: 20,
    padding: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tasteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  tasteTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
  },
  tasteCloseBtn: {
    padding: 4,
  },
  tasteOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  tasteBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    minWidth: 80,
  },
  tasteEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  tasteBtnLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.secondary,
  },
  tasteSkipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  tasteSkipText: {
    fontSize: FONT_SIZE.xs,
    color: BRAND.text.muted,
  },
  // Post-juice enrichment styles
  enrichSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  enrichLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.muted,
    marginBottom: 8,
  },
  enrichStars: {
    flexDirection: 'row',
    gap: 8,
  },
  enrichNoteInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FONT_SIZE.sm,
    color: BRAND.text.primary,
    minHeight: 60,
    maxHeight: 100,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  enrichFavoriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  enrichFavoriteText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: BRAND.text.muted,
  },
  tasteActions: {
    marginTop: 16,
  },
  tasteSaveBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: BRAND.cta.primary,
    borderRadius: RADIUS.md,
    marginBottom: 8,
  },
  tasteSaveText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
})
