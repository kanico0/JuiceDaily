// ─────────────────────────────────────────────────────────────
// FridgeForagerScreen.js — Recipe discovery by unclosed rings
// Shows recommended recipes to close your color rings
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowLeft, ChevronRight, Star } from 'lucide-react-native'
import { useChallenge, DAILY_PILLARS } from '../services/ChallengeStore'
import MeshGradientBg from '../components/MeshGradientBg'
import { RECIPES, getCleanupLabel } from '../constants/recipeData'

function RecipeCard({ recipe, navigation }) {
  return (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={() => navigation.navigate('RecipeDetail', { recipeId: recipe.id })}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={recipe.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.recipeGradient}
      >
        <View style={styles.recipeTop}>
          <View style={styles.recipeTagRow}>
            <View style={[styles.vibeTag, { backgroundColor: `${recipe.vibeColor}20` }]}>
              <Text style={[styles.vibeTagText, { color: recipe.vibeColor }]}>
                {recipe.vibeTag}
              </Text>
            </View>
            {recipe.pillars.map((p) => (
              <View key={p} style={[styles.pillarBadge, { borderColor: `${DAILY_PILLARS[p].color}50` }]}>
                <View style={[styles.pillarDot, { backgroundColor: DAILY_PILLARS[p].color }]} />
                <Text style={[styles.pillarText, { color: DAILY_PILLARS[p].color }]}>
                  {DAILY_PILLARS[p].shortLabel}
                </Text>
              </View>
            ))}
          </View>
          <ChevronRight size={18} color="#484F58" />
        </View>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <View style={styles.recipeMeta}>
          <View style={styles.recipeIngCount}>
            <Text style={styles.recipeMetaText}>
              {recipe.ingredients.length} ingredients
            </Text>
          </View>
          <View style={styles.recipeStars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={10}
                color={s <= recipe.cleanupScore ? '#FFD54F' : '#21262D'}
                fill={s <= recipe.cleanupScore ? '#FFD54F' : 'transparent'}
              />
            ))}
            <Text style={styles.recipeCleanup}>{getCleanupLabel(recipe.cleanupScore)}</Text>
          </View>
        </View>
        {/* Mini ratio bar */}
        <View style={styles.miniRatioBar}>
          {recipe.ingredients.map((ing, i) => (
            <View
              key={i}
              style={[
                styles.miniRatioSeg,
                {
                  backgroundColor: ing.color,
                  flex: ing.ratio,
                  borderTopLeftRadius: i === 0 ? 4 : 0,
                  borderBottomLeftRadius: i === 0 ? 4 : 0,
                  borderTopRightRadius: i === recipe.ingredients.length - 1 ? 4 : 0,
                  borderBottomRightRadius: i === recipe.ingredients.length - 1 ? 4 : 0,
                },
              ]}
            />
          ))}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  )
}

export default function FridgeForagerScreen({ navigation }) {
  const { todayLog } = useChallenge()
  const unclosed = ['base', 'power', 'kick'].filter((c) => !todayLog[c])

  const recommendedRecipes = useMemo(() => {
    if (unclosed.length === 0) return RECIPES
    return RECIPES.filter((r) => r.pillars.some((p) => unclosed.includes(p)))
  }, [unclosed])

  const otherRecipes = useMemo(() => {
    if (unclosed.length === 0) return []
    return RECIPES.filter((r) => !r.pillars.some((p) => unclosed.includes(p)))
  }, [unclosed])

  return (
    <View style={styles.rootWrap}>
    <MeshGradientBg />
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find a Recipe</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Unclosed rings summary */}
        {unclosed.length > 0 && (
          <View style={styles.ringHint}>
            <Text style={styles.ringHintText}>
              Close your{' '}
              {unclosed.map((c, i) => (
                <Text key={c}>
                  {i > 0 ? ' & ' : ''}
                  <Text style={{ color: DAILY_PILLARS[c].color, fontWeight: '700' }}>
                    {DAILY_PILLARS[c].shortLabel}
                  </Text>
                </Text>
              ))}
              {' '}ring{unclosed.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {unclosed.length === 0 && (
          <View style={styles.completeCard}>
            <Text style={styles.completeEmoji}>🌈</Text>
            <Text style={styles.completeText}>All rings closed! Browse all recipes.</Text>
          </View>
        )}

        {/* Recommended recipes */}
        {recommendedRecipes.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>
              {unclosed.length > 0 ? 'Recommended for You' : 'All Recipes'}
            </Text>
            {recommendedRecipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} navigation={navigation} />
            ))}
          </>
        )}

        {/* Other recipes */}
        {otherRecipes.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Explore More</Text>
            {otherRecipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} navigation={navigation} />
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  rootWrap: { flex: 1, backgroundColor: '#060D0A' },
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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  ringHint: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ringHintText: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 20,
  },
  completeCard: {
    backgroundColor: 'rgba(76,175,80,0.06)',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(76,175,80,0.12)',
  },
  completeEmoji: {
    fontSize: 28,
  },
  completeText: {
    fontSize: 15,
    color: '#81C784',
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  recipeCard: {
    marginBottom: 12,
    borderRadius: 24,
    overflow: 'hidden',
  },
  recipeGradient: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recipeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recipeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  pillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  pillarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillarText: {
    fontSize: 10,
    fontWeight: '700',
  },
  vibeTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 24,
  },
  vibeTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  recipeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recipeIngCount: {},
  recipeMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B949E',
  },
  recipeStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  recipeCleanup: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8B949E',
    marginLeft: 6,
  },
  miniRatioBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  miniRatioSeg: {
    height: '100%',
  },
})
