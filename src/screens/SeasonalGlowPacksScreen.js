import React, { useCallback, useMemo, useState } from 'react'
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
import { ArrowLeft, ChevronRight, Leaf, Lock } from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import PaywallModal from '../components/PaywallModal'
import { RECIPES, getCleanupLabel } from '../constants/recipeData'
import { usePro } from '../services/ProStore'
import { useFlags } from '../services/FeatureFlags'

function PackPill({ label }) {
  return (
    <View style={styles.packPill}>
      <Text style={styles.packPillText}>{label}</Text>
    </View>
  )
}

function RecipeRow({ recipe, isLocked, onPress }) {
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
            <View style={[styles.vibeTag, { backgroundColor: `${recipe.vibeColor}20` }]}>
              <Text style={[styles.vibeTagText, { color: recipe.vibeColor }]}>
                {recipe.vibeTag}
              </Text>
            </View>
            {recipe.seasonalPack && (
              <PackPill label={recipe.seasonalPack.replace(/_/g, ' ')} />
            )}
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{getCleanupLabel(recipe.cleanupScore)}</Text>
            </View>
          </View>
          <ChevronRight size={18} color="#484F58" />
        </View>

        <Text style={styles.recipeTitle}>{recipe.title}</Text>

        {isLocked && (
          <View style={styles.lockOverlay} pointerEvents="none">
            <Lock size={14} color="#FFD54F" />
            <Text style={styles.lockText}>Pro</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  )
}

export default function SeasonalGlowPacksScreen({ navigation }) {
  const { hasFeatureAccess } = usePro()
  const { isEnabled } = useFlags()
  const [showPaywall, setShowPaywall] = useState(false)

  const isPaywallDisabled = isEnabled('ff_dev_disable_paywalls')
  const isPaywallForced = isEnabled('ff_dev_force_paywalls')

  const recipes = useMemo(() => {
    return RECIPES.filter((r) => r.collection === 'seasonal')
  }, [])

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.goBack()
  }, [navigation])

  const handleOpenRecipe = useCallback((recipeId, isLocked) => {
    if (isPaywallDisabled) {
      navigation.navigate('RecipeDetail', { recipeId })
      return
    }

    if (isPaywallForced || isLocked) {
      setShowPaywall(true)
      return
    }

    navigation.navigate('RecipeDetail', { recipeId })
  }, [navigation, isPaywallDisabled, isPaywallForced])

  const canAccessProRecipes = hasFeatureAccess('proRecipes')

  return (
    <View style={styles.rootWrap}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Leaf size={18} color="#81C784" />
            <Text style={styles.headerTitle}>Seasonal Glow Packs</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subTitle}>Limited-time packs and seasonal rotations.</Text>

          {recipes.map((r) => {
            const isLocked = r.tier === 'pro' && !canAccessProRecipes
            return (
              <RecipeRow
                key={r.id}
                recipe={r}
                isLocked={isLocked}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  handleOpenRecipe(r.id, isLocked)
                }}
              />
            )
          })}

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>

      <PaywallModal
        visible={!isPaywallDisabled && showPaywall}
        onDismiss={() => setShowPaywall(false)}
        trigger="seasonal_packs"
      />
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
  packPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(129,199,132,0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.18)',
  },
  packPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#81C784',
    textTransform: 'capitalize',
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
  lockOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6,13,10,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(255,213,79,0.15)',
  },
  lockText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFD54F',
    letterSpacing: 0.4,
  },
})
