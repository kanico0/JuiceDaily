// ─────────────────────────────────────────────────────────────
// OptimizeScreen.js — Advanced juicing tools hub
// Groups: Calculator, Pantry, Templates, Challenges, History,
// Hall of Vitality, Monthly Heatmap, Novice Journey.
// Unlocked progressively (Day 7+ or via feature flag override).
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  Calculator,
  ShoppingCart,
  BookTemplate,
  Trophy,
  Clock,
  Award,
  CalendarDays,
  BookOpen,
  Beaker,
  ChevronRight,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import { useFlags } from '../services/FeatureFlags'
import { DARK, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'

const TOOLS = [
  {
    id: 'calculator',
    label: 'Juice Calculator',
    desc: 'Find produce to meet nutrient goals',
    icon: Calculator,
    color: '#CE93D8',
    route: 'JuiceCalculator',
    flag: 'ff_juice_calculator',
  },
  {
    id: 'pantry',
    label: 'Smart Pantry',
    desc: 'Track what you have, use it before it expires',
    icon: ShoppingCart,
    color: '#81C784',
    route: 'FridgeForager',
    flag: 'ff_smart_pantry',
  },
  {
    id: 'templates',
    label: 'Juice Templates',
    desc: 'Save and reuse your favorite recipes',
    icon: BookTemplate,
    color: '#64B5F6',
    route: 'FridgeForager',
    flag: 'ff_templates',
  },
  {
    id: 'challenges',
    label: 'Challenges',
    desc: 'Join community juicing challenges',
    icon: Trophy,
    color: '#FFB74D',
    route: 'HallOfVitality',
    flag: 'ff_social_challenges',
  },
  {
    id: 'history',
    label: 'Vitality History',
    desc: 'Review your juicing timeline',
    icon: Clock,
    color: '#90CAF9',
    route: 'VitalityHistory',
    flag: null,
  },
  {
    id: 'hall',
    label: 'Hall of Vitality',
    desc: 'Badges and achievements',
    icon: Award,
    color: '#FFD54F',
    route: 'HallOfVitality',
    flag: null,
  },
  {
    id: 'heatmap',
    label: 'Monthly Heatmap',
    desc: 'Visualize your monthly consistency',
    icon: CalendarDays,
    color: '#4DD0E1',
    route: 'MonthlyWrap',
    flag: 'ff_monthly_heatmap',
  },
  {
    id: 'learn',
    label: 'Learn — Juice Smarter',
    desc: 'Tips and education for beginners',
    icon: BookOpen,
    color: '#81C784',
    route: 'NoviceJourney',
    flag: null,
  },
]

function ToolCard({ tool, onPress }) {
  const Icon = tool.icon
  return (
    <TouchableOpacity
      style={cardStyles.card}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress(tool.route)
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${tool.label}: ${tool.desc}`}
    >
      <View style={[cardStyles.iconWrap, { backgroundColor: `${tool.color}10` }]}>
        <Icon size={20} color={tool.color} />
      </View>
      <View style={cardStyles.content}>
        <Text style={cardStyles.label}>{tool.label}</Text>
        <Text style={cardStyles.desc}>{tool.desc}</Text>
      </View>
      <ChevronRight size={16} color={DARK.textMuted} />
    </TouchableOpacity>
  )
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.xl,
    padding: 14,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginBottom: 2,
  },
  desc: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
  },
})

export default function OptimizeScreen({ navigation }) {
  const isReduced = useReducedMotion()
  const { isEnabled } = useFlags()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isReduced) { fadeAnim.setValue(1) } else {
      Animated.timing(fadeAnim, { toValue: 1, duration: DURATION.enter, easing: EASING.decelerate, useNativeDriver: true }).start()
    }
  }, [])

  const visibleTools = TOOLS.filter((t) => {
    if (t.flag && !isEnabled(t.flag)) return false
    return true
  })

  const handleNavigate = (route) => {
    navigation.navigate(route)
  }

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          <View style={styles.header}>
            <Beaker size={18} color="#CE93D8" />
            <Text style={styles.headerTitle}>Optimize</Text>
          </View>
          <Text style={styles.subtitle}>Advanced Juicing Tools</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {visibleTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onPress={handleNavigate} />
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

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
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
})
