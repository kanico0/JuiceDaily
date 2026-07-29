import React, { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { ArrowLeft, Search, ChevronRight, Heart } from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import { WELLNESS_FOCUS_AREAS } from '../constants/wellnessFocusDirectory'
import { SEMANTIC_COLORS, SEMANTIC_TYPOGRAPHY, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'
import { standardCard, compactSupportingCard } from '../constants/styleRecipes'

export default function WellnessFocusScreen({ navigation }) {
  const [search, setSearch] = useState('')

  const filteredAreas = useMemo(() => {
    if (!search.trim()) return WELLNESS_FOCUS_AREAS
    const q = search.toLowerCase().trim()
    return WELLNESS_FOCUS_AREAS.filter((area) => {
      if (area.label.toLowerCase().includes(q)) return true
      if (area.id.toLowerCase().includes(q)) return true
      return area.search_terms.some((t) => t.toLowerCase().includes(q))
    })
  }, [search])

  const handleSelectArea = useCallback((areaId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.navigate('WellnessResults', { focusAreaId: areaId })
  }, [navigation])

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.goBack()
  }, [])

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Heart size={18} color="#81C784" />
            <Text style={styles.headerTitle}>Wellness Focus</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchInputWrap}>
            <Search size={16} color={SEMANTIC_COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search wellness focus areas"
              placeholderTextColor={SEMANTIC_COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search wellness focus areas"
            />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Choose a wellness focus to discover juice recipes with commonly associated nutrients.
            {'\n\n'}
            <Text style={styles.introNote}>
              For education & entertainment only — not medical advice.
            </Text>
          </Text>

          {filteredAreas.map((area) => (
            <TouchableOpacity
              key={area.id}
              style={styles.areaCard}
              onPress={() => handleSelectArea(area.id)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={area.label}
            >
              <View style={styles.areaContent}>
                <Text style={styles.areaLabel}>{area.label}</Text>
                <Text style={styles.areaNutrients} numberOfLines={1}>
                  {area.associated_nutrients.length} associated nutrients
                </Text>
              </View>
              <ChevronRight size={16} color={SEMANTIC_COLORS.textMuted} />
            </TouchableOpacity>
          ))}

          {filteredAreas.length === 0 && (
            <Text style={styles.emptyText}>No wellness focus areas match your search.</Text>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>

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
  },
  headerTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.screenTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
  },
  searchWrap: {
    paddingHorizontal: SEMANTIC_SPACE.lg,
    paddingBottom: 8,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...compactSupportingCard,
    borderRadius: SEMANTIC_RADIUS.medium,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SEMANTIC_SPACE.lg,
    paddingBottom: SEMANTIC_SPACE.lg,
  },
  intro: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SEMANTIC_SPACE.md,
  },
  introNote: {
    fontStyle: 'italic',
    color: SEMANTIC_COLORS.textMuted,
  },
  areaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...compactSupportingCard,
    borderRadius: SEMANTIC_RADIUS.large,
    paddingVertical: 14,
    paddingHorizontal: SEMANTIC_SPACE.lg,
    marginBottom: 6,
  },
  areaContent: {
    flex: 1,
  },
  areaLabel: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: 2,
  },
  areaNutrients: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.textMuted,
  },
  emptyText: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    color: SEMANTIC_COLORS.textMuted,
    textAlign: 'center',
    marginTop: SEMANTIC_SPACE.xl,
  },
})
