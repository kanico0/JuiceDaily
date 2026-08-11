// ─────────────────────────────────────────────────────────────
// useDeveloperMode — hidden developer options unlock gate
//
// Normal users never see Developer Flags. The gate requires:
//   1. Tap the version display 7 times in Settings
//   2. Enter passcode 7918
//
// BUILD-TIME PRODUCTION SAFETY GATE:
//   EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS env var controls whether
//   the unlock gesture can work at all.
//   - QA/local builds: set EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS=1
//   - Production Google Play builds: default disabled (unset or 0)
//   When disabled, 7 taps + 7918 cannot expose Developer Flags.
//
// SESSION-ONLY UNLOCK:
//   The unlock is NOT persisted to AsyncStorage. Developer Options
//   begin locked and hidden on every app launch. The user must
//   tap 7 times + enter 7918 each session. Closing and relaunching
//   the app relocks Developer Options.
//
// This gate does NOT protect secrets or privileged backend
// operations. It only hides QA/developer UI from ordinary users.
// Developer mode never grants real RevenueCat/server Pro entitlement.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'

const REQUIRED_TAPS = 7
const REQUIRED_PASSCODE = '7918'
const TAP_RESET_TIMEOUT_MS = 3000 // Reset tap counter after 3s of inactivity

// Build-time production safety gate.
// QA/local builds set EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS=1.
// Production Google Play builds leave it unset (disabled).
export const DEVELOPER_TOOLS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS === '1'

export function useDeveloperMode() {
  // Always start locked — no persisted unlock state.
  // Developer Options relock on every app launch.
  const [unlocked, setUnlocked] = useState(false)
  const [tapCount, setTapCount] = useState(0)
  const [showPasscodePrompt, setShowPasscodePrompt] = useState(false)
  const [passcodeError, setPasscodeError] = useState(false)
  const tapTimerRef = useRef(null)

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
    // Production gate: taps do nothing if developer tools are disabled
    if (!DEVELOPER_TOOLS_ENABLED) return
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
    // Production gate: passcode cannot unlock if developer tools are disabled
    if (!DEVELOPER_TOOLS_ENABLED) {
      setPasscodeError(true)
      return false
    }
    if (code === REQUIRED_PASSCODE) {
      setUnlocked(true)
      setShowPasscodePrompt(false)
      setPasscodeError(false)
      // Session-only: do NOT persist to AsyncStorage.
      // Unlock expires when the app is closed/relaunched.
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
    developerToolsEnabled: DEVELOPER_TOOLS_ENABLED,
  }
}

export { REQUIRED_TAPS, REQUIRED_PASSCODE }
