export const JUICE_SPOTLIGHTS = [
  {
    id: 'green-glow',
    name: 'Green Glow',
    shortDescription: 'A crisp green blend for an easy, produce-forward juice.',
    ingredients: ['kale', 'cucumber', 'apple', 'lemon'],
    ingredientLabels: ['Kale', 'Cucumber', 'Green Apple', 'Lemon'],
    focusNutrients: ['vitamin_k', 'folate', 'iron_support', 'magnesium'],
    accentColors: ['#70C97A', '#1B7F55', '#0D3D2C'],
    preparationSteps: ['Wash produce thoroughly.', 'Cut ingredients to fit your juicer.', 'Juice and enjoy soon after preparation.'],
    juicerNote: 'Cucumber adds a clean, refreshing base.',
    beginnerFriendly: true,
    imageSource: null,
  },
  {
    id: 'carrot-sunrise',
    name: 'Carrot Sunrise',
    shortDescription: 'A simple, colorful blend to begin exploring juicing.',
    ingredients: ['carrot', 'orange', 'apple', 'ginger'],
    ingredientLabels: ['Carrot', 'Orange', 'Green Apple', 'Ginger'],
    focusNutrients: ['vitamin_a', 'vitamin_c'],
    accentColors: ['#FFB347', '#F06B3C', '#9B3C2D'],
    preparationSteps: ['Wash produce thoroughly.', 'Cut carrots and oranges to fit your juicer.', 'Add ginger gradually, then enjoy soon after juicing.'],
    juicerNote: 'Start with a small piece of ginger and adjust to taste.',
    beginnerFriendly: true,
    imageSource: null,
  },
  {
    id: 'beet-bright',
    name: 'Beet Bright',
    shortDescription: 'An earthy, vibrant blend with a bright citrus finish.',
    ingredients: ['beet', 'apple', 'carrot', 'lemon'],
    ingredientLabels: ['Beet', 'Green Apple', 'Carrot', 'Lemon'],
    focusNutrients: ['folate', 'iron_support', 'antioxidants'],
    accentColors: ['#C1445A', '#8C2354', '#401B45'],
    preparationSteps: ['Wash and trim produce.', 'Cut beet and carrot into slim pieces.', 'Juice with lemon and enjoy soon after preparation.'],
    juicerNote: 'Peel beet if its skin is tough or waxed.',
    beginnerFriendly: false,
    imageSource: null,
  },
  {
    id: 'cucumber-cooler',
    name: 'Cucumber Cooler',
    shortDescription: 'A light, refreshing blend built around crisp ingredients.',
    ingredients: ['cucumber', 'celery', 'apple', 'lime'],
    ingredientLabels: ['Cucumber', 'Celery', 'Green Apple', 'Lime'],
    focusNutrients: ['potassium', 'fiber'],
    accentColors: ['#8BD17C', '#3C9D75', '#156450'],
    preparationSteps: ['Wash produce thoroughly.', 'Cut celery and cucumber to fit your juicer.', 'Finish with lime and enjoy soon after preparation.'],
    juicerNote: 'Use what you have—lemon works well if lime is unavailable.',
    beginnerFriendly: true,
    imageSource: null,
  },
  {
    id: 'berry-green',
    name: 'Berry Green',
    shortDescription: 'A colorful green blend with a berry-inspired accent.',
    ingredients: ['spinach', 'blueberry', 'apple', 'lemon'],
    ingredientLabels: ['Spinach', 'Blueberry', 'Green Apple', 'Lemon'],
    focusNutrients: ['antioxidants', 'vitamin_e', 'vitamin_k'],
    accentColors: ['#8756B8', '#55408A', '#1C6B56'],
    preparationSteps: ['Wash produce thoroughly.', 'Cut ingredients to fit your juicer.', 'Juice and enjoy soon after preparation.'],
    juicerNote: 'Use what you have—spinach keeps the blend approachable.',
    beginnerFriendly: true,
    imageSource: null,
  },
  {
    id: 'golden-fresh',
    name: 'Golden Fresh',
    shortDescription: 'A bright, tropical-leaning juice with a gentle ginger note.',
    ingredients: ['pineapple', 'carrot', 'lemon', 'ginger'],
    ingredientLabels: ['Pineapple', 'Carrot', 'Lemon', 'Ginger'],
    focusNutrients: ['vitamin_c', 'vitamin_a'],
    accentColors: ['#F7C948', '#EF8A34', '#D85E37'],
    preparationSteps: ['Wash and prepare produce.', 'Cut pineapple and carrot to fit your juicer.', 'Juice with lemon and ginger, then enjoy soon after.'],
    juicerNote: 'Adjust ginger based on your preferred level of warmth.',
    beginnerFriendly: true,
    imageSource: null,
  },
  {
    id: 'simple-apple-green',
    name: 'Simple Apple Green',
    shortDescription: 'A three-ingredient starting point for a quick fresh juice.',
    ingredients: ['apple', 'cucumber', 'spinach'],
    ingredientLabels: ['Green Apple', 'Cucumber', 'Spinach'],
    focusNutrients: ['fiber', 'magnesium', 'calcium'],
    accentColors: ['#B4D96C', '#5BAA67', '#247052'],
    preparationSteps: ['Wash produce thoroughly.', 'Cut ingredients to fit your juicer.', 'Juice and enjoy soon after preparation.'],
    juicerNote: 'A practical choice when you want fewer ingredients.',
    beginnerFriendly: true,
    imageSource: null,
  },
  {
    id: 'citrus-lift',
    name: 'Citrus Lift',
    shortDescription: 'A bright citrus blend with a small ginger finish.',
    ingredients: ['orange', 'grapefruit', 'lemon', 'ginger'],
    ingredientLabels: ['Orange', 'Grapefruit', 'Lemon', 'Ginger'],
    focusNutrients: ['vitamin_c', 'zinc'],
    accentColors: ['#FFD166', '#FF9F43', '#ED6A5A'],
    preparationSteps: ['Wash citrus thoroughly.', 'Peel thick citrus skin before juicing.', 'Add ginger gradually and enjoy soon after preparation.'],
    juicerNote: 'Use what you have—orange and lemon make a simple alternative.',
    beginnerFriendly: true,
    imageSource: null,
  },
]

export const SPOTLIGHT_FOCUS_MAP = {
  vitamin_k: ['green-glow', 'berry-green'],
  vitamin_c: ['citrus-lift', 'golden-fresh', 'carrot-sunrise'],
  vitamin_a: ['carrot-sunrise', 'golden-fresh'],
  folate: ['beet-bright', 'green-glow'],
  fiber: ['simple-apple-green', 'cucumber-cooler'],
  potassium: ['cucumber-cooler', 'green-glow'],
  magnesium: ['simple-apple-green', 'green-glow'],
  iron_support: ['beet-bright', 'green-glow'],
  antioxidants: ['berry-green', 'beet-bright'],
  vitamin_e: ['berry-green', 'simple-apple-green'],
  calcium: ['simple-apple-green', 'green-glow'],
  zinc: ['citrus-lift', 'golden-fresh'],
  b_vitamins: ['beet-bright', 'carrot-sunrise'],
  lycopene: ['beet-bright', 'carrot-sunrise'],
  omega3_support: ['simple-apple-green'],
  protein_support: ['simple-apple-green'],
}

function hashDay(value) {
  return value.split('').reduce((total, character) => total + character.charCodeAt(0), 0)
}

function selectByIds(ids, dayKey) {
  const candidates = ids
    .map((id) => JUICE_SPOTLIGHTS.find((spotlight) => spotlight.id === id))
    .filter(Boolean)

  if (candidates.length === 0) return null
  return candidates[hashDay(dayKey) % candidates.length]
}

export function getSpotlightForDay({ focusId, dayKey }) {
  const safeDayKey = dayKey || 'local-day'
  const mappedSpotlight = selectByIds(SPOTLIGHT_FOCUS_MAP[focusId] || [], safeDayKey)
  if (mappedSpotlight) return mappedSpotlight

  const beginnerSpotlights = JUICE_SPOTLIGHTS.filter((spotlight) => spotlight.beginnerFriendly)
  return beginnerSpotlights[hashDay(safeDayKey) % beginnerSpotlights.length]
}

export function getSpotlightState({ totalLogs, todayEntries }) {
  const entries = Array.isArray(todayEntries) ? todayEntries : []
  const latestEntry = entries[0] || null

  if (latestEntry) {
    return {
      kind: 'completed',
      latestEntry,
      hasHistory: (totalLogs || 0) > 0,
    }
  }

  return {
    kind: (totalLogs || 0) > 0 ? 'suggestion' : 'new',
    latestEntry: null,
    hasHistory: (totalLogs || 0) > 0,
  }
}

export function resolveSpotlightDestination({ hasHistory, target }) {
  if (target === 'scan') {
    return { route: 'ScanFlow', params: { screen: 'ScanHome', params: { openCamera: true, source: 'spotlight' } } }
  }

  if (target === 'add') {
    return { route: 'ScanFlow', params: { screen: 'ScanHome', params: { manualEntry: true, source: 'spotlight' } } }
  }

  return hasHistory ? { route: 'HistoryScreen' } : { route: 'ScanFlow', params: { screen: 'ScanHome', params: { manualEntry: true, source: 'spotlight' } } }
}
