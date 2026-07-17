// ─────────────────────────────────────────────────────────────
// RecipeDetailScreen.js — Editorial-style recipe detail page
// Hero gradient, ingredient ratio bar, interactive checklist,
// benefit cards, cleanup score, sticky CTA, taste feedback
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Modal,
  Linking,
  TextInput,
  LayoutAnimation,
  UIManager,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft,
  Heart,
  Zap,
  Shield,
  Flame,
  Sun,
  Sparkles,
  Droplets,
  Leaf,
  Star,
  Play,
  Check,
  ShoppingCart,
  ExternalLink,
  Plus,
  Minus,
  X,
  Search,
} from 'lucide-react-native'
import { getRecipeById, getCleanupLabel, TASTE_REACTIONS } from '../constants/recipeData'
import { classifyProduceAllPillars, DAILY_PILLARS } from '../services/ChallengeStore'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import MeshGradientBg from '../components/MeshGradientBg'
import { useFormatWeight } from '../utils/weightFormat'
import { useOrganicPref, getDefaultOrganic } from '../utils/organicPreference'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const ALL_PRODUCE = Object.entries(PRODUCE_DATA).map(([id, entry]) => ({
  id,
  name: entry.name,
  category: entry.category,
})).sort((a, b) => a.name.localeCompare(b.name))

const ICON_MAP = {
  Zap,
  Shield,
  Flame,
  Sun,
  Sparkles,
  Droplets,
  Heart,
  Leaf,
}

// ── Ingredient Ratio Bar ─────────────────────────────────────

function IngredientRatioBar({ ingredients }) {
  const barAnims = useRef(ingredients.map(() => new Animated.Value(0))).current

  useEffect(() => {
    const anims = ingredients.map((_, i) =>
      Animated.timing(barAnims[i], {
        toValue: 1,
        duration: 600,
        delay: 400 + i * 120,
        useNativeDriver: false,
      })
    )
    Animated.stagger(80, anims).start()
  }, [])

  return (
    <View style={styles.ratioBarContainer}>
      <View style={styles.ratioBar}>
        {ingredients.map((ing, i) => {
          const width = barAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', `${ing.ratio * 100}%`],
          })
          return (
            <Animated.View
              key={i}
              style={[
                styles.ratioSegment,
                {
                  backgroundColor: ing.color,
                  width,
                  borderTopLeftRadius: i === 0 ? 8 : 0,
                  borderBottomLeftRadius: i === 0 ? 8 : 0,
                  borderTopRightRadius: i === ingredients.length - 1 ? 8 : 0,
                  borderBottomRightRadius: i === ingredients.length - 1 ? 8 : 0,
                },
              ]}
            />
          )
        })}
      </View>
      <View style={styles.ratioLabels}>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.ratioLabel}>
            <View style={[styles.ratioLabelDot, { backgroundColor: ing.color }]} />
            <Text style={styles.ratioLabelText}>{Math.round(ing.ratio * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Benefit Card ─────────────────────────────────────────────

function BenefitCard({ benefit, delay }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, delay, useNativeDriver: true }),
    ]).start()
  }, [delay])

  const IconComponent = ICON_MAP[benefit.icon] || Zap

  return (
    <Animated.View style={[styles.benefitCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.benefitIconWrap, { backgroundColor: `${benefit.color}15` }]}>
        <IconComponent size={18} color={benefit.color} />
      </View>
      <Text style={styles.benefitLabel}>{benefit.label}</Text>
    </Animated.View>
  )
}

// ── Cleanup Score Stars ──────────────────────────────────────

function CleanupScore({ score }) {
  return (
    <View style={styles.cleanupRow}>
      <Text style={styles.cleanupLabel}>Cleanup Difficulty</Text>
      <View style={styles.cleanupStars}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={14}
            color={s <= score ? '#FFD54F' : '#21262D'}
            fill={s <= score ? '#FFD54F' : 'transparent'}
          />
        ))}
      </View>
      <Text style={styles.cleanupText}>{getCleanupLabel(score)}</Text>
    </View>
  )
}

// ── Taste Feedback Modal ─────────────────────────────────────

function TasteFeedbackModal({ visible, onSelect, onDismiss }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.tasteOverlay}>
        <View style={styles.tasteCard}>
          <View style={styles.tasteHeader}>
            <Text style={styles.tasteTitle}>How was the taste?</Text>
            <TouchableOpacity
              style={styles.tasteCloseBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onDismiss()
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close without answering"
            >
              <X size={18} color="#8B949E" />
            </TouchableOpacity>
          </View>
          <View style={styles.tasteOptions}>
            {TASTE_REACTIONS.map((r) => (
              <TouchableOpacity
                key={r.emoji}
                style={styles.tasteBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  onSelect(r)
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.tasteEmoji}>{r.emoji}</Text>
                <Text style={styles.tasteBtnLabel}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.tasteSkipBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onDismiss()
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="I didn't juice, exit without logging"
          >
            <Text style={styles.tasteSkipEmoji}>🚫</Text>
            <Text style={styles.tasteSkipText}>I didn't juice</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Main Screen ──────────────────────────────────────────────

export default function RecipeDetailScreen({ route, navigation }) {
  const { recipeId } = route.params || {}
  const recipe = useMemo(() => getRecipeById(recipeId), [recipeId])
  const { fmtG } = useFormatWeight()
  const { mode: organicMode } = useOrganicPref()

  // Editable ingredient list — starts from recipe, user can add/remove
  const [ingredients, setIngredients] = useState(() => {
    if (!recipe) return []
    return recipe.ingredients.map((ing) => ({
      produceId: ing.produceId,
      name: ing.name,
      amount: ing.amount,
      color: ing.color,
      weightG: 150,
      isOrganic: getDefaultOrganic(organicMode),
      isOriginal: true,
    }))
  })
  const [checkedItems, setCheckedItems] = useState({})
  const [showTaste, setShowTaste] = useState(false)
  const [tasteResponse, setTasteResponse] = useState(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const pendingTasteRef = useRef(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addSearch, setAddSearch] = useState('')

  const heroOpacity = useRef(new Animated.Value(0)).current
  const heroSlide = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(heroSlide, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start()
  }, [])

  const toggleCheck = useCallback((index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }))
  }, [])

  const handleRemoveIngredient = useCallback((index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    LayoutAnimation.configureNext(LayoutAnimation.create(250, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity))
    setIngredients((prev) => prev.filter((_, i) => i !== index))
    setCheckedItems((prev) => {
      const updated = {}
      Object.keys(prev).forEach((k) => {
        const ki = parseInt(k, 10)
        if (ki < index) updated[ki] = prev[ki]
        else if (ki > index) updated[ki - 1] = prev[ki]
      })
      return updated
    })
  }, [])

  const handleAddIngredient = useCallback((produceItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    LayoutAnimation.configureNext(LayoutAnimation.create(250, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity))
    const entry = PRODUCE_DATA[produceItem.id]
    setIngredients((prev) => [...prev, {
      produceId: produceItem.id,
      name: entry?.name || produceItem.name,
      amount: '150g',
      color: '#8B949E',
      weightG: 150,
      isOrganic: getDefaultOrganic(organicMode),
      isOriginal: false,
    }])
    setShowAddModal(false)
    setAddSearch('')
  }, [organicMode])

  const handleWeightChange = useCallback((index, delta) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIngredients((prev) => prev.map((ing, i) => {
      if (i !== index) return ing
      const newWeight = Math.max(25, (ing.weightG || 150) + delta)
      return { ...ing, weightG: newWeight, amount: `${newWeight}g` }
    }))
  }, [])

  const handleToggleOrganic = useCallback((index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIngredients((prev) => prev.map((ing, i) => {
      if (i !== index) return ing
      return { ...ing, isOrganic: !ing.isOrganic }
    }))
  }, [])

  const existingIds = useMemo(() => new Set(ingredients.map((i) => i.produceId)), [ingredients])

  const filteredProduce = useMemo(() => {
    let list = ALL_PRODUCE.filter((p) => !existingIds.has(p.id))
    if (addSearch.trim()) {
      const q = addSearch.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list
  }, [existingIds, addSearch])

  const allChecked = ingredients.length > 0 && ingredients.every((_, i) => checkedItems[i])

  // Show taste feedback when returning to this screen after Start Juicing
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (pendingTasteRef.current) {
        pendingTasteRef.current = false
        setShowTaste(true)
      }
    })
    return unsubscribe
  }, [navigation])

  const handleStartJuicing = useCallback(() => {
    if (!recipe || ingredients.length === 0) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    // Hand off to the log/ingredients screen with the (possibly edited)
    // recipe preloaded, so the user can tweak and "Log to Today" with
    // full nutrition computed by the juice engine.
    const preload = ingredients.map((ing) => ({
      produceId: ing.produceId,
      weightG: ing.weightG || 150,
      isOrganic: !!ing.isOrganic,
    }))
    pendingTasteRef.current = true
    navigation.navigate('ScanFlow', {
      screen: 'ScanHome',
      params: { preloadIngredients: preload, source: 'recipe' },
    })
  }, [recipe, ingredients, navigation])

  const handleTasteSelect = useCallback((reaction) => {
    setTasteResponse(reaction)
    setShowTaste(false)
    if (reaction.emoji === '😋') {
      setIsFavorite(true)
    }
  }, [])

  const handleTasteDismiss = useCallback(() => {
    setShowTaste(false)
  }, [])

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.errorText}>Recipe not found</Text>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero Header ──────────────────────────────────── */}
          <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroSlide }] }}>
            <LinearGradient
              colors={recipe.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              {/* Glassmorphism nav bar */}
              <View style={styles.heroNav}>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.heroNavBtn}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setIsFavorite((f) => !f)
                  }}
                  style={styles.heroNavBtn}
                  activeOpacity={0.7}
                >
                  <Heart
                    size={20}
                    color={isFavorite ? '#E91E63' : '#FFFFFF'}
                    fill={isFavorite ? '#E91E63' : 'transparent'}
                  />
                </TouchableOpacity>
              </View>

              {/* Vibe tag + Pillar badges */}
              <View style={styles.heroTagRow}>
                <View style={[styles.vibeTag, { backgroundColor: `${recipe.vibeColor}20` }]}>
                  <Text style={[styles.vibeTagText, { color: recipe.vibeColor }]}>
                    {recipe.vibeTag}
                  </Text>
                </View>
                <View style={styles.heroPillars}>
                  {recipe.pillars.map((p) => (
                    <View key={p} style={[styles.heroPillarBadge, { borderColor: `${DAILY_PILLARS[p].color}50` }]}>
                      <View style={[styles.heroPillarDot, { backgroundColor: DAILY_PILLARS[p].color }]} />
                      <Text style={[styles.heroPillarText, { color: DAILY_PILLARS[p].color }]}>
                        {DAILY_PILLARS[p].shortLabel}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Title */}
              <Text style={styles.heroTitle}>{recipe.title}</Text>

              {/* Cleanup score */}
              <CleanupScore score={recipe.cleanupScore} />
            </LinearGradient>
          </Animated.View>

          {/* ── The "Why" Description ────────────────────────── */}
          <View style={styles.descCard}>
            <Text style={styles.descText}>{recipe.description}</Text>
          </View>

          {/* ── Ingredient Ratio Bar ─────────────────────────── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Ingredient Ratio</Text>
            <IngredientRatioBar ingredients={recipe.ingredients} />
          </View>

          {/* ── Nutrient Benefit Cards ────────────────────────── */}
          <View style={styles.benefitsRow}>
            {recipe.benefits.map((b, i) => (
              <BenefitCard key={i} benefit={b} delay={800 + i * 150} />
            ))}
          </View>

          {/* ── Interactive Checklist (Editable) ─────────────── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {ingredients.map((ing, i) => {
              const isChecked = !!checkedItems[i]
              const ingPillars = classifyProduceAllPillars(ing.produceId)
              return (
                <View key={`${ing.produceId}-${i}`} style={styles.checkRow}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() => toggleCheck(i)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.checkbox,
                      isChecked && { backgroundColor: recipe.vibeColor, borderColor: recipe.vibeColor },
                    ]}>
                      {isChecked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <View style={[styles.checkColorDot, { backgroundColor: ing.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.checkName,
                        isChecked && styles.checkNameDone,
                      ]}>
                        {ing.name}
                        {!ing.isOriginal && (
                          <Text style={styles.addedBadgeText}> (added)</Text>
                        )}
                      </Text>
                      {ingPillars.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                          {ingPillars.map((p) => (
                            <Text key={p} style={{
                              fontSize: 10,
                              fontWeight: '600',
                              color: DAILY_PILLARS[p].color,
                              opacity: isChecked ? 0.5 : 0.8,
                            }}>
                              {DAILY_PILLARS[p].shortLabel}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                  {/* Weight controls */}
                  <View style={styles.ingWeightControls}>
                    <TouchableOpacity
                      style={styles.ingWeightBtn}
                      onPress={() => handleWeightChange(i, -25)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Minus size={10} color="#8B949E" />
                    </TouchableOpacity>
                    <Text style={[
                      styles.checkAmount,
                      isChecked && styles.checkAmountDone,
                    ]}>
                      {fmtG(ing.weightG || 150)}
                    </Text>
                    <TouchableOpacity
                      style={styles.ingWeightBtn}
                      onPress={() => handleWeightChange(i, 25)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Plus size={10} color="#8B949E" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.ingOrganicBtn, ing.isOrganic && styles.ingOrganicBtnActive]}
                    onPress={() => handleToggleOrganic(i)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Leaf size={11} color={ing.isOrganic ? '#81C784' : '#484F58'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeIngBtn}
                    onPress={() => handleRemoveIngredient(i)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color="#E91E63" />
                  </TouchableOpacity>
                </View>
              )
            })}
            {allChecked && ingredients.length > 0 && (
              <View style={styles.allCheckedBadge}>
                <Text style={styles.allCheckedText}>All prepped!</Text>
              </View>
            )}

            {/* Add Ingredient Button */}
            <TouchableOpacity
              style={styles.addIngBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setShowAddModal(true)
              }}
              activeOpacity={0.7}
            >
              <Plus size={16} color="#81C784" />
              <Text style={styles.addIngText}>Add Ingredient</Text>
            </TouchableOpacity>
          </View>

          {/* ── Grocery Delivery (Affiliate) ─────────────────── */}
          {recipe && (
            <TouchableOpacity
              style={styles.groceryBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                const query = recipe.ingredients.map((i) => i.name).join(', ')
                const encoded = encodeURIComponent(query)
                Linking.openURL(`https://www.instacart.com/store/search/${encoded}`)
              }}
              activeOpacity={0.7}
            >
              <ShoppingCart size={18} color="#81C784" />
              <View style={styles.groceryInfo}>
                <Text style={styles.groceryTitle}>Order Ingredients</Text>
                <Text style={styles.groceryDesc}>Get everything delivered via Instacart</Text>
              </View>
              <ExternalLink size={16} color="#484F58" />
            </TouchableOpacity>
          )}

          {/* Taste response */}
          {tasteResponse && (
            <View style={styles.tasteResponseCard}>
              <Text style={styles.tasteResponseEmoji}>{tasteResponse.emoji}</Text>
              <Text style={styles.tasteResponseText}>{tasteResponse.response}</Text>
            </View>
          )}

          {/* Bottom spacer for sticky CTA */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Sticky CTA ───────────────────────────────────────── */}
      {(
        <View style={styles.ctaOuter}>
          <BlurView intensity={60} tint="dark" style={styles.ctaBlur}>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={handleStartJuicing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[recipe.vibeColor, recipe.gradientColors[0]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.ctaText}>Start Juicing</Text>
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </View>
      )}

      <TasteFeedbackModal visible={showTaste} onSelect={handleTasteSelect} onDismiss={handleTasteDismiss} />

      {/* ── Add Ingredient Modal ─────────────────────────── */}
      <Modal visible={showAddModal} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.addModalOverlay}>
          <View style={styles.addModalCard}>
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>Add Ingredient</Text>
              <TouchableOpacity
                onPress={() => { setShowAddModal(false); setAddSearch('') }}
                style={styles.addModalClose}
              >
                <X size={20} color="#8B949E" />
              </TouchableOpacity>
            </View>
            <View style={styles.addModalSearchRow}>
              <Search size={16} color="#484F58" />
              <TextInput
                style={styles.addModalSearchInput}
                placeholder="Search produce..."
                placeholderTextColor="#484F58"
                value={addSearch}
                onChangeText={setAddSearch}
                autoFocus
              />
            </View>
            <ScrollView style={styles.addModalList} keyboardShouldPersistTaps="handled">
              {filteredProduce.map((item) => {
                const pillars = classifyProduceAllPillars(item.id)
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.addModalItem}
                    onPress={() => handleAddIngredient(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addModalItemName}>{item.name}</Text>
                      {pillars.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                          {pillars.map((p) => (
                            <Text key={p} style={{
                              fontSize: 10,
                              fontWeight: '600',
                              color: DAILY_PILLARS[p].color,
                            }}>
                              {DAILY_PILLARS[p].shortLabel}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                    <Plus size={16} color="#81C784" />
                  </TouchableOpacity>
                )
              })}
              {filteredProduce.length === 0 && (
                <Text style={styles.addModalEmpty}>No matching produce found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  errorText: {
    color: '#8B949E',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },

  // ── Hero ───────────────────────────────────────────────────
  heroCard: {
    borderRadius: 24,
    padding: 20,
    paddingTop: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    minHeight: 200,
  },
  heroNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  vibeTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  vibeTagText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroPillars: {
    flexDirection: 'row',
    gap: 6,
  },
  heroPillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroPillarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroPillarText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },

  // ── Cleanup ────────────────────────────────────────────────
  cleanupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cleanupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cleanupStars: {
    flexDirection: 'row',
    gap: 2,
  },
  cleanupText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B949E',
  },

  // ── Description ────────────────────────────────────────────
  descCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  descText: {
    fontSize: 15,
    color: '#C9D1D9',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },

  // ── Ratio Bar ──────────────────────────────────────────────
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  ratioBarContainer: {
    gap: 8,
  },
  ratioBar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ratioSegment: {
    height: '100%',
  },
  ratioLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ratioLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratioLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ratioLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B949E',
  },

  // ── Benefits ───────────────────────────────────────────────
  benefitsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  benefitCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  benefitIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C9D1D9',
    textAlign: 'center',
  },

  // ── Checklist ──────────────────────────────────────────────
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  checkName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C9D1D9',
  },
  checkNameDone: {
    textDecorationLine: 'line-through',
    color: '#484F58',
  },
  checkAmount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B949E',
  },
  checkAmountDone: {
    textDecorationLine: 'line-through',
    color: '#484F58',
  },
  allCheckedBadge: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  allCheckedText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#81C784',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#81C784',
    fontStyle: 'italic',
  },
  ingWeightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
  },
  ingWeightBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingOrganicBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ingOrganicBtnActive: {
    backgroundColor: 'rgba(129,199,132,0.12)',
    borderColor: 'rgba(129,199,132,0.25)',
  },
  removeIngBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(233,30,99,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  addIngBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(129,199,132,0.2)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(129,199,132,0.04)',
  },
  addIngText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#81C784',
  },

  // ── Add Ingredient Modal ────────────────────────────────────
  addModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13,17,23,0.85)',
    justifyContent: 'flex-end',
  },
  addModalCard: {
    backgroundColor: '#161B22',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '70%',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  addModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  addModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  addModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addModalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  addModalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#C9D1D9',
    padding: 0,
  },
  addModalList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  addModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  addModalItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C9D1D9',
  },
  addModalEmpty: {
    fontSize: 14,
    color: '#484F58',
    textAlign: 'center',
    paddingVertical: 24,
  },

  // ── Taste Feedback ─────────────────────────────────────────
  tasteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13,17,23,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tasteCard: {
    backgroundColor: 'rgba(13,17,23,0.95)',
    borderRadius: 32,
    padding: 26,
    width: '100%',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tasteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginBottom: 20,
    gap: 12,
  },
  tasteCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tasteTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tasteOptions: {
    flexDirection: 'row',
    gap: 16,
  },
  tasteSkipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tasteSkipEmoji: {
    fontSize: 16,
  },
  tasteSkipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B949E',
  },
  tasteBtn: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tasteEmoji: {
    fontSize: 32,
  },
  tasteBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B949E',
  },
  tasteResponseCard: {
    backgroundColor: 'rgba(76,175,80,0.06)',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(76,175,80,0.15)',
  },
  tasteResponseEmoji: {
    fontSize: 36,
  },
  tasteResponseText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#81C784',
    textAlign: 'center',
  },

  // ── Grocery Delivery (Affiliate) ────────────────────────────
  groceryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(129,199,132,0.04)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.12)',
  },
  groceryInfo: { flex: 1 },
  groceryTitle: { fontSize: 15, fontWeight: '700', color: '#81C784' },
  groceryDesc: { fontSize: 12, color: '#8B949E', marginTop: 2 },

  // ── Sticky CTA ─────────────────────────────────────────────
  ctaOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  ctaBlur: {
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 16,
  },
  ctaBtn: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
})
