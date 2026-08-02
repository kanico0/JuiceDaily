// src/screens/__tests__/browseIdeasHookOrder.test.js
// Regression suite for BrowseIdeasModal hook-order crash fix.
// 14 source-level tests verifying no hook is called after the
// `if (!visible) return null` early return in BrowseIdeasModal.
//
// The original crash ("Rendered more hooks than during the previous render")
// was caused by useCallback(handleRecipePress) being called AFTER the early
// return. The fix moved it above.
//
// Source-level testing is used because:
// 1. The bug is a static code-structure issue (hook after conditional return)
// 2. Rendering ScanScreen requires 20+ mocks and Animated.View stubs
// 3. Animated.timing().start() with useNativeDriver creates pending handles
//    that cause Jest to hang
// 4. These tests run in milliseconds with zero hang risk

const fs = require('fs')
const path = require('path')

// ── Source-level static analysis: 14 hook-order regression tests ──
//
// These tests verify the BrowseIdeasModal hook-order fix at the source level.
// The original crash ("Rendered more hooks than during the previous render")
// was caused by useCallback(handleRecipePress) being called AFTER the
// `if (!visible) return null` early return. The fix moved it above.
//
// Source-level testing is the correct strategy here because:
// 1. The bug is a static code-structure issue (hook after conditional return)
// 2. Rendering ScanScreen requires 20+ mocks and Animated.View stubs
// 3. Animated.timing().start() with useNativeDriver creates pending handles
// 4. These tests run in milliseconds with zero hang risk

describe('BrowseIdeasModal — Hook Order Regression (14 tests)', () => {
  const sourcePath = path.resolve(__dirname, '../ScanScreen.js')
  const source = fs.readFileSync(sourcePath, 'utf8')

  // Extract BrowseIdeasModal function body
  const modalStart = source.indexOf('function BrowseIdeasModal(')
  const modalEnd = source.indexOf('const browseStyles = StyleSheet.create')
  const modalSource = source.slice(modalStart, modalEnd)

  const earlyReturnIdx = modalSource.indexOf('if (!visible) return null')
  const beforeReturn = modalSource.slice(0, earlyReturnIdx)
  const afterReturn = modalSource.slice(earlyReturnIdx)

  const hookPattern = /\b(useState|useEffect|useMemo|useCallback|useRef|useContext|useReducer|usePro|useFlags)\b\s*[\n(]/g
  const hooksBefore = beforeReturn.match(hookPattern) || []
  const hooksAfter = afterReturn.match(hookPattern) || []

  // ── Tests 1–2: Overall hook ordering ───────────────────────

  test('1. all hooks are called before the early return in BrowseIdeasModal', () => {
    expect(earlyReturnIdx).toBeGreaterThan(-1)
    expect(hooksAfter).toHaveLength(0)
  })

  test('2. at least 8 hooks are registered before the early return', () => {
    expect(hooksBefore.length).toBeGreaterThanOrEqual(8)
  })

  // ── Tests 3–4: useCallback(handleRecipePress) placement ────

  test('3. useCallback for handleRecipePress is before early return', () => {
    const handlePressIdx = modalSource.indexOf('const handleRecipePress = useCallback')
    expect(handlePressIdx).toBeGreaterThan(-1)
    expect(handlePressIdx).toBeLessThan(earlyReturnIdx)
  })

  test('4. handleRecipePress useCallback appears after all other hooks', () => {
    const handlePressIdx = modalSource.indexOf('const handleRecipePress = useCallback')
    const lastHookBeforeReturn = Math.max(
      ...['useRef', 'useState', 'usePro', 'useFlags', 'useMemo', 'useEffect']
        .map((h) => {
          const idx = beforeReturn.lastIndexOf(h)
          return idx === -1 ? 0 : idx
        })
    )
    expect(handlePressIdx).toBeGreaterThan(lastHookBeforeReturn)
  })

  // ── Tests 5–6: useRef and useState placement ───────────────

  test('5. useRef(fadeAnim) is the first hook in BrowseIdeasModal', () => {
    const useRefIdx = modalSource.indexOf('useRef(new Animated.Value(0))')
    expect(useRefIdx).toBeGreaterThan(-1)
    expect(useRefIdx).toBeLessThan(earlyReturnIdx)
    const firstHookMatch = modalSource.match(/\b(useState|useEffect|useMemo|useCallback|useRef|usePro|useFlags)\b/)
    expect(firstHookMatch[0]).toBe('useRef')
  })

  test('6. both useState calls are before the early return', () => {
    const useStateIndices = []
    let searchIdx = 0
    while (true) {
      const idx = modalSource.indexOf('useState(', searchIdx)
      if (idx === -1) break
      useStateIndices.push(idx)
      searchIdx = idx + 1
    }
    expect(useStateIndices.length).toBeGreaterThanOrEqual(2)
    useStateIndices.forEach((idx) => {
      expect(idx).toBeLessThan(earlyReturnIdx)
    })
  })

  // ── Tests 7–8: usePro and useFlags placement ───────────────

  test('7. usePro() is called before the early return', () => {
    const useProIdx = modalSource.indexOf('usePro()')
    expect(useProIdx).toBeGreaterThan(-1)
    expect(useProIdx).toBeLessThan(earlyReturnIdx)
  })

  test('8. useFlags() is called before the early return', () => {
    const useFlagsIdx = modalSource.indexOf('useFlags()')
    expect(useFlagsIdx).toBeGreaterThan(-1)
    expect(useFlagsIdx).toBeLessThan(earlyReturnIdx)
  })

  // ── Tests 9–10: useMemo and useEffect placement ────────────

  test('9. useMemo(searchResults) is called before the early return', () => {
    const useMemoIdx = modalSource.indexOf('useMemo(')
    expect(useMemoIdx).toBeGreaterThan(-1)
    expect(useMemoIdx).toBeLessThan(earlyReturnIdx)
  })

  test('10. useEffect is called before the early return', () => {
    const useEffectIdx = modalSource.indexOf('useEffect(')
    expect(useEffectIdx).toBeGreaterThan(-1)
    expect(useEffectIdx).toBeLessThan(earlyReturnIdx)
  })

  // ── Tests 11–12: Early return and conditional logic ────────

  test('11. early return `if (!visible) return null` exists in BrowseIdeasModal', () => {
    expect(earlyReturnIdx).toBeGreaterThan(-1)
    expect(modalSource.slice(earlyReturnIdx, earlyReturnIdx + 25)).toContain('return null')
  })

  test('12. no hooks appear between early return and end of component', () => {
    expect(hooksAfter).toHaveLength(0)
  })

  // ── Tests 13–14: Hook order stability across re-renders ────

  test('13. hook call order is deterministic (useRef → useState → useState → useState → useRef → usePro → useFlags → useMemo → useMemo → useEffect → useCallback → useCallback → useEffect → useCallback)', () => {
    const expectedOrder = ['useRef', 'useState', 'useState', 'useState', 'useRef', 'usePro', 'useFlags', 'useMemo', 'useMemo', 'useEffect', 'useCallback', 'useCallback', 'useEffect', 'useCallback']
    const hookCalls = []
    let searchIdx = 0
    while (searchIdx < earlyReturnIdx) {
      const match = modalSource.slice(searchIdx).match(/\b(useState|useEffect|useMemo|useCallback|useRef|usePro|useFlags)\b\s*[\n(]/)
      if (!match) break
      hookCalls.push(match[0].trim().split(/[\n(]/)[0])
      searchIdx += match.index + match[0].length
    }
    expect(hookCalls).toEqual(expectedOrder)
  })

  test('14. handleRecipePress useCallback dependency array includes all required deps', () => {
    const useCallbackBlock = modalSource.slice(
      modalSource.indexOf('const handleRecipePress = useCallback'),
      earlyReturnIdx
    )
    expect(useCallbackBlock).toContain('navigation')
    expect(useCallbackBlock).toContain('onDismiss')
    expect(useCallbackBlock).toContain('hasFeatureAccess')
    expect(useCallbackBlock).toContain('isPaywallDisabled')
    expect(useCallbackBlock).toContain('isPaywallForced')
  })
})
