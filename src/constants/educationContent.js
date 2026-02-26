// ─────────────────────────────────────────────────────────────
// educationContent.js — Novice Journey content from PRD
// Source of truth: JuiceEducation.md
// ─────────────────────────────────────────────────────────────

// ── 5-Screen Novice Journey (exact PRD verbiage) ─────────────

export const NOVICE_SCREENS = [
  {
    id: 'welcome',
    index: 0,
    headline: 'Your Nutrition, Reimagined',
    emoji: '🌱',
    color: '#81C784',
    xp: 20,
    script: 'Welcome! Whether you\'re here to boost your energy, support your heart, or simply add more color to your diet, you\'ve come to the right place. Think of juicing as a "circuit breaker" for old habits\u2014a way to flood your system with what we call "liquid gold."',
    stats: [],
  },
  {
    id: 'bioavailability',
    index: 1,
    headline: 'Unlock "Liquid Gold"',
    emoji: '🔬',
    color: '#64B5F6',
    xp: 25,
    script: 'Why juice? While whole produce is great for fiber, juicing extracts vitamins and minerals into a highly bioavailable form. Because the liquid is separated from the bulk, your body can absorb Vitamin C even more efficiently than from a supplement\u2014achieving an absorption rate up to 25.3% higher. It\'s a direct infusion of plant-based energy!',
    stats: [
      { value: '25.3%', label: 'Higher AUC (absorption rate) vs. supplements' },
    ],
  },
  {
    id: 'method',
    index: 2,
    headline: 'Not All Juice is Equal',
    emoji: '\u2699\uFE0F',
    color: '#FFB74D',
    xp: 30,
    script: 'Method matters. Cold-pressed (masticating) juicers use slow pressure to preserve up to 94% of live enzymes for up to 72 hours. High-speed centrifugal juicers use fast blades that create heat, which can destroy delicate B-vitamins and enzymes like amylase and protease.',
    stats: [
      { value: '94%', label: 'Enzyme retention \u2014 Cold-Pressed' },
      { value: '31%', label: 'Enzyme retention \u2014 Centrifugal' },
    ],
    comparison: {
      coldPress: { label: 'Cold-Pressed', value: 94, color: '#81C784' },
      centrifugal: { label: 'Centrifugal', value: 31, color: '#E57373' },
    },
  },
  {
    id: 'sourcing',
    index: 3,
    headline: 'Quality In, Quality Out',
    emoji: '🌿',
    color: '#A5D6A7',
    xp: 25,
    script: 'What\'s on your fruit matters as much as what\'s in it. Choosing organic reduces pesticide exposure by 4x. Plus, organic plants often produce 20-40% more antioxidants as they defend themselves naturally in the field.',
    stats: [
      { value: '4x', label: 'Less pesticide exposure with organic' },
      { value: '20\u201340%', label: 'More antioxidants in organic produce' },
    ],
  },
  {
    id: 'habit',
    index: 4,
    headline: 'Progress, Not Perfection',
    emoji: '🏆',
    color: '#CE93D8',
    xp: 30,
    script: 'In this app, we don\'t believe in "failing" a diet. If you miss a day, that\'s okay! We focus on cumulative progress. Every green juice you drink is a win for your gut microbiome and your long-term vitality. Just aim for "one juice a day" to start building a habit that sticks.',
    stats: [
      { value: '66', label: 'Days to form a lasting habit [Lally et al.]' },
    ],
    showCumulativeDashboard: true,
  },
]

// ── Persistent Safety & Legal Footer (exact PRD verbiage) ────

export const SAFETY_FOOTER = {
  title: 'Safety & Disclosures',
  icon: '\u26D5\uFE0F',
  text: 'This information is for educational purposes only and does not substitute for professional medical advice. Consult your doctor before starting a juice plan. Fresh juice is raw and unpasteurized; wash all produce for 20 seconds. If you are pregnant or have a weakened immune system, consult a professional.',
  dataPoint: 'Store fresh juice at or below 41\u00B0F (5\u00B0C).',
}

// ── Traffic Light Classification ─────────────────────────────

export const DIRTY_DOZEN = [
  'celery', 'spinach', 'kale', 'apple_green', 'red_apple',
  'strawberry', 'peach', 'nectarine', 'cherry', 'grape',
  'bell_pepper_red', 'bell_pepper_green',
]

export const CLEAN_FIFTEEN = [
  'pineapple', 'papaya', 'mango', 'honeydew', 'cantaloupe',
  'kiwi', 'cabbage_green', 'asparagus', 'sweet_potato',
  'coconut_water', 'jicama', 'grapefruit', 'avocado', 'onion',
]

// High-sugar produce (>10g sugar per 100g raw)
export const HIGH_SUGAR_PRODUCE = [
  'pineapple', 'mango', 'grape', 'cherry', 'pomegranate',
  'passion_fruit', 'apple_green', 'red_apple', 'beet',
]

/**
 * Compute traffic-light color for a single ingredient.
 * Green:  Organic + Cold-pressed + Low-sugar
 * Orange: Conventional (Clean 15) OR Centrifugal-made
 * Red:    Dirty Dozen conventional OR High-sugar
 */
export function getTrafficLight(produceId, { isOrganic = false, juiceMethod = 'cold_pressed' } = {}) {
  const isDirty = DIRTY_DOZEN.includes(produceId)
  const isClean = CLEAN_FIFTEEN.includes(produceId)
  const isHighSugar = HIGH_SUGAR_PRODUCE.includes(produceId)
  const isColdPressed = juiceMethod === 'cold_pressed'

  // Red: Dirty Dozen + not organic, or high-sugar
  if ((isDirty && !isOrganic) || isHighSugar) {
    return { color: 'red', hex: '#E57373', label: 'Caution' }
  }

  // Green: Organic + Cold-pressed + not high-sugar
  if (isOrganic && isColdPressed && !isHighSugar) {
    return { color: 'green', hex: '#81C784', label: 'Excellent' }
  }

  // Orange: everything else (conventional Clean 15, centrifugal, etc.)
  return { color: 'orange', hex: '#FFB74D', label: 'Good' }
}

// ── Gamification ─────────────────────────────────────────────

export const XP_PER_SCREEN = NOVICE_SCREENS.reduce((map, s) => {
  map[s.id] = s.xp
  return map
}, {})

export const TOTAL_JOURNEY_XP = NOVICE_SCREENS.reduce((sum, s) => sum + s.xp, 0)

export const BEGINNER_BADGE = {
  id: 'beginner_enthusiast',
  emoji: '🎓',
  name: 'Beginner Enthusiast',
  desc: 'Completed the Novice Journey \u2014 all 5 screens',
}
