// ─────────────────────────────────────────────────────────────
// WeeklyReportScreen.js — "Your Weekly Vitality Map"
// 6 vertical test tubes, ingredient diversity bubbles,
// shopping list generator, fun weight comparison
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft,
  ShoppingCart,
  ChefHat,
  Scale,
  Sparkles,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import {
  useChallenge,
  WEEKLY_COLORS,
  getFunComparison,
  getColorAffirmation,
  generateShoppingList,
} from '../services/ChallengeStore'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import { useFormatWeight } from '../utils/weightFormat'

const COLOR_ORDER = ['red', 'orange', 'yellow', 'green', 'purple', 'white']

const MISSING_HINTS = {
  red: 'Your Lycopene levels are lower than usual. Try Beet or Pomegranate to boost cardiovascular strength.',
  orange: 'Missing Beta-Carotene this week. A single carrot juice closes this gap instantly.',
  yellow: 'Your Citrus intake is low. Lemon-ginger shots are the fastest fix.',
  green: 'Chlorophyll is your foundation. Grab some Kale or Spinach to anchor your spectrum.',
  purple: 'Your Antioxidant levels are lower than usual. Try Red Cabbage or Blackberries to complete your spectrum.',
  white: 'Allicin compounds are missing. Cauliflower or Parsnip will round out your rainbow.',
}

// ── Test Tube Component ──────────────────────────────────────

function TestTube({ colorKey, data, isFilled, index, onRecipePress }) {
  const fillAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 120),
      Animated.spring(fillAnim, {
        toValue: isFilled ? 1 : 0,
        damping: 15,
        stiffness: 100,
        useNativeDriver: false,
      }),
    ]).start()

    if (!isFilled) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start()
    }
  }, [isFilled, index])

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <View style={styles.tubeWrapper}>
      <View style={styles.tubeOuter}>
        <Animated.View
          style={[
            styles.tubeEmpty,
            !isFilled && { opacity: pulseAnim },
          ]}
        >
          <View style={[styles.tubeGhost, { borderColor: `${data.color}30` }]} />
        </Animated.View>
        <Animated.View
          style={[
            styles.tubeFill,
            { height: fillHeight, backgroundColor: data.color },
          ]}
        />
        {isFilled && (
          <View style={[styles.tubeCap, { backgroundColor: data.color }]} />
        )}
      </View>
      <Text style={[styles.tubeLabel, isFilled && { color: data.color, fontWeight: '800' }]}>
        {data.label}
      </Text>
      {!isFilled && (
        <TouchableOpacity
          style={[styles.tubeRecipeBtn, { borderColor: `${data.color}60` }]}
          onPress={() => onRecipePress(colorKey)}
          activeOpacity={0.7}
        >
          <ChefHat size={10} color={data.color} />
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Ingredient Bubble ────────────────────────────────────────

function IngredientBubble({ id, weight, maxWeight }) {
  const entry = PRODUCE_DATA[id]
  const name = entry?.name || id
  const size = Math.max(32, Math.min(72, (weight / maxWeight) * 72))

  return (
    <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.bubbleText} numberOfLines={1}>
        {name}
      </Text>
    </View>
  )
}

// ── Main Screen ──────────────────────────────────────────────

export default function WeeklyReportScreen({ navigation }) {
  const { weeklyDiversity, weeklyStats } = useChallenge()
  const { fmtLbs } = useFormatWeight()
  const { totalWeightG, heroIngredients, topColor } = weeklyStats
  const filledCount = COLOR_ORDER.filter((c) => weeklyDiversity[c]).length
  const allFilled = filledCount === 6
  const shoppingList = generateShoppingList(weeklyDiversity)
  const maxIngWeight = heroIngredients[0]?.weight || 1

  const handleRecipePress = (colorKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.navigate('FridgeForager', { filterColor: colorKey })
  }

  // Find first missing color for the hint
  const missingColor = COLOR_ORDER.find((c) => !weeklyDiversity[c])

  return (
    <View style={styles.rootWrap}>
    <MeshGradientBg />
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Vitality Map</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Counter Badge ──────────────────────────────── */}
        <View style={styles.counterRow}>
          <Text style={styles.counterText}>
            {filledCount}<Text style={styles.counterDim}>/6 Colors</Text>
          </Text>
          {allFilled && <Text style={styles.rainbowBadge}>🌈 Rainbow Master</Text>}
        </View>

        {/* ── Test Tubes ─────────────────────────────────── */}
        <View style={styles.tubesCard}>
          <View style={styles.tubesRow}>
            {COLOR_ORDER.map((key, i) => (
              <TestTube
                key={key}
                colorKey={key}
                data={WEEKLY_COLORS[key]}
                isFilled={!!weeklyDiversity[key]}
                index={i}
                onRecipePress={handleRecipePress}
              />
            ))}
          </View>
        </View>

        {/* ── Missing Link Hint ──────────────────────────── */}
        {missingColor && (
          <View style={styles.hintCard}>
            <View style={[styles.hintDot, { backgroundColor: WEEKLY_COLORS[missingColor].color }]} />
            <Text style={styles.hintText}>{MISSING_HINTS[missingColor]}</Text>
          </View>
        )}

        {/* ── Weight Stat ────────────────────────────────── */}
        {totalWeightG > 0 && (
          <View style={styles.statCard}>
            <Scale size={20} color="#64B5F6" />
            <View style={styles.statContent}>
              <Text style={styles.statValue}>
                {fmtLbs(totalWeightG)}
              </Text>
              <Text style={styles.statSub}>
                You juiced {getFunComparison(totalWeightG)}'s worth of produce this week!
              </Text>
            </View>
          </View>
        )}

        {/* ── Color Affirmation ──────────────────────────── */}
        {topColor && (
          <View style={styles.affirmCard}>
            <Sparkles size={16} color={WEEKLY_COLORS[topColor]?.color || '#FFD54F'} />
            <Text style={styles.affirmText}>
              This week, you were powered by{' '}
              <Text style={{ color: WEEKLY_COLORS[topColor]?.color, fontWeight: '800' }}>
                {getColorAffirmation(topColor)}
              </Text>
            </Text>
          </View>
        )}

        {/* ── Ingredient Diversity Bubbles ────────────────── */}
        {heroIngredients.length > 0 && (
          <View style={styles.bubblesCard}>
            <Text style={styles.sectionTitle}>Ingredient Heroes</Text>
            <View style={styles.bubblesRow}>
              {heroIngredients.slice(0, 8).map((h) => (
                <IngredientBubble
                  key={h.id}
                  id={h.id}
                  weight={h.weight}
                  maxWeight={maxIngWeight}
                />
              ))}
            </View>
            {heroIngredients.length > 0 && (
              <Text style={styles.bubblesHint}>
                You're a {PRODUCE_DATA[heroIngredients[0].id]?.name || heroIngredients[0].id} Specialist!
                {heroIngredients.length > 2 && ` Can you become a ${PRODUCE_DATA[heroIngredients[heroIngredients.length - 1].id]?.name || 'new ingredient'} Boss by Sunday?`}
              </Text>
            )}
          </View>
        )}

        {/* ── Shopping List ───────────────────────────────── */}
        {shoppingList.length > 0 && (
          <View style={styles.shopCard}>
            <View style={styles.shopHeader}>
              <ShoppingCart size={18} color="#81C784" />
              <Text style={styles.shopTitle}>Fill the Gap</Text>
            </View>
            <Text style={styles.shopSub}>
              Buy these {shoppingList.length} item{shoppingList.length > 1 ? 's' : ''} to finish your Rainbow:
            </Text>
            {shoppingList.map((item) => (
              <View key={item.color} style={styles.shopItem}>
                <View style={[styles.shopDot, { backgroundColor: item.colorHex }]} />
                <Text style={styles.shopName}>
                  {item.suggestion ? (PRODUCE_DATA[item.suggestion]?.name || item.suggestion) : item.label}
                </Text>
                <Text style={[styles.shopColor, { color: item.colorHex }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Finish the Rainbow CTA ─────────────────────── */}
        {!allFilled && (
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              navigation.navigate('FridgeForager')
            }}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#9C27B0', '#7B1FA2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>🌈 Finish the Rainbow</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  rootWrap: { flex: 1, backgroundColor: '#060D0A' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 18, fontWeight: '800', color: '#FFFFFF',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  // Counter
  counterRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  counterText: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  counterDim: { fontSize: 16, fontWeight: '600', color: '#484F58' },
  rainbowBadge: {
    fontSize: 14, fontWeight: '800', color: '#CE93D8',
    backgroundColor: 'rgba(156,39,176,0.08)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(156,39,176,0.15)',
  },

  // Tubes
  tubesCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 28, padding: 20, marginBottom: 16,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  tubesRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    height: 160,
  },
  tubeWrapper: { alignItems: 'center', flex: 1 },
  tubeOuter: {
    width: 28, height: 140, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'flex-end', position: 'relative',
  },
  tubeEmpty: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  tubeGhost: {
    width: '100%', height: '100%',
    borderWidth: 0.5, borderRadius: 14,
  },
  tubeFill: {
    width: '100%', borderRadius: 12,
    position: 'absolute', bottom: 0,
  },
  tubeCap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 4, borderTopLeftRadius: 14, borderTopRightRadius: 14,
  },
  tubeLabel: {
    fontSize: 9, fontWeight: '600', color: '#484F58',
    marginTop: 6, textAlign: 'center',
  },
  tubeRecipeBtn: {
    marginTop: 4, width: 24, height: 24, borderRadius: 12,
    borderWidth: 0.5, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // Hint
  hintCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, padding: 16, marginBottom: 16,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', gap: 10,
  },
  hintDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  hintText: { flex: 1, fontSize: 13, color: '#8B949E', lineHeight: 18 },

  // Stat
  statCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, padding: 16, marginBottom: 16,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', gap: 12,
  },
  statContent: { flex: 1 },
  statValue: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  statSub: { fontSize: 12, color: '#8B949E', marginTop: 2 },

  // Affirmation
  affirmCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, padding: 16, marginBottom: 16,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', gap: 10,
  },
  affirmText: { flex: 1, fontSize: 13, color: '#C9D1D9', lineHeight: 18 },

  // Bubbles
  bubblesCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, padding: 18, marginBottom: 16,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: '#484F58',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  bubblesRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8, justifyContent: 'center',
  },
  bubble: {
    backgroundColor: 'rgba(100,181,246,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(100,181,246,0.2)',
  },
  bubbleText: { fontSize: 8, fontWeight: '700', color: '#C9D1D9', textAlign: 'center' },
  bubblesHint: {
    fontSize: 12, color: '#8B949E', textAlign: 'center',
    marginTop: 10, fontStyle: 'italic',
  },

  // Shopping
  shopCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, padding: 18, marginBottom: 16,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  shopHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  shopTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  shopSub: { fontSize: 12, color: '#8B949E', marginBottom: 10 },
  shopItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  shopDot: { width: 10, height: 10, borderRadius: 5 },
  shopName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#C9D1D9' },
  shopColor: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  // CTA
  ctaBtn: {
    borderRadius: 28, overflow: 'hidden',
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 16,
  },
  ctaGradient: {
    paddingVertical: 18, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
})
