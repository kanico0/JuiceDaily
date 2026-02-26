// ─────────────────────────────────────────────────────────────
// SocialChallengeStore.js — Optional social challenges
// Opt-in only. No leaderboards. No comparison pressure.
// Users can join/leave freely at any time.
// Gated behind ff_social_challenges feature flag.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { trackEvent } from './AnalyticsService'

const STORAGE_KEY = '@juicing_social_challenges_v1'

// ── Built-in Challenge Definitions ───────────────────────────
// Community-oriented, non-competitive, encouraging.

const CHALLENGE_CATALOG = [
  {
    id: 'rainbow_week',
    title: 'Rainbow Week',
    description: 'Log at least one juice from each color group this week.',
    duration: 7,
    goal: 'Log 6 different color groups',
    emoji: '🌈',
    category: 'diversity',
  },
  {
    id: 'green_streak_3',
    title: '3-Day Green Streak',
    description: 'Include a green juice in your log for 3 consecutive days.',
    duration: 3,
    goal: 'Log greens 3 days in a row',
    emoji: '🥬',
    category: 'consistency',
  },
  {
    id: 'try_something_new',
    title: 'Try Something New',
    description: 'Log a produce item you have never logged before.',
    duration: 7,
    goal: 'Log 1 new ingredient',
    emoji: '🆕',
    category: 'exploration',
  },
  {
    id: 'morning_ritual_5',
    title: '5-Day Morning Ritual',
    description: 'Log a juice before noon for 5 days this week.',
    duration: 7,
    goal: 'Log before noon 5 times',
    emoji: '🌅',
    category: 'habit',
  },
  {
    id: 'root_power',
    title: 'Root Power',
    description: 'Include a root vegetable (carrot, beet, ginger) in 3 juices this week.',
    duration: 7,
    goal: 'Log 3 root-based juices',
    emoji: '🥕',
    category: 'diversity',
  },
]

// ── Reducer ──────────────────────────────────────────────────

function createEmptyState() {
  return {
    activeChallenges: [],
    completedChallenges: [],
    optedIn: false,
  }
}

function socialReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload }

    case 'OPT_IN':
      return { ...state, optedIn: true }

    case 'OPT_OUT':
      return { ...state, optedIn: false, activeChallenges: [] }

    case 'JOIN_CHALLENGE': {
      const { challengeId } = action.payload
      if (state.activeChallenges.find((c) => c.challengeId === challengeId)) return state
      const catalog = CHALLENGE_CATALOG.find((c) => c.id === challengeId)
      if (!catalog) return state

      const entry = {
        challengeId,
        joinedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + catalog.duration * 86400000).toISOString(),
        progress: 0,
        isComplete: false,
      }
      return { ...state, activeChallenges: [...state.activeChallenges, entry] }
    }

    case 'LEAVE_CHALLENGE': {
      return {
        ...state,
        activeChallenges: state.activeChallenges.filter(
          (c) => c.challengeId !== action.payload.challengeId
        ),
      }
    }

    case 'UPDATE_PROGRESS': {
      const { challengeId, progress } = action.payload
      return {
        ...state,
        activeChallenges: state.activeChallenges.map((c) => {
          if (c.challengeId !== challengeId) return c
          const isComplete = progress >= 1
          return { ...c, progress: Math.min(progress, 1), isComplete }
        }),
      }
    }

    case 'COMPLETE_CHALLENGE': {
      const { challengeId } = action.payload
      const active = state.activeChallenges.find((c) => c.challengeId === challengeId)
      if (!active) return state
      return {
        ...state,
        activeChallenges: state.activeChallenges.filter((c) => c.challengeId !== challengeId),
        completedChallenges: [
          ...state.completedChallenges,
          { ...active, completedAt: new Date().toISOString() },
        ],
      }
    }

    case 'CLEANUP_EXPIRED': {
      const now = new Date().toISOString()
      return {
        ...state,
        activeChallenges: state.activeChallenges.filter((c) => c.expiresAt > now || c.isComplete),
      }
    }

    default:
      return state
  }
}

// ── Context + Provider ───────────────────────────────────────

const SocialChallengeContext = createContext(null)

export function SocialChallengeProvider({ children }) {
  const [state, dispatch] = useReducer(socialReducer, createEmptyState())

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
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (e) { /* non-fatal */ }
    })()
  }, [state])

  // Cleanup expired challenges on mount
  useEffect(() => {
    dispatch({ type: 'CLEANUP_EXPIRED' })
  }, [])

  const optIn = useCallback(() => {
    dispatch({ type: 'OPT_IN' })
    trackEvent('social_opt_in', { source: 'manual' })
  }, [])

  const optOut = useCallback(() => {
    dispatch({ type: 'OPT_OUT' })
    trackEvent('social_opt_out', { source: 'manual' })
  }, [])

  const joinChallenge = useCallback((challengeId) => {
    dispatch({ type: 'JOIN_CHALLENGE', payload: { challengeId } })
    trackEvent('social_challenge_joined', {
      challenge_id_enum: challengeId,
      source: 'catalog',
    })
  }, [])

  const leaveChallenge = useCallback((challengeId) => {
    dispatch({ type: 'LEAVE_CHALLENGE', payload: { challengeId } })
    trackEvent('social_challenge_left', {
      challenge_id_enum: challengeId,
      source: 'manual',
    })
  }, [])

  const updateProgress = useCallback((challengeId, progress) => {
    dispatch({ type: 'UPDATE_PROGRESS', payload: { challengeId, progress } })
  }, [])

  const completeChallenge = useCallback((challengeId) => {
    dispatch({ type: 'COMPLETE_CHALLENGE', payload: { challengeId } })
    trackEvent('social_challenge_completed', {
      challenge_id_enum: challengeId,
    })
  }, [])

  const availableChallenges = useMemo(() => {
    const activeIds = new Set(state.activeChallenges.map((c) => c.challengeId))
    return CHALLENGE_CATALOG.filter((c) => !activeIds.has(c.id))
  }, [state.activeChallenges])

  const value = useMemo(() => ({
    optedIn: state.optedIn,
    activeChallenges: state.activeChallenges,
    completedChallenges: state.completedChallenges,
    availableChallenges,
    catalog: CHALLENGE_CATALOG,
    optIn,
    optOut,
    joinChallenge,
    leaveChallenge,
    updateProgress,
    completeChallenge,
  }), [state, availableChallenges, optIn, optOut, joinChallenge, leaveChallenge, updateProgress, completeChallenge])

  return (
    <SocialChallengeContext.Provider value={value}>
      {children}
    </SocialChallengeContext.Provider>
  )
}

export function useSocialChallenges() {
  const ctx = useContext(SocialChallengeContext)
  if (!ctx) throw new Error('useSocialChallenges must be used within <SocialChallengeProvider>')
  return ctx
}

export { CHALLENGE_CATALOG }
