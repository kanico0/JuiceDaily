// ─────────────────────────────────────────────────────────────
// UserProfileStore.js — Persistent user profile for beta testers
// Stores name, avatar initial, goal, and last session timestamp.
// Resumes where the user left off on relaunch.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { loadState, saveState, resetAllStorageKeys, ALL_STORAGE_KEYS } from './storage'

const STORAGE_KEY = '@juicing_user_profile_v1'
const PROFILE_SCHEMA_VERSION = 2

// Re-export for backward compat
export { ALL_STORAGE_KEYS }

// ── Default Profile ─────────────────────────────────────────

function createEmptyProfile() {
  return {
    name: '',
    avatar: '',
    goal: '',
    lastSessionTs: null,
    createdAt: null,
    hasCompletedSetup: false,
  }
}

// ── Reducer ─────────────────────────────────────────────────

function profileReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload, lastSessionTs: new Date().toISOString() }
    case 'SET_NAME':
      return { ...state, name: action.name, avatar: (action.name || '?')[0].toUpperCase() }
    case 'SET_GOAL':
      return { ...state, goal: action.goal }
    case 'COMPLETE_SETUP':
      return { ...state, hasCompletedSetup: true, createdAt: state.createdAt || new Date().toISOString() }
    case 'UPDATE_SESSION':
      return { ...state, lastSessionTs: new Date().toISOString() }
    case 'RESET':
      return createEmptyProfile()
    default:
      return state
  }
}

// ── Context ─────────────────────────────────────────────────

const ProfileContext = createContext(null)

/** Sanitize profile from storage */
function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    avatar: typeof raw.avatar === 'string' ? raw.avatar : '',
    goal: typeof raw.goal === 'string' ? raw.goal : '',
    lastSessionTs: typeof raw.lastSessionTs === 'string' ? raw.lastSessionTs : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
    hasCompletedSetup: typeof raw.hasCompletedSetup === 'boolean' ? raw.hasCompletedSetup : false,
  }
}

export function UserProfileProvider({ children }) {
  const [profile, dispatch] = useReducer(profileReducer, createEmptyProfile())
  const isHydrated = useRef(false)

  // Hydrate from storage on mount (schema-versioned)
  useEffect(() => {
    ;(async () => {
      const restored = await loadState({
        key: STORAGE_KEY,
        version: PROFILE_SCHEMA_VERSION,
        sanitize: sanitizeProfile,
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
    saveState(STORAGE_KEY, PROFILE_SCHEMA_VERSION, profile)
  }, [profile])

  const setName = useCallback((name) => {
    dispatch({ type: 'SET_NAME', name })
  }, [])

  const setGoal = useCallback((goal) => {
    dispatch({ type: 'SET_GOAL', goal })
  }, [])

  const completeSetup = useCallback(() => {
    dispatch({ type: 'COMPLETE_SETUP' })
  }, [])

  const updateSession = useCallback(() => {
    dispatch({ type: 'UPDATE_SESSION' })
  }, [])

  const resetProfile = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return (
    <ProfileContext.Provider value={{
      profile,
      setName,
      setGoal,
      completeSetup,
      updateSession,
      resetProfile,
    }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useUserProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useUserProfile must be used within <UserProfileProvider>')
  return ctx
}

// ── Nuclear Reset ───────────────────────────────────────────
// Clears ALL app data from AsyncStorage. Used by dev "Reset User" button.

export async function resetAllUserData() {
  await resetAllStorageKeys()
}
