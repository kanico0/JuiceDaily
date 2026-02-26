// ─────────────────────────────────────────────────────────────
// focusNutrient.js — Today's Focus Nutrient rotation
//
// Deterministic daily nutrient pick from a built-in list of 16.
// Persists today's pick in AsyncStorage so it stays stable
// across app restarts within the same day.
// Respects DevClock for testing.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getDevNow } from '../utils/DevClock'

const KEY_DATE = 'focusNutrient_date'
const KEY_ID = 'focusNutrient_id'
const KEY_SWAP_DATE = 'focusNutrient_swapUsedDate'

// ── Built-in nutrient catalog ────────────────────────────────

export const FOCUS_NUTRIENTS = [
  {
    id: 'vitamin_c',
    name: 'Vitamin C',
    emoji: '🍊',
    benefit: 'Boosts immune defense and brightens skin.',
    combos: ['Orange + Red Pepper + Pineapple', 'Kiwi + Strawberry + Lemon'],
    tips: [
      'Vitamin C is water-soluble — drink juice fresh for max potency.',
      'Pair with iron-rich greens to boost iron absorption.',
      'Red bell peppers have 3× more vitamin C than oranges by weight.',
      'Heat destroys vitamin C — raw juice preserves it best.',
    ],
  },
  {
    id: 'fiber',
    name: 'Fiber',
    emoji: '🌾',
    benefit: 'Supports digestion and steady energy.',
    combos: ['Apple + Celery + Ginger', 'Pear + Spinach + Cucumber'],
    tips: [
      'Use a blender instead of a juicer to keep more pulp fiber.',
      'Soluble fiber in apples feeds beneficial gut bacteria.',
      'Add chia seeds to juice for an extra fiber boost.',
      'Aim for 25–30g of fiber daily from whole foods and juice.',
    ],
  },
  {
    id: 'potassium',
    name: 'Potassium',
    emoji: '🍌',
    benefit: 'Regulates blood pressure and muscle function.',
    combos: ['Banana + Spinach + Coconut Water', 'Sweet Potato + Orange + Carrot'],
    tips: [
      'Coconut water is a natural potassium powerhouse.',
      'Potassium helps counterbalance sodium in your diet.',
      'Leafy greens like spinach are surprisingly high in potassium.',
      'Most adults need ~2,600–3,400 mg of potassium daily.',
    ],
  },
  {
    id: 'folate',
    name: 'Folate',
    emoji: '🥬',
    benefit: 'Essential for cell repair and energy metabolism.',
    combos: ['Spinach + Beet + Orange', 'Kale + Avocado + Lemon'],
    tips: [
      'Dark leafy greens are the richest natural folate source.',
      'Folate is heat-sensitive — raw juicing preserves it well.',
      'Beets are an excellent folate source often overlooked.',
      'Folate supports healthy red blood cell production.',
    ],
  },
  {
    id: 'vitamin_a',
    name: 'Vitamin A',
    emoji: '🥕',
    benefit: 'Supports vision, skin health, and immunity.',
    combos: ['Carrot + Mango + Turmeric', 'Sweet Potato + Ginger + Orange'],
    tips: [
      'Beta-carotene (pro-vitamin A) gives carrots their orange color.',
      'Fat helps absorption — add a splash of coconut oil.',
      'Just one large carrot provides over 200% of daily vitamin A.',
      'Cooking or juicing breaks cell walls, releasing more beta-carotene.',
    ],
  },
  {
    id: 'magnesium',
    name: 'Magnesium',
    emoji: '🌿',
    benefit: 'Calms the nervous system and supports sleep.',
    combos: ['Spinach + Banana + Cacao', 'Swiss Chard + Pineapple + Mint'],
    tips: [
      'Up to 60% of adults don\'t get enough magnesium.',
      'Dark leafy greens are the best juice-friendly magnesium source.',
      'Magnesium supports over 300 enzymatic reactions in the body.',
      'Evening juices with magnesium-rich greens may support sleep.',
    ],
  },
  {
    id: 'iron_support',
    name: 'Iron Support',
    emoji: '💪',
    benefit: 'Fights fatigue and supports oxygen transport.',
    combos: ['Spinach + Lemon + Beet', 'Kale + Orange + Ginger'],
    tips: [
      'Vitamin C dramatically increases plant-based iron absorption.',
      'Always pair iron-rich greens with citrus in your juice.',
      'Beet juice supports healthy blood flow and stamina.',
      'Avoid drinking tea or coffee with iron-rich meals — they block absorption.',
    ],
  },
  {
    id: 'antioxidants',
    name: 'Antioxidants',
    emoji: '🫐',
    benefit: 'Protects cells from oxidative stress and aging.',
    combos: ['Blueberry + Pomegranate + Beet', 'Acai + Grape + Ginger'],
    tips: [
      'Deep purple and red produce are highest in polyphenols.',
      'Pomegranate juice has 3× the antioxidant power of green tea.',
      'Antioxidants work best as a team — mix colors for synergy.',
      'Fresh juice retains more antioxidants than store-bought.',
    ],
  },
  {
    id: 'omega3_support',
    name: 'Omega-3 Support',
    emoji: '🐟',
    benefit: 'Reduces inflammation and supports brain health.',
    combos: ['Flaxseed + Spinach + Apple', 'Chia + Walnut Milk + Blueberry'],
    tips: [
      'Ground flaxseed or chia seeds add plant-based omega-3 to juice.',
      'Omega-3 fats are anti-inflammatory — great for recovery.',
      'Walnuts blended into smoothie-juice combos boost omega-3.',
      'ALA from plants converts partially to EPA/DHA in the body.',
    ],
  },
  {
    id: 'protein_support',
    name: 'Protein Support',
    emoji: '🥜',
    benefit: 'Supports muscle repair and satiety.',
    combos: ['Hemp Seed + Spinach + Banana', 'Pea Protein + Mango + Coconut'],
    tips: [
      'Hemp seeds add 10g protein per 3 tablespoons to any juice.',
      'Protein slows sugar absorption — great for balanced energy.',
      'Spirulina powder adds protein plus B-vitamins to green juice.',
      'Post-workout juice with protein supports muscle recovery.',
    ],
  },
  {
    id: 'vitamin_k',
    name: 'Vitamin K',
    emoji: '🥦',
    benefit: 'Supports bone strength and healthy blood clotting.',
    combos: ['Kale + Cucumber + Apple', 'Broccoli + Parsley + Lemon'],
    tips: [
      'One cup of kale provides over 600% of daily vitamin K.',
      'Vitamin K is fat-soluble — a little healthy fat aids absorption.',
      'Parsley is one of the most vitamin K-dense herbs.',
      'Vitamin K works with vitamin D for optimal bone health.',
    ],
  },
  {
    id: 'vitamin_e',
    name: 'Vitamin E',
    emoji: '🥑',
    benefit: 'Protects skin and supports heart health.',
    combos: ['Avocado + Spinach + Mango', 'Almond Milk + Kiwi + Banana'],
    tips: [
      'Vitamin E is a powerful fat-soluble antioxidant.',
      'Avocado blended into juice adds creamy texture plus vitamin E.',
      'Almonds and sunflower seeds are top vitamin E sources.',
      'Vitamin E and vitamin C work together to protect cells.',
    ],
  },
  {
    id: 'zinc',
    name: 'Zinc',
    emoji: '🛡️',
    benefit: 'Strengthens immune response and wound healing.',
    combos: ['Pumpkin Seed + Spinach + Orange', 'Cashew Milk + Ginger + Turmeric'],
    tips: [
      'Pumpkin seeds are one of the best plant-based zinc sources.',
      'Zinc is critical for immune cell function.',
      'Soaking seeds before blending improves zinc bioavailability.',
      'Zinc and vitamin C together create a powerful immune duo.',
    ],
  },
  {
    id: 'b_vitamins',
    name: 'B Vitamins',
    emoji: '⚡',
    benefit: 'Converts food to energy and supports mood.',
    combos: ['Banana + Spinach + Nutritional Yeast', 'Beet + Orange + Ginger'],
    tips: [
      'B vitamins are water-soluble — your body needs them daily.',
      'Leafy greens provide folate (B9) and other B vitamins.',
      'Nutritional yeast is a vegan B12 powerhouse — add to smoothies.',
      'B6 in bananas supports serotonin production for mood balance.',
    ],
  },
  {
    id: 'lycopene',
    name: 'Lycopene',
    emoji: '🍅',
    benefit: 'Protects heart health and supports prostate wellness.',
    combos: ['Tomato + Watermelon + Basil', 'Red Grapefruit + Carrot + Ginger'],
    tips: [
      'Lycopene gives tomatoes and watermelon their red color.',
      'Interestingly, cooked tomatoes have more bioavailable lycopene.',
      'Watermelon juice is a refreshing lycopene-rich option.',
      'Fat improves lycopene absorption — add a drizzle of olive oil.',
    ],
  },
  {
    id: 'calcium',
    name: 'Calcium',
    emoji: '🦴',
    benefit: 'Builds strong bones and supports nerve signaling.',
    combos: ['Kale + Orange + Almond Milk', 'Broccoli + Fig + Sesame'],
    tips: [
      'Kale and broccoli have highly absorbable plant calcium.',
      'Vitamin D helps your body use calcium effectively.',
      'Sesame seeds (tahini) are a surprisingly rich calcium source.',
      'Oxalates in spinach can reduce calcium absorption — prefer kale.',
    ],
  },
]

// ── Deterministic daily pick ─────────────────────────────────

function getTodayKey() {
  const d = getDevNow()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateSeed(dateKey) {
  // Simple hash: sum of char codes × position
  let hash = 0
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export async function chooseFocusForToday() {
  const today = getTodayKey()

  // Check if already chosen today
  const [storedDate, storedId] = await Promise.all([
    AsyncStorage.getItem(KEY_DATE),
    AsyncStorage.getItem(KEY_ID),
  ])

  if (storedDate === today && storedId) {
    const nutrient = FOCUS_NUTRIENTS.find((n) => n.id === storedId)
    if (nutrient) return nutrient
  }

  // Deterministic pick based on date
  const index = dateSeed(today) % FOCUS_NUTRIENTS.length
  const picked = FOCUS_NUTRIENTS[index]

  await AsyncStorage.multiSet([
    [KEY_DATE, today],
    [KEY_ID, picked.id],
  ])

  return picked
}

export async function getFocusForToday() {
  const today = getTodayKey()
  const [storedDate, storedId] = await Promise.all([
    AsyncStorage.getItem(KEY_DATE),
    AsyncStorage.getItem(KEY_ID),
  ])

  if (storedDate === today && storedId) {
    return FOCUS_NUTRIENTS.find((n) => n.id === storedId) || null
  }

  // Not yet chosen — choose now
  return chooseFocusForToday()
}

// Swap once per day — pick a different nutrient
export async function swapFocusToday() {
  const today = getTodayKey()
  const swapDate = await AsyncStorage.getItem(KEY_SWAP_DATE)

  if (swapDate === today) {
    return { swapped: false, nutrient: await getFocusForToday() }
  }

  const currentId = await AsyncStorage.getItem(KEY_ID)
  const available = FOCUS_NUTRIENTS.filter((n) => n.id !== currentId)
  const index = dateSeed(today + '_swap') % available.length
  const picked = available[index]

  await AsyncStorage.multiSet([
    [KEY_DATE, today],
    [KEY_ID, picked.id],
    [KEY_SWAP_DATE, today],
  ])

  return { swapped: true, nutrient: picked }
}

// Dev reset
export async function resetFocusForToday() {
  await AsyncStorage.multiRemove([KEY_DATE, KEY_ID, KEY_SWAP_DATE])
}
