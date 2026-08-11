import React, { useMemo, useCallback, useState } from 'react'
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
import { ArrowLeft, ChevronRight, Leaf } from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import { WellnessBanner, WellnessMicroDisclaimer, WellnessDisclaimerModal, useWellnessDisclaimerAccepted } from '../components/WellnessDisclaimer'
import { getFocusAreaById, getNutrientById } from '../constants/wellnessFocusDirectory'
import { getCachedRanking } from '../services/wellnessFocusMatcher'
import { SEMANTIC_COLORS, SEMANTIC_TYPOGRAPHY, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'
import { standardCard } from '../constants/styleRecipes'

export default function WellnessResultsScreen({ route, navigation }) {
  const { focusAreaId } = route.params || {}
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false)
  const [accepted, acceptDisclaimer] = useWellnessDisclaimerAccepted()

  const focusArea = useMemo(() => getFocusAreaById(focusAreaId), [focusAreaId])

  const rankedRecipes = useMemo(() => {
    if (!focusAreaId) return []
    return getCachedRanking(focusAreaId)
  }, [focusAreaId])

  const nutrientLabels = useMemo(() => {
    if (!focusArea) return []
    return focusArea.associated_nutrients.map((nid) => {
      const nutrient = getNutrientById(nid)
      return nutrient ? nutrient.label : nid
    })
  }, [focusArea])

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.goBack()
  }, [])

  const handleOpenRecipe = useCallback((recipeId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.navigate('RecipeDetail', { recipeId, origin: 'wellnessFocus' })
  }, [navigation])

  const handleLearnMore = useCallback(() => {
    setShowDisclaimerModal(true)
  }, [])

  if (!focusArea) {
    return (
      <View style={styles.root}>
        <MeshGradientBg />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <ArrowLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Wellness Results</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Wellness focus area not found.</Text>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  const renderRecipe = ({ item }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={() => handleOpenRecipe(item.recipeId)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${item.recipeTitle}, ${item.overlapCount} associated nutrients, ${item.ingredientCount} ingredients`}
    >
      <LinearGradient
        colors={['#1B3A2D', '#0F2419', '#0D1117']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.recipeGradient}
      >
        <View style={styles.recipeTop}>
          <View style={styles.matchBadge}>
            <Text style={styles.matchBadgeText}>
              {item.overlapCount} associated nutrients
            </Text>
          </View>
          <ChevronRight size={16} color={SEMANTIC_COLORS.textMuted} />
        </View>
        <Text style={styles.recipeTitle}>{item.recipeTitle}</Text>
        <Text style={styles.recipeMeta}>
          {item.ingredientCount} ingredients
        </Text>
        <View style={styles.nutrientChips}>
          {item.matchedNutrients.slice(0, 4).map((nid) => {
            const nutrient = getNutrientById(nid)
            return (
              <View key={nid} style={styles.nutrientChip}>
                <Text style={styles.nutrientChipText}>
                  {nutrient ? nutrient.label : nid}
                </Text>
              </View>
            )
          })}
        </View>
        <WellnessMicroDisclaimer />
      </LinearGradient>
    </TouchableOpacity>
  )

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Leaf size={18} color="#81C784" />
            <Text style={styles.headerTitle} numberOfLines={1}>Wellness Results</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.focusAreaCard}>
            <Text style={styles.focusAreaLabel}>{focusArea.label}</Text>
            <Text style={styles.focusAreaNote}>{focusArea.note}</Text>
            <View style={styles.nutrientListWrap}>
              <Text style={styles.nutrientListTitle}>Associated nutrients:</Text>
              <Text style={styles.nutrientListText}>
                {nutrientLabels.join(', ')}
              </Text>
            </View>
          </View>

          <WellnessBanner onLearnMore={handleLearnMore} />

          <Text style={styles.resultsHeader}>
            {rankedRecipes.length > 0
              ? `${rankedRecipes.length} recipe${rankedRecipes.length !== 1 ? 's' : ''} found`
              : 'No matching juices yet'}
          </Text>

          {rankedRecipes.map((recipe) => (
            <View key={recipe.recipeId}>
              {renderRecipe({ item: recipe })}
            </View>
          ))}

          {rankedRecipes.length === 0 && (
            <View style={styles.noResultsCard}>
              <Text style={styles.noResultsText}>
                No recipes in the current collection match this wellness focus.
                Try a different focus area or check back as new recipes are added.
              </Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>

      <WellnessDisclaimerModal
        visible={!accepted || showDisclaimerModal}
        onAccept={() => {
          if (!accepted) acceptDisclaimer()
          setShowDisclaimerModal(false)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SEMANTIC_COLORS.canvas,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SEMANTIC_SPACE.lg,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.screenTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SEMANTIC_SPACE.lg,
    paddingBottom: SEMANTIC_SPACE.lg,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    color: SEMANTIC_COLORS.textMuted,
  },
  focusAreaCard: {
    ...standardCard,
    padding: SEMANTIC_SPACE.lg,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  focusAreaLabel: {
    fontSize: SEMANTIC_TYPOGRAPHY.cardTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.cardTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: 8,
  },
  focusAreaNote: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  nutrientListWrap: {
    marginTop: 4,
  },
  nutrientListTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    marginBottom: 4,
  },
  nutrientListText: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.textMuted,
    lineHeight: 18,
  },
  resultsHeader: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginTop: SEMANTIC_SPACE.sm,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  recipeCard: {
    borderRadius: SEMANTIC_RADIUS.large,
    overflow: 'hidden',
    marginBottom: 8,
  },
  recipeGradient: {
    padding: 16,
  },
  recipeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchBadge: {
    backgroundColor: 'rgba(129,199,132,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  matchBadgeText: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: '#81C784',
  },
  recipeTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.cardTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.cardTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: 4,
  },
  recipeMeta: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    marginBottom: 8,
  },
  nutrientChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  nutrientChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  nutrientChipText: {
    fontSize: 10,
    color: SEMANTIC_COLORS.textSecondary,
    fontWeight: '500',
  },
  noResultsCard: {
    ...standardCard,
    padding: SEMANTIC_SPACE.lg,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    color: SEMANTIC_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
})
