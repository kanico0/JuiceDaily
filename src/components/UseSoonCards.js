// ─────────────────────────────────────────────────────────────
// UseSoonCards.js — Horizontal "Use Soon" cards for Today Hub
// Shows pantry items nearing quality guideline window.
// Tapping a card suggests a recipe using that ingredient.
// Gated behind ff_use_soon_cards feature flag.
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native'
import { AlertTriangle, ChefHat, Clock } from 'lucide-react-native'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT, GLASS } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { trackEvent } from '../services/AnalyticsService'
import { useFlags } from '../services/FeatureFlags'

// ── Urgency color mapping ────────────────────────────────────

function getUrgencyColor(daysRemaining) {
  if (daysRemaining <= 0) return '#EF5350'
  if (daysRemaining === 1) return '#FF9800'
  return '#FFB74D'
}

function getUrgencyLabel(daysRemaining) {
  if (daysRemaining <= 0) return 'Past guideline'
  if (daysRemaining === 1) return 'Use today'
  return `${daysRemaining} days left`
}

// ── Single Use-Soon Card ─────────────────────────────────────

function UseSoonCard({ item, index, onSuggestRecipe }) {
  const isReduced = useReducedMotion()
  const slideAnim = useRef(new Animated.Value(30)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const delay = isReduced ? 0 : index * 80
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: isReduced ? DURATION.crossfade : DURATION.enter,
          easing: isReduced ? EASING.linear : EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: isReduced ? DURATION.crossfade : DURATION.enter,
          easing: EASING.linear,
          useNativeDriver: true,
        }),
      ]).start()
    }, delay)
  }, [isReduced, index])

  const urgencyColor = getUrgencyColor(item.daysRemaining)
  const urgencyLabel = getUrgencyLabel(item.daysRemaining)

  return (
    <Animated.View
      style={[
        cardStyles.wrapper,
        {
          opacity: opacityAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[cardStyles.card, { borderColor: `${urgencyColor}20` }]}
        onPress={() => {
          trackEvent('pantry_use_suggested', {
            item_id_opaque: item.id,
            days_remaining_bucket: item.daysRemaining,
            surface: 'today_hub_use_soon',
          })
          onSuggestRecipe(item)
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.guidelineLabel}, ${urgencyLabel}. Tap for recipe suggestion.`}
      >
        {/* Urgency indicator */}
        <View style={[cardStyles.urgencyDot, { backgroundColor: urgencyColor }]} />

        {/* Produce name */}
        <Text style={cardStyles.name} numberOfLines={1}>
          {item.guidelineLabel}
        </Text>

        {/* Time remaining */}
        <View style={cardStyles.timeRow}>
          <Clock size={10} color={urgencyColor} />
          <Text style={[cardStyles.timeText, { color: urgencyColor }]}>
            {urgencyLabel}
          </Text>
        </View>

        {/* Storage location */}
        <Text style={cardStyles.storage}>
          {item.storage === 'fridge' ? '🧊' : item.storage === 'counter' ? '🍽️' : '❄️'}{' '}
          {item.storage}
        </Text>

        {/* Recipe suggestion CTA */}
        <View style={cardStyles.recipeCta}>
          <ChefHat size={12} color={DARK.green} />
          <Text style={cardStyles.recipeText}>Use in recipe</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const cardStyles = StyleSheet.create({
  wrapper: {
    marginRight: SPACE.md,
  },
  card: {
    width: 140,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.xl,
    padding: SPACE.md,
    borderWidth: 0.5,
    gap: 6,
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  storage: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    textTransform: 'capitalize',
  },
  recipeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    backgroundColor: 'rgba(129,199,132,0.08)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  recipeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.green,
  },
})

// ── Main UseSoonCards Section ─────────────────────────────────

export default function UseSoonCards({ useSoonItems, onSuggestRecipe }) {
  const { isEnabled } = useFlags()
  const isPantryAiPriority = isEnabled('ff_pantry_ai_priority')
  const alertFiredRef = React.useRef(false)

  // Emit pantry_expiring_alert_sent once when expiring items are shown
  React.useEffect(() => {
    if (!isPantryAiPriority || !useSoonItems || useSoonItems.length === 0) return
    if (alertFiredRef.current) return
    alertFiredRef.current = true
    trackEvent('pantry_expiring_alert_sent', {
      item_count: useSoonItems.length,
      surface: 'today_hub_use_soon',
    })
  }, [isPantryAiPriority, useSoonItems])

  if (!useSoonItems || useSoonItems.length === 0) return null

  return (
    <View style={sectionStyles.container}>
      {/* Section header */}
      <View style={sectionStyles.header}>
        <View style={sectionStyles.headerLeft}>
          <AlertTriangle size={14} color="#FFB74D" />
          <Text style={sectionStyles.title}>Use Soon</Text>
        </View>
        <Text style={sectionStyles.count}>
          {useSoonItems.length} item{useSoonItems.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <Text style={sectionStyles.subtitle}>
        {isPantryAiPriority
          ? 'AI recipes will prioritize these ingredients'
          : 'These items are nearing their recommended quality window'}
      </Text>

      {/* Horizontal scroll of cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sectionStyles.scrollContent}
      >
        {useSoonItems.slice(0, 8).map((item, index) => (
          <UseSoonCard
            key={item.id}
            item={item}
            index={index}
            onSuggestRecipe={onSuggestRecipe}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const sectionStyles = StyleSheet.create({
  container: {
    marginBottom: SPACE.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFB74D',
  },
  count: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    marginBottom: SPACE.md,
  },
  scrollContent: {
    paddingRight: SPACE.md,
  },
})
