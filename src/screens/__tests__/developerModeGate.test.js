// ─────────────────────────────────────────────────────────────
// Tests for hidden developer mode unlock gate
//
// Normal users must NOT see Developer Flags. The gate requires:
//   1. Tap the version display 7 times in Settings
//   2. Enter passcode 7918
// ─────────────────────────────────────────────────────────────

const mockStorage = new Map()

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(mockStorage.get(key) || null)),
  setItem: jest.fn((key, value) => {
    mockStorage.set(key, value)
    return Promise.resolve()
  }),
  removeItem: jest.fn((key) => {
    mockStorage.delete(key)
    return Promise.resolve()
  }),
}))

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}))

// We test the hook by wrapping it in a test component and using
// react-test-renderer to read state and trigger interactions.
const React = require('react')
const TestRenderer = require('react-test-renderer')
const { act } = TestRenderer
const { useDeveloperMode, DEV_MODE_KEY, REQUIRED_TAPS, REQUIRED_PASSCODE } = require('../../hooks/useDeveloperMode')

// Helper: render the hook in a test component and return controls
function renderDevModeHook() {
  let stateRef = { current: null }
  const TestComp = React.memo(function TestComp() {
    const hook = useDeveloperMode()
    stateRef.current = hook
    return null
  })
  let renderer
  act(() => {
    renderer = TestRenderer.create(React.createElement(TestComp))
  })
  return {
    stateRef,
    renderer,
    unmount: () => {
      act(() => renderer.unmount())
    },
  }
}

// Helper: advance timers and flush promises
async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve))
}

describe('useDeveloperMode — hidden developer mode unlock gate', () => {
  beforeEach(() => {
    mockStorage.clear()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // ── 1. Developer Flags absent by default ──

  test('1. unlocked is false by default', () => {
    const { stateRef, unmount } = renderDevModeHook()
    expect(stateRef.current.unlocked).toBe(false)
    expect(stateRef.current.showPasscodePrompt).toBe(false)
    unmount()
  })

  // ── 2. 1–6 version taps do not reveal anything ──

  test('2. 1-6 version taps do not reveal passcode prompt', () => {
    const { stateRef, unmount } = renderDevModeHook()
    for (let i = 0; i < 6; i++) {
      act(() => stateRef.current.handleVersionTap())
      expect(stateRef.current.showPasscodePrompt).toBe(false)
      expect(stateRef.current.unlocked).toBe(false)
    }
    expect(stateRef.current.tapCount).toBe(6)
    unmount()
  })

  // ── 3. 7th tap opens passcode prompt ──

  test('3. 7th tap opens passcode prompt', () => {
    const { stateRef, unmount } = renderDevModeHook()
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    expect(stateRef.current.showPasscodePrompt).toBe(true)
    expect(stateRef.current.tapCount).toBe(0) // Reset after prompt opens
    unmount()
  })

  // ── 4. Wrong passcode keeps developer options hidden ──

  test('4. Wrong passcode keeps developer options hidden', async () => {
    const { stateRef, unmount } = renderDevModeHook()
    // Open passcode prompt
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    expect(stateRef.current.showPasscodePrompt).toBe(true)

    // Submit wrong passcode
    let ok
    await act(async () => {
      ok = await stateRef.current.submitPasscode('0000')
    })
    expect(ok).toBe(false)
    expect(stateRef.current.unlocked).toBe(false)
    expect(stateRef.current.passcodeError).toBe(true)
    expect(stateRef.current.showPasscodePrompt).toBe(true) // Still showing
    unmount()
  })

  // ── 5. 7918 unlocks developer options ──

  test('5. 7918 unlocks developer options', async () => {
    const { stateRef, unmount } = renderDevModeHook()
    // Open passcode prompt
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    // Submit correct passcode
    let ok
    await act(async () => {
      ok = await stateRef.current.submitPasscode('7918')
    })
    expect(ok).toBe(true)
    expect(stateRef.current.unlocked).toBe(true)
    expect(stateRef.current.showPasscodePrompt).toBe(false)
    expect(stateRef.current.passcodeError).toBe(false)
    unmount()
  })

  // ── 6. Developer Flags become visible only after successful unlock ──

  test('6. unlocked flag is true only after correct passcode', async () => {
    const { stateRef, unmount } = renderDevModeHook()
    // Before unlock
    expect(stateRef.current.unlocked).toBe(false)

    // 7 taps
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    // Prompt is showing but not unlocked yet
    expect(stateRef.current.unlocked).toBe(false)

    // Correct passcode
    await act(async () => {
      await stateRef.current.submitPasscode('7918')
    })
    expect(stateRef.current.unlocked).toBe(true)
    unmount()
  })

  // ── 7. Persisted unlock works ──

  test('7. Persisted unlock works on subsequent mount', async () => {
    // First instance: unlock
    const { stateRef: r1, unmount: u1 } = renderDevModeHook()
    for (let i = 0; i < 7; i++) {
      act(() => r1.current.handleVersionTap())
    }
    await act(async () => {
      await r1.current.submitPasscode('7918')
    })
    expect(r1.current.unlocked).toBe(true)
    u1()

    // Verify persisted
    expect(mockStorage.get(DEV_MODE_KEY)).toBe('true')

    // Second instance: should load persisted unlock
    const { stateRef: r2, unmount: u2 } = renderDevModeHook()
    await act(async () => {
      await flushPromises()
    })
    expect(r2.current.unlocked).toBe(true)
    u2()
  })

  // ── 8. Disable Developer Mode hides the controls again ──

  test('8. Disable Developer Mode hides the controls again', async () => {
    const { stateRef, unmount } = renderDevModeHook()
    // Unlock first
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    await act(async () => {
      await stateRef.current.submitPasscode('7918')
    })
    expect(stateRef.current.unlocked).toBe(true)

    // Disable
    await act(async () => {
      await stateRef.current.disableDeveloperMode()
    })
    expect(stateRef.current.unlocked).toBe(false)
    expect(mockStorage.has(DEV_MODE_KEY)).toBe(false)
    unmount()
  })

  // ── 9. No developer options leak onto unrelated screens (source check) ──

  test('9. Developer Flags section is gated by devModeUnlocked in SettingsScreen', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    // The Developer Flags section must exist
    const devFlagsIdx = src.indexOf('DEVELOPER FLAGS')
    expect(devFlagsIdx).toBeGreaterThan(0)
    // The devModeUnlocked conditional must exist in the file and
    // appear BEFORE the Developer Flags section
    const condIdx = src.indexOf('devModeUnlocked')
    expect(condIdx).toBeGreaterThan(0)
    expect(condIdx).toBeLessThan(devFlagsIdx)
    // The conditional must wrap the Developer Flags — check that
    // the gating pattern exists: {devModeUnlocked && (
    expect(src).toMatch(/\{devModeUnlocked\s*&&\s*\(/)
  })

  test('9b. Version display exists in SettingsScreen', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    expect(src).toMatch(/APP_VERSION/)
    expect(src).toMatch(/handleVersionTap/)
  })

  test('9c. Passcode prompt exists in SettingsScreen', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    expect(src).toMatch(/showPasscodePrompt/)
    expect(src).toMatch(/submitPasscode/)
    expect(src).toMatch(/cancelPasscode/)
  })

  test('9d. Disable Developer Mode button exists in SettingsScreen', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    expect(src).toMatch(/disableDeveloperMode/)
    expect(src).toMatch(/Disable Developer Mode/)
  })

  // ── Constants ──

  test('REQUIRED_TAPS is 7', () => {
    expect(REQUIRED_TAPS).toBe(7)
  })

  test('REQUIRED_PASSCODE is 7918', () => {
    expect(REQUIRED_PASSCODE).toBe('7918')
  })

  test('DEV_MODE_KEY is a string', () => {
    expect(typeof DEV_MODE_KEY).toBe('string')
    expect(DEV_MODE_KEY.length).toBeGreaterThan(0)
  })

  // ── Tap counter resets on inactivity ──

  test('Tap counter resets after inactivity timeout', () => {
    jest.useFakeTimers()
    const { stateRef, unmount } = renderDevModeHook()
    // 3 taps
    for (let i = 0; i < 3; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    expect(stateRef.current.tapCount).toBe(3)

    // Advance past timeout
    act(() => {
      jest.advanceTimersByTime(4000)
    })

    expect(stateRef.current.tapCount).toBe(0)
    unmount()
  })

  // ── Cancel passcode resets state ──

  test('Cancel passcode resets tap count and hides prompt', () => {
    const { stateRef, unmount } = renderDevModeHook()
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    expect(stateRef.current.showPasscodePrompt).toBe(true)

    act(() => stateRef.current.cancelPasscode())
    expect(stateRef.current.showPasscodePrompt).toBe(false)
    expect(stateRef.current.tapCount).toBe(0)
    expect(stateRef.current.passcodeError).toBe(false)
    unmount()
  })

  // ── Already unlocked: taps do nothing ──

  test('Already unlocked: handleVersionTap does nothing', async () => {
    const { stateRef, unmount } = renderDevModeHook()
    // Unlock
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    await act(async () => {
      await stateRef.current.submitPasscode('7918')
    })
    expect(stateRef.current.unlocked).toBe(true)

    // Taps should not increment or show prompt
    act(() => stateRef.current.handleVersionTap())
    act(() => stateRef.current.handleVersionTap())
    expect(stateRef.current.tapCount).toBe(0)
    expect(stateRef.current.showPasscodePrompt).toBe(false)
    unmount()
  })
})

