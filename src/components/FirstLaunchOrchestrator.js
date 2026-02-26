// ─────────────────────────────────────────────────────────────
// FirstLaunchOrchestrator.js — Emotional first-launch flow
// Detects first app open, presents goal selection, generates
// a tailored recipe via AISuggestionService, pre-fills
// QuickLogger, triggers RewardSplash + StreakEngine on log.
// Gated behind ff_first_launch_orchestrator feature flag.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Sparkles, ArrowRight, ChefHat, Check } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import GoalSelectionCard, { GOALS } from './GoalSelectionCard'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import { generateSuggestions } from '../services/AISuggestionService'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import { classifyProduceAllPillars, DAILY_PILLARS } from '../services/ChallengeStore'
import { useFormatWeight } from '../utils/weightFormat'
import { useOrganicPref, getDefaultOrganic } from '../utils/organicPreference'

const FIRST_LAUNCH_KEY = '@juicing_first_launch_orchestrator_done'

// ── Goal → Recipe Mapping ────────────────────────────────────
// Maps user goals to recipe suggestion contexts for AISuggestionService

const GOAL_RECIPE_MAP = {
  energy: {
    type: 'goal_energy',
    title: 'Morning Energy Boost',
    description: 'A vibrant citrus-ginger blend to kickstart your day with natural energy.',
    ingredients: ['orange', 'carrot', 'ginger', 'lemon'],
    pillar: 'kick',
  },
  glow: {
    type: 'goal_glow',
    title: 'Radiance Green Glow',
    description: 'Cucumber and celery hydrate from within, while kale delivers skin-loving vitamins.',
    ingredients: ['cucumber', 'celery', 'kale', 'lemon'],
    pillar: 'base',
  },
  immunity: {
    type: 'goal_immunity',
    title: 'Immunity Shield',
    description: 'Citrus vitamin C paired with turmeric and ginger for natural defense support.',
    ingredients: ['orange', 'lemon', 'turmeric', 'ginger'],
    pillar: 'kick',
  },
  detox: {
    type: 'goal_detox',
    title: 'Green Detox Reset',
    description: 'A classic green blend with beet for liver-supporting nutrients.',
    ingredients: ['kale', 'spinach', 'beet', 'lemon'],
    pillar: 'power',
  },
  explore: {
    type: 'goal_explore',
    title: 'Classic Green Starter',
    description: 'The perfect beginner juice — mild, refreshing, and packed with nutrients.',
    ingredients: ['cucumber', 'celery', 'kale', 'lemon'],
    pillar: 'base',
  },
}

// ── Step: Welcome ────────────────────────────────────────────

function WelcomeStep({ onNext }) {
  const isReduced = useReducedMotion()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(isReduced ? 0 : 20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: isReduced ? DURATION.crossfade : DURATION.enter,
        easing: isReduced ? EASING.linear : EASING.decelerate,
        useNativeDriver: true,
      }),
      ...(isReduced ? [] : [
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: DURATION.enter,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [isReduced])

  return (
    <Animated.View style={[stepStyles.wrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={stepStyles.emoji}>🍹</Text>
      <Text style={stepStyles.title}>Your first juice is 60 seconds away</Text>
      <Text style={stepStyles.desc}>
        Tell us your goal, and we will create a personalized recipe — then log it in three taps.
      </Text>
      <TouchableOpacity
        style={stepStyles.nextBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onNext()
        }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Get started with goal selection"
      >
        <Text style={stepStyles.nextBtnText}>Let's Go</Text>
        <ArrowRight size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Step: Goal Selection ─────────────────────────────────────

function GoalStep({ selectedGoal, onSelectGoal, onNext, onExplore }) {
  const isExplore = selectedGoal === 'explore'

  return (
    <View style={stepStyles.wrap}>
      <GoalSelectionCard
        selectedGoal={selectedGoal}
        onSelectGoal={onSelectGoal}
      />
      <TouchableOpacity
        style={[stepStyles.nextBtn, !selectedGoal && stepStyles.nextBtnDisabled]}
        onPress={() => {
          if (!selectedGoal) return
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          if (isExplore) {
            onExplore()
          } else {
            onNext()
          }
        }}
        activeOpacity={0.8}
        disabled={!selectedGoal}
        accessibilityRole="button"
        accessibilityLabel={isExplore ? 'Start exploring the app' : 'Continue to your personalized recipe'}
      >
        <Text style={stepStyles.nextBtnText}>{isExplore ? 'Start Exploring' : 'Show My Recipe'}</Text>
        {isExplore ? <ArrowRight size={18} color="#FFFFFF" /> : <ChefHat size={18} color="#FFFFFF" />}
      </TouchableOpacity>
    </View>
  )
}

// ── Step: Recipe Preview ─────────────────────────────────────

function RecipePreviewStep({ recipe, onCustomize, onSkip, onQuickLog }) {
  const isReduced = useReducedMotion()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: isReduced ? DURATION.crossfade : DURATION.standard,
      easing: isReduced ? EASING.linear : EASING.decelerate,
      useNativeDriver: true,
    }).start()
  }, [isReduced])

  if (!recipe) return null

  return (
    <Animated.View style={[stepStyles.wrap, { opacity: fadeAnim }]}>
      <Text style={stepStyles.emoji}>🧃</Text>
      <Text style={stepStyles.title}>{recipe.title}</Text>
      <Text style={stepStyles.desc}>{recipe.description}</Text>

      <View style={recipeStyles.ingredientList}>
        {recipe.ingredients.map((ing) => (
          <View key={ing} style={recipeStyles.ingredientChip}>
            <Text style={recipeStyles.ingredientText}>{ing}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={stepStyles.startBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onCustomize()
        }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Customize ingredients and portions before logging"
      >
        <LinearGradient
          colors={['#4CAF50', '#2E7D32']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={stepStyles.startBtnGradient}
        >
          <ChefHat size={20} color="#FFFFFF" />
          <Text style={stepStyles.startBtnText}>Customize & Log</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={stepStyles.quickLogBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onQuickLog()
        }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Log a juice you already made"
      >
        <Text style={stepStyles.quickLogBtnText}>I Just Juiced!</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={stepStyles.skipBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onSkip()
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Skip logging and explore the app"
      >
        <Text style={stepStyles.skipBtnText}>Maybe Later</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Step: Ingredient Checklist ───────────────────────────────

const INGREDIENT_RATIOS = {
  4: [0.35, 0.25, 0.25, 0.15],
  3: [0.40, 0.35, 0.25],
  2: [0.55, 0.45],
  1: [1.0],
}
const DEFAULT_WEIGHT_G = 475

function IngredientChecklistStep({ recipe, onLogIt, onBack }) {
  const isReduced = useReducedMotion()
  const { fmtG } = useFormatWeight()
  const { mode: organicMode } = useOrganicPref()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const ratios = INGREDIENT_RATIOS[recipe.ingredients.length] || INGREDIENT_RATIOS[4]

  const [checkedItems, setCheckedItems] = useState(() => {
    const init = {}
    recipe.ingredients.forEach((_, i) => { init[i] = true })
    return init
  })

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: isReduced ? DURATION.crossfade : DURATION.standard,
      easing: isReduced ? EASING.linear : EASING.decelerate,
      useNativeDriver: true,
    }).start()
  }, [isReduced])

  const toggleCheck = useCallback((idx) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }, [])

  const checkedCount = Object.values(checkedItems).filter(Boolean).length

  const handleLog = useCallback(() => {
    const selected = recipe.ingredients
      .map((ing, i) => ({ ing, i }))
      .filter(({ i }) => checkedItems[i])
      .map(({ ing, i }) => ({
        produceId: ing,
        weightG: Math.round(DEFAULT_WEIGHT_G * (ratios[i] || 0.25)),
        isOrganic: getDefaultOrganic(organicMode),
      }))
    if (selected.length === 0) return
    onLogIt(selected)
  }, [recipe, checkedItems, ratios, onLogIt, organicMode])

  return (
    <Animated.View style={[stepStyles.wrap, { opacity: fadeAnim }]}>
      <Text style={checklistStyles.heading}>Pick Your Ingredients</Text>
      <Text style={checklistStyles.subheading}>
        Toggle off anything you don't have — we'll log the rest.
      </Text>

      <ScrollView
        style={checklistStyles.scrollArea}
        contentContainerStyle={checklistStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {recipe.ingredients.map((ingId, i) => {
          const produce = PRODUCE_DATA[ingId.toLowerCase()]
          const displayName = produce ? produce.name : ingId
          const weightG = Math.round(DEFAULT_WEIGHT_G * (ratios[i] || 0.25))
          const weightLabel = fmtG(weightG)
          const isChecked = !!checkedItems[i]
          const pillars = classifyProduceAllPillars(ingId)

          return (
            <TouchableOpacity
              key={ingId}
              style={[
                checklistStyles.row,
                !isChecked && checklistStyles.rowUnchecked,
              ]}
              onPress={() => toggleCheck(i)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              accessibilityLabel={`${displayName}, ${weightLabel}`}
            >
              <View style={[
                checklistStyles.checkbox,
                isChecked && checklistStyles.checkboxChecked,
              ]}>
                {isChecked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[
                  checklistStyles.ingName,
                  !isChecked && checklistStyles.ingNameOff,
                ]}>
                  {displayName}
                </Text>
                {pillars.length > 0 && (
                  <View style={checklistStyles.pillarRow}>
                    {pillars.map((p) => (
                      <Text key={p} style={[
                        checklistStyles.pillarLabel,
                        { color: DAILY_PILLARS[p].color, opacity: isChecked ? 0.8 : 0.4 },
                      ]}>
                        {DAILY_PILLARS[p].shortLabel}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              <Text style={[
                checklistStyles.amount,
                !isChecked && checklistStyles.amountOff,
              ]}>
                {weightLabel}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <TouchableOpacity
        style={[stepStyles.startBtn, checkedCount === 0 && stepStyles.nextBtnDisabled]}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          handleLog()
        }}
        activeOpacity={0.8}
        disabled={checkedCount === 0}
        accessibilityRole="button"
        accessibilityLabel={`Log juice with ${checkedCount} ingredients`}
      >
        <LinearGradient
          colors={checkedCount > 0 ? ['#4CAF50', '#2E7D32'] : ['#333', '#222']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={stepStyles.startBtnGradient}
        >
          <Sparkles size={20} color="#FFFFFF" />
          <Text style={stepStyles.startBtnText}>
            Log This Juice ({checkedCount})
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={stepStyles.skipBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onBack()
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Go back to recipe overview"
      >
        <Text style={stepStyles.skipBtnText}>← Back</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const checklistStyles = StyleSheet.create({
  heading: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.heavy,
    color: DARK.textPrimary,
    textAlign: 'center',
    marginBottom: SPACE.xs,
  },
  subheading: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
    textAlign: 'center',
    marginBottom: SPACE.lg,
  },
  scrollArea: {
    maxHeight: 240,
    width: '100%',
    marginBottom: SPACE.lg,
  },
  scrollContent: {
    gap: SPACE.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    gap: SPACE.md,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowUnchecked: {
    opacity: 0.45,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  ingName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    textTransform: 'capitalize',
  },
  ingNameOff: {
    textDecorationLine: 'line-through',
    color: DARK.textMuted,
  },
  pillarRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  pillarLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  amount: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textSecondary,
  },
  amountOff: {
    color: DARK.textMuted,
    textDecorationLine: 'line-through',
  },
})

const recipeStyles = StyleSheet.create({
  ingredientList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACE.sm,
    marginVertical: SPACE.lg,
  },
  ingredientChip: {
    backgroundColor: 'rgba(129,199,132,0.1)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.2)',
  },
  ingredientText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.green,
    textTransform: 'capitalize',
  },
})

// ── Step: Sign-In Prompt ─────────────────────────────────────

function SignInPromptStep({ onSkip }) {
  const isReduced = useReducedMotion()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: isReduced ? DURATION.crossfade : DURATION.enter,
      easing: isReduced ? EASING.linear : EASING.decelerate,
      useNativeDriver: true,
    }).start()
  }, [isReduced])

  return (
    <Animated.View style={[stepStyles.wrap, { opacity: fadeAnim }]}>
      <Text style={stepStyles.emoji}>🎉</Text>
      <Text style={stepStyles.title}>You just logged your first juice!</Text>
      <Text style={stepStyles.desc}>
        Your streak has started. Come back tomorrow to keep it going.
      </Text>

      <TouchableOpacity
        style={stepStyles.nextBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onSkip()
        }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Continue to the main app"
      >
        <Text style={stepStyles.nextBtnText}>Start Juicing</Text>
        <ArrowRight size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Shared Step Styles ───────────────────────────────────────

const stepStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: SPACE.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.heavy,
    color: DARK.textPrimary,
    textAlign: 'center',
    marginBottom: SPACE.sm,
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACE.xl,
    paddingHorizontal: SPACE.sm,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.xxl,
    borderRadius: RADIUS.xl,
    width: '100%',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nextBtnDisabled: {
    opacity: 0.3,
  },
  nextBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
  startBtn: {
    width: '100%',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  startBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: RADIUS.xl,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  startBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.heavy,
    color: '#FFFFFF',
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.md,
    marginTop: SPACE.sm,
  },
  quickLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.xxl,
    borderRadius: RADIUS.xl,
    width: '100%',
    marginTop: SPACE.sm,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickLogBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
  skipBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
  },
})

// ── Main Orchestrator ────────────────────────────────────────

export default function FirstLaunchOrchestrator({
  visible,
  onComplete,
  onLogJuice,
  onTriggerReward,
  onRecordStreak,
  onQuickLog,
}) {
  const [step, setStep] = useState(0) // 0=welcome, 1=goal, 2=recipe preview, 3=ingredient checklist, 4=done
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [recipe, setRecipe] = useState(null)

  // Emit first_launch_viewed on mount
  useEffect(() => {
    if (visible) {
      trackEvent('first_launch_viewed', { source: 'orchestrator' })
    }
  }, [visible])

  const handleGoalSelected = useCallback((goalId) => {
    setSelectedGoal(goalId)
    trackEvent('goal_selected', { goal_enum: goalId, source: 'first_launch' })
  }, [])

  const handleShowRecipe = useCallback(() => {
    if (!selectedGoal) return
    const goalRecipe = GOAL_RECIPE_MAP[selectedGoal]

    // Try AISuggestionService first for richer suggestions
    const aiSuggestions = generateSuggestions({
      pantryItems: [],
      weeklyStats: null,
      weeklyDiversity: null,
    })

    // Use goal-mapped recipe as primary (AI may not have data on first launch)
    const finalRecipe = goalRecipe
    setRecipe(finalRecipe)

    trackEvent('first_recipe_generated', {
      suggestion_type_enum: finalRecipe.type,
      goal_enum: selectedGoal,
      source: 'first_launch',
    })

    setStep(2)
  }, [selectedGoal])

  const handleLogIt = useCallback((scannedIngredients) => {
    if (!scannedIngredients || scannedIngredients.length === 0) return

    // Trigger the log through parent callback
    if (onLogJuice) onLogJuice(scannedIngredients)

    // Trigger reward splash
    if (onTriggerReward) onTriggerReward()

    // Record streak increment
    if (onRecordStreak) onRecordStreak()

    setStep(4)
  }, [onLogJuice, onTriggerReward, onRecordStreak])

  const handleFinish = useCallback(async () => {
    try {
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true')
    } catch (e) {
      // Non-fatal
    }
    if (onComplete) onComplete(selectedGoal)
  }, [onComplete, selectedGoal])

  const handleDismiss = useCallback(() => {
    if (onComplete) onComplete(selectedGoal)
  }, [onComplete, selectedGoal])

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View style={modalStyles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={modalStyles.keyboardWrap}
        >
          <View style={modalStyles.card}>
            {/* Progress dots */}
            <View style={modalStyles.dots}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    modalStyles.dot,
                    i === step && modalStyles.dotActive,
                    i < step && modalStyles.dotDone,
                  ]}
                />
              ))}
            </View>

            {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
            {step === 1 && (
              <GoalStep
                selectedGoal={selectedGoal}
                onSelectGoal={handleGoalSelected}
                onNext={handleShowRecipe}
                onExplore={handleFinish}
              />
            )}
            {step === 2 && (
              <RecipePreviewStep
                recipe={recipe}
                onCustomize={() => setStep(3)}
                onSkip={handleDismiss}
                onQuickLog={() => {
                  handleDismiss()
                  if (onQuickLog) onQuickLog()
                }}
              />
            )}
            {step === 3 && (
              <IngredientChecklistStep
                recipe={recipe}
                onLogIt={handleLogIt}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && <SignInPromptStep onSkip={handleFinish} />}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  card: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'rgba(13,17,23,0.95)',
    borderRadius: RADIUS.xxl,
    padding: SPACE.xxl,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACE.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dotActive: {
    backgroundColor: DARK.green,
    width: 24,
  },
  dotDone: {
    backgroundColor: 'rgba(129,199,132,0.4)',
  },
})

// Export for checking first-launch state externally
export async function hasCompletedFirstLaunch() {
  try {
    const val = await AsyncStorage.getItem(FIRST_LAUNCH_KEY)
    return val === 'true'
  } catch (e) {
    return false
  }
}

// Export for marking first-launch as done (called when any juice is logged)
export async function markFirstLaunchDone() {
  try {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true')
  } catch (e) {
    // Non-fatal
  }
}

// Export for resetting first-launch state (dev/testing)
export async function resetFirstLaunch() {
  try {
    await AsyncStorage.removeItem(FIRST_LAUNCH_KEY)
  } catch (e) {
    // Non-fatal
  }
}
