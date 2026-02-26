// ─────────────────────────────────────────────────────────────
// TemplateStore.js — Save & reuse juice templates
// AsyncStorage-backed, offline-first.
// Gated behind ff_templates feature flag.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { trackEvent } from './AnalyticsService'

const STORAGE_KEY = '@juicing_templates_v1'
const MAX_TEMPLATES = 50

// ── Reducer ──────────────────────────────────────────────────

function templateReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, templates: action.payload }

    case 'SAVE_TEMPLATE': {
      const newTemplate = {
        id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: action.payload.name,
        ingredients: action.payload.ingredients,
        juiceMethod: action.payload.juiceMethod || 'cold_pressed',
        createdAt: new Date().toISOString(),
        usageCount: 0,
        lastUsedAt: null,
      }
      const updated = [newTemplate, ...state.templates].slice(0, MAX_TEMPLATES)
      return { ...state, templates: updated }
    }

    case 'USE_TEMPLATE': {
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.payload.id
            ? { ...t, usageCount: t.usageCount + 1, lastUsedAt: new Date().toISOString() }
            : t
        ),
      }
    }

    case 'RENAME_TEMPLATE': {
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.payload.id ? { ...t, name: action.payload.name } : t
        ),
      }
    }

    case 'DELETE_TEMPLATE': {
      return {
        ...state,
        templates: state.templates.filter((t) => t.id !== action.payload.id),
      }
    }

    default:
      return state
  }
}

// ── Context + Provider ───────────────────────────────────────

const TemplateContext = createContext(null)

export function TemplateProvider({ children }) {
  const [state, dispatch] = useReducer(templateReducer, { templates: [] })

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
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.templates))
      } catch (e) { /* non-fatal */ }
    })()
  }, [state.templates])

  const saveTemplate = useCallback((name, ingredients, juiceMethod) => {
    dispatch({ type: 'SAVE_TEMPLATE', payload: { name, ingredients, juiceMethod } })
  }, [])

  const useTemplate = useCallback((id) => {
    dispatch({ type: 'USE_TEMPLATE', payload: { id } })
    const tpl = state.templates.find((t) => t.id === id)
    trackEvent('template_used', {
      template_id_opaque: id,
      ingredient_count: tpl ? tpl.ingredients.length : 0,
      usage_count_bucket: tpl ? tpl.usageCount + 1 : 1,
      source: 'manual',
    })
    return tpl || null
  }, [state.templates])

  const renameTemplate = useCallback((id, name) => {
    dispatch({ type: 'RENAME_TEMPLATE', payload: { id, name } })
  }, [])

  const deleteTemplate = useCallback((id) => {
    dispatch({ type: 'DELETE_TEMPLATE', payload: { id } })
  }, [])

  // Sorted: most recently used first, then most recently created
  const sortedTemplates = useMemo(() => {
    return [...state.templates].sort((a, b) => {
      if (a.lastUsedAt && b.lastUsedAt) return new Date(b.lastUsedAt) - new Date(a.lastUsedAt)
      if (a.lastUsedAt) return -1
      if (b.lastUsedAt) return 1
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  }, [state.templates])

  const value = useMemo(() => ({
    templates: sortedTemplates,
    saveTemplate,
    useTemplate,
    renameTemplate,
    deleteTemplate,
  }), [sortedTemplates, saveTemplate, useTemplate, renameTemplate, deleteTemplate])

  return (
    <TemplateContext.Provider value={value}>
      {children}
    </TemplateContext.Provider>
  )
}

export function useTemplates() {
  const ctx = useContext(TemplateContext)
  if (!ctx) throw new Error('useTemplates must be used within <TemplateProvider>')
  return ctx
}
