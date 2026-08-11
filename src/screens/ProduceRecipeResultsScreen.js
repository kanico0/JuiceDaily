import React, { useMemo, useCallback, memo, useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { ArrowLeft, ChevronRight, Check, Sparkles, Lock } from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import { getRecipesForProduce, getRecipesForPrimaryProduce } from '../services/produceRecipeMatcher'
import { FREE_BROWSE_COLLECTIONS } from '../services/produceFamilies'
import { getRecipeById } from '../constants/recipeData'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import { SEMANTIC_COLORS, SEMANTIC_TYPOGRAPHY, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'

const PAGE_SIZE = 25

const TIER_CONFIG = {
  ready_now: {
    title: 'All Ingredients Selected',
    badge: 'Ready to Make',
    subtitle: 'Check the recipe amounts before starting.',
  },
  close_match: {
    title: 'Almost There',
    badge: null,
    subtitle: null,
  },
  closest_match: {
    title: 'Closest Matches',
    badge: null,
    subtitle: 'These recipes use some of what you selected but need a few more ingredients.',
  },
}

function getProduceName(id) {
  const entry = PRODUCE_DATA[id.toLowerCase()]
  return entry ? entry.name : id
}

function ProduceChip({ id, name }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{name}</Text>
    </View>
  )
}

const MemoizedRecipeCard = memo(function RecipeCard({ match, onPress }) {
  const config = TIER_CONFIG[match.tier]
  const isPro = match.tier_label === 'pro'
  const recipe = getRecipeById(match.recipeId)
  const isFreeBrowse = recipe && FREE_BROWSE_COLLECTIONS.has(recipe.collection)
  const showProBadge = isPro && !isFreeBrowse

  return (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={() => onPress(match.recipeId)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${match.title}, ${match.displayMatchPct}% match, ${match.missingProduceNames.length} missing ingredients`}
    >
      <LinearGradient
        colors={['#1B3A2D', '#0F2419', '#0D1117']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.recipeGradient}
      >
        <View style={styles.cardTopRow}>
          {config.badge && (
            <View style={styles.readyBadge}>
              <Check size={12} color="#81C784" />
              <Text style={styles.readyBadgeText}>{config.badge}</Text>
            </View>
          )}
          {match.tier === 'close_match' && (
            <View style={styles.matchPctBadge}>
              <Text style={styles.matchPctText}>{match.displayMatchPct}% match</Text>
            </View>
          )}
          {match.tier === 'closest_match' && (
            <View style={styles.weakBadge}>
              <Text style={styles.weakBadgeText}>{match.displayMatchPct}% match</Text>
            </View>
          )}
          {showProBadge && (
            <View style={styles.proBadge}>
              <Lock size={10} color="#FFD54F" />
              <Text style={styles.proBadgeText}>Pro</Text>
            </View>
          )}
          <View style={styles.blendTypeWrap}>
            {match.blendType === 'advanced' && (
              <View style={styles.advancedBadge}>
                <Sparkles size={10} color="#FFD54F" />
                <Text style={styles.advancedBadgeText}>Advanced</Text>
              </View>
            )}
          </View>
          <ChevronRight size={16} color={SEMANTIC_COLORS.textMuted} />
        </View>

        <Text style={styles.recipeTitle}>{match.title}</Text>
        <Text style={styles.recipeMeta}>
          {match.distinctIngredientCount} ingredients
        </Text>

        {match.missingProduceNames.length > 0 && (
          <View style={styles.missingWrap}>
            <Text style={styles.missingLabel}>
              {match.missingProduceNames.length === 1
                ? `Add: ${match.missingProduceNames[0]}`
                : `Missing: ${match.missingProduceNames.join(' and ')}`}
            </Text>
          </View>
        )}

        {match.tier === 'ready_now' && (
          <Text style={styles.readyHint}>Check the recipe amounts before starting.</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  )
})

export default function ProduceRecipeResultsScreen({ route, navigation }) {
  const selectedProduceIds = route?.params?.selectedProduceIds || []
  const primaryProduceId = route?.params?.primaryProduceId || null
  const otherSelectedProduceIds = route?.params?.otherSelectedProduceIds || []

  const [currentPage, setCurrentPage] = useState(1)
  const listRef = useRef(null)

  const produceNames = useMemo(() => {
    return selectedProduceIds.map((id) => ({
      id: id.toLowerCase(),
      name: getProduceName(id),
    }))
  }, [selectedProduceIds])

  const primaryName = useMemo(() => {
    if (!primaryProduceId) return null
    return getProduceName(primaryProduceId)
  }, [primaryProduceId])

  const result = useMemo(() => {
    if (primaryProduceId) {
      return getRecipesForPrimaryProduce(primaryProduceId, otherSelectedProduceIds)
    }
    if (selectedProduceIds.length === 0) {
      return { status: 'empty_selection', matches: [], invalidIds: [] }
    }
    return getRecipesForProduce(selectedProduceIds)
  }, [primaryProduceId, otherSelectedProduceIds, selectedProduceIds])

  // Reset to page 1 when any search input changes
  useEffect(() => {
    setCurrentPage(1)
  }, [primaryProduceId, otherSelectedProduceIds, selectedProduceIds])

  const totalCount = result.status === 'results' ? result.matches.length : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE

  const pagedMatches = useMemo(() => {
    if (result.status !== 'results') return []
    return result.matches.slice(startIndex, endIndex)
  }, [result, startIndex, endIndex])

  const handlePrevPage = useCallback(() => {
    if (safePage <= 1) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCurrentPage((p) => Math.max(1, p - 1))
    if (listRef.current) {
      listRef.current.scrollToOffset({ offset: 0, animated: false })
    }
  }, [safePage])

  const handleNextPage = useCallback(() => {
    if (safePage >= totalPages) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCurrentPage((p) => Math.min(totalPages, p + 1))
    if (listRef.current) {
      listRef.current.scrollToOffset({ offset: 0, animated: false })
    }
  }, [safePage, totalPages])

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.goBack()
  }, [navigation])

  const handleOpenRecipe = useCallback((recipeId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.navigate('RecipeDetail', { recipeId, origin: 'produceRecipe' })
  }, [navigation])

  const renderCard = useCallback(({ item }) => (
    <MemoizedRecipeCard match={item} onPress={handleOpenRecipe} />
  ), [handleOpenRecipe])

  const keyExtractor = useCallback((item) => item.recipeId, [])

  const renderListHeader = useCallback(() => {
    if (pagedMatches.length === 0) return null
    const firstMatch = pagedMatches[0]
    const config = TIER_CONFIG[firstMatch.tier]
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{config.title}</Text>
        {config.subtitle && (
          <Text style={styles.sectionSubtitle}>{config.subtitle}</Text>
        )}
      </View>
    )
  }, [pagedMatches])

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {primaryName ? `Recipes featuring ${primaryName}` : 'Recipe Matches'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {produceNames.length > 0 && (
          <View style={styles.chipsRow}>
            {produceNames.map((p) => (
              <ProduceChip key={p.id} id={p.id} name={p.name} />
            ))}
          </View>
        )}

        {result.status === 'empty_selection' && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No produce selected</Text>
            <Text style={styles.emptyText}>
              Select at least one fruit or vegetable to find recipes that fit what you have.
            </Text>
          </View>
        )}

        {result.status === 'zero_overlap' && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No matching recipes</Text>
            <Text style={styles.emptyText}>
              No recipes in the library use this selection yet. Add another fruit or vegetable to see more possibilities.
            </Text>
          </View>
        )}

        {result.status === 'results' && (
          <>
            <FlatList
              ref={listRef}
              data={pagedMatches}
              keyExtractor={keyExtractor}
              renderItem={renderCard}
              ListHeaderComponent={renderListHeader}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={5}
              removeClippedSubviews
            />

            {totalCount > PAGE_SIZE && (
              <View style={styles.paginationBar}>
                <TouchableOpacity
                  onPress={handlePrevPage}
                  style={[styles.pageBtn, safePage <= 1 && styles.pageBtnDisabled]}
                  disabled={safePage <= 1}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                  accessibilityState={{ disabled: safePage <= 1 }}
                >
                  <Text style={[styles.pageBtnText, safePage <= 1 && styles.pageBtnTextDisabled]}>Previous</Text>
                </TouchableOpacity>
                <Text style={styles.pageIndicator}>
                  Page {safePage} of {totalPages}
                </Text>
                <TouchableOpacity
                  onPress={handleNextPage}
                  style={[styles.pageBtn, safePage >= totalPages && styles.pageBtnDisabled]}
                  disabled={safePage >= totalPages}
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                  accessibilityState={{ disabled: safePage >= totalPages }}
                >
                  <Text style={[styles.pageBtnText, safePage >= totalPages && styles.pageBtnTextDisabled]}>Next</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chip: {
    backgroundColor: 'rgba(129,199,132,0.12)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    color: '#81C784',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#8B949E',
    marginTop: 2,
  },
  recipeCard: {
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  recipeGradient: {
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(129,199,132,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readyBadgeText: {
    color: '#81C784',
    fontSize: 11,
    fontWeight: '700',
  },
  matchPctBadge: {
    backgroundColor: 'rgba(100,181,246,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchPctText: {
    color: '#64B5F6',
    fontSize: 11,
    fontWeight: '600',
  },
  weakBadge: {
    backgroundColor: 'rgba(255,183,77,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  weakBadgeText: {
    color: '#FFB74D',
    fontSize: 11,
    fontWeight: '600',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,213,79,0.12)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  proBadgeText: {
    color: '#FFD54F',
    fontSize: 10,
    fontWeight: '700',
  },
  blendTypeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  advancedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,213,79,0.08)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  advancedBadgeText: {
    color: '#FFD54F',
    fontSize: 10,
    fontWeight: '500',
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  recipeMeta: {
    fontSize: 13,
    color: '#8B949E',
  },
  missingWrap: {
    marginTop: 8,
  },
  missingLabel: {
    fontSize: 13,
    color: '#F0883E',
    fontWeight: '500',
  },
  readyHint: {
    fontSize: 12,
    color: '#6E7681',
    marginTop: 6,
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(13,17,23,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(100,181,246,0.10)',
  },
  pageBtnDisabled: {
    backgroundColor: 'rgba(72,79,88,0.06)',
    opacity: 0.4,
  },
  pageBtnText: {
    color: '#64B5F6',
    fontSize: 13,
    fontWeight: '600',
  },
  pageBtnTextDisabled: {
    color: '#90A4AE',
  },
  pageIndicator: {
    color: '#8B949E',
    fontSize: 13,
    fontWeight: '500',
  },
})
