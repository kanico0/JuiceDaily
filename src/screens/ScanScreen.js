// ─────────────────────────────────────────────────────────────
// ScanScreen.js — Scan-first hero entry point
// Onboarding flow: Hero → Scan → Tracking Hook → Goal → Today
// Post-onboarding: Quick scan CTA + secondary actions
// Secondary actions (ff_scan_secondary_actions):
//   Browse Juice Ideas, See an Example Scan, Explore without tracking
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Modal,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  Camera,
  Scan,
  Target,
  Sparkles,
  Check,
  Compass,
  Eye,
  ChevronRight,
  X,
  Leaf,
  Crown,
  Zap,
  Shield,
  BookOpen,
  Home,
  Settings,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import LiquidNutrientOrb from '../components/LiquidNutrientOrb'
import { DARK, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING, LIQUID_SPRING, LIQUID_SPRING_SNAPPY } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import { useActivation } from '../services/ActivationStore'
import { useFlags } from '../services/FeatureFlags'
import { useJuiceLog } from '../services/JuiceLogStore'
import { RECIPES, getCleanupLabel } from '../constants/recipeData'

const GOALS = [
  { id: 'energy', label: 'More Energy', emoji: 'âš¡' },
  { id: 'glow', label: 'Better Skin', emoji: 'âœ¨' },
  { id: 'immunity', label: 'Stronger Immunity', emoji: 'ðŸ›¡ï¸' },
  { id: 'detox', label: 'Daily Detox', emoji: 'ðŸŒ¿' },
  { id: 'explore', label: 'Just Exploring', emoji: 'ðŸ§­' },
]

// â”€â”€ Browse Ideas source: curated RECIPES (offline-safe) â”€â”€â”€â”€â”€â”€

// â”€â”€ Example scan mock data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EXAMPLE_SCAN = {
  produce: [
    { name: 'Kale', amount: '2 large leaves (~80g)' },
    { name: 'Green Apple', amount: '1 medium (~180g)' },
    { name: 'Cucumber', amount: 'Â½ cucumber (~150g)' },
    { name: 'Lemon', amount: 'Â½ lemon (~40g)' },
    { name: 'Ginger', amount: '1 thumb (~10g)' },
  ],
  nutrients: [
    { label: 'Vitamin C', value: '68mg', pct: 76, color: '#FFB74D' },
    { label: 'Vitamin A', value: '500mcg', pct: 56, color: '#81C784' },
    { label: 'Potassium', value: '620mg', pct: 24, color: '#64B5F6' },
    { label: 'Iron', value: '1.8mg', pct: 10, color: '#EF5350' },
  ],
  totalCal: 112,
  juiceOz: '~10 oz',
}

// ── Nutrient Teaser Lines ────────────────────────────────────

const TEASER_LINES = [
  'Carrots → Vitamin A',
  'Ginger → Anti-inflammatory',
  'Spinach → Iron boost',
  'Beets → Nitric oxide support',
  'Kale → Vitamin C powerhouse',
  'Turmeric → Curcumin boost',
]

function NutrientTeaser({ isReduced }) {
  const [index, setIndex] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current
  const timerRef = useRef(null)

  useEffect(() => {
    let mounted = true

    trackEvent('scan_teaser_visible', { teaser_index: 0 })
    if (isReduced) return

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    timerRef.current = setInterval(() => {
      if (!mounted) return
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        easing: EASING.linear,
        useNativeDriver: true,
      }).start(() => {
        if (!mounted) return
        setIndex((prev) => {
          const next = (prev + 1) % TEASER_LINES.length
          trackEvent('scan_teaser_visible', { teaser_index: next })
          return next
        })
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }).start()
      })
    }, 3500)

    return () => {
      mounted = false
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      Animated.timing(fadeAnim, { toValue: 1, duration: 0, useNativeDriver: true }).stop()
    }
  }, [isReduced, fadeAnim])

  return (
    <View style={teaserStyles.wrap} accessibilityRole="text" accessibilityLabel={`Nutrient fact: ${TEASER_LINES[index]}`}>
      <Animated.Text style={[teaserStyles.text, !isReduced && { opacity: fadeAnim }]}>
        {TEASER_LINES[index]}
      </Animated.Text>
    </View>
  )
}

const teaserStyles = StyleSheet.create({
  wrap: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  text: {
    fontSize: 14,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#B0BEC5',
    opacity: 0.9,
    letterSpacing: 0.4,
  },
})

// ── Secondary Actions Row ────────────────────────────────────

function SecondaryActions({ onBrowse, onExample, onExplore, isReduced }) {
  return (
    <View style={secStyles.wrap}>
      <TouchableOpacity
        style={secStyles.btn}
        onPress={onBrowse}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Browse juice ideas"
      >
        <Compass size={16} color="#64B5F6" />
        <Text style={secStyles.btnText}>Browse Juice Ideas</Text>
        <ChevronRight size={14} color={DARK.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity
        style={secStyles.btn}
        onPress={onExample}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="See an example scan"
      >
        <Eye size={16} color="#CE93D8" />
        <Text style={secStyles.btnText}>See an Example Scan</Text>
        <ChevronRight size={14} color={DARK.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity
        style={secStyles.tertiaryBtn}
        onPress={onExplore}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Explore without tracking"
      >
        <Text style={secStyles.tertiaryText}>Explore without tracking</Text>
      </TouchableOpacity>
    </View>
  )
}

const secStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: 8,
    gap: 6,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  btnText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
  },
  tertiaryBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  tertiaryText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
})

// ── Browse Ideas Modal ───────────────────────────────────────

function BrowseIdeasModal({ visible, onDismiss, onScanReady, isReduced, navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const coreRecipes = useMemo(() => {
    return RECIPES
      .filter((r) => r.collection === 'core' && r.tier === 'free')
      .slice()
  }, [])

  useEffect(() => {
    if (visible) {
      trackEvent('browse_ideas_opened', { source: 'scan_screen' })
      if (isReduced) { fadeAnim.setValue(1) } else {
        Animated.timing(fadeAnim, { toValue: 1, duration: DURATION.enter, easing: EASING.decelerate, useNativeDriver: true }).start()
      }
    } else {
      fadeAnim.setValue(0)
    }
  }, [visible])

  if (!visible) return null

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[browseStyles.overlay, { opacity: fadeAnim }]}>
        <SafeAreaView style={browseStyles.safe} edges={['top', 'bottom']}>
          <View style={browseStyles.header}>
            <Text style={browseStyles.title}>Juice Ideas</Text>
            <TouchableOpacity
              onPress={onDismiss}
              style={browseStyles.closeBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color={DARK.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={browseStyles.scroll}
            contentContainerStyle={browseStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {coreRecipes.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={browseStyles.templateCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  trackEvent('browse_recipe_opened', { recipe_id: r.id })
                  onDismiss()
                  navigation.navigate('RecipeDetail', { recipeId: r.id })
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}: ${r.ingredients.map((i) => i.name).join(', ')}`}
              >
                <View style={[browseStyles.templateDot, { backgroundColor: r.vibeColor }]} />
                <View style={browseStyles.templateContent}>
                  <Text style={browseStyles.templateName}>{r.title}</Text>
                  <Text style={browseStyles.templateIng} numberOfLines={1}>
                    {r.vibeTag} · {r.ingredients.length} ingredients · {getCleanupLabel(r.cleanupScore)}
                  </Text>
                </View>
                <ChevronRight size={14} color={DARK.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={browseStyles.footer}>
            <TouchableOpacity
              style={browseStyles.scanReadyBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
                onScanReady()
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Scan when ready"
            >
              <LinearGradient
                colors={['#4CAF50', '#2E7D32']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={browseStyles.scanReadyGradient}
              >
                <Camera size={18} color="#FFFFFF" />
                <Text style={browseStyles.scanReadyText}>Scan when ready</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  )
}

const browseStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  templateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginBottom: 2,
  },
  templateIng: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
  },
  detailCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  detailName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.heavy,
  },
  detailLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  detailIng: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textPrimary,
    paddingVertical: 3,
  },
  highlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  highlightChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  highlightText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textSecondary,
  },
  backBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
  backText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#64B5F6',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  scanReadyBtn: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  scanReadyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
  },
  scanReadyText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.heavy,
    color: '#FFFFFF',
  },
})

// ── Example Scan Modal ───────────────────────────────────────

function ExampleScanModal({ visible, onDismiss, onTryScan, isReduced }) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      trackEvent('scan_example_viewed', { source: 'scan_screen' })
      if (isReduced) { fadeAnim.setValue(1) } else {
        Animated.timing(fadeAnim, { toValue: 1, duration: DURATION.enter, easing: EASING.decelerate, useNativeDriver: true }).start()
      }
    } else {
      fadeAnim.setValue(0)
    }
  }, [visible])

  if (!visible) return null

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[exStyles.overlay, { opacity: fadeAnim }]}>
        <SafeAreaView style={exStyles.safe} edges={['top', 'bottom']}>
          <View style={exStyles.header}>
            <Text style={exStyles.title}>Example Scan</Text>
            <TouchableOpacity
              onPress={onDismiss}
              style={exStyles.closeBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close example"
            >
              <X size={20} color={DARK.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={exStyles.scroll}
            contentContainerStyle={exStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Mock produce card */}
            <View style={exStyles.produceCard}>
              <View style={exStyles.produceHeader}>
                <Scan size={18} color="#81C784" />
                <Text style={exStyles.produceTitle}>Scanned Produce</Text>
              </View>
              {EXAMPLE_SCAN.produce.map((p) => (
                <View key={p.name} style={exStyles.produceRow}>
                  <Leaf size={14} color="#81C784" />
                  <Text style={exStyles.produceName}>{p.name}</Text>
                  <Text style={exStyles.produceAmt}>{p.amount}</Text>
                </View>
              ))}
            </View>

            {/* Nutrient highlights */}
            <View style={exStyles.nutrientCard}>
              <Text style={exStyles.nutrientTitle}>Nutrient Highlights</Text>
              {EXAMPLE_SCAN.nutrients.map((n) => (
                <View key={n.label} style={exStyles.nutrientRow}>
                  <Text style={exStyles.nutrientLabel}>{n.label}</Text>
                  <View style={exStyles.barTrack}>
                    <View style={[exStyles.barFill, { width: `${Math.min(n.pct, 100)}%`, backgroundColor: n.color }]} />
                  </View>
                  <Text style={exStyles.nutrientValue}>{n.value}</Text>
                </View>
              ))}
              <View style={exStyles.summaryRow}>
                <Text style={exStyles.summaryText}>{EXAMPLE_SCAN.totalCal} kcal</Text>
                <Text style={exStyles.summaryText}>{EXAMPLE_SCAN.juiceOz}</Text>
              </View>
            </View>

            <Text style={exStyles.disclaimer}>
              This is an example. Your results will vary based on actual produce scanned.
            </Text>
          </ScrollView>

          <View style={exStyles.footer}>
            <TouchableOpacity
              style={exStyles.tryBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
                onTryScan()
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Try scanning my produce"
            >
              <LinearGradient
                colors={['#4CAF50', '#2E7D32']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={exStyles.tryGradient}
              >
                <Camera size={18} color="#FFFFFF" />
                <Text style={exStyles.tryText}>Try scanning my produce</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  )
}

const exStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  produceCard: {
    backgroundColor: 'rgba(129,199,132,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.12)',
  },
  produceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  produceTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
  produceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  produceName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
  },
  produceAmt: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
  },
  nutrientCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  nutrientTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  nutrientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  nutrientLabel: {
    width: 80,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  nutrientValue: {
    width: 56,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    textAlign: 'right',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  summaryText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textSecondary,
  },
  disclaimer: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tryBtn: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  tryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
  },
  tryText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.heavy,
    color: '#FFFFFF',
  },
})

// ── Onboarding Screen 1: Hero ────────────────────────────────

function HeroStep({ onScan, onBrowse, onExample, onExplore, onNotReady, showSecondary, isReduced }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current
  const settleAnim = useRef(new Animated.Value(isReduced ? 1 : 1.02)).current
  const btnScale = useRef(new Animated.Value(1)).current
  const [isAnticipating, setIsAnticipating] = useState(false)

  useEffect(() => {
    trackEvent('onboarding_started', { source: 'scan_screen' })
    trackEvent('scan_entry_viewed', { variant: showSecondary ? 'with_secondary' : 'primary_only' })
    if (isReduced) {
      fadeAnim.setValue(1)
      slideAnim.setValue(0)
      settleAnim.setValue(1)
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, easing: EASING.decelerate, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, easing: EASING.decelerate, useNativeDriver: true }),
        Animated.timing(settleAnim, { toValue: 1, duration: 250, easing: EASING.decelerate, useNativeDriver: true }),
      ]).start()
    }
  }, [])

  const handlePressIn = useCallback(() => {
    if (!isReduced) {
      Animated.spring(btnScale, { toValue: 0.97, ...LIQUID_SPRING_SNAPPY }).start()
    }
  }, [isReduced])

  const handlePressOut = useCallback(() => {
    if (!isReduced) {
      Animated.spring(btnScale, { toValue: 1, ...LIQUID_SPRING }).start()
    }
  }, [isReduced])

  const handleCtaTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    trackEvent('scan_cta_tapped', { source: 'hero' })
    trackEvent('scan_primary_tapped', { source: 'hero' })

    if (isReduced) {
      onScan()
      return
    }

    setIsAnticipating(true)
    setTimeout(() => {
      setIsAnticipating(false)
      onScan()
    }, 300)
  }, [isReduced, onScan])

  return (
    <Animated.View style={[obStyles.stepWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: settleAnim }] }]}>
      {/* Liquid Nutrient Orb */}
      <View style={obStyles.orbWrap}>
        <LiquidNutrientOrb isReduced={isReduced} />
      </View>

      <Text style={obStyles.heroHeadline}>What's really in{'\n'}your juice?</Text>
      <Text style={obStyles.heroSub}>
        Let's find out.
      </Text>

      <NutrientTeaser isReduced={isReduced} />

      <Animated.View style={[obStyles.primaryBtnWrap, { transform: [{ scale: btnScale }] }]}>
        <Pressable
          style={obStyles.primaryBtn}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handleCtaTap}
          disabled={isAnticipating}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Reveal my nutrients"
        >
          <View style={obStyles.primaryBtnHighlight} pointerEvents="none" />
          <LinearGradient
            colors={['#43A047', '#2E7D32', '#1B5E20']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.8 }}
            style={obStyles.primaryBtnGradient}
          >
            <Camera size={22} color="#FFFFFF" />
            <Text style={obStyles.primaryBtnText}>
              {isAnticipating ? 'Analyzing\u2026' : 'Reveal My Nutrients'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <Text style={obStyles.reassurance}>No account needed. Just point and discover.</Text>

      {showSecondary ? (
        <SecondaryActions
          onBrowse={onBrowse}
          onExample={onExample}
          onExplore={onExplore}
          isReduced={isReduced}
        />
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [obStyles.secondaryBtn, pressed && { opacity: 0.5 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onExplore()
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="See how it works"
          >
            <Text style={obStyles.secondaryBtnText}>See how it works</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [obStyles.exploreFirstBtn, pressed && { opacity: 0.5 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              trackEvent('not_ready_yet_tapped', { source: 'hero' })
              onNotReady()
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Explore first"
          >
            <Home size={14} color="rgba(240, 246, 252, 0.35)" />
            <Text style={obStyles.exploreFirstText}>Explore first</Text>
          </Pressable>
        </>
      )}
    </Animated.View>
  )
}

// ── Onboarding Screen 3: Tracking Hook ───────────────────────

function TrackingHookStep({ onOptIn, onSkip, isReduced }) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isReduced) { fadeAnim.setValue(1) } else {
      Animated.timing(fadeAnim, { toValue: 1, duration: DURATION.enter, easing: EASING.decelerate, useNativeDriver: true }).start()
    }
  }, [])

  return (
    <Animated.View style={[obStyles.stepWrap, { opacity: fadeAnim }]}>
      <View style={obStyles.trackIcon}>
        <Target size={40} color="#64B5F6" />
      </View>
      <Text style={obStyles.stepTitle}>Want to track your{'\n'}juicing journey?</Text>
      <Text style={obStyles.stepDesc}>
        See your daily nutrition, build streaks, and unlock insights as you go.
      </Text>

      <Pressable
        style={obStyles.primaryBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onOptIn()
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Start tracking"
      >
        <LinearGradient
          colors={['#42A5F5', '#1E88E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={obStyles.primaryBtnGradient}
        >
          <Sparkles size={20} color="#FFFFFF" />
          <Text style={obStyles.primaryBtnText}>Start Tracking</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={({ pressed }) => [obStyles.secondaryBtn, pressed && { opacity: 0.5 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onSkip()
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Maybe later"
      >
        <Text style={obStyles.secondaryBtnText}>Maybe later</Text>
      </Pressable>
    </Animated.View>
  )
}

// ── Onboarding Screen 4: Goal Selection ──────────────────────

function GoalStep({ onSelect, isReduced }) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isReduced) { fadeAnim.setValue(1) } else {
      Animated.timing(fadeAnim, { toValue: 1, duration: DURATION.enter, easing: EASING.decelerate, useNativeDriver: true }).start()
    }
  }, [])

  return (
    <Animated.View style={[obStyles.stepWrap, { opacity: fadeAnim }]}>
      <Text style={obStyles.stepTitle}>What brings you{'\n'}to juicing?</Text>
      <Text style={obStyles.stepDesc}>Pick one — you can always change it later.</Text>

      <View style={obStyles.goalGrid}>
        {GOALS.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={obStyles.goalChip}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              trackEvent('goal_selected', { goal_enum: g.id })
              onSelect(g.id)
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={g.label}
          >
            <Text style={obStyles.goalEmoji}>{g.emoji}</Text>
            <Text style={obStyles.goalLabel}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  )
}

// ── Post-Onboarding: Scan Home ───────────────────────────────

function ScanHome({ onScan, onBrowse, onExample, onExplore, totalLogs, showSecondary, isReduced }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const settleAnim = useRef(new Animated.Value(isReduced ? 1 : 1.02)).current
  const btnScale = useRef(new Animated.Value(1)).current
  const [isAnticipating, setIsAnticipating] = useState(false)

  useEffect(() => {
    trackEvent('scan_entry_viewed', { variant: showSecondary ? 'with_secondary' : 'primary_only' })
    if (isReduced) {
      fadeAnim.setValue(1)
      settleAnim.setValue(1)
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, easing: EASING.decelerate, useNativeDriver: true }),
        Animated.timing(settleAnim, { toValue: 1, duration: 250, easing: EASING.decelerate, useNativeDriver: true }),
      ]).start()
    }
  }, [])

  const handlePressIn = useCallback(() => {
    if (!isReduced) {
      Animated.spring(btnScale, { toValue: 0.97, ...LIQUID_SPRING_SNAPPY }).start()
    }
  }, [isReduced])

  const handlePressOut = useCallback(() => {
    if (!isReduced) {
      Animated.spring(btnScale, { toValue: 1, ...LIQUID_SPRING }).start()
    }
  }, [isReduced])

  const handleCtaTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    trackEvent('scan_cta_tapped', { source: 'scan_home' })
    trackEvent('scan_primary_tapped', { source: 'scan_home' })

    if (isReduced) {
      onScan()
      return
    }

    setIsAnticipating(true)
    setTimeout(() => {
      setIsAnticipating(false)
      onScan()
    }, 300)
  }, [isReduced, onScan])

  return (
    <Animated.View style={[obStyles.stepWrap, { opacity: fadeAnim, transform: [{ scale: settleAnim }] }]}>
      <View style={obStyles.orbWrap}>
        <LiquidNutrientOrb isReduced={isReduced} />
      </View>

      <Text style={obStyles.heroHeadline}>What's really in{'\n'}your juice?</Text>
      <Text style={obStyles.heroSub}>
        Let's find out.
      </Text>

      <NutrientTeaser isReduced={isReduced} />

      {totalLogs > 0 && (
        <View style={obStyles.logsBadge}>
          <Check size={14} color="#81C784" />
          <Text style={obStyles.logsBadgeText}>{totalLogs} juice{totalLogs !== 1 ? 's' : ''} logged</Text>
        </View>
      )}

      <Animated.View style={[obStyles.primaryBtnWrap, { transform: [{ scale: btnScale }] }]}>
        <Pressable
          style={obStyles.primaryBtn}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handleCtaTap}
          disabled={isAnticipating}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Reveal my nutrients"
        >
          <View style={obStyles.primaryBtnHighlight} pointerEvents="none" />
          <LinearGradient
            colors={['#43A047', '#2E7D32', '#1B5E20']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.8 }}
            style={obStyles.primaryBtnGradient}
          >
            <Camera size={22} color="#FFFFFF" />
            <Text style={obStyles.primaryBtnText}>
              {isAnticipating ? 'Analyzing…' : 'Reveal My Nutrients'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <Text style={obStyles.reassurance}>No account needed. Just point and discover.</Text>

      {showSecondary && (
        <SecondaryActions
          onBrowse={onBrowse}
          onExample={onExample}
          onExplore={onExplore}
          isReduced={isReduced}
        />
      )}
    </Animated.View>
  )
}

// -- Browse Home: Discovery Hub --

function BrowseHome({ onScan, onBrowse, onExample, onExplore, onGlowLibrary, onSeasonalPacks, onBeginnerPath, isExpandedRecipes, totalLogs, isReduced }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const btnScale = useRef(new Animated.Value(1)).current
  const isReturning = totalLogs > 0

  useEffect(() => {
    trackEvent('explore_home_viewed', { total_logs: totalLogs })
    if (isReduced) {
      fadeAnim.setValue(1)
    } else {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, easing: EASING.decelerate, useNativeDriver: true }).start()
    }
  }, [])

  const handlePressIn = useCallback(() => {
    if (!isReduced) {
      Animated.spring(btnScale, { toValue: 0.97, ...LIQUID_SPRING_SNAPPY }).start()
    }
  }, [isReduced])

  const handlePressOut = useCallback(() => {
    if (!isReduced) {
      Animated.spring(btnScale, { toValue: 1, ...LIQUID_SPRING }).start()
    }
  }, [isReduced])

  return (
    <Animated.View style={[obStyles.stepWrap, { opacity: fadeAnim }]}>
      <Text style={obStyles.heroHeadline}>What will you juice today?</Text>
      <Text style={obStyles.heroSub}>
        Discover a blend, scan your ingredients, or revisit what works for you.
      </Text>

      {totalLogs > 0 && (
        <View style={obStyles.logsBadge}>
          <Check size={14} color="#81C784" />
          <Text style={obStyles.logsBadgeText}>{totalLogs} juice{totalLogs !== 1 ? 's' : ''} logged</Text>
        </View>
      )}

      {/* Primary CTA â€” Scan Produce */}
      <Animated.View style={[obStyles.primaryBtnWrap, { transform: [{ scale: btnScale }], marginTop: isReturning ? 12 : 20 }]}>
        <Pressable
          style={obStyles.primaryBtn}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
            trackEvent('scan_cta_tapped', { source: 'explore_home' })
            onScan()
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isReturning ? 'Scan produce' : 'Reveal my nutrients'}
        >
          <View style={obStyles.primaryBtnHighlight} pointerEvents="none" />
          <LinearGradient
            colors={['#43A047', '#2E7D32', '#1B5E20']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.8 }}
            style={obStyles.primaryBtnGradient}
          >
            <Camera size={22} color="#FFFFFF" />
            <Text style={obStyles.primaryBtnText}>{isReturning ? 'Scan Produce' : 'Reveal My Nutrients'}</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Discovery action cards */}
      <View style={browseHomeStyles.actions}>
        {isExpandedRecipes && (
          <>
            <Pressable
              style={({ pressed }) => [browseHomeStyles.actionCard, pressed && { opacity: 0.7 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onBeginnerPath()
              }}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Beginner Glow Path"
            >
              <BookOpen size={20} color="#81C784" />
              <View style={browseHomeStyles.actionContent}>
                <Text style={browseHomeStyles.actionTitle}>Beginner Glow Path</Text>
                <Text style={browseHomeStyles.actionDesc}>Day-by-day recipes to build consistency</Text>
              </View>
              <ChevronRight size={16} color={DARK.textMuted} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [browseHomeStyles.actionCard, pressed && { opacity: 0.7 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onSeasonalPacks()
              }}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Seasonal Glow Packs"
            >
              <Leaf size={20} color="#64B5F6" />
              <View style={browseHomeStyles.actionContent}>
                <Text style={browseHomeStyles.actionTitle}>Seasonal Glow Packs</Text>
                <Text style={browseHomeStyles.actionDesc}>Limited-time seasonal recipe drops</Text>
              </View>
              <ChevronRight size={16} color={DARK.textMuted} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [browseHomeStyles.actionCard, pressed && { opacity: 0.7 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onGlowLibrary()
              }}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Glow Library"
            >
              <Crown size={20} color="#FFD54F" />
              <View style={browseHomeStyles.actionContent}>
                <Text style={browseHomeStyles.actionTitle}>Glow Library</Text>
                <Text style={browseHomeStyles.actionDesc}>Pro-only recipe collections</Text>
              </View>
              <ChevronRight size={16} color={DARK.textMuted} />
            </Pressable>
          </>
        )}

        <Pressable
          style={({ pressed }) => [browseHomeStyles.actionCard, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onBrowse()
          }}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Browse juice ideas"
        >
          <Compass size={20} color="#64B5F6" />
          <View style={browseHomeStyles.actionContent}>
            <Text style={browseHomeStyles.actionTitle}>Browse Juice Ideas</Text>
            <Text style={browseHomeStyles.actionDesc}>Curated recipes to inspire you</Text>
          </View>
          <ChevronRight size={16} color={DARK.textMuted} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [browseHomeStyles.actionCard, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onExplore()
          }}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="See how it works"
        >
          <BookOpen size={20} color="#CE93D8" />
          <View style={browseHomeStyles.actionContent}>
            <Text style={browseHomeStyles.actionTitle}>Learn How It Works</Text>
            <Text style={browseHomeStyles.actionDesc}>Quick 3-step walkthrough</Text>
          </View>
          <ChevronRight size={16} color={DARK.textMuted} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [browseHomeStyles.actionCard, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onExample()
          }}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Try a demo scan"
        >
          <Eye size={20} color="#FFB74D" />
          <View style={browseHomeStyles.actionContent}>
            <Text style={browseHomeStyles.actionTitle}>Try a Demo Scan</Text>
            <Text style={browseHomeStyles.actionDesc}>See results without scanning</Text>
          </View>
          <ChevronRight size={16} color={DARK.textMuted} />
        </Pressable>
      </View>

      <Text style={obStyles.reassurance}>{isReturning ? 'Your daily journey continues.' : 'Ready when you are.'}</Text>
    </Animated.View>
  )
}

const browseHomeStyles = StyleSheet.create({
  actions: {
    width: '100%',
    gap: 8,
    marginBottom: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
})

export default function ScanScreen({ navigation }) {
  const isReduced = useReducedMotion()
  const { isEnabled } = useFlags()
  const {
    activation,
    unlocks,
    recordLog,
    recordOnboardingComplete,
    recordTrackingOptIn,
    setGoal,
    recordIntroDismissed,
  } = useActivation()

  const { totalLogCount } = useJuiceLog()

  const showSecondary = isEnabled('ff_scan_secondary_actions')
  const forceOnboarding = isEnabled('ff_force_onboarding')
  const isExpandedRecipes = isEnabled('ff_expanded_recipes')

  // Onboarding step: 'browse' | 'tracking' | 'goal' | 'done'
  // 'browse' = stable Home/Dashboard (consistent home base)
  // 'done'   = post-onboarding scan home (committed user)
  // Note: 'hero' (Intro) is now handled by the root gate in App.js
  const [obStep, setObStep] = useState(() => {
    if (activation.onboardingComplete) return 'done'
    return 'browse'
  })
  const [showBrowseModal, setShowBrowseModal] = useState(false)
  const [showExample, setShowExample] = useState(false)
  // Session-only flag: suppress tracking prompt after dismissal (resets on app restart)
  const [trackingDismissedThisSession, setTrackingDismissedThisSession] = useState(false)
  // Goal saved banner: show on browse after goal selection, dismissible
  // Ref: pending tracking prompt (deferred until user returns from camera with items)
  const pendingTrackingRef = useRef(false)

  // Sync if activation hydrates after mount
  useEffect(() => {
    if (activation.onboardingComplete && obStep !== 'done' && obStep !== 'browse') {
      setObStep('done')
    }
  }, [activation.onboardingComplete])

  // When screen re-focuses after camera, check if tracking prompt is pending
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (pendingTrackingRef.current) {
        pendingTrackingRef.current = false
        // Only show tracking if user actually logged items (came back with data)
        // If they cancelled (camera X â†’ goBack), they land on browse â€” no prompt
        if (unlocks.totalLogsCount > 0 && !trackingDismissedThisSession) {
          setObStep('tracking')
        }
        // Otherwise stay on browse
      }
    })
    return unsubscribe
  }, [navigation, unlocks.totalLogsCount, trackingDismissedThisSession])

  // â”€â”€ Navigation handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleScan = useCallback(() => {
    navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { openCamera: true, source: 'camera' } })
    trackEvent('scan_cta_tapped', { source: obStep })
  }, [navigation, obStep])

  // Scan from browse â€” navigate to camera, then return to browse
  const handleScanFromBrowse = useCallback(() => {
    navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { openCamera: true, source: 'camera' } })
    trackEvent('scan_cta_tapped', { source: 'browse_home' })
    // obStep stays 'browse' â€” camera close returns here
  }, [navigation])

  const handleNotReady = useCallback(() => {
    trackEvent('explore_first_tapped', { source: obStep })
  }, [obStep])

  const handleBrowseIdeas = useCallback(() => {
    trackEvent('scan_secondary_browse_tapped', { source: obStep })
    setShowBrowseModal(true)
  }, [obStep])

  const handleExample = useCallback(() => {
    trackEvent('scan_secondary_example_tapped', { source: obStep })
    setShowExample(true)
  }, [obStep])

  const handleExplore = useCallback(() => {
    navigation.navigate('ExplainFlow')
  }, [navigation])

  const handleBrowseScanReady = useCallback(() => {
    setShowBrowseModal(false)
    handleScan()
  }, [handleScan])

  const handleExampleTryScan = useCallback(() => {
    setShowExample(false)
    handleScan()
  }, [handleScan])

  const handleTrackingOptIn = useCallback(() => {
    recordTrackingOptIn()
    trackEvent('tracking_opt_in', { source: 'onboarding' })
    setObStep('goal')
  }, [recordTrackingOptIn])

  // "Maybe later" â†’ go to browse (stable Home), NOT back to hero loop
  const handleTrackingSkip = useCallback(() => {
    trackEvent('tracking_maybe_later', { source: 'onboarding' })
    setTrackingDismissedThisSession(true)
    setObStep('browse')
  }, [])

  // Goal selected â†’ save goal, mark onboarding complete, go to browse (NOT forced scan)
  const handleGoalSelect = useCallback((goalId) => {
    setGoal(goalId)
    recordOnboardingComplete()
    trackEvent('goal_completed_to_browse', { goal: goalId })
    setObStep('browse')
  }, [setGoal, recordOnboardingComplete])

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Settings gear â€” top right */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Settings size={18} color="#484F58" />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.scrollWrap}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {obStep === 'browse' && (
            <BrowseHome
              onScan={handleScanFromBrowse}
              onBrowse={handleBrowseIdeas}
              onExample={handleExample}
              onExplore={handleExplore}
              onGlowLibrary={() => navigation.navigate('GlowLibrary')}
              onSeasonalPacks={() => navigation.navigate('SeasonalGlowPacks')}
              onBeginnerPath={() => navigation.navigate('BeginnerGlowPath')}
              isExpandedRecipes={isExpandedRecipes}
              totalLogs={totalLogCount}
              isReduced={isReduced}
            />
          )}
          {obStep === 'tracking' && (
            <TrackingHookStep onOptIn={handleTrackingOptIn} onSkip={handleTrackingSkip} isReduced={isReduced} />
          )}
          {obStep === 'goal' && (
            <GoalStep onSelect={handleGoalSelect} isReduced={isReduced} />
          )}
          {obStep === 'done' && (
            <ScanHome
              onScan={handleScan}
              onBrowse={handleBrowseIdeas}
              onExample={handleExample}
              onExplore={handleExplore}
              totalLogs={unlocks.totalLogsCount}
              showSecondary={showSecondary}
              isReduced={isReduced}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Browse Ideas Modal */}
      <BrowseIdeasModal
        visible={showBrowseModal}
        onDismiss={() => setShowBrowseModal(false)}
        onScanReady={handleBrowseScanReady}
        isReduced={isReduced}
        navigation={navigation}
      />

      {/* Example Scan Modal */}
      <ExampleScanModal
        visible={showExample}
        onDismiss={() => setShowExample(false)}
        onTryScan={handleExampleTryScan}
        isReduced={isReduced}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 2,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollWrap: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
})

const obStyles = StyleSheet.create({
  stepWrap: {
    alignItems: 'center',
  },
  // ── Liquid Nutrient Orb container ──
  orbWrap: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Headline (31px, tighter spacing) ──
  heroHeadline: {
    fontSize: 31,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  heroSub: {
    fontSize: 16,
    fontWeight: '500',
    color: '#B0BEC5',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 16,
    maxWidth: 280,
  },
  // ── Primary CTA (taller, shadow, highlight) ──
  primaryBtnWrap: {
    width: '100%',
    marginBottom: 12,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderTopLeftRadius: RADIUS.pill,
    borderTopRightRadius: RADIUS.pill,
    zIndex: 1,
  },
  primaryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: RADIUS.pill,
  },
  primaryBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.heavy,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  // ── Reassurance microcopy (≥16px for accessibility) ──
  reassurance: {
    fontSize: 16,
    fontWeight: FONT_WEIGHT.medium,
    color: '#90A4AE',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  // ── Secondary micro-link (≥16px, comfortable tap) ──
  secondaryBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#90A4AE',
  },
  exploreFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
  },
  exploreFirstText: {
    fontSize: 14,
    fontWeight: FONT_WEIGHT.medium,
    color: 'rgba(240, 246, 252, 0.35)',
  },
  trackIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(100,181,246,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.15)',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  stepDesc: {
    fontSize: 15,
    fontWeight: '500',
    color: DARK.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 280,
  },
  goalGrid: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.xl,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  goalEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  goalLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textPrimary,
  },
  logsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(129,199,132,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.15)',
  },
  logsBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#81C784',
  },
})
