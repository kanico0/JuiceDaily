// ─────────────────────────────────────────────────────────────
// recipeData.js — Canonical recipe data adapter.
// Loads from the bundled 1,000-recipe library JSON and preserves
// the existing RECIPES, getRecipeById, getRecipesByPillar,
// getCleanupLabel, and TASTE_REACTIONS exports.
//
// All recipe consumers must import from this file.
// Do not import from juiceIdeas90 or the raw JSON directly.
// ─────────────────────────────────────────────────────────────

import libraryData from './recipeLibrary1000.json'

const RECIPES = libraryData.recipes
const DATASET_FINGERPRINT = libraryData.datasetFingerprint || ''

const TASTE_REACTIONS = [
  { emoji: '😋', label: 'Delicious', response: 'Saved to your \'Glow-Up\' favorites!' },
  { emoji: '😐', label: 'Okay', response: 'Noted! We\'ll suggest tweaks next time.' },
  { emoji: '🤢', label: 'Not great', response: 'No worries — we\'ll find your perfect blend.' },
]

function getRecipesByPillar (pillarKey) {
  return RECIPES.filter((r) => r.pillars.includes(pillarKey))
}

function getRecipeById (id) {
  return RECIPES.find((r) => r.id === id)
}

function getCleanupLabel (score) {
  const labels = ['', 'Easy Rinse', 'Quick Clean', 'Moderate', 'Staining Risk', 'Deep Scrub']
  return labels[score] || 'Unknown'
}

const SIMPLE_BLEND_MAX = 4

function countDistinctProduceIds (ingredients) {
  return new Set(
    ingredients
      .map((ing) => ing.produceId)
      .filter(Boolean)
      .map((id) => id.toLowerCase())
  ).size
}

function getRecipeBlendType (recipe) {
  const count = countDistinctProduceIds(recipe.ingredients)
  return count >= 5 ? 'advanced' : 'simple'
}

export {
  RECIPES,
  DATASET_FINGERPRINT,
  TASTE_REACTIONS,
  getRecipesByPillar,
  getRecipeById,
  getCleanupLabel,
  countDistinctProduceIds,
  getRecipeBlendType,
  SIMPLE_BLEND_MAX,
}
