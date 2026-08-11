// ─────────────────────────────────────────────────────────────
// Tests for hidden developer mode unlock gate
//
// Normal users must NOT see Developer Flags. The gate requires:
//   1. Tap the version display 7 times in Settings
//   2. Enter passcode 7918
//   3. EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS=1 (build-time gate)
// ─────────────────────────────────────────────────────────────

// Set env var BEFORE any module requires happen.
// The QA-enabled scenario is the default for these tests.
process.env.EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS = '1'

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}))

const React = require('react')
const TestRenderer = require('react-test-renderer')
const { act } = TestRenderer

// Helper: render the hook in a test component and return controls
function renderDevModeHook(useDeveloperModeFn) {
  let stateRef = { current: null }
  const TestComp = React.memo(function TestComp() {
    const hook = useDeveloperModeFn()
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

const { useDeveloperMode } = require('../../hooks/useDeveloperMode')

// ── QA-enabled scenario (EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS=1) ──

describe('useDeveloperMode — QA/dev-tools-enabled', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('1. unlocked is false by default', () => {
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
    expect(stateRef.current.unlocked).toBe(false)
    expect(stateRef.current.showPasscodePrompt).toBe(false)
    unmount()
  })

  test('2. 1-6 version taps do not reveal passcode prompt', () => {
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
    for (let i = 0; i < 6; i++) {
      act(() => stateRef.current.handleVersionTap())
      expect(stateRef.current.showPasscodePrompt).toBe(false)
      expect(stateRef.current.unlocked).toBe(false)
    }
    expect(stateRef.current.tapCount).toBe(6)
    unmount()
  })

  test('3. 7th tap opens passcode prompt', () => {
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    expect(stateRef.current.showPasscodePrompt).toBe(true)
    expect(stateRef.current.tapCount).toBe(0)
    unmount()
  })

  test('4. Wrong passcode keeps developer options hidden', async () => {
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    expect(stateRef.current.showPasscodePrompt).toBe(true)

    let ok
    await act(async () => {
      ok = await stateRef.current.submitPasscode('0000')
    })
    expect(ok).toBe(false)
    expect(stateRef.current.unlocked).toBe(false)
    expect(stateRef.current.passcodeError).toBe(true)
    expect(stateRef.current.showPasscodePrompt).toBe(true)
    unmount()
  })

  test('5. 7918 unlocks developer options', async () => {
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
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

  test('6. unlocked flag is true only after correct passcode', async () => {
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
    expect(stateRef.current.unlocked).toBe(false)
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    expect(stateRef.current.unlocked).toBe(false)
    await act(async () => {
      await stateRef.current.submitPasscode('7918')
    })
    expect(stateRef.current.unlocked).toBe(true)
    unmount()
  })

  test('7. Relocks on every new mount (session-only unlock, no persistence)', async () => {
    const { stateRef: r1, unmount: u1 } = renderDevModeHook(useDeveloperMode)
    for (let i = 0; i < 7; i++) {
      act(() => r1.current.handleVersionTap())
    }
    await act(async () => {
      await r1.current.submitPasscode('7918')
    })
    expect(r1.current.unlocked).toBe(true)
    u1()

    // Nothing should be persisted — unlock is session-only
    // (No AsyncStorage calls should have been made)

    // A fresh mount (simulating app relaunch) must start locked
    const { stateRef: r2, unmount: u2 } = renderDevModeHook(useDeveloperMode)
    await act(async () => {
      await flushPromises()
    })
    expect(r2.current.unlocked).toBe(false)
    expect(r2.current.showPasscodePrompt).toBe(false)
    expect(r2.current.tapCount).toBe(0)
    u2()
  })

  test('8. Disable Developer Mode hides the controls again', async () => {
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    await act(async () => {
      await stateRef.current.submitPasscode('7918')
    })
    expect(stateRef.current.unlocked).toBe(true)

    await act(async () => {
      await stateRef.current.disableDeveloperMode()
    })
    expect(stateRef.current.unlocked).toBe(false)
    unmount()
  })

  test('developerToolsEnabled is true when env var is set', () => {
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
    expect(stateRef.current.developerToolsEnabled).toBe(true)
    unmount()
  })

  test('Cancel passcode resets tap count and hides prompt', () => {
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
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

  test('Already unlocked: handleVersionTap does nothing', async () => {
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
    for (let i = 0; i < 7; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    await act(async () => {
      await stateRef.current.submitPasscode('7918')
    })
    expect(stateRef.current.unlocked).toBe(true)

    act(() => stateRef.current.handleVersionTap())
    act(() => stateRef.current.handleVersionTap())
    expect(stateRef.current.tapCount).toBe(0)
    expect(stateRef.current.showPasscodePrompt).toBe(false)
    unmount()
  })

  test('Tap counter resets after inactivity timeout', () => {
    jest.useFakeTimers()
    const { stateRef, unmount } = renderDevModeHook(useDeveloperMode)
    for (let i = 0; i < 3; i++) {
      act(() => stateRef.current.handleVersionTap())
    }
    expect(stateRef.current.tapCount).toBe(3)

    act(() => {
      jest.advanceTimersByTime(4000)
    })
    expect(stateRef.current.tapCount).toBe(0)
    unmount()
  })
})

// ── Production-disabled scenario ──
// Tested via source-level checks below, since the env var is
// evaluated at module load time and cannot be reliably toggled
// within a single Jest file. The useDeveloperMode.js source is
// verified to reference EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS.
//
// Required behavior (verified by source-level checks):
//   - enabled flag + not unlocked → hidden (test 1: unlocked=false by default)
//   - fewer than 7 taps → hidden (test 2: 1-6 taps do not reveal prompt)
//   - 7 taps → PIN gate (test 3: 7th tap opens passcode prompt)
//   - wrong PIN → hidden (test 4: wrong passcode keeps options hidden)
//   - correct 7918 → visible (test 5: 7918 unlocks developer options)
//   - production flag unset → unlock unavailable (source check: useDeveloperMode
//     checks EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS; handleVersionTap returns
//     early if DEVELOPER_TOOLS_ENABLED is false)

// ── Source-level checks ──

describe('useDeveloperMode — source-level checks', () => {
  test('SettingsScreen gates Developer Flags behind devModeUnlocked', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    const devFlagsIdx = src.indexOf('DEVELOPER FLAGS')
    expect(devFlagsIdx).toBeGreaterThan(0)
    const condIdx = src.indexOf('devModeUnlocked')
    expect(condIdx).toBeGreaterThan(0)
    expect(condIdx).toBeLessThan(devFlagsIdx)
    expect(src).toMatch(/\{devModeUnlocked\s*&&\s*\(/)
  })

  test('Version display exists in SettingsScreen', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    expect(src).toMatch(/APP_VERSION/)
    expect(src).toMatch(/handleVersionTap/)
  })

  test('Passcode prompt exists in SettingsScreen', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    expect(src).toMatch(/showPasscodePrompt/)
    expect(src).toMatch(/submitPasscode/)
    expect(src).toMatch(/cancelPasscode/)
  })

  test('Disable Developer Mode button exists in SettingsScreen', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    expect(src).toMatch(/disableDeveloperMode/)
    expect(src).toMatch(/Disable Developer Mode/)
  })

  test('useDeveloperMode checks EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'hooks', 'useDeveloperMode.js'), 'utf8')
    expect(src).toMatch(/EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS/)
  })

  test('production flag unset → handleVersionTap returns early (source check)', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'hooks', 'useDeveloperMode.js'), 'utf8')
    // handleVersionTap must check DEVELOPER_TOOLS_ENABLED and return early
    const tapIdx = src.indexOf('handleVersionTap')
    expect(tapIdx).toBeGreaterThan(-1)
    const tapBody = src.slice(tapIdx, tapIdx + 300)
    expect(tapBody).toMatch(/DEVELOPER_TOOLS_ENABLED/)
    expect(tapBody).toMatch(/return/)
  })

  test('production flag unset → submitPasscode fails (source check)', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'hooks', 'useDeveloperMode.js'), 'utf8')
    const submitIdx = src.indexOf('submitPasscode')
    expect(submitIdx).toBeGreaterThan(-1)
    const submitBody = src.slice(submitIdx, submitIdx + 300)
    expect(submitBody).toMatch(/DEVELOPER_TOOLS_ENABLED/)
    expect(submitBody).toMatch(/return false/)
  })

  test('DEVELOPER_TOOLS_ENABLED defaults to false when env var is unset', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'hooks', 'useDeveloperMode.js'), 'utf8')
    // The export must use === '1' so unset/undefined/0 all evaluate to false
    expect(src).toMatch(/DEVELOPER_TOOLS_ENABLED\s*=\s*process\.env\.EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS\s*===\s*['"]1['"]/)
  })

  test('REQUIRED_TAPS is 7', () => {
    jest.resetModules()
    process.env.EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS = '1'
    const { REQUIRED_TAPS } = require('../../hooks/useDeveloperMode')
    expect(REQUIRED_TAPS).toBe(7)
    delete process.env.EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS
    jest.resetModules()
  })

  test('REQUIRED_PASSCODE is 7918', () => {
    jest.resetModules()
    process.env.EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS = '1'
    const { REQUIRED_PASSCODE } = require('../../hooks/useDeveloperMode')
    expect(REQUIRED_PASSCODE).toBe('7918')
    delete process.env.EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS
    jest.resetModules()
  })

  test('useDeveloperMode does NOT persist unlock state (no AsyncStorage import)', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'hooks', 'useDeveloperMode.js'), 'utf8')
    // Must NOT import AsyncStorage
    expect(src).not.toMatch(/import.*AsyncStorage/)
    expect(src).not.toMatch(/from.*async-storage/)
    // Must NOT call setItem or getItem for unlock persistence
    expect(src).not.toMatch(/\.setItem\(/)
    expect(src).not.toMatch(/\.getItem\(/)
  })

  test('Developer mode does not grant Pro entitlement (source check)', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'hooks', 'useDeveloperMode.js'), 'utf8')
    // The hook must NOT import ProStore, RevenueCat, or subscription logic
    // (mentions in comments are OK — we check imports/calls only)
    expect(src).not.toMatch(/from\s+['"][^'"]*ProStore['"]/)
    expect(src).not.toMatch(/from\s+['"][^'"]*react-native-iap['"]/)
    expect(src).not.toMatch(/require\(['"][^'"]*ProStore['"]\)/)
  })
})

// ── Freezer Pass retirement source checks ──

describe('Freezer Pass retirement — source checks', () => {
  test('SettingsScreen does not show Freezer Pass Alerts toggle', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    expect(src).not.toMatch(/Freezer Pass Alerts/)
  })

  test('SettingsScreen does not mention Freezer Pass in quiet hours note', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    expect(src).not.toMatch(/Freezer Pass alerts will bypass/)
  })

  test('SettingsScreen does not mention Freezer Passes in FAQ', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.js'), 'utf8')
    expect(src).not.toMatch(/Freezer Passes/)
  })

  test('DashboardScreen does not import FreezerPassModal', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'DashboardScreen.js'), 'utf8')
    expect(src).not.toMatch(/FreezerPassModal/)
    expect(src).not.toMatch(/MercyModal/)
    expect(src).not.toMatch(/ThawRecipeSuggestion/)
  })

  test('DashboardScreen does not show freezerPill', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'DashboardScreen.js'), 'utf8')
    expect(src).not.toMatch(/freezerPill/)
  })

  test('VaultScreen does not show freezer IAP pack', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'VaultScreen.js'), 'utf8')
    expect(src).not.toMatch(/IAP_PACKS\.freezer_3/)
    expect(src).not.toMatch(/buyFreezerPack/)
  })

  test('NotificationService scheduleFreezerMorning is retired (no-op)', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'services', 'NotificationService.js'), 'utf8')
    const start = src.indexOf('async function scheduleFreezerMorning') || src.indexOf('export async function scheduleFreezerMorning')
    const section = src.substring(start, start + 500)
    // Must NOT schedule a notification — only cancel
    expect(section).toMatch(/safeCancel/)
    expect(section).not.toMatch(/scheduleNotif/)
    expect(section).toMatch(/RETIR/i)
  })

  test('NotificationService scheduleStreakShield does not use freezerPasses', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'services', 'NotificationService.js'), 'utf8')
    const start = src.indexOf('export async function scheduleStreakShield')
    const section = src.substring(start, start + 500)
    expect(section).not.toMatch(/freezerPasses/)
    expect(section).not.toMatch(/isEmergency/)
  })

  test('NotificationCapPolicy has no freezer exemption', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'services', 'NotificationCapPolicy.js'), 'utf8')
    expect(src).not.toMatch(/ALWAYS_EXEMPT_IDS/)
    expect(src).not.toMatch(/EXEMPT_PREFIXES/)
    expect(src).not.toMatch(/isExemptNotification/)
  })

  test('NotificationCapPolicy canSendNotification has no isEmergency parameter', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'services', 'NotificationCapPolicy.js'), 'utf8')
    const start = src.indexOf('export async function canSendNotification')
    const section = src.substring(start, start + 500)
    expect(section).not.toMatch(/isEmergency/)
  })
})
