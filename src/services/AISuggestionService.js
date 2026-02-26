// ─────────────────────────────────────────────────────────────
// AISuggestionService.js — AI-powered recipe suggestions
// Transparency: always shows reasoning/source for suggestions.
// No black-box recommendations. User can dismiss or edit.
// Gated behind ff_ai_suggestions feature flag.
// ─────────────────────────────────────────────────────────────

import { trackEvent } from './AnalyticsService'

// ── Suggestion Strategies ────────────────────────────────────
// Each strategy produces suggestions with transparent reasoning.

function suggestFromPantry(pantryItems) {
  if (!pantryItems || pantryItems.length === 0) return []

  const useSoon = pantryItems
    .filter((i) => i.isUseSoon || i.isPastGuideline)
    .sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0))

  if (useSoon.length === 0) return []

  const topItems = useSoon.slice(0, 3)
  const ingredientNames = topItems.map((i) => i.guidelineLabel || i.produceId)

  return [{
    id: `ai_pantry_${Date.now()}`,
    type: 'pantry_use',
    title: `Use your ${ingredientNames[0]}`,
    description: `Your ${ingredientNames.join(', ')} ${topItems.length > 1 ? 'are' : 'is'} nearing the quality window. Here is a recipe idea.`,
    reasoning: 'Based on items in your pantry that are approaching their recommended use-by guideline.',
    ingredients: topItems.map((i) => i.produceId),
    confidence: 0.9,
    source: 'pantry_timeline',
  }]
}

function suggestFromHistory(weeklyStats) {
  if (!weeklyStats || !weeklyStats.pillarCounts) return []

  const { base, power, kick } = weeklyStats.pillarCounts
  const total = base + power + kick
  if (total === 0) return []

  // Find the weakest pillar
  const pillars = [
    { name: 'Base', count: base, ingredients: ['cucumber', 'celery', 'watermelon'] },
    { name: 'Power', count: power, ingredients: ['kale', 'spinach', 'beet'] },
    { name: 'Kick', count: kick, ingredients: ['ginger', 'lemon', 'turmeric'] },
  ]
  const weakest = pillars.sort((a, b) => a.count - b.count)[0]

  if (weakest.count >= 3) return [] // All pillars well-covered

  return [{
    id: `ai_balance_${Date.now()}`,
    type: 'pillar_balance',
    title: `Try a ${weakest.name} juice`,
    description: `You have logged ${weakest.count} ${weakest.name} juice${weakest.count !== 1 ? 's' : ''} this week. Adding variety across pillars increases nutritional range.`,
    reasoning: `Your ${weakest.name} pillar has the fewest logs this week compared to other pillars.`,
    ingredients: weakest.ingredients,
    confidence: 0.7,
    source: 'weekly_pattern',
  }]
}

function suggestFromDiversity(weeklyDiversity) {
  if (!weeklyDiversity) return []

  const uniqueColors = weeklyDiversity.uniqueColors || 0
  if (uniqueColors >= 5) return [] // Already diverse

  const missingColors = ['red', 'orange', 'yellow', 'green', 'blue_purple', 'white']
    .filter((c) => !(weeklyDiversity.colors || []).includes(c))

  if (missingColors.length === 0) return []

  const colorIngredientMap = {
    red: ['beet', 'tomato', 'strawberry'],
    orange: ['carrot', 'orange', 'mango'],
    yellow: ['lemon', 'pineapple', 'ginger'],
    green: ['kale', 'spinach', 'cucumber'],
    blue_purple: ['blueberry', 'grape', 'cabbage_red'],
    white: ['cauliflower', 'garlic', 'jicama'],
  }

  const targetColor = missingColors[0]
  const suggestions = colorIngredientMap[targetColor] || []

  return [{
    id: `ai_color_${Date.now()}`,
    type: 'color_diversity',
    title: `Add some ${targetColor.replace('_', '/')} to your week`,
    description: `You have not logged any ${targetColor.replace('_', '/')} produce this week. Try ${suggestions.slice(0, 2).join(' or ')}.`,
    reasoning: `Based on your weekly color log: ${uniqueColors} of 6 color groups covered so far.`,
    ingredients: suggestions,
    confidence: 0.8,
    source: 'color_diversity',
  }]
}

// ── Main Suggestion Generator ────────────────────────────────

export function generateSuggestions({ pantryItems, weeklyStats, weeklyDiversity }) {
  const all = [
    ...suggestFromPantry(pantryItems),
    ...suggestFromHistory(weeklyStats),
    ...suggestFromDiversity(weeklyDiversity),
  ]

  // Sort by confidence descending, limit to 3
  const sorted = all.sort((a, b) => b.confidence - a.confidence).slice(0, 3)

  return sorted
}

// ── Track suggestion interaction ─────────────────────────────

export function trackSuggestionViewed(suggestion) {
  trackEvent('ai_recipe_suggested', {
    suggestion_id_opaque: suggestion.id,
    suggestion_type_enum: suggestion.type,
    confidence_bucket: Math.round(suggestion.confidence * 10) / 10,
    source: suggestion.source,
  })
}

export function trackSuggestionAccepted(suggestion) {
  trackEvent('ai_suggestion_accepted', {
    suggestion_id_opaque: suggestion.id,
    suggestion_type_enum: suggestion.type,
    source: suggestion.source,
  })
}

export function trackSuggestionDismissed(suggestion) {
  trackEvent('ai_suggestion_dismissed', {
    suggestion_id_opaque: suggestion.id,
    suggestion_type_enum: suggestion.type,
    source: suggestion.source,
  })
}
