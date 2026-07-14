import React, { useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { ArrowLeft, ChevronRight, BookOpen } from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import { RECIPES, getCleanupLabel } from '../constants/recipeData'

function RecipeRow({ recipe, onPress }) {
  return (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
    >
      <LinearGradient
        colors={recipe.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.recipeGradient}
      >
        <View style={styles.recipeTop}>
          <View style={styles.recipeTagRow}>
            <View style={[styles.dayPill, { backgroundColor: 'rgba(129,199,132,0.10)' }]}>
              <Text style={styles.dayPillText}>Day {recipe.beginnerDay}</Text>
            </View>
            <View style={[styles.vibeTag, { backgroundColor: `${recipe.vibeColor}20` }]}>
              <Text style={[styles.vibeTagText, { color: recipe.vibeColor }]}>
                {recipe.vibeTag}
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{getCleanupLabel(recipe.cleanupScore)}</Text>
            </View>
          </View>
          <ChevronRight size={18} color="#484F58" />
        </View>

        <Text style={styles.recipeTitle}>{recipe.title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  )
}

export default function BeginnerGlowPathScreen({ navigation }) {
  const recipes = useMemo(() => {
    return RECIPES
      .filter((r) => r.collection === 'beginner_path')
      .slice()
      .sort((a, b) => (a.beginnerDay || 999) - (b.beginnerDay || 999))
  }, [])

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.goBack()
  }, [navigation])

  return (
    <View style={styles.rootWrap}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <BookOpen size={18} color="#81C784" />
            <Text style={styles.headerTitle}>Beginner Glow Path</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subTitle}>A gentle, day-by-day ramp into consistent juicing.</Text>

          {recipes.map((r) => (
            <RecipeRow
              key={r.id}
              recipe={r}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                navigation.navigate('RecipeDetail', { recipeId: r.id })
              }}
            />
          ))}

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  subTitle: {
    fontSize: 13,
    color: '#8B949E',
    marginBottom: 14,
    lineHeight: 18,
  },
  recipeCard: {
    marginBottom: 12,
    borderRadius: 24,
    overflow: 'hidden',
  },
  recipeGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  recipeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recipeTagRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginRight: 8,
  },
  dayPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.18)',
  },
  dayPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#81C784',
  },
  vibeTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  vibeTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B949E',
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
})
