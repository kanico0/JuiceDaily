// ─────────────────────────────────────────────────────────────
// ChallengeStore.js — 7-Day Rainbow Challenge state management
// Daily Pillars: Base / Power / Kick
// Weekly Diversity: 6 phytonutrient colors with 30% threshold
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useReducer, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  orchestrateNotifications,
  onJuiceLogged,
} from './NotificationService'
import { loadState, saveState } from './storage'

const CHALLENGE_STORAGE_KEY = '@juicing_challenge_v1'
const CHALLENGE_SCHEMA_VERSION = 2

/** Sanitize challenge state from storage — ensure required fields exist */
function sanitizeChallengeState(raw) {
  if (!raw || typeof raw !== 'object') return null
  const empty = createEmptyChallenge()
  return {
    startDate: typeof raw.startDate === 'string' ? raw.startDate : empty.startDate,
    currentDay: typeof raw.currentDay === 'number' ? raw.currentDay : 1,
    streak: typeof raw.streak === 'number' ? raw.streak : 0,
    days: (raw.days && typeof raw.days === 'object') ? raw.days : {},
    weeklyColors: (raw.weeklyColors && typeof raw.weeklyColors === 'object') ? raw.weeklyColors : {},
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    isComplete: typeof raw.isComplete === 'boolean' ? raw.isComplete : false,
    freezerPasses: typeof raw.freezerPasses === 'number' ? raw.freezerPasses : INITIAL_FREEZER_PASSES,
    frozenDays: Array.isArray(raw.frozenDays) ? raw.frozenDays : [],
    isFrozen: typeof raw.isFrozen === 'boolean' ? raw.isFrozen : false,
    uniqueIngredients: Array.isArray(raw.uniqueIngredients) ? raw.uniqueIngredients : [],
    totalProduceWeightG: typeof raw.totalProduceWeightG === 'number' ? raw.totalProduceWeightG : 0,
    completedRainbows: typeof raw.completedRainbows === 'number' ? raw.completedRainbows : 0,
    longestStreak: typeof raw.longestStreak === 'number' ? raw.longestStreak : 0,
    userName: typeof raw.userName === 'string' ? raw.userName : '',
    hasOnboarded: typeof raw.hasOnboarded === 'boolean' ? raw.hasOnboarded : false,
  }
}

// ── Daily Pillar Classification ──────────────────────────────
// Ring 1: Base (Hydration/Volume) – Cucumber, Celery, Melon, Watermelon
// Ring 2: Power (Dense Micros) – Spinach, Kale, Beets, Carrot, Broccoli
// Ring 3: Kick (Inflammation/Metabolism) – Ginger, Turmeric, Lemon, Garlic, Cayenne

export const DAILY_PILLARS = {
  base: {
    label: 'Hydration Base',
    shortLabel: 'Base',
    color: '#64B5F6',
    colorLight: '#BBDEFB',
    icon: 'Droplets',
    produceIds: ['cucumber', 'celery', 'melon', 'watermelon', 'coconut_water', 'apple_green'],
    description: 'Hydrating, high-volume produce',
  },
  power: {
    label: 'Nutrient Power',
    shortLabel: 'Power',
    color: '#81C784',
    colorLight: '#C8E6C9',
    icon: 'Zap',
    produceIds: ['spinach', 'kale', 'beet', 'carrot', 'broccoli', 'pineapple', 'sweet_potato'],
    description: 'Dense micronutrient sources',
  },
  kick: {
    label: 'Metabolic Kick',
    shortLabel: 'Kick',
    color: '#FFB74D',
    colorLight: '#FFE0B2',
    icon: 'Flame',
    produceIds: ['ginger', 'turmeric', 'lemon', 'garlic', 'cayenne', 'lime', 'apple_cider_vinegar'],
    description: 'Anti-inflammatory & metabolism boosters',
  },
}

// ── Weekly Diversity Colors (6 phytonutrient groups) ─────────
// 30% volume threshold: a color only counts if ≥30% of total juice weight

export const WEEKLY_COLORS = {
  red: {
    label: 'Red',
    color: '#E91E63',
    heroIngredients: ['beet', 'tomato', 'watermelon', 'pomegranate', 'strawberry', 'raspberry', 'red_pepper'],
  },
  orange: {
    label: 'Orange',
    color: '#FF9800',
    heroIngredients: ['carrot', 'sweet_potato', 'mango', 'papaya', 'orange', 'cantaloupe'],
  },
  yellow: {
    label: 'Yellow',
    color: '#FFD54F',
    heroIngredients: ['lemon', 'pineapple', 'ginger', 'turmeric', 'banana', 'yellow_pepper'],
  },
  green: {
    label: 'Green',
    color: '#4CAF50',
    heroIngredients: ['kale', 'spinach', 'cucumber', 'celery', 'apple_green', 'broccoli', 'lime', 'avocado'],
  },
  purple: {
    label: 'Blue/Purple',
    color: '#9C27B0',
    heroIngredients: ['blueberry', 'blackberry', 'grape', 'acai', 'purple_cabbage', 'plum', 'eggplant'],
  },
  white: {
    label: 'White',
    color: '#B0BEC5',
    heroIngredients: ['garlic', 'onion', 'cauliflower', 'coconut_water', 'mushroom', 'jicama', 'parsnip'],
  },
}

const WEEKLY_COLOR_THRESHOLD = 0.30

// Keep backward-compat export name for components that still reference it
export const COLOR_GROUPS = DAILY_PILLARS

export function classifyProduceByPillar(produceId) {
  const id = (produceId || '').toLowerCase()
  for (const [pillar, data] of Object.entries(DAILY_PILLARS)) {
    if (data.produceIds.includes(id)) return pillar
  }
  return null
}

export function classifyProduceAllPillars(produceId) {
  const id = (produceId || '').toLowerCase()
  const matched = []
  for (const [pillar, data] of Object.entries(DAILY_PILLARS)) {
    if (data.produceIds.includes(id)) matched.push(pillar)
  }
  return matched
}

export function classifyProduceByWeeklyColor(produceId) {
  const id = (produceId || '').toLowerCase()
  for (const [color, data] of Object.entries(WEEKLY_COLORS)) {
    if (data.heroIngredients.includes(id)) return color
  }
  return null
}

// Classify a juice into daily pillars based on ingredient categories
export function classifyJuicePillars(ingredients) {
  const pillars = new Set()
  for (const item of ingredients) {
    const pillar = classifyProduceByPillar(item.produceId || item.name?.toLowerCase() || '')
    if (pillar) pillars.add(pillar)
  }
  return [...pillars]
}

// Classify a juice into weekly colors with 30% volume threshold
export function classifyJuiceWeeklyColors(ingredients) {
  const totalWeight = ingredients.reduce((sum, i) => sum + (i.weightG || 150), 0)
  if (totalWeight === 0) return []

  // Accumulate weight per weekly color
  const colorWeights = {}
  for (const item of ingredients) {
    const color = classifyProduceByWeeklyColor(item.produceId || item.name?.toLowerCase() || '')
    if (color) {
      colorWeights[color] = (colorWeights[color] || 0) + (item.weightG || 150)
    }
  }

  // Only count colors that exceed 30% threshold
  const qualified = []
  for (const [color, weight] of Object.entries(colorWeights)) {
    if (weight / totalWeight >= WEEKLY_COLOR_THRESHOLD) {
      qualified.push(color)
    }
  }
  return qualified
}

// Legacy compat — used by BigSqueezeModal and other components
export function classifyJuiceByColors(ingredients) {
  return classifyJuicePillars(ingredients)
}

// ── Challenge State ───────────────────────────────────────────

const CHALLENGE_DAYS = 7

function getTodayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekStartKey(dateStr) {
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  const dow = d.getDay()
  const diff = d.getDate() - dow + (dow === 0 ? -6 : 1)
  const monday = new Date(y, m - 1, diff)
  const my = monday.getFullYear()
  const mm = String(monday.getMonth() + 1).padStart(2, '0')
  const md = String(monday.getDate()).padStart(2, '0')
  return `${my}-${mm}-${md}`
}

const MAX_FREEZER_PASSES = 3
const INITIAL_FREEZER_PASSES = 2

function createEmptyChallenge() {
  const startDate = getTodayKey()
  return {
    startDate,
    currentDay: 1,
    streak: 0,
    days: {},
    weeklyColors: {},
    isActive: true,
    isComplete: false,
    freezerPasses: INITIAL_FREEZER_PASSES,
    frozenDays: [],
    isFrozen: false,
    uniqueIngredients: [],
    totalProduceWeightG: 0,
    completedRainbows: 0,
    longestStreak: 0,
    userName: '',
    hasOnboarded: false,
  }
}

function createEmptyDayLog() {
  return {
    base: false,
    power: false,
    kick: false,
    juices: [],
  }
}

function computeVitalityScore(challenge) {
  let totalRings = 0
  for (const dayLog of Object.values(challenge.days)) {
    if (dayLog.base) totalRings++
    if (dayLog.power) totalRings++
    if (dayLog.kick) totalRings++
  }
  const maxRings = CHALLENGE_DAYS * 3
  return Math.round((totalRings / maxRings) * 100)
}

function computeStreak(challenge) {
  const today = getTodayKey()
  let streak = 0
  const [sy, sm, sd] = (challenge.startDate || getTodayKey()).split('-').map(Number)
  const frozenSet = new Set(challenge.frozenDays || [])

  for (let i = 0; i < CHALLENGE_DAYS; i++) {
    const d = new Date(sy, sm - 1, sd + i)
    const ky = d.getFullYear()
    const km = String(d.getMonth() + 1).padStart(2, '0')
    const kd = String(d.getDate()).padStart(2, '0')
    const key = `${ky}-${km}-${kd}`
    if (key > today) break

    const dayLog = challenge.days[key]
    if (dayLog && (dayLog.base || dayLog.power || dayLog.kick)) {
      streak++
    } else if (frozenSet.has(key)) {
      // Frozen day preserves streak but doesn't increment
    } else if (key <= today) {
      streak = 0
    }
  }
  return streak
}

function computeCurrentDay(challenge) {
  const [sy, sm, sd] = (challenge.startDate || getTodayKey()).split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const todayStr = getTodayKey()
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const now = new Date(ty, tm - 1, td)
  const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  return Math.max(diff + 1, 1)
}

// Compute weekly diversity from all days in the current week
function computeWeeklyDiversity(challenge) {
  const today = getTodayKey()
  const weekStart = getWeekStartKey(today)
  const filled = { ...challenge.weeklyColors }

  // Collect all weekly colors from juices logged this week
  for (const [dateKey, dayLog] of Object.entries(challenge.days)) {
    if (dateKey >= weekStart && dateKey <= today) {
      for (const juice of (dayLog.juices || [])) {
        for (const wc of (juice.weeklyColors || [])) {
          filled[wc] = true
        }
      }
    }
  }
  return filled
}

// ── Weekly Stats Helpers ──────────────────────────────────────

export function computeWeeklyStats(challenge) {
  const today = getTodayKey()
  const weekStart = getWeekStartKey(today)
  let totalWeightG = 0
  let totalLogs = 0
  const ingredientCounts = {}
  const colorCounts = {}
  const pillarCounts = { base: 0, power: 0, kick: 0 }

  for (const [dateKey, dayLog] of Object.entries(challenge.days)) {
    if (dateKey >= weekStart && dateKey <= today) {
      totalLogs += (dayLog.juices || []).length
      if (dayLog.base) pillarCounts.base++
      if (dayLog.power) pillarCounts.power++
      if (dayLog.kick) pillarCounts.kick++
      for (const juice of (dayLog.juices || [])) {
        for (const ing of (juice.ingredients || [])) {
          const id = ing.produceId || ''
          const w = ing.weightG || 150
          totalWeightG += w
          ingredientCounts[id] = (ingredientCounts[id] || 0) + w
        }
        for (const wc of (juice.weeklyColors || [])) {
          colorCounts[wc] = (colorCounts[wc] || 0) + 1
        }
      }
    }
  }

  // Sort ingredients by total weight descending
  const heroIngredients = Object.entries(ingredientCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, weight]) => ({ id, weight }))

  // Most consumed color
  const topColor = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null

  return { totalWeightG, totalLogs, heroIngredients, topColor, colorCounts, pillarCounts }
}

const FUN_COMPARISONS = [
  { threshold: 500, text: 'a large grapefruit' },
  { threshold: 1000, text: 'a pineapple' },
  { threshold: 2000, text: 'a bowling ball' },
  { threshold: 3000, text: 'a medium pumpkin 🎃' },
  { threshold: 5000, text: 'a watermelon 🍉' },
  { threshold: 8000, text: 'a Thanksgiving turkey 🦃' },
]

export function getFunComparison(weightG) {
  for (let i = FUN_COMPARISONS.length - 1; i >= 0; i--) {
    if (weightG >= FUN_COMPARISONS[i].threshold) return FUN_COMPARISONS[i].text
  }
  return 'a handful of berries'
}

const COLOR_AFFIRMATIONS = {
  red: 'Lycopene Power — your cardiovascular system thanks you',
  orange: 'Beta-Carotene Blitz — your skin is glowing',
  yellow: 'Citrus Surge — your immunity is fortified',
  green: 'Chlorophyll Champion — deep cellular detox activated',
  purple: 'Anthocyanin Authority — antioxidant defense maximized',
  white: 'Allicin Architect — anti-inflammatory pathways engaged',
}

export function getColorAffirmation(topColor) {
  return COLOR_AFFIRMATIONS[topColor] || 'You\'re building a diverse spectrum!'
}

// ── History & Monthly Helpers ────────────────────────────────

const ARCHETYPES = {
  green: { title: 'The Forest Spirit', emoji: '🌿', color: '#4CAF50' },
  red: { title: 'The Heartbeat', emoji: '❤️', color: '#E91E63' },
  orange: { title: 'The Sun Chaser', emoji: '☀️', color: '#FF9800' },
  yellow: { title: 'The Citrus Surge', emoji: '⚡', color: '#FFD54F' },
  purple: { title: 'The Mystic Berry', emoji: '🔮', color: '#9C27B0' },
  white: { title: 'The Root Alchemist', emoji: '🧪', color: '#B0BEC5' },
}

const INGREDIENT_ARCHETYPES = {
  kale: 'The Kale Crusader',
  spinach: 'The Iron Fortress',
  ginger: 'The Ginger Firestarter',
  beet: 'The Crimson Engine',
  carrot: 'The Beta-Carotene Baron',
  cucumber: 'The Hydration Architect',
  celery: 'The Alkaline Alchemist',
  turmeric: 'The Golden Healer',
  lemon: 'The Citrus Commander',
  apple_green: 'The Orchard Optimizer',
}

export function getDayDominantColor(dayLog) {
  if (!dayLog || !dayLog.juices || dayLog.juices.length === 0) return null
  const colorWeights = {}
  for (const juice of dayLog.juices) {
    for (const ing of (juice.ingredients || [])) {
      const color = classifyProduceByWeeklyColor(ing.produceId || '')
      if (color) {
        colorWeights[color] = (colorWeights[color] || 0) + (ing.weightG || 150)
      }
    }
  }
  const sorted = Object.entries(colorWeights).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] || null
}

export function isFullRainbowDay(dayLog) {
  return dayLog && dayLog.base && dayLog.power && dayLog.kick
}

export function computeMonthlyStats(challenge, year, month) {
  let totalWeightG = 0
  let totalJuices = 0
  let totalRings = 0
  let maxRings = 0
  const ingredientCounts = {}
  const colorCounts = {}
  const dailySquares = []

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayLog = challenge.days[key]
    let rings = 0
    if (dayLog) {
      if (dayLog.base) rings++
      if (dayLog.power) rings++
      if (dayLog.kick) rings++
      totalRings += rings
      for (const juice of (dayLog.juices || [])) {
        totalJuices++
        for (const ing of (juice.ingredients || [])) {
          const id = ing.produceId || ''
          const w = ing.weightG || 150
          totalWeightG += w
          ingredientCounts[id] = (ingredientCounts[id] || 0) + w
        }
        for (const wc of (juice.weeklyColors || [])) {
          colorCounts[wc] = (colorCounts[wc] || 0) + 1
        }
      }
    }
    maxRings += 3
    const dominantColor = dayLog ? getDayDominantColor(dayLog) : null
    const isRainbow = dayLog ? isFullRainbowDay(dayLog) : false
    dailySquares.push({ date: key, dominantColor, isRainbow, rings, hasData: !!dayLog && rings > 0 })
  }

  const heroIngredients = Object.entries(ingredientCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, weight]) => ({ id, weight }))

  const topColor = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null

  const topIngredient = heroIngredients[0]?.id || null

  const archetype = topIngredient && INGREDIENT_ARCHETYPES[topIngredient]
    ? INGREDIENT_ARCHETYPES[topIngredient]
    : topColor && ARCHETYPES[topColor]
      ? ARCHETYPES[topColor].title
      : 'The Wellness Architect'

  const archetypeEmoji = topColor && ARCHETYPES[topColor]
    ? ARCHETYPES[topColor].emoji
    : '🏗️'

  const vitalityPercent = maxRings > 0 ? Math.round((totalRings / maxRings) * 100) : 0

  const topThreeColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c)

  return {
    totalWeightG,
    totalJuices,
    totalRings,
    vitalityPercent,
    heroIngredients,
    topColor,
    topIngredient,
    archetype,
    archetypeEmoji,
    colorCounts,
    dailySquares,
    topThreeColors,
    daysInMonth,
  }
}

export function getAllHistoryDays(challenge) {
  return Object.entries(challenge.days)
    .map(([date, dayLog]) => ({
      date,
      dayLog,
      dominantColor: getDayDominantColor(dayLog),
      isRainbow: isFullRainbowDay(dayLog),
      juiceCount: (dayLog.juices || []).length,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function filterHistoryByColor(history, colorKey) {
  return history.filter((entry) => {
    for (const juice of (entry.dayLog.juices || [])) {
      for (const ing of (juice.ingredients || [])) {
        const c = classifyProduceByWeeklyColor(ing.produceId || '')
        if (c === colorKey) return true
      }
    }
    return false
  })
}

export function filterHistoryByIngredient(history, ingredientId) {
  const id = ingredientId.toLowerCase()
  return history.filter((entry) => {
    for (const juice of (entry.dayLog.juices || [])) {
      for (const ing of (juice.ingredients || [])) {
        if ((ing.produceId || '').toLowerCase() === id) return true
      }
    }
    return false
  })
}

export { ARCHETYPES }

// ── Shopping List Generator ──────────────────────────────────

export function generateShoppingList(weeklyDiversity) {
  const missing = []
  for (const [color, data] of Object.entries(WEEKLY_COLORS)) {
    if (!weeklyDiversity[color]) {
      const suggestion = data.heroIngredients[Math.floor(Math.random() * Math.min(3, data.heroIngredients.length))]
      missing.push({ color, label: data.label, colorHex: data.color, suggestion })
    }
  }
  return missing.slice(0, 3)
}

// ── Reducer ───────────────────────────────────────────────────

function challengeReducer(state, action) {
  switch (action.type) {
    case 'LOAD': {
      return { ...state, ...action.payload }
    }
    case 'LOG_JUICE': {
      const today = getTodayKey()
      const { pillars, weeklyColors, juiceData } = action.payload

      const days = { ...state.days }
      const dayLog = { ...(days[today] || createEmptyDayLog()) }

      for (const pillar of pillars) {
        if (pillar === 'base' || pillar === 'power' || pillar === 'kick') {
          dayLog[pillar] = true
        }
      }
      dayLog.juices = [...dayLog.juices, juiceData]
      days[today] = dayLog

      const updated = { ...state, days }
      updated.currentDay = computeCurrentDay(updated)
      updated.streak = computeStreak(updated)
      updated.isComplete = updated.currentDay >= CHALLENGE_DAYS
      updated.longestStreak = Math.max(updated.longestStreak || 0, updated.streak)

      // Thaw frozen state if user logs today
      if (state.isFrozen) {
        updated.isFrozen = false
      }

      // Update weekly colors
      const wc = { ...(updated.weeklyColors || {}) }
      for (const c of weeklyColors) {
        wc[c] = true
      }
      updated.weeklyColors = wc

      // Check if weekly rainbow is complete → earn a freezer pass
      const filledColors = Object.keys(wc).filter((k) => wc[k])
      if (filledColors.length === 6 && state.completedRainbows === (updated.completedRainbows || 0)) {
        updated.completedRainbows = (state.completedRainbows || 0) + 1
        updated.freezerPasses = Math.min((state.freezerPasses || 0) + 1, MAX_FREEZER_PASSES)
      }

      // Track unique ingredients and total weight
      const uniqueSet = new Set(state.uniqueIngredients || [])
      let addedWeight = 0
      for (const ing of (juiceData.ingredients || [])) {
        uniqueSet.add(ing.produceId)
        addedWeight += ing.weightG || 150
      }
      updated.uniqueIngredients = [...uniqueSet]
      updated.totalProduceWeightG = (state.totalProduceWeightG || 0) + addedWeight

      return updated
    }
    case 'USE_FREEZER_PASS': {
      const { dateKey } = action.payload
      if ((state.freezerPasses || 0) <= 0) return state
      return {
        ...state,
        freezerPasses: state.freezerPasses - 1,
        frozenDays: [...(state.frozenDays || []), dateKey],
        isFrozen: true,
        streak: computeStreak({ ...state, frozenDays: [...(state.frozenDays || []), dateKey] }),
      }
    }
    case 'COMPLETE_ONBOARDING': {
      return {
        ...state,
        userName: action.payload.userName || '',
        hasOnboarded: true,
      }
    }
    case 'HYDRATE': {
      const hydrated = { ...state, ...action.payload }
      hydrated.currentDay = computeCurrentDay(hydrated)
      hydrated.streak = computeStreak(hydrated)
      return hydrated
    }
    case 'RESET': {
      return createEmptyChallenge()
    }
    case 'DEV_ADVANCE_DAY': {
      const start = new Date(state.startDate)
      start.setDate(start.getDate() - 1)
      const newStartDate = start.toISOString().split('T')[0]

      // Re-key all juice log entries: shift each date key back by 1 day
      // so logs spread across the simulated timeline correctly
      const oldDays = state.days || {}
      const newDays = {}
      const sortedKeys = Object.keys(oldDays).sort()
      for (const dateKey of sortedKeys) {
        const d = new Date(dateKey + 'T00:00:00')
        d.setDate(d.getDate() - 1)
        const shiftedKey = d.toISOString().split('T')[0]
        // Merge if multiple keys collapse (shouldn't happen, but safe)
        if (newDays[shiftedKey]) {
          newDays[shiftedKey] = {
            base: newDays[shiftedKey].base || oldDays[dateKey].base,
            power: newDays[shiftedKey].power || oldDays[dateKey].power,
            kick: newDays[shiftedKey].kick || oldDays[dateKey].kick,
            juices: [...(newDays[shiftedKey].juices || []), ...(oldDays[dateKey].juices || [])],
          }
        } else {
          newDays[shiftedKey] = { ...oldDays[dateKey] }
        }
      }

      // Also shift frozen days
      const newFrozenDays = (state.frozenDays || []).map((fk) => {
        const fd = new Date(fk + 'T00:00:00')
        fd.setDate(fd.getDate() - 1)
        return fd.toISOString().split('T')[0]
      })

      const updated = { ...state, startDate: newStartDate, days: newDays, frozenDays: newFrozenDays }
      updated.currentDay = computeCurrentDay(updated)
      updated.streak = computeStreak(updated)
      return updated
    }
    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────

const ChallengeContext = createContext(null)

export function ChallengeProvider({ children }) {
  const [state, dispatch] = useReducer(challengeReducer, createEmptyChallenge())
  const isHydrated = useRef(false)

  // Hydrate from storage on mount (schema-versioned)
  useEffect(() => {
    ;(async () => {
      const restored = await loadState({
        key: CHALLENGE_STORAGE_KEY,
        version: CHALLENGE_SCHEMA_VERSION,
        sanitize: sanitizeChallengeState,
      })
      if (restored) {
        dispatch({ type: 'HYDRATE', payload: restored })
      }
      isHydrated.current = true
    })()
  }, [])

  // Persist to storage on every state change (debounced 300ms)
  useEffect(() => {
    if (!isHydrated.current) return
    saveState(CHALLENGE_STORAGE_KEY, CHALLENGE_SCHEMA_VERSION, state)
  }, [state])

  const logJuice = useCallback((scannedIngredients, batchResult) => {
    const pillars = classifyJuicePillars(scannedIngredients)
    const weeklyColors = classifyJuiceWeeklyColors(scannedIngredients)
    dispatch({
      type: 'LOG_JUICE',
      payload: {
        pillars,
        weeklyColors,
        juiceData: {
          timestamp: new Date().toISOString(),
          pillars,
          weeklyColors,
          totals: batchResult.totals,
          ingredients: scannedIngredients.map((i) => ({
            produceId: i.produceId,
            weightG: i.weightG || 150,
          })),
        },
      },
    })
  }, [])

  const useFreezerPass = useCallback((dateKey) => {
    dispatch({ type: 'USE_FREEZER_PASS', payload: { dateKey: dateKey || getTodayKey() } })
  }, [])

  const resetChallenge = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const completeOnboarding = useCallback((userName) => {
    dispatch({ type: 'COMPLETE_ONBOARDING', payload: { userName } })
  }, [])

  const devAdvanceDay = useCallback(() => {
    dispatch({ type: 'DEV_ADVANCE_DAY' })
  }, [])

  const todayLog = useMemo(() => {
    const today = getTodayKey()
    return state.days[today] || createEmptyDayLog()
  }, [state.days])

  const vitalityScore = useMemo(() => computeVitalityScore(state), [state])

  const weeklyDiversity = useMemo(() => computeWeeklyDiversity(state), [state])

  const weeklyStats = useMemo(() => computeWeeklyStats(state), [state])

  // Compute last ingredients for wilt warning
  const lastIngredients = useMemo(() => {
    const allJuices = Object.values(state.days)
      .flatMap((d) => d.juices || [])
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
    return allJuices[0]?.ingredients || []
  }, [state.days])

  // Compute total juice count
  const totalJuiceCount = useMemo(() => {
    return Object.values(state.days).reduce((sum, d) => sum + (d.juices || []).length, 0)
  }, [state.days])

  // Orchestrate all notifications
  useEffect(() => {
    orchestrateNotifications({
      weeklyDiversity,
      todayLog,
      streak: state.streak,
      freezerPasses: state.freezerPasses || 0,
      isFrozen: state.isFrozen || false,
      totalWeightG: state.totalProduceWeightG || 0,
      lastIngredients,
    })
  }, [weeklyDiversity, todayLog, state.streak, state.freezerPasses, state.isFrozen, lastIngredients])

  // Track juice logs for surprise & delight + wilt warning timestamp
  const prevJuiceCountRef = useRef(totalJuiceCount)
  useEffect(() => {
    if (totalJuiceCount > prevJuiceCountRef.current) {
      onJuiceLogged(totalJuiceCount, state.totalProduceWeightG || 0)
    }
    prevJuiceCountRef.current = totalJuiceCount
  }, [totalJuiceCount, state.totalProduceWeightG])

  const value = useMemo(() => ({
    challenge: state,
    todayLog,
    vitalityScore,
    weeklyDiversity,
    weeklyStats,
    logJuice,
    useFreezerPass,
    resetChallenge,
    completeOnboarding,
    devAdvanceDay,
  }), [state, todayLog, vitalityScore, weeklyDiversity, weeklyStats, logJuice, useFreezerPass, resetChallenge, completeOnboarding, devAdvanceDay])

  return (
    <ChallengeContext.Provider value={value}>
      {children}
    </ChallengeContext.Provider>
  )
}

export function useChallenge() {
  const ctx = useContext(ChallengeContext)
  if (!ctx) throw new Error('useChallenge must be used within ChallengeProvider')
  return ctx
}
