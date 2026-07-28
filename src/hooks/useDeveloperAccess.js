// ─────────────────────────────────────────────────────────────
// useDeveloperAccess.js — React hook for developer authorization.
//
// Manages the seven-tap unlock state, server authorization check,
// and automatic hide-on-sign-out / identity-change behavior.
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react'
import { checkDeveloperAccess, isDevBypassAvailable } from '../services/supabase/developerAccess'
import { getAccountStatus, addIdentityChangeListener } from '../services/supabase/accountLink'
import { getSupabase } from '../services/supabase/supabaseClient'

const TAP_THRESHOLD = 7
const TAP_RESET_MS = 7000
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000

export function useDeveloperAccess () {
  const [tapCount, setTapCount] = useState(0)
  const [devToolsVisible, setDevToolsVisible] = useState(false)
  const [checking, setChecking] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState(null)
  const [authResult, setAuthResult] = useState(null)
  const tapTimerRef = useRef(null)
  const sessionTimerRef = useRef(null)
  const currentUserIdRef = useRef(null)

  const resetTaps = useCallback(() => {
    setTapCount(0)
    setFeedbackMessage(null)
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current)
      tapTimerRef.current = null
    }
  }, [])

  const hideDevTools = useCallback(() => {
    setDevToolsVisible(false)
    setAuthResult(null)
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
  }, [])

  const checkAccess = useCallback(async () => {
    setChecking(true)
    setFeedbackMessage('Checking developer access…')

    try {
      const status = await getAccountStatus()

      if (!status.isDurable) {
        setFeedbackMessage('Sign in with an authorized developer account to access developer tools.')
        setChecking(false)
        resetTaps()
        return
      }

      currentUserIdRef.current = status.userId

      if (isDevBypassAvailable()) {
        setAuthResult({ authorized: true, role: 'dev_local', expiresAt: null })
        setDevToolsVisible(true)
        setFeedbackMessage('Development Build Access')
        setChecking(false)
        resetTaps()

        sessionTimerRef.current = setTimeout(() => {
          hideDevTools()
        }, SESSION_EXPIRY_MS)

        return
      }

      const result = await checkDeveloperAccess()
      setAuthResult(result)

      if (result.authorized) {
        setDevToolsVisible(true)
        setFeedbackMessage(null)

        sessionTimerRef.current = setTimeout(() => {
          hideDevTools()
        }, SESSION_EXPIRY_MS)
      } else {
        setFeedbackMessage('Developer access is not available for this account.')
      }
    } catch {
      setFeedbackMessage('Developer access check failed. Please try again.')
    } finally {
      setChecking(false)
      resetTaps()
    }
  }, [hideDevTools, resetTaps])

  const handleVersionTap = useCallback(() => {
    const nextCount = tapCount + 1

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current)
    }
    tapTimerRef.current = setTimeout(() => {
      resetTaps()
    }, TAP_RESET_MS)

    if (nextCount >= TAP_THRESHOLD) {
      setTapCount(0)
      setFeedbackMessage(null)
      checkAccess()
      return
    }

    setTapCount(nextCount)

    if (nextCount >= 4) {
      const remaining = TAP_THRESHOLD - nextCount
      setFeedbackMessage(`${remaining} more tap${remaining === 1 ? '' : 's'} to check developer access`)
    } else {
      setFeedbackMessage(null)
    }
  }, [tapCount, checkAccess, resetTaps])

  useEffect(() => {
    const removeListener = addIdentityChangeListener((newUserId) => {
      if (currentUserIdRef.current && newUserId !== currentUserIdRef.current) {
        hideDevTools()
        resetTaps()
      }
      currentUserIdRef.current = newUserId
    })

    let authUnsub = null
    const supabase = getSupabase()
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          hideDevTools()
          resetTaps()
          currentUserIdRef.current = null
        }
      })
      authUnsub = data?.subscription?.unsubscribe ?? null
    }

    return () => {
      removeListener()
      if (authUnsub) authUnsub()
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current)
    }
  }, [hideDevTools, resetTaps])

  return {
    tapCount,
    devToolsVisible,
    checking,
    feedbackMessage,
    authResult,
    handleVersionTap,
    hideDevTools,
    resetTaps,
  }
}
