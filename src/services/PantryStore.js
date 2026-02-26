// ─────────────────────────────────────────────────────────────
// PantryStore.js — Smart Pantry data model + storage timeline
// Uses USDA FoodKeeper "guideline" framing (not hard expiration).
// Gated behind ff_smart_pantry feature flag.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { trackEvent } from './AnalyticsService'

const STORAGE_KEY = '@juicing_pantry_v1'

// ── Storage Quality Guidelines (days) ────────────────────────
// Based on USDA FoodKeeper guidelines for fresh produce.
// These are GUIDELINES, not hard expiration dates.

const QUALITY_GUIDELINES = {
  // Greens
  kale: { fridge: 5, counter: 1, label: 'Kale' },
  spinach: { fridge: 5, counter: 1, label: 'Spinach' },
  swiss_chard: { fridge: 5, counter: 1, label: 'Swiss Chard' },
  collard_greens: { fridge: 5, counter: 1, label: 'Collard Greens' },
  arugula: { fridge: 3, counter: 1, label: 'Arugula' },
  romaine: { fridge: 7, counter: 1, label: 'Romaine Lettuce' },
  bok_choy: { fridge: 4, counter: 1, label: 'Bok Choy' },
  parsley: { fridge: 7, counter: 2, label: 'Parsley' },
  cilantro: { fridge: 7, counter: 2, label: 'Cilantro' },
  mint: { fridge: 7, counter: 2, label: 'Mint' },
  basil: { fridge: 5, counter: 3, label: 'Basil' },
  wheatgrass: { fridge: 5, counter: 1, label: 'Wheatgrass' },
  dandelion_greens: { fridge: 4, counter: 1, label: 'Dandelion Greens' },

  // Root & Stalk
  carrot: { fridge: 21, counter: 5, label: 'Carrot' },
  celery: { fridge: 14, counter: 3, label: 'Celery' },
  beet: { fridge: 14, counter: 5, label: 'Beet' },
  cucumber: { fridge: 7, counter: 3, label: 'Cucumber' },
  ginger: { fridge: 21, counter: 7, label: 'Ginger' },
  turmeric: { fridge: 21, counter: 7, label: 'Turmeric' },
  fennel: { fridge: 7, counter: 3, label: 'Fennel' },
  sweet_potato: { fridge: 30, counter: 14, label: 'Sweet Potato' },
  turnip: { fridge: 14, counter: 5, label: 'Turnip' },
  radish: { fridge: 10, counter: 3, label: 'Radish' },
  asparagus: { fridge: 5, counter: 1, label: 'Asparagus' },
  zucchini: { fridge: 7, counter: 3, label: 'Zucchini' },
  jicama: { fridge: 14, counter: 7, label: 'Jicama' },
  celeriac: { fridge: 14, counter: 5, label: 'Celeriac' },
  garlic: { fridge: 60, counter: 30, label: 'Garlic' },

  // Cruciferous
  broccoli: { fridge: 5, counter: 2, label: 'Broccoli' },
  cabbage_green: { fridge: 14, counter: 3, label: 'Green Cabbage' },
  cabbage_red: { fridge: 14, counter: 3, label: 'Red Cabbage' },
  cauliflower: { fridge: 7, counter: 2, label: 'Cauliflower' },
  kohlrabi: { fridge: 14, counter: 3, label: 'Kohlrabi' },

  // Peppers
  bell_pepper_red: { fridge: 7, counter: 3, label: 'Red Bell Pepper' },
  bell_pepper_yellow: { fridge: 7, counter: 3, label: 'Yellow Bell Pepper' },
  bell_pepper_green: { fridge: 7, counter: 3, label: 'Green Bell Pepper' },
  jalapeno: { fridge: 7, counter: 3, label: 'Jalapeno' },
  tomato: { fridge: 7, counter: 5, label: 'Tomato' },

  // Fruits
  apple: { fridge: 28, counter: 7, label: 'Apple' },
  apple_green: { fridge: 28, counter: 7, label: 'Green Apple' },
  apple_red: { fridge: 28, counter: 7, label: 'Red Apple' },
  lemon: { fridge: 21, counter: 7, label: 'Lemon' },
  lime: { fridge: 21, counter: 7, label: 'Lime' },
  orange: { fridge: 21, counter: 7, label: 'Orange' },
  grapefruit: { fridge: 21, counter: 7, label: 'Grapefruit' },
  pineapple: { fridge: 5, counter: 3, label: 'Pineapple' },
  watermelon: { fridge: 5, counter: 3, label: 'Watermelon' },
  mango: { fridge: 5, counter: 3, label: 'Mango' },
  papaya: { fridge: 5, counter: 3, label: 'Papaya' },
  kiwi: { fridge: 14, counter: 5, label: 'Kiwi' },
  pear: { fridge: 7, counter: 3, label: 'Pear' },
  grape: { fridge: 7, counter: 2, label: 'Red Grape' },
  strawberry: { fridge: 5, counter: 1, label: 'Strawberry' },
  blueberry: { fridge: 7, counter: 2, label: 'Blueberry' },
  raspberry: { fridge: 3, counter: 1, label: 'Raspberry' },
  blackberry: { fridge: 3, counter: 1, label: 'Blackberry' },
  cranberry: { fridge: 14, counter: 5, label: 'Cranberry' },
  cherry: { fridge: 7, counter: 2, label: 'Tart Cherry' },
  cantaloupe: { fridge: 5, counter: 3, label: 'Cantaloupe' },
  honeydew: { fridge: 5, counter: 3, label: 'Honeydew Melon' },
  pomegranate: { fridge: 14, counter: 5, label: 'Pomegranate' },
  peach: { fridge: 5, counter: 3, label: 'Peach' },
  plum: { fridge: 5, counter: 3, label: 'Plum' },
  nectarine: { fridge: 5, counter: 3, label: 'Nectarine' },
  passion_fruit: { fridge: 7, counter: 3, label: 'Passion Fruit' },
}

// ── Category + Storage Enums ─────────────────────────────────

const CATEGORIES = ['greens', 'root_stalk', 'cruciferous', 'pepper', 'fruit', 'herb', 'other']
const STORAGE_LOCATIONS = ['fridge', 'counter', 'freezer']

// ── "Use Soon" threshold: items within 2 days of quality end ─

const USE_SOON_THRESHOLD_DAYS = 2

// ── Helper: compute days remaining ───────────────────────────

function computeDaysRemaining(item) {
  const guideline = QUALITY_GUIDELINES[item.produceId]
  if (!guideline) return null

  const qualityDays = item.storage === 'freezer'
    ? 180
    : guideline[item.storage] || guideline.fridge || 7

  const addedDate = new Date(item.addedDate)
  const qualityEndDate = new Date(addedDate.getTime() + qualityDays * 86400000)
  const now = new Date()
  const remaining = Math.ceil((qualityEndDate - now) / 86400000)
  return remaining
}

function categorizeProduceId(produceId) {
  const greens = ['kale', 'spinach', 'swiss_chard', 'collard_greens', 'arugula', 'romaine', 'bok_choy', 'wheatgrass', 'dandelion_greens']
  const herbs = ['parsley', 'cilantro', 'mint', 'basil']
  const rootStalk = ['carrot', 'celery', 'beet', 'cucumber', 'ginger', 'turmeric', 'fennel', 'sweet_potato', 'turnip', 'radish', 'asparagus', 'zucchini', 'jicama', 'celeriac', 'garlic']
  const cruciferous = ['broccoli', 'cabbage_green', 'cabbage_red', 'cauliflower', 'kohlrabi']
  const peppers = ['bell_pepper_red', 'bell_pepper_yellow', 'bell_pepper_green', 'jalapeno', 'tomato']

  if (greens.includes(produceId)) return 'greens'
  if (herbs.includes(produceId)) return 'herb'
  if (rootStalk.includes(produceId)) return 'root_stalk'
  if (cruciferous.includes(produceId)) return 'cruciferous'
  if (peppers.includes(produceId)) return 'pepper'
  return 'fruit'
}

// ── Reducer ──────────────────────────────────────────────────

function pantryReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, items: action.payload }

    case 'ADD_ITEM': {
      const newItem = {
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        produceId: action.payload.produceId,
        category: categorizeProduceId(action.payload.produceId),
        storage: action.payload.storage || 'fridge',
        addedDate: action.payload.addedDate || new Date().toISOString(),
        quantity: action.payload.quantity || 1,
        notes: '',
      }
      return { ...state, items: [...state.items, newItem] }
    }

    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.payload.id) }

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, ...action.payload.updates } : i
        ),
      }

    case 'DECREMENT_QUANTITY': {
      return {
        ...state,
        items: state.items.map((i) => {
          if (i.id !== action.payload.id) return i
          const newQty = Math.max(0, i.quantity - (action.payload.amount || 1))
          return newQty <= 0 ? null : { ...i, quantity: newQty }
        }).filter(Boolean),
      }
    }

    case 'UNDO_DECREMENT': {
      const { item, amount } = action.payload
      const existing = state.items.find((i) => i.id === item.id)
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + amount } : i
          ),
        }
      }
      return { ...state, items: [...state.items, { ...item, quantity: amount }] }
    }

    default:
      return state
  }
}

// ── Context + Provider ───────────────────────────────────────

const PantryContext = createContext(null)

export function PantryProvider({ children }) {
  const [state, dispatch] = useReducer(pantryReducer, { items: [] })

  useEffect(() => {
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        if (raw) dispatch({ type: 'HYDRATE', payload: JSON.parse(raw) })
      } catch (e) { /* use empty */ }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
      } catch (e) { /* non-fatal */ }
    })()
  }, [state.items])

  const addItem = useCallback((produceId, storage, quantity) => {
    dispatch({ type: 'ADD_ITEM', payload: { produceId, storage, quantity } })
    const guideline = QUALITY_GUIDELINES[produceId]
    const qualityDays = storage === 'freezer' ? 180 : guideline ? (guideline[storage] || guideline.fridge || 7) : 7
    trackEvent('pantry_item_added', {
      item_id_opaque: `p_${Date.now()}`,
      category_enum: categorizeProduceId(produceId),
      storage_enum: storage || 'fridge',
      days_to_quality_end_bucket: qualityDays,
      add_method: 'manual',
    })
  }, [])

  const removeItem = useCallback((id) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } })
  }, [])

  const updateItem = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_ITEM', payload: { id, updates } })
  }, [])

  const decrementQuantity = useCallback((id, amount = 1) => {
    const item = state.items.find((i) => i.id === id)
    dispatch({ type: 'DECREMENT_QUANTITY', payload: { id, amount } })
    return { item, amount }
  }, [state.items])

  const undoDecrement = useCallback((item, amount) => {
    dispatch({ type: 'UNDO_DECREMENT', payload: { item, amount } })
  }, [])

  // Computed: items with days remaining + use-soon flag
  const enrichedItems = useMemo(() => {
    return state.items.map((item) => {
      const daysRemaining = computeDaysRemaining(item)
      const guideline = QUALITY_GUIDELINES[item.produceId]
      const qualityDays = item.storage === 'freezer'
        ? 180
        : guideline ? (guideline[item.storage] || guideline.fridge || 7) : 7
      return {
        ...item,
        daysRemaining,
        qualityDays,
        isUseSoon: daysRemaining !== null && daysRemaining <= USE_SOON_THRESHOLD_DAYS && daysRemaining >= 0,
        isPastGuideline: daysRemaining !== null && daysRemaining < 0,
        guidelineLabel: guideline?.label || item.produceId,
      }
    })
  }, [state.items])

  const useSoonItems = useMemo(() => {
    return enrichedItems
      .filter((i) => i.isUseSoon)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
  }, [enrichedItems])

  const value = useMemo(() => ({
    items: enrichedItems,
    useSoonItems,
    addItem,
    removeItem,
    updateItem,
    decrementQuantity,
    undoDecrement,
  }), [enrichedItems, useSoonItems, addItem, removeItem, updateItem, decrementQuantity, undoDecrement])

  return (
    <PantryContext.Provider value={value}>
      {children}
    </PantryContext.Provider>
  )
}

export function usePantry() {
  const ctx = useContext(PantryContext)
  if (!ctx) throw new Error('usePantry must be used within <PantryProvider>')
  return ctx
}

export { QUALITY_GUIDELINES, CATEGORIES, STORAGE_LOCATIONS, USE_SOON_THRESHOLD_DAYS, computeDaysRemaining }
