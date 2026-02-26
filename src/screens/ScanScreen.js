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
  Zap,
  Shield,
  Droplets as DropIcon,
  BookOpen,
  Home,
  BarChart3,
  Flame,
  TrendingUp,
  AlertCircle,
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
import { useNutritionScore } from '../services/NutritionScoreStore'
import { USDA_RDA } from '../constants/nutrition'
import { getGlowState, checkInToday, skipToday } from '../services/glowStreak'
import { getFocusForToday, swapFocusToday } from '../services/focusNutrient'
import { shouldShowWeeklySummary, dismissWeeklySummary, buildWeeklySummaryData } from '../services/weeklySummary'
import { checkAchievements } from '../services/achievements'
import AchievementOverlay from '../components/AchievementOverlay'

const GOALS = [
  { id: 'energy', label: 'More Energy', emoji: '⚡' },
  { id: 'glow', label: 'Better Skin', emoji: '✨' },
  { id: 'immunity', label: 'Stronger Immunity', emoji: '🛡️' },
  { id: 'detox', label: 'Daily Detox', emoji: '🌿' },
  { id: 'explore', label: 'Just Exploring', emoji: '🧭' },
]

// ── Curated juice templates (offline-safe) ───────────────────

const BROWSE_TEMPLATES = [
  {
    id: 'green_glow',
    name: 'Green Glow',
    ingredients: ['Kale', 'Spinach', 'Cucumber', 'Green Apple', 'Lemon'],
    highlights: ['Vitamin C', 'Iron', 'Folate'],
    color: '#81C784',
  },
  {
    id: 'immunity_boost',
    name: 'Immunity Boost',
    ingredients: ['Orange', 'Carrot', 'Ginger', 'Turmeric'],
    highlights: ['Vitamin C', 'Vitamin A', 'Potassium'],
    color: '#FFB74D',
  },
  {
    id: 'beet_revival',
    name: 'Beet Revival',
    ingredients: ['Beet', 'Carrot', 'Apple', 'Ginger'],
    highlights: ['Folate', 'Potassium', 'Iron'],
    color: '#EF5350',
  },
  {
    id: 'tropical_detox',
    name: 'Tropical Detox',
    ingredients: ['Pineapple', 'Cucumber', 'Celery', 'Lime'],
    highlights: ['Vitamin C', 'Magnesium'],
    color: '#4DD0E1',
  },
  {
    id: 'carrot_sunrise',
    name: 'Carrot Sunrise',
    ingredients: ['Carrot', 'Orange', 'Lemon', 'Ginger'],
    highlights: ['Vitamin A', 'Vitamin C', 'Potassium'],
    color: '#FF9800',
  },
  {
    id: 'power_greens',
    name: 'Power Greens',
    ingredients: ['Kale', 'Celery', 'Cucumber', 'Lemon', 'Ginger'],
    highlights: ['Iron', 'Magnesium', 'Folate'],
    color: '#66BB6A',
  },
]

// ── Example scan mock data ───────────────────────────────────

const EXAMPLE_SCAN = {
  produce: [
    { name: 'Kale', amount: '2 large leaves (~80g)' },
    { name: 'Green Apple', amount: '1 medium (~180g)' },
    { name: 'Cucumber', amount: '½ cucumber (~150g)' },
    { name: 'Lemon', amount: '½ lemon (~40g)' },
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
    trackEvent('scan_teaser_visible', { teaser_index: 0 })
    if (isReduced) return

    timerRef.current = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        easing: EASING.linear,
        useNativeDriver: true,
      }).start(() => {
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
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isReduced])

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

function BrowseIdeasModal({ visible, onDismiss, onScanReady, isReduced }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  useEffect(() => {
    if (visible) {
      trackEvent('browse_ideas_opened', { source: 'scan_screen' })
      if (isReduced) { fadeAnim.setValue(1) } else {
        Animated.timing(fadeAnim, { toValue: 1, duration: DURATION.enter, easing: EASING.decelerate, useNativeDriver: true }).start()
      }
    } else {
      fadeAnim.setValue(0)
      setSelectedTemplate(null)
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
            {selectedTemplate ? (
              <View style={browseStyles.detailCard}>
                <View style={[browseStyles.detailBadge, { backgroundColor: `${selectedTemplate.color}15` }]}>
                  <Leaf size={16} color={selectedTemplate.color} />
                  <Text style={[browseStyles.detailName, { color: selectedTemplate.color }]}>
                    {selectedTemplate.name}
                  </Text>
                </View>
                <Text style={browseStyles.detailLabel}>Ingredients</Text>
                {selectedTemplate.ingredients.map((ing) => (
                  <Text key={ing} style={browseStyles.detailIng}>• {ing}</Text>
                ))}
                <Text style={[browseStyles.detailLabel, { marginTop: 14 }]}>Top Nutrients</Text>
                <View style={browseStyles.highlightRow}>
                  {selectedTemplate.highlights.map((h) => (
                    <View key={h} style={browseStyles.highlightChip}>
                      <Text style={browseStyles.highlightText}>{h}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={browseStyles.backBtn}
                  onPress={() => setSelectedTemplate(null)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Back to list"
                >
                  <Text style={browseStyles.backText}>← Back to ideas</Text>
                </TouchableOpacity>
              </View>
            ) : (
              BROWSE_TEMPLATES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={browseStyles.templateCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    trackEvent('browse_template_opened', { template_id: t.id })
                    setSelectedTemplate(t)
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.name}: ${t.ingredients.join(', ')}`}
                >
                  <View style={[browseStyles.templateDot, { backgroundColor: t.color }]} />
                  <View style={browseStyles.templateContent}>
                    <Text style={browseStyles.templateName}>{t.name}</Text>
                    <Text style={browseStyles.templateIng} numberOfLines={1}>
                      {t.ingredients.join(', ')}
                    </Text>
                  </View>
                  <ChevronRight size={14} color={DARK.textMuted} />
                </TouchableOpacity>
              ))
            )}
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

// ── Browse Home: Stable Dashboard ────────────────────────────

function BrowseHome({ onScan, onBrowse, onExample, onExplore, onViewToday, dailySummary, totalLogs, savedGoalId, onDismissGoalBanner, isReduced }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const btnScale = useRef(new Animated.Value(1)).current
  const goalData = savedGoalId ? GOALS.find((g) => g.id === savedGoalId) : null
  const isReturning = totalLogs > 0 && dailySummary

  // ── Glow Streak state ──
  const [glowCount, setGlowCount] = useState(0)
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [graceUsedToday, setGraceUsedToday] = useState(false)
  const [checkInFeedback, setCheckInFeedback] = useState(null) // 'checked' | 'already' | 'grace' | 'reset'
  const streakScale = useRef(new Animated.Value(1)).current

  // Hydrate glow state on mount
  useEffect(() => {
    ;(async () => {
      const s = await getGlowState()
      setGlowCount(s.count)
      const today = new Date().toISOString().slice(0, 10)
      if (s.lastCheckInDate === today) setCheckedInToday(true)
      if (s.graceUsedDate === today) setGraceUsedToday(true)
    })()
  }, [])

  const pulseStreak = useCallback(() => {
    if (isReduced) return
    Animated.sequence([
      Animated.timing(streakScale, { toValue: 1.06, duration: 180, useNativeDriver: true }),
      Animated.timing(streakScale, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start()
  }, [isReduced, streakScale])

  const handleCheckIn = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const result = await checkInToday()
    setGlowCount(result.count)
    if (result.wasIncremented) {
      setCheckedInToday(true)
      setCheckInFeedback('checked')
      pulseStreak()
      trackEvent('glow_streak_checkin', { count: result.count })
    } else {
      setCheckInFeedback('already')
    }
    setTimeout(() => setCheckInFeedback(null), 2500)
  }, [pulseStreak])

  const handleSkip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const result = await skipToday()
    setGlowCount(result.count)
    if (result.streakReset) {
      setCheckInFeedback('reset')
      trackEvent('glow_streak_reset', { reason: 'double_skip' })
    } else if (result.usedGrace) {
      setGraceUsedToday(true)
      setCheckInFeedback('grace')
      trackEvent('glow_streak_grace', { count: result.count })
    }
    setTimeout(() => setCheckInFeedback(null), 2500)
  }, [])

  // ── Focus Nutrient state ──
  const [focusNutrient, setFocusNutrient] = useState(null)
  const [focusSwapped, setFocusSwapped] = useState(false)
  const [showFocusDetail, setShowFocusDetail] = useState(false)

  // Hydrate focus nutrient on mount
  useEffect(() => {
    ;(async () => {
      const n = await getFocusForToday()
      if (n) setFocusNutrient(n)
    })()
  }, [])

  const handleSwapFocus = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const result = await swapFocusToday()
    if (result.swapped) {
      setFocusNutrient(result.nutrient)
      setFocusSwapped(true)
      trackEvent('focus_nutrient_swapped', { id: result.nutrient.id })
    }
  }, [])

  // ── Weekly Summary state ──
  const [weeklySummary, setWeeklySummary] = useState(null)
  const [showWeekly, setShowWeekly] = useState(false)
  const weeklyFade = useRef(new Animated.Value(0)).current
  const weeklySlide = useRef(new Animated.Value(-20)).current

  useEffect(() => {
    ;(async () => {
      const result = await shouldShowWeeklySummary()
      if (result.show) {
        const data = buildWeeklySummaryData({
          juicesThisWeek: dailySummary?.todayCount || 0,
          glowStreak: glowCount,
          recentNutrients: [],
        })
        setWeeklySummary(data)
        setShowWeekly(true)
        if (!isReduced) {
          Animated.parallel([
            Animated.timing(weeklyFade, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(weeklySlide, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]).start()
        } else {
          weeklyFade.setValue(1)
          weeklySlide.setValue(0)
        }
      }
    })()
  }, [glowCount])

  const handleDismissWeekly = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await dismissWeeklySummary()
    if (!isReduced) {
      Animated.timing(weeklyFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setShowWeekly(false)
      })
    } else {
      setShowWeekly(false)
    }
    trackEvent('weekly_summary_dismissed')
  }, [isReduced, weeklyFade])

  // ── Achievement state ──
  const [pendingAchievement, setPendingAchievement] = useState(null)

  // Check achievements after glow state hydrates
  useEffect(() => {
    if (glowCount === 0 && totalLogs === 0) return
    ;(async () => {
      const newlyUnlocked = await checkAchievements({
        totalLogs,
        streakCount: glowCount,
      })
      if (newlyUnlocked.length > 0) {
        setPendingAchievement(newlyUnlocked[0])
        trackEvent('achievement_unlocked', { id: newlyUnlocked[0].id })
      }
    })()
  }, [glowCount, totalLogs])

  useEffect(() => {
    trackEvent('browse_home_viewed', { total_logs: totalLogs, saved_goal: savedGoalId || 'none' })
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
      <View style={obStyles.orbWrap}>
        <LiquidNutrientOrb isReduced={isReduced} />
      </View>

      <Text style={obStyles.heroHeadline}>Welcome to Juicing</Text>
      <Text style={obStyles.heroSub}>
        {isReturning ? 'Here\'s your day at a glance.' : 'Explore at your own pace. Scan when you\'re ready.'}
      </Text>

      {/* ── Weekly Glow Summary ── */}
      {showWeekly && weeklySummary && (
        <Animated.View style={[weeklyStyles.card, { opacity: weeklyFade, transform: [{ translateY: weeklySlide }] }]}>
          <View style={weeklyStyles.headerRow}>
            <Text style={weeklyStyles.emoji}>🌟</Text>
            <Text style={weeklyStyles.title}>Your Glow Week</Text>
          </View>
          <View style={weeklyStyles.statsRow}>
            <View style={weeklyStyles.stat}>
              <Text style={weeklyStyles.statValue}>{weeklySummary.juicesThisWeek}</Text>
              <Text style={weeklyStyles.statLabel}>juices</Text>
            </View>
            <View style={weeklyStyles.statDivider} />
            <View style={weeklyStyles.stat}>
              <Text style={weeklyStyles.statValue}>{weeklySummary.glowStreak}d</Text>
              <Text style={weeklyStyles.statLabel}>streak</Text>
            </View>
            <View style={weeklyStyles.statDivider} />
            <View style={weeklyStyles.stat}>
              <Text style={weeklyStyles.statValue}>{weeklySummary.highlightNutrient}</Text>
              <Text style={weeklyStyles.statLabel}>top nutrient</Text>
            </View>
          </View>
          <View style={weeklyStyles.btnRow}>
            <Pressable
              style={({ pressed }) => [weeklyStyles.primaryBtn, pressed && { opacity: 0.8 }]}
              onPress={handleDismissWeekly}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Keep the glow going"
            >
              <Text style={weeklyStyles.primaryBtnText}>Keep the glow going</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [weeklyStyles.secondaryBtn, pressed && { opacity: 0.6 }]}
              onPress={handleDismissWeekly}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share glow"
            >
              <Text style={weeklyStyles.secondaryBtnText}>Share glow</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* ── Glow Streak + Daily Check-In ── */}
      <View style={glowStyles.card}>
        <Animated.View style={[glowStyles.streakRow, { transform: [{ scale: streakScale }] }]}>
          <Flame size={20} color="#FFB74D" />
          <Text style={glowStyles.streakLabel}>Glow Streak</Text>
          <Text style={glowStyles.streakValue}>{glowCount} day{glowCount !== 1 ? 's' : ''}</Text>
        </Animated.View>

        {checkInFeedback === 'checked' && (
          <Text style={glowStyles.feedback}>Checked in for today ✓</Text>
        )}
        {checkInFeedback === 'already' && (
          <Text style={glowStyles.feedback}>Already checked in today</Text>
        )}
        {checkInFeedback === 'grace' && (
          <Text style={[glowStyles.feedback, { color: '#FFB74D' }]}>Grace used — streak protected</Text>
        )}
        {checkInFeedback === 'reset' && (
          <Text style={[glowStyles.feedback, { color: '#FFB74D' }]}>New glow cycle begins.</Text>
        )}

        {!checkedInToday && !checkInFeedback && (
          <>
            <Text style={glowStyles.prompt}>Did you juice today?</Text>
            <View style={glowStyles.btnRow}>
              <Pressable
                style={({ pressed }) => [glowStyles.btnPrimary, pressed && { opacity: 0.8 }]}
                onPress={handleCheckIn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Yes, I juiced"
              >
                <Check size={16} color="#FFFFFF" />
                <Text style={glowStyles.btnPrimaryText}>Yes, I juiced</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [glowStyles.btnSecondary, graceUsedToday && { opacity: 0.4 }, pressed && { opacity: 0.6 }]}
                onPress={handleSkip}
                disabled={graceUsedToday}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Not today"
              >
                <Text style={glowStyles.btnSecondaryText}>Not today</Text>
              </Pressable>
            </View>
          </>
        )}

        {checkedInToday && !checkInFeedback && (
          <Text style={glowStyles.feedback}>Checked in for today ✓</Text>
        )}
      </View>

      {/* ── Today's Focus Nutrient ── */}
      {focusNutrient && (
        <View style={focusStyles.card}>
          <View style={focusStyles.headerRow}>
            <Text style={focusStyles.emoji}>{focusNutrient.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={focusStyles.label}>Today's Focus</Text>
              <Text style={focusStyles.name}>{focusNutrient.name}</Text>
            </View>
            {!focusSwapped && (
              <Pressable
                onPress={handleSwapFocus}
                hitSlop={10}
                style={({ pressed }) => [focusStyles.swapBtn, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Swap nutrient"
              >
                <Text style={focusStyles.swapText}>Swap</Text>
              </Pressable>
            )}
          </View>
          <Text style={focusStyles.benefit}>{focusNutrient.benefit}</Text>
          <View style={focusStyles.comboRow}>
            <Leaf size={13} color="#81C784" />
            <Text style={focusStyles.comboText}>Try: {focusNutrient.combos[0]}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [focusStyles.tipsBtn, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowFocusDetail(true)
              trackEvent('focus_nutrient_tips_opened', { id: focusNutrient.id })
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="See tips"
          >
            <Sparkles size={14} color="#64B5F6" />
            <Text style={focusStyles.tipsBtnText}>See tips</Text>
          </Pressable>
        </View>
      )}

      {/* Focus Detail Modal */}
      {focusNutrient && (
        <Modal
          visible={showFocusDetail}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFocusDetail(false)}
        >
          <View style={focusStyles.modalOverlay}>
            <View style={focusStyles.modalContent}>
              <View style={focusStyles.modalHeader}>
                <Text style={focusStyles.modalEmoji}>{focusNutrient.emoji}</Text>
                <Text style={focusStyles.modalTitle}>{focusNutrient.name}</Text>
                <Pressable
                  onPress={() => setShowFocusDetail(false)}
                  hitSlop={12}
                  style={focusStyles.modalClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X size={18} color={DARK.textMuted} />
                </Pressable>
              </View>
              <Text style={focusStyles.modalBenefit}>{focusNutrient.benefit}</Text>

              <Text style={focusStyles.modalSection}>Tips</Text>
              {focusNutrient.tips.map((tip, i) => (
                <View key={i} style={focusStyles.tipRow}>
                  <View style={focusStyles.tipBullet} />
                  <Text style={focusStyles.tipText}>{tip}</Text>
                </View>
              ))}

              <Text style={focusStyles.modalSection}>Suggested Combos</Text>
              {focusNutrient.combos.map((combo, i) => (
                <View key={i} style={focusStyles.comboItem}>
                  <Leaf size={14} color="#81C784" />
                  <Text style={focusStyles.comboItemText}>{combo}</Text>
                </View>
              ))}

              <Pressable
                style={({ pressed }) => [focusStyles.modalCta, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  setShowFocusDetail(false)
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
                  onScan()
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Try a scan"
              >
                <Camera size={18} color="#FFFFFF" />
                <Text style={focusStyles.modalCtaText}>Try a Scan</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Today Summary Card — returning users only */}
      {isReturning && (
        <View style={browseHomeStyles.summaryCard}>
          <Text style={browseHomeStyles.summaryTitle}>Today</Text>
          <View style={browseHomeStyles.summaryRow}>
            <View style={browseHomeStyles.summaryItem}>
              <DropIcon size={16} color="#64B5F6" />
              <Text style={browseHomeStyles.summaryValue}>{dailySummary.todayCount}</Text>
              <Text style={browseHomeStyles.summaryLabel}>juices</Text>
            </View>
            <View style={browseHomeStyles.summaryDivider} />
            <View style={browseHomeStyles.summaryItem}>
              <TrendingUp size={16} color="#81C784" />
              <Text style={browseHomeStyles.summaryValue}>{dailySummary.todayScore}</Text>
              <Text style={browseHomeStyles.summaryLabel}>score</Text>
            </View>
            <View style={browseHomeStyles.summaryDivider} />
            <View style={browseHomeStyles.summaryItem}>
              <Flame size={16} color="#FFB74D" />
              <Text style={browseHomeStyles.summaryValue}>{dailySummary.currentStreak}d</Text>
              <Text style={browseHomeStyles.summaryLabel}>streak</Text>
            </View>
          </View>
        </View>
      )}

      {/* Dynamic suggestion */}
      {isReturning && dailySummary.suggestion ? (
        <View style={browseHomeStyles.suggestionRow}>
          <AlertCircle size={14} color={DARK.textMuted} />
          <Text style={browseHomeStyles.suggestionText}>{dailySummary.suggestion}</Text>
        </View>
      ) : null}

      {/* Goal saved banner — dismissible */}
      {goalData && (
        <View style={browseHomeStyles.goalBanner}>
          <View style={browseHomeStyles.goalBannerContent}>
            <Text style={browseHomeStyles.goalBannerEmoji}>{goalData.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={browseHomeStyles.goalBannerTitle}>Goal saved: {goalData.label}</Text>
              <Text style={browseHomeStyles.goalBannerDesc}>We'll tailor your experience</Text>
            </View>
            <Pressable
              onPress={onDismissGoalBanner}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Dismiss goal banner"
            >
              <X size={16} color={DARK.textMuted} />
            </Pressable>
          </View>
        </View>
      )}

      {totalLogs > 0 && !isReturning && (
        <View style={obStyles.logsBadge}>
          <Check size={14} color="#81C784" />
          <Text style={obStyles.logsBadgeText}>{totalLogs} juice{totalLogs !== 1 ? 's' : ''} logged</Text>
        </View>
      )}

      {/* Primary CTA — Scan Produce */}
      <Animated.View style={[obStyles.primaryBtnWrap, { transform: [{ scale: btnScale }], marginTop: isReturning ? 12 : 20 }]}>
        <Pressable
          style={obStyles.primaryBtn}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
            trackEvent('scan_cta_tapped', { source: 'browse_home' })
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

      {/* Secondary CTA — View Today (returning users) */}
      {isReturning && (
        <Pressable
          style={({ pressed }) => [browseHomeStyles.secondaryCta, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onViewToday()
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="View Today"
        >
          <BarChart3 size={18} color="#81C784" />
          <Text style={browseHomeStyles.secondaryCtaText}>View Today</Text>
        </Pressable>
      )}

      {/* Low-friction browse actions */}
      <View style={browseHomeStyles.actions}>
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

        {totalLogs > 0 && !isReturning && (
          <Pressable
            style={({ pressed }) => [browseHomeStyles.actionCard, browseHomeStyles.actionCardHighlight, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onViewToday()
            }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="View Today"
          >
            <BarChart3 size={20} color="#81C784" />
            <View style={browseHomeStyles.actionContent}>
              <Text style={browseHomeStyles.actionTitle}>View Today</Text>
              <Text style={browseHomeStyles.actionDesc}>Your daily dashboard</Text>
            </View>
            <ChevronRight size={16} color={DARK.textMuted} />
          </Pressable>
        )}
      </View>

      <Text style={obStyles.reassurance}>{isReturning ? 'Your daily journey continues.' : 'Ready when you are.'}</Text>

      {/* Achievement Overlay */}
      <AchievementOverlay
        achievement={pendingAchievement}
        visible={!!pendingAchievement}
        onDismiss={() => setPendingAchievement(null)}
      />
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
  actionCardHighlight: {
    borderColor: 'rgba(76,175,80,0.2)',
    backgroundColor: 'rgba(76,175,80,0.06)',
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
  goalBanner: {
    width: '100%',
    marginBottom: 12,
  },
  goalBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(76, 175, 80, 0.15)',
  },
  goalBannerEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  goalBannerTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#81C784',
  },
  goalBannerDesc: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    marginTop: 1,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    fontStyle: 'italic',
  },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  secondaryCtaText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#81C784',
  },
})

const glowStyles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(255,179,0,0.12)',
    marginBottom: 12,
    marginTop: 4,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  streakLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
    flex: 1,
  },
  streakValue: {
    fontSize: 18,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFB74D',
  },
  prompt: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textPrimary,
    marginBottom: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 11,
  },
  btnPrimaryText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#FFFFFF',
  },
  btnSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  btnSecondaryText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
  feedback: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#81C784',
    textAlign: 'center',
    marginTop: 4,
  },
})

const focusStyles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.12)',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  emoji: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginTop: 1,
  },
  swapBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  swapText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
  },
  benefit: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    marginBottom: 8,
    lineHeight: 18,
  },
  comboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  comboText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: '#81C784',
    flex: 1,
  },
  tipsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(100,181,246,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.15)',
  },
  tipsBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#64B5F6',
  },
  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0D1A14',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalEmoji: {
    fontSize: 28,
  },
  modalTitle: {
    flex: 1,
    fontSize: FONT_SIZE.xl || 22,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBenefit: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalSection: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
    marginTop: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  tipBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#64B5F6',
    marginTop: 6,
  },
  tipText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textPrimary,
    lineHeight: 20,
  },
  comboItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(76,175,80,0.06)',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(76,175,80,0.12)',
  },
  comboItemText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: '#81C784',
  },
  modalCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2E7D32',
  },
  modalCtaText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
})

const weeklyStyles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,179,0,0.15)',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  emoji: {
    fontSize: 22,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2E7D32',
  },
  primaryBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
})

// ── Main Screen ──────────────────────────────────────────────

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

  // Daily summary data for returning users
  const { todayEntries, totalLogCount, diversityStats } = useJuiceLog()
  const { momentum, streak } = useNutritionScore()

  const dailySummary = useMemo(() => {
    const todayCount = todayEntries.length
    const todayScore = typeof momentum === 'number' ? momentum : 0
    const currentStreak = streak?.currentCycleStreak || 0
    // Find missing nutrients (< 5% DV) for suggestion
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
  }, [todayEntries, momentum, streak])

  const showSecondary = isEnabled('ff_scan_secondary_actions')
  const forceOnboarding = isEnabled('ff_force_onboarding')

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
  const [savedGoalId, setSavedGoalId] = useState(null)
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
        // If they cancelled (camera X → goBack), they land on browse — no prompt
        if (unlocks.totalLogsCount > 0 && !trackingDismissedThisSession) {
          setObStep('tracking')
        }
        // Otherwise stay on browse
      }
    })
    return unsubscribe
  }, [navigation, unlocks.totalLogsCount, trackingDismissedThisSession])

  // ── Navigation handlers ──────────────────────────────────────

  const handleScan = useCallback(() => {
    navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { openCamera: true, source: 'camera' } })
    trackEvent('scan_cta_tapped', { source: obStep })
  }, [navigation, obStep])

  // Scan from browse — navigate to camera, then return to browse
  const handleScanFromBrowse = useCallback(() => {
    navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { openCamera: true, source: 'camera' } })
    trackEvent('scan_cta_tapped', { source: 'browse_home' })
    // obStep stays 'browse' — camera close returns here
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

  // "Maybe later" → go to browse (stable Home), NOT back to hero loop
  const handleTrackingSkip = useCallback(() => {
    trackEvent('tracking_maybe_later', { source: 'onboarding' })
    setTrackingDismissedThisSession(true)
    setObStep('browse')
  }, [])

  // Goal selected → save goal, mark onboarding complete, go to browse (NOT forced scan)
  const handleGoalSelect = useCallback((goalId) => {
    setGoal(goalId)
    recordOnboardingComplete()
    trackEvent('goal_completed_to_browse', { goal: goalId })
    setSavedGoalId(goalId)
    setObStep('browse')
  }, [setGoal, recordOnboardingComplete])

  // ── Render ───────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Settings gear — top right */}
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
              onViewToday={() => navigation.navigate('PerformanceDashboard')}
              dailySummary={dailySummary}
              totalLogs={unlocks.totalLogsCount}
              savedGoalId={savedGoalId}
              onDismissGoalBanner={() => setSavedGoalId(null)}
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
