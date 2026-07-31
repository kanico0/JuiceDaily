// src/services/recipeSearch.js
// Fast search over the 1,000-recipe library by produce name, alias, and title.
// Ranking: exact title > title prefix > ingredient match > alias match.
// All searches are case-insensitive and return recipes in ranked order.

import { RECIPES } from '../constants/recipeData'
import {
  resolveQueryToProduceFamily,
  recipeContainsProduceFamily,
} from './produceFamilies'

// ── Produce alias map ────────────────────────────────────────
// Maps common names and aliases to produceId keys.
const PRODUCE_ALIASES = {
  // Greens
  kale: ['kale', 'curly kale', 'dinosaur kale', 'lacinato'],
  spinach: ['spinach', 'baby spinach'],
  swiss_chard: ['swiss chard', 'chard', 'silverbeet'],
  collard_greens: ['collard', 'collards', 'collard greens'],
  dandelion_greens: ['dandelion', 'dandelion greens'],
  arugula: ['arugula', 'rocket', 'rucola'],
  romaine: ['romaine', 'cos lettuce', 'romaine lettuce'],
  bok_choy: ['bok choy', 'pak choi', 'chinese cabbage'],
  wheatgrass: ['wheatgrass', 'wheat grass'],
  parsley: ['parsley', 'flat leaf parsley', 'curly parsley'],
  cilantro: ['cilantro', 'coriander', 'chinese parsley'],
  mint: ['mint', 'peppermint', 'spearmint'],
  basil: ['basil', 'sweet basil', 'thai basil'],
  aloe_vera: ['aloe', 'aloe vera'],
  watercress: ['watercress', 'cress'],

  // Cruciferous
  broccoli: ['broccoli', 'broccolini'],
  cabbage_green: ['cabbage', 'green cabbage'],
  cabbage_red: ['red cabbage', 'purple cabbage'],
  cauliflower: ['cauliflower'],
  kohlrabi: ['kohlrabi', 'kohlrabi bulb'],

  // Root & Stalk
  carrot: ['carrot', 'carrots'],
  celery: ['celery', 'celery stalk'],
  beet: ['beet', 'beets', 'beetroot'],
  cucumber: ['cucumber', 'cukes'],
  fennel: ['fennel', 'fennel bulb'],
  sweet_potato: ['sweet potato', 'yam'],
  turnip: ['turnip', 'turnips'],
  celeriac: ['celeriac', 'celery root'],
  jicama: ['jicama', 'yam bean'],
  zucchini: ['zucchini', 'courgette'],
  asparagus: ['asparagus'],
  radish: ['radish', 'radishes', 'daikon'],
  ginger: ['ginger', 'ginger root'],
  turmeric: ['turmeric', 'curcumin'],
  garlic: ['garlic', 'garlic clove'],

  // Peppers
  bell_pepper_red: ['red bell pepper', 'red pepper', 'capsicum'],
  bell_pepper_yellow: ['yellow bell pepper', 'yellow pepper'],
  bell_pepper_green: ['green bell pepper', 'green pepper'],
  jalapeño: ['jalapeño', 'jalapeno', 'jalapenos'],
  cayenne: ['cayenne', 'cayenne pepper', 'chili'],
  tomato: ['tomato', 'tomatoes'],

  // Fruits
  apple: ['apple', 'apples'],
  apple_green: ['green apple', 'granny smith'],
  apple_red: ['red apple', 'fuji', 'gala'],
  lemon: ['lemon', 'lemons'],
  lime: ['lime', 'limes'],
  orange: ['orange', 'oranges', 'navel orange'],
  grapefruit: ['grapefruit'],
  pineapple: ['pineapple', 'pineapples'],
  watermelon: ['watermelon', 'watermelons'],
  pomegranate: ['pomegranate'],
  mango: ['mango', 'mangos', 'mangoes'],
  papaya: ['papaya', 'pawpaw'],
  kiwi: ['kiwi', 'kiwifruit', 'kiwi fruit'],
  pear: ['pear', 'pears'],
  grape: ['grape', 'grapes'],
  strawberry: ['strawberry', 'strawberries'],
  blueberry: ['blueberry', 'blueberries'],
  raspberry: ['raspberry', 'raspberries'],
  blackberry: ['blackberry', 'blackberries'],
  cranberry: ['cranberry', 'cranberries'],
  cherry: ['cherry', 'cherries', 'tart cherry'],
  cantaloupe: ['cantaloupe', 'rockmelon', 'muskmelon'],
  honeydew: ['honeydew', 'honeydew melon'],
  coconut_water: ['coconut water', 'coconut'],
  passion_fruit: ['passion fruit', 'passionfruit', 'maracuya'],
  peach: ['peach', 'peaches'],
  plum: ['plum', 'plums'],
  nectarine: ['nectarine', 'nectarines'],
}

// Build reverse lookup: alias -> produceId
const ALIAS_TO_PRODUCE_ID = {}
for (const [produceId, aliases] of Object.entries(PRODUCE_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_PRODUCE_ID[alias.toLowerCase()] = produceId
  }
}

// ── Search index (built once) ────────────────────────────────

let searchIndex = null

function buildSearchIndex () {
  const index = RECIPES.map((recipe) => {
    const titleLower = recipe.title.toLowerCase()
    const ingredientNames = recipe.ingredients.map((ing) => ing.name.toLowerCase())
    const ingredientProduceIds = recipe.ingredients.map((ing) => ing.produceId.toLowerCase())
    const vibeLower = recipe.vibeTag.toLowerCase()

    return {
      id: recipe.id,
      title: recipe.title,
      titleLower,
      vibeTag: recipe.vibeTag,
      vibeColor: recipe.vibeColor,
      collection: recipe.collection,
      tier: recipe.tier,
      cleanupScore: recipe.cleanupScore,
      ingredientCount: recipe.ingredients.length,
      ingredientNames,
      ingredientProduceIds,
      vibeLower,
    }
  })
  return index
}

function getIndex () {
  if (!searchIndex) {
    searchIndex = buildSearchIndex()
  }
  return searchIndex
}

// ── Search ───────────────────────────────────────────────────

/**
 * Search recipes by query string. Matches on title, ingredient names,
 * and produce aliases. Results are ranked:
 *   1. Exact title match
 *   2. Title starts with query
 *   3. Title contains query
 *   4. Ingredient name match
 *   5. Alias/produceId match
 *
 * @param {string} query - Search term
 * @param {object} [filters] - Optional filters
 * @param {string} [filters.collection] - Filter by collection
 * @param {string} [filters.tier] - Filter by tier
 * @param {number} [limit] - Max results (default: 50)
 * @returns {Array} Ranked recipe objects
 */
function searchRecipes (query, filters, limit) {
  const q = (query || '').trim().toLowerCase()
  const max = limit || 50

  if (!q) {
    // No query — return all (filtered) recipes in default order
    let results = getIndex()
    if (filters) {
      results = results.filter((r) => {
        if (filters.collection && r.collection !== filters.collection) return false
        if (filters.tier && r.tier !== filters.tier) return false
        return true
      })
    }
    return results.slice(0, max).map((r) => RECIPES.find((recipe) => recipe.id === r.id))
  }

  // Check if query resolves to a known produce family
  const produceFamily = resolveQueryToProduceFamily(q)

  // Check if query matches a produce alias (for non-family produce)
  const matchedProduceId = ALIAS_TO_PRODUCE_ID[q]

  if (produceFamily) {
    // Use structured produce-family matching for recognized produce queries
    // Inclusion is based solely on recipe ingredient IDs, not title text
    const familyRecipes = getIndex()
      .filter((r) => {
        if (filters) {
          if (filters.collection && r.collection !== filters.collection) return false
          if (filters.tier && r.tier !== filters.tier) return false
        }
        return true
      })
      .map((r) => {
        const recipe = RECIPES.find((rec) => rec.id === r.id)
        let score = 0

        // Inclusion: recipe must contain the produce family
        if (recipe && recipeContainsProduceFamily(recipe, produceFamily)) {
          // Ranking: exact variant match > title match > family match
          let hasExactVariant = false
          for (const pid of r.ingredientProduceIds) {
            if (pid === q || pid === matchedProduceId) {
              hasExactVariant = true
              break
            }
          }

          if (hasExactVariant) {
            score = 55
          } else if (r.titleLower === q) {
            score = 54
          } else if (r.titleLower.startsWith(q)) {
            score = 53
          } else {
            score = 50
          }
        }

        return { recipe, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.recipe.id.localeCompare(b.recipe.id)
      })

    return familyRecipes.slice(0, max).map((entry) => entry.recipe)
  }

  // Non-produce free-text search (unchanged path)
  const scored = getIndex()
    .filter((r) => {
      if (filters) {
        if (filters.collection && r.collection !== filters.collection) return false
        if (filters.tier && r.tier !== filters.tier) return false
      }
      return true
    })
    .map((r) => {
      let score = 0

      // Exact title match
      if (r.titleLower === q) {
        score = 100
      } else if (r.titleLower.startsWith(q)) {
        score = 80
      } else if (r.titleLower.includes(q)) {
        score = 60
      } else if (r.vibeLower.includes(q)) {
        score = 40
      } else {
        // Check ingredient names
        for (const ingName of r.ingredientNames) {
          if (ingName === q) {
            score = Math.max(score, 50)
          } else if (ingName.startsWith(q)) {
            score = Math.max(score, 35)
          } else if (ingName.includes(q)) {
            score = Math.max(score, 25)
          }
        }

        // Check produceId match (exact only, no substring)
        for (const pid of r.ingredientProduceIds) {
          if (pid === q) {
            score = Math.max(score, 45)
          }
        }

        // Check alias match
        if (matchedProduceId) {
          for (const pid of r.ingredientProduceIds) {
            if (pid === matchedProduceId) {
              score = Math.max(score, 55)
            }
          }
        }
      }

      return { recipe: RECIPES.find((rec) => rec.id === r.id), score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.recipe.id.localeCompare(b.recipe.id)
    })

  return scored.slice(0, max).map((entry) => entry.recipe)
}

/**
 * Get all produce aliases for autocomplete suggestions.
 * @returns {Array} Sorted list of alias strings
 */
function getSearchSuggestions () {
  return Object.keys(ALIAS_TO_PRODUCE_ID).sort((a, b) => a.localeCompare(b))
}

/**
 * Resolve a search query to a produceId if it matches an alias.
 * @param {string} query
 * @returns {string|null}
 */
function resolveAlias (query) {
  const q = (query || '').trim().toLowerCase()
  return ALIAS_TO_PRODUCE_ID[q] || null
}

export {
  searchRecipes,
  getSearchSuggestions,
  resolveAlias,
  PRODUCE_ALIASES,
  ALIAS_TO_PRODUCE_ID,
}
