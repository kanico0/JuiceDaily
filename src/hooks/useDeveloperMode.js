// ─────────────────────────────────────────────────────────────
// useDeveloperMode — hidden developer options unlock gate
//
// Normal users never see Developer Flags. The gate requires:
//   1. Tap the version display 7 times in Settings
//   2. Enter passcode 7918
//
// The unlock persists in AsyncStorage so the user does not need
// to re-enter the sequence every time. A "Disable Developer Mode"
// action is available inside the unlocked developer area.
//
// This gate does NOT protect secrets or privileged backend
// operations. It only hides QA/developer UI from ordinary users.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const DEV_MODE_KEY = '@juicing_developer_mode_unlocked_v1'
const REQUIRED_TAPS = 7
const REQUIRED_PASSCODE = '7918'
const TAP_RESET_TIMEOUT_MS = 3000 // Reset tap counter after 3s of inactivity

export function useDeveloperMode() {
  const [unlocked, setUnlocked] = useState(false)
  const [tapCount, setTapCount] = useState(0)
  const [showPasscodePrompt, setShowPasscodePrompt] = useState(false)
  const [passcodeError, setPasscodeError] = useState(false)
  const tapTimerRef = useRef(null)

  // Load persisted unlock state on mount
  useEffect(() => {
    AsyncStorage.getItem(DEV_MODE_KEY).then((val) => {
      if (val === 'true') setUnlocked(true)
    }).catch(() => {})
  }, [])

  // Reset tap counter after inactivity timeout
  useEffect(() => {
    if (tapCount === 0) return
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => {
      setTapCount(0)
    }, TAP_RESET_TIMEOUT_MS)
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    }
  }, [tapCount])

  const handleVersionTap = useCallback(() => {
    if (unlocked) return // Already unlocked — no need to count
    const newCount = tapCount + 1
    setTapCount(newCount)
    if (newCount >= REQUIRED_TAPS) {
      setShowPasscodePrompt(true)
      setPasscodeError(false)
      setTapCount(0) // Reset counter when prompt opens
    }
  }, [tapCount, unlocked])

  const submitPasscode = useCallback(async (code) => {
    if (code === REQUIRED_PASSCODE) {
      setUnlocked(true)
      setShowPasscodePrompt(false)
      setPasscodeError(false)
      try {
        await AsyncStorage.setItem(DEV_MODE_KEY, 'true')
      } catch (e) { /* ignore */ }
      return true
    }
    setPasscodeError(true)
    return false
  }, [])

  const cancelPasscode = useCallback(() => {
    setShowPasscodePrompt(false)
    setPasscodeError(false)
    setTapCount(0)
  }, [])

  const disableDeveloperMode = useCallback(async () => {
    setUnlocked(false)
    setShowPasscodePrompt(false)
    setPasscodeError(false)
    setTapCount(0)
    try {
      await AsyncStorage.removeItem(DEV_MODE_KEY)
    } catch (e) { /* ignore */ }
  }, [])

  return {
    unlocked,
    tapCount,
    showPasscodePrompt,
    passcodeError,
    handleVersionTap,
    submitPasscode,
    cancelPasscode,
    disableDeveloperMode,
  }
}

export { DEV_MODE_KEY, REQUIRED_TAPS, REQUIRED_PASSCODE }
