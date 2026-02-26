// ─────────────────────────────────────────────────────────────
// recipeData.js — Curated juice recipes with ingredients,
// nutrient benefits, cleanup scores, and vibe tags
// Each recipe lists which daily pillars it fills (base/power/kick)
// ─────────────────────────────────────────────────────────────

export const RECIPES = [
  {
    id: 'emerald-uplift',
    title: 'The Emerald Uplift',
    vibeTag: '⚡ High Energy',
    vibeColor: '#81C784',
    pillars: ['base', 'kick'],
    description: 'Celery and cucumber hydrate your cells (Base), while ginger and lemon fire up your metabolism (Kick). You\'ll still need a Power juice to close all three.',
    cleanupScore: 2,
    gradientColors: ['#1B3A2D', '#0F2419', '#0D1117'],
    ingredients: [
      { name: 'Celery', amount: '3 stalks', produceId: 'celery', color: '#66BB6A', ratio: 0.35 },
      { name: 'Cucumber', amount: '1 whole', produceId: 'cucumber', color: '#81C784', ratio: 0.30 },
      { name: 'Green Apple', amount: '1 medium', produceId: 'apple_green', color: '#A5D6A7', ratio: 0.20 },
      { name: 'Lemon', amount: '½ peeled', produceId: 'lemon', color: '#FFF176', ratio: 0.10 },
      { name: 'Ginger', amount: '1 inch knob', produceId: 'ginger', color: '#FFE082', ratio: 0.05 },
    ],
    benefits: [
      { icon: 'Zap', label: 'Mental Clarity', color: '#FFD54F' },
      { icon: 'Shield', label: 'Immunity Boost', color: '#81C784' },
      { icon: 'Droplets', label: 'Deep Hydration', color: '#64B5F6' },
    ],
  },
  {
    id: 'sunset-glow',
    title: 'The Sunset Glow',
    vibeTag: '🧖 Skin Glow',
    vibeColor: '#FFB74D',
    pillars: ['power', 'kick'],
    description: 'Carrot and pineapple deliver dense Vitamin A (Power), while ginger and lemon add metabolic fire (Kick). Pair with a hydrating Base juice to complete the day.',
    cleanupScore: 3,
    gradientColors: ['#3E2723', '#1A1207', '#0D1117'],
    ingredients: [
      { name: 'Carrot', amount: '3 large', produceId: 'carrot', color: '#FF9800', ratio: 0.40 },
      { name: 'Pineapple', amount: '2 cups chunks', produceId: 'pineapple', color: '#FFD54F', ratio: 0.30 },
      { name: 'Ginger', amount: '1.5 inch knob', produceId: 'ginger', color: '#FFE082', ratio: 0.15 },
      { name: 'Lemon', amount: '1 whole peeled', produceId: 'lemon', color: '#FFF176', ratio: 0.15 },
    ],
    benefits: [
      { icon: 'Sun', label: 'Vitamin A Surge', color: '#FFB74D' },
      { icon: 'Sparkles', label: 'Skin Radiance', color: '#F48FB1' },
      { icon: 'Flame', label: 'Metabolism Ignite', color: '#FF7043' },
    ],
  },
  {
    id: 'crimson-power',
    title: 'The Crimson Power',
    vibeTag: '💪 Endurance',
    vibeColor: '#F48FB1',
    pillars: ['power', 'kick'],
    description: 'Beet and carrot pack dense micros (Power), ginger and lemon bring the anti-inflammatory Kick. Add a cucumber-celery Base to finish your daily rings.',
    cleanupScore: 4,
    gradientColors: ['#3E1929', '#1A0D14', '#0D1117'],
    ingredients: [
      { name: 'Beet', amount: '1 medium', produceId: 'beet', color: '#E91E63', ratio: 0.40 },
      { name: 'Carrot', amount: '2 medium', produceId: 'carrot', color: '#FF9800', ratio: 0.25 },
      { name: 'Ginger', amount: '2 inch knob', produceId: 'ginger', color: '#FFE082', ratio: 0.15 },
      { name: 'Lemon', amount: '1 whole peeled', produceId: 'lemon', color: '#FFF176', ratio: 0.10 },
      { name: 'Green Apple', amount: '½ medium', produceId: 'apple_green', color: '#A5D6A7', ratio: 0.10 },
    ],
    benefits: [
      { icon: 'Heart', label: 'Blood Flow', color: '#E91E63' },
      { icon: 'Shield', label: 'Antioxidant Shield', color: '#CE93D8' },
      { icon: 'Zap', label: 'Endurance Boost', color: '#FFD54F' },
    ],
  },
  {
    id: 'green-machine',
    title: 'The Green Machine',
    vibeTag: '🧬 Detox',
    vibeColor: '#4CAF50',
    pillars: ['base', 'power'],
    description: 'Spinach and kale deliver iron and chlorophyll (Power), while cucumber and celery hydrate (Base). Add a ginger-lemon Kick shot to close all three rings.',
    cleanupScore: 2,
    gradientColors: ['#1B3A2D', '#0A1F15', '#0D1117'],
    ingredients: [
      { name: 'Spinach', amount: '2 cups packed', produceId: 'spinach', color: '#388E3C', ratio: 0.30 },
      { name: 'Kale', amount: '3 leaves', produceId: 'kale', color: '#2E7D32', ratio: 0.25 },
      { name: 'Cucumber', amount: '1 whole', produceId: 'cucumber', color: '#81C784', ratio: 0.25 },
      { name: 'Celery', amount: '2 stalks', produceId: 'celery', color: '#66BB6A', ratio: 0.10 },
      { name: 'Lemon', amount: '½ peeled', produceId: 'lemon', color: '#FFF176', ratio: 0.10 },
    ],
    benefits: [
      { icon: 'Leaf', label: 'Deep Detox', color: '#4CAF50' },
      { icon: 'Droplets', label: 'Alkalinity', color: '#64B5F6' },
      { icon: 'Sparkles', label: 'Iron Absorption', color: '#FFB74D' },
    ],
  },
  {
    id: 'tropical-shield',
    title: 'The Tropical Shield',
    vibeTag: '🛡️ Immunity',
    vibeColor: '#FFD54F',
    pillars: ['power', 'kick'],
    description: 'Pineapple\'s bromelain (Power) meets ginger\'s gingerol (Kick) for ultimate immune fortification. You\'ll need a separate Base juice to complete the daily rings.',
    cleanupScore: 3,
    gradientColors: ['#3E3517', '#1A1507', '#0D1117'],
    ingredients: [
      { name: 'Pineapple', amount: '3 cups chunks', produceId: 'pineapple', color: '#FFD54F', ratio: 0.45 },
      { name: 'Ginger', amount: '2 inch knob', produceId: 'ginger', color: '#FFE082', ratio: 0.20 },
      { name: 'Lemon', amount: '1 whole peeled', produceId: 'lemon', color: '#FFF176', ratio: 0.20 },
      { name: 'Carrot', amount: '1 medium', produceId: 'carrot', color: '#FF9800', ratio: 0.15 },
    ],
    benefits: [
      { icon: 'Shield', label: 'Immunity Wall', color: '#FFD54F' },
      { icon: 'Flame', label: 'Anti-Inflammatory', color: '#FF7043' },
      { icon: 'Zap', label: 'Enzyme Activation', color: '#81C784' },
    ],
  },
  {
    id: 'hydration-reset',
    title: 'The Hydration Reset',
    vibeTag: '💧 Pure Base',
    vibeColor: '#64B5F6',
    pillars: ['base'],
    description: 'Pure hydration. Cucumber, celery, and green apple flood your cells with electrolytes and water. The perfect Base ring closer.',
    cleanupScore: 1,
    gradientColors: ['#0D2137', '#0A1929', '#0D1117'],
    ingredients: [
      { name: 'Cucumber', amount: '2 whole', produceId: 'cucumber', color: '#81C784', ratio: 0.45 },
      { name: 'Celery', amount: '4 stalks', produceId: 'celery', color: '#66BB6A', ratio: 0.35 },
      { name: 'Green Apple', amount: '1 medium', produceId: 'apple_green', color: '#A5D6A7', ratio: 0.20 },
    ],
    benefits: [
      { icon: 'Droplets', label: 'Cell Hydration', color: '#64B5F6' },
      { icon: 'Sparkles', label: 'Electrolytes', color: '#81C784' },
      { icon: 'Heart', label: 'Blood Volume', color: '#F48FB1' },
    ],
  },
  {
    id: 'fire-shot',
    title: 'The Fire Shot',
    vibeTag: '🔥 Kick Only',
    vibeColor: '#FFB74D',
    pillars: ['kick'],
    description: 'A concentrated 2oz shot of pure metabolic fire. Ginger, turmeric, and lemon — the missing Kick ring closer.',
    cleanupScore: 1,
    gradientColors: ['#3E2A0D', '#1A1207', '#0D1117'],
    ingredients: [
      { name: 'Ginger', amount: '3 inch knob', produceId: 'ginger', color: '#FFE082', ratio: 0.40 },
      { name: 'Turmeric', amount: '2 inch knob', produceId: 'turmeric', color: '#FFB74D', ratio: 0.30 },
      { name: 'Lemon', amount: '1 whole peeled', produceId: 'lemon', color: '#FFF176', ratio: 0.30 },
    ],
    benefits: [
      { icon: 'Flame', label: 'Metabolism Boost', color: '#FF7043' },
      { icon: 'Shield', label: 'Anti-Inflammatory', color: '#FFB74D' },
      { icon: 'Zap', label: 'Digestive Fire', color: '#FFD54F' },
    ],
  },
]

export const TASTE_REACTIONS = [
  { emoji: '😋', label: 'Delicious', response: 'Saved to your \'Glow-Up\' favorites!' },
  { emoji: '😐', label: 'Okay', response: 'Noted! We\'ll suggest tweaks next time.' },
  { emoji: '🤢', label: 'Not great', response: 'No worries — we\'ll find your perfect blend.' },
]

export function getRecipesByPillar(pillarKey) {
  return RECIPES.filter((r) => r.pillars.includes(pillarKey))
}

export function getRecipeById(id) {
  return RECIPES.find((r) => r.id === id)
}

export function getCleanupLabel(score) {
  const labels = ['', 'Easy Rinse', 'Quick Clean', 'Moderate', 'Staining Risk', 'Deep Scrub']
  return labels[score] || 'Unknown'
}
