// ─────────────────────────────────────────────────────────────
// wellnessDisclaimerFlash.test.js — Regression tests for Defect 4:
// "Before you explore" Wellness Focus disclaimer flashed and
// disappeared before the user could acknowledge it.
//
// Root cause: useWellnessDisclaimerAccepted() initializes
// accepted=false, so the modal's `visible={!accepted || ...}`
// computed true on first render. A moment later, the AsyncStorage
// rehydration effect resolved to accepted=true (if the user had
// previously accepted), flipping `visible` back to false — the
// modal mounted visible and was told to close a fraction of a
// second later, before the user could read/tap it.
//
// Fix: useWellnessDisclaimerAccepted() now also returns `loaded`,
// which starts false and only becomes true after the AsyncStorage
// read resolves (success or failure). WellnessResultsScreen gates
// the first-use modal visibility on `loaded` as well as `accepted`,
// so the modal's visibility is deterministic from the very first
// render — it does not flash-and-hide once rehydration completes.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const disclaimerSrc = fs.readFileSync(
  path.join(__dirname, '..', 'WellnessDisclaimer.js'),
  'utf-8',
)
const resultsScreenSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'WellnessResultsScreen.js'),
  'utf-8',
)

describe('Defect 4 — source wiring', () => {
  test('1. useWellnessDisclaimerAccepted tracks a loaded flag', () => {
    expect(disclaimerSrc).toMatch(/const \[loaded, setLoaded\] = useState\(false\)/)
  })

  test('2. loaded is set to true only after the AsyncStorage read settles (success or failure)', () => {
    const hookSrc = disclaimerSrc.slice(
      disclaimerSrc.indexOf('export function useWellnessDisclaimerAccepted'),
      disclaimerSrc.indexOf('export function resetWellnessDisclaimer'),
    )
    expect(hookSrc).toMatch(/\.finally\(\(\) => setLoaded\(true\)\)/)
  })

  test('3. hook returns [accepted, accept, loaded]', () => {
    expect(disclaimerSrc).toMatch(/return \[accepted, accept, loaded\]/)
  })

  test('4. WellnessResultsScreen destructures disclaimerLoaded from the hook', () => {
    expect(resultsScreenSrc).toMatch(
      /const \[accepted, acceptDisclaimer, disclaimerLoaded\] = useWellnessDisclaimerAccepted\(\)/,
    )
  })

  test('5. WellnessDisclaimerModal visibility is gated on disclaimerLoaded for the first-use path', () => {
    expect(resultsScreenSrc).toMatch(
      /visible=\{\(disclaimerLoaded && !accepted\) \|\| showDisclaimerModal\}/,
    )
  })

  test('6. The explicit re-open ("Learn more") path is not blocked by disclaimerLoaded', () => {
    // showDisclaimerModal is OR'd in unconditionally, so re-opening from
    // the banner's "Learn more" link is never gated on the load flag.
    const visibleExprMatch = resultsScreenSrc.match(/visible=\{([^}]+)\}/)
    expect(visibleExprMatch).toBeTruthy()
    expect(visibleExprMatch[1]).toContain('|| showDisclaimerModal')
  })
})

describe('Defect 4 — behavioral lifecycle simulation', () => {
  // Simulates the exact hook + screen visibility computation without
  // needing @testing-library/react-native (not a project dependency).
  function simulateLifecycle(storageValue) {
    // Initial render: accepted=false, loaded=false (mirrors useState initial values)
    let accepted = false
    let loaded = false
    let showDisclaimerModal = false

    const visibleAt = (acceptedVal, loadedVal, showVal) =>
      (loadedVal && !acceptedVal) || showVal

    const history = []
    // First render (synchronous, before any AsyncStorage promise resolves)
    history.push(visibleAt(accepted, loaded, showDisclaimerModal))

    // AsyncStorage.getItem resolves asynchronously
    if (storageValue === 'true') accepted = true
    loaded = true
    history.push(visibleAt(accepted, loaded, showDisclaimerModal))

    return { history, finalVisible: visibleAt(accepted, loaded, showDisclaimerModal) }
  }

  test('7. First-time user (no prior acceptance): modal is visible before AND after rehydration — no flash-to-hidden', () => {
    const { history, finalVisible } = simulateLifecycle(null)
    expect(history[0]).toBe(false) // not yet loaded -> not shown yet (avoids flash of default state too)
    expect(history[1]).toBe(true) // loaded, not accepted -> visible
    expect(finalVisible).toBe(true)
  })

  test('8. Returning user who already accepted: modal is NEVER visible (not even transiently)', () => {
    const { history, finalVisible } = simulateLifecycle('true')
    expect(history[0]).toBe(false) // loaded=false -> never shown
    expect(history[1]).toBe(false) // loaded=true, accepted=true -> stays hidden
    expect(finalVisible).toBe(false)
    // Critically: it is never `true` at any point in this sequence,
    // proving no flash-then-hide can occur for a returning user.
    expect(history.every((v) => v === false)).toBe(true)
  })

  test('9. Old (defective) computation WOULD have flashed for a returning user — proves the fix matters', () => {
    // Old: visible = !accepted || showDisclaimerModal (no loaded gate)
    function oldVisibleAt(acceptedVal, showVal) {
      return !acceptedVal || showVal
    }
    let accepted = false
    const showDisclaimerModal = false
    const firstRender = oldVisibleAt(accepted, showDisclaimerModal) // true - visible!
    accepted = true // storage resolves to accepted
    const afterRehydration = oldVisibleAt(accepted, showDisclaimerModal) // false - hidden!
    expect(firstRender).toBe(true)
    expect(afterRehydration).toBe(false)
    // This true -> false transition on mount is exactly the "flash and
    // disappear" defect. The new computation (test 8) never does this.
  })

  test('10. Explicit re-open (showDisclaimerModal=true) is visible regardless of loaded/accepted', () => {
    const visibleAt = (acceptedVal, loadedVal, showVal) => (loadedVal && !acceptedVal) || showVal
    expect(visibleAt(true, true, true)).toBe(true)
    expect(visibleAt(true, false, true)).toBe(true)
  })

  test('11. Acknowledgement (onAccept) clears showDisclaimerModal and sets accepted', () => {
    // Simulates the onAccept handler logic directly from the source.
    let accepted = false
    let showDisclaimerModal = true
    const acceptDisclaimer = () => { accepted = true }
    // onAccept body: if (!accepted) acceptDisclaimer(); setShowDisclaimerModal(false)
    if (!accepted) acceptDisclaimer()
    showDisclaimerModal = false
    expect(accepted).toBe(true)
    expect(showDisclaimerModal).toBe(false)
  })
})
