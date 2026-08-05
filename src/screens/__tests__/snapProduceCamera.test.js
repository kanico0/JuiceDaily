// Snap Produce camera eligibility tests
// Verifies the deterministic attemptCameraOpen behavior:
//   - Confirmed eligible quota opens camera
//   - Confirmed exhausted quota shows snap gate
//   - Null quota invokes refreshQuota() and uses returned snapshot
//   - Successful refresh with remaining quota opens camera
//   - Successful refresh showing exhaustion displays snap gate
//   - Failed quota refresh shows network/retry alert (not snap gate)
//   - Eligibility network failure shows network/retry alert (not snap gate)
//   - No setTimeout(0) or ref synchronization for quota
//   - In-flight guard prevents duplicate taps and resets in finally
//   - Camera open/cancel/permission denial consumes zero scans
//   - Manual entry unaffected

const fs = require('fs')
const path = require('path')

const homeSource = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8',
)

const coordinatorSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'cameraEligibilityCoordinator.ts'),
  'utf8',
)

const quotaStoreSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'quota', 'QuotaStore.tsx'),
  'utf8',
)

const selectorSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'subscriptions', 'subscriptionSelectors.ts'),
  'utf8',
)

// Helper: extract attemptCameraOpen function body
function getAttemptCameraOpenSection () {
  const idx = homeSource.indexOf('const attemptCameraOpen = useCallback')
  return homeSource.substring(idx, idx + 8000)
}

describe('Snap Produce: button wiring', () => {
  test('1. SnapButton is rendered with onPress={handleSnap}', () => {
    expect(homeSource).toContain('<SnapButton onPress={handleSnap}')
  })

  test('2. handleSnap calls attemptCameraOpen(false)', () => {
    const idx = homeSource.indexOf('const handleSnap = useCallback')
    const section = homeSource.substring(idx, idx + 200)
    expect(section).toContain('attemptCameraOpen(false)')
  })

  test('3. handleSnap triggers haptic feedback', () => {
    const idx = homeSource.indexOf('const handleSnap = useCallback')
    const section = homeSource.substring(idx, idx + 200)
    expect(section).toContain('Haptics.impactAsync')
  })
})

describe('Snap Produce: null quota invokes refreshQuota', () => {
  const section = getAttemptCameraOpenSection()

  test('4. Null quota triggers refreshQuota() call', () => {
    expect(section).toContain('refreshQuota()')
  })

  test('5. refreshQuota is only called when serverQuota is null and Supabase is configured', () => {
    expect(section).toContain('currentQuota === null')
    expect(section).toContain('SUPABASE_CONFIGURED')
  })

  test('6. After refresh, returned snapshot is used directly (no ref, wrapped in timeout)', () => {
    expect(section).toContain('currentQuota = await Promise.race([')
    expect(section).toContain('refreshQuota()')
    expect(homeSource).not.toContain('latestQuotaRef')
    // setTimeout is now intentionally used for the camera timeout safety net
    expect(section).toContain('CAMERA_TIMEOUT_MS')
  })

  test('7. Does not invent remaining usage (no optimistic effectiveRemaining = 1)', () => {
    expect(section).not.toContain('effectiveRemaining')
    expect(section).not.toContain('quotaLoaded ? filmRollRemaining : 1')
  })

  test('7a. Camera timeout uses Promise.race with setTimeout safety net', () => {
    // setTimeout is intentionally used as a timeout safety net for refreshQuota
    expect(section).toMatch(/Promise\.race/)
    expect(section).toContain('CAMERA_TIMEOUT_MS')
  })
})

describe('Snap Produce: confirmed eligible quota opens camera', () => {
  const section = getAttemptCameraOpenSection()

  test('8. Uses selectFilmRollRemaining for actual remaining count', () => {
    expect(section).toContain('selectFilmRollRemaining(currentQuota)')
  })

  test('9. Uses selectFilmRollIsPro for actual pro status', () => {
    expect(section).toContain('selectFilmRollIsPro(currentQuota)')
  })

  test('10. open_camera action sets isCameraOpen to true', () => {
    expect(section).toContain("result.action === 'open_camera'")
    expect(section).toContain('setIsCameraOpen(true)')
  })
})

describe('Snap Produce: confirmed exhausted quota shows snap gate', () => {
  const section = getAttemptCameraOpenSection()

  test('11. show_snap_gate action sets showSnapGate to true', () => {
    expect(section).toContain("result.action === 'show_snap_gate'")
    expect(section).toContain('setShowSnapGate(true)')
  })

  test('12. Snap gate is only shown for confirmed exhaustion, not network errors', () => {
    const catchIdx = section.indexOf('catch (e)')
    const catchSection = section.substring(catchIdx, catchIdx + 500)
    expect(catchSection).not.toContain('setShowSnapGate(true)')
  })
})

describe('Snap Produce: network/retry behavior for unresolved quota', () => {
  const section = getAttemptCameraOpenSection()

  test('13. Null quota after failed refresh shows Alert.alert (not snap gate)', () => {
    expect(section).toContain('Alert.alert')
    expect(section).toContain('Unable to Check Access')
  })

  test('14. Retry alert has Cancel and Try Again buttons', () => {
    expect(section).toContain("'Try Again'")
    expect(section).toContain("'Cancel'")
  })

  test('15. Try Again button calls attemptCameraOpen for retry', () => {
    expect(section).toContain('attemptCameraOpen(isAutoOpen)')
  })
})

describe('Snap Produce: error classification — network errors are not quota exhaustion', () => {
  const section = getAttemptCameraOpenSection()

  test('16. catch block shows Alert.alert, not setShowSnapGate', () => {
    const catchIdx = section.indexOf('catch (e)')
    const catchSection = section.substring(catchIdx, catchIdx + 500)
    expect(catchSection).toContain('Alert.alert')
    expect(catchSection).not.toContain('setShowSnapGate')
  })

  test('17. result.action === error shows Alert.alert, not snap gate', () => {
    const authResumeIdx = section.indexOf("result.action === 'show_auth_resume'")
    const afterAuthResume = section.substring(authResumeIdx, authResumeIdx + 500)
    expect(afterAuthResume).toContain("'error'")
    expect(afterAuthResume).toContain('Alert.alert')
  })

  test('18. catch block logs diagnostic warning without secrets', () => {
    const catchIdx = section.indexOf('catch (e)')
    const catchSection = section.substring(catchIdx, catchIdx + 500)
    expect(catchSection).toContain('console.warn')
    expect(catchSection).toContain('[Camera]')
  })
})

describe('Snap Produce: in-flight guard behavior', () => {
  const section = getAttemptCameraOpenSection()

  test('19. cameraInFlightRef prevents duplicate entry', () => {
    expect(section).toContain('cameraInFlightRef.current')
    expect(section).toContain('if (cameraInFlightRef.current) return')
  })

  test('20. cameraInFlightRef is set to true at start', () => {
    expect(section).toContain('cameraInFlightRef.current = true')
  })

  test('21. cameraInFlightRef is reset in finally block', () => {
    expect(section).toContain('finally {')
    expect(section).toContain('cameraInFlightRef.current = false')
  })

  test('21a. isPreparingCamera is reset in finally block as safety net', () => {
    const finallyIdx = section.indexOf('finally {')
    const finallySection = section.substring(finallyIdx, finallyIdx + 400)
    expect(finallySection).toContain('setIsPreparingCamera(false)')
  })

  test('22. try/catch/finally structure is complete', () => {
    expect(section).toContain('try {')
    expect(section).toContain('catch (e)')
    expect(section).toContain('finally {')
  })
})

describe('Snap Produce: camera modal and zero scan consumption', () => {
  test('23. Camera is controlled by isCameraOpen state in a Modal', () => {
    expect(homeSource).toContain('visible={isCameraOpen}')
  })

  test('24. Camera modal has onRequestClose={handleCameraClose}', () => {
    expect(homeSource).toContain('onRequestClose={handleCameraClose}')
  })

  test('25. handleCameraClose sets isCameraOpen to false', () => {
    const idx = homeSource.indexOf('const handleCameraClose = useCallback')
    const section = homeSource.substring(idx, idx + 200)
    expect(section).toContain('setIsCameraOpen(false)')
  })

  test('26. Opening camera does not call applySnapshot or recordSnapUsage', () => {
    const section = getAttemptCameraOpenSection()
    expect(section).not.toContain('applySnapshot')
    expect(section).not.toContain('recordSnapUsage')
  })

  test('27. handleCameraClose does not call applySnapshot or recordSnapUsage', () => {
    const idx = homeSource.indexOf('const handleCameraClose = useCallback')
    const section = homeSource.substring(idx, idx + 200)
    expect(section).not.toContain('applySnapshot')
    expect(section).not.toContain('recordSnapUsage')
  })
})

describe('Snap Produce: coordinator actions preserved', () => {
  test('28. Coordinator returns open_camera for eligible users', () => {
    expect(coordinatorSource).toContain("'open_camera'")
  })

  test('29. Coordinator returns show_snap_gate for exhausted users', () => {
    expect(coordinatorSource).toContain("'show_snap_gate'")
  })

  test('30. Coordinator returns show_account_gate for guest journey completed', () => {
    expect(coordinatorSource).toContain("'show_account_gate'")
  })

  test('31. Coordinator returns show_auth_resume for in-progress guest sessions', () => {
    expect(coordinatorSource).toContain("'show_auth_resume'")
  })

  test('32. Coordinator returns error for network/server failures', () => {
    expect(coordinatorSource).toContain("'error'")
  })
})

describe('Snap Produce: QuotaStore refresh behavior', () => {
  test('33. refreshQuota returns Promise<ScanQuotaSnapshot | null> and updates quota state', () => {
    expect(quotaStoreSource).toContain('Promise<ScanQuotaSnapshot | null>')
  })

  test('34. refreshQuota calls fetchScanQuota and setQuota', () => {
    expect(quotaStoreSource).toContain('fetchScanQuota')
    expect(quotaStoreSource).toContain('setQuota(snapshot)')
  })

  test('35. refreshQuota keeps last known snapshot on failure', () => {
    expect(quotaStoreSource).toContain('Keep the last known snapshot on failure')
  })

  test('36. refreshQuota returns early if SUPABASE_CONFIGURED is false', () => {
    expect(quotaStoreSource).toContain('if (!SUPABASE_CONFIGURED) return null')
  })

  test('36a. refreshQuota returns the fetched snapshot on success', () => {
    expect(quotaStoreSource).toContain('return snapshot || null')
  })

  test('36b. refreshQuota returns null on catch failure', () => {
    expect(quotaStoreSource).toContain('return null')
  })

  test('36c. refreshQuota return type is declared in interface', () => {
    expect(quotaStoreSource).toContain('refresh: () => Promise<ScanQuotaSnapshot | null>')
  })
})

describe('Snap Produce: selectors return defaults for null quota', () => {
  test('37. selectFilmRollRemaining returns 0 for null quota', () => {
    expect(selectorSource).toContain('if (!quota) return 0')
  })

  test('38. selectFilmRollIsPro returns false for null quota', () => {
    expect(selectorSource).toContain('if (!quota) return false')
  })
})

describe('Snap Produce: latestQuotaRef removed (deterministic refresh)', () => {
  test('39. latestQuotaRef is not present in HomeScreen', () => {
    expect(homeSource).not.toContain('latestQuotaRef')
  })

  test('40. No useRef for serverQuota synchronization', () => {
    expect(homeSource).not.toContain('useRef(serverQuota)')
  })
})

describe('Snap Produce: auth resume flow preserved', () => {
  test('41. show_account_gate sets accountGateMode to guest', () => {
    const section = getAttemptCameraOpenSection()
    expect(section).toContain("setAccountGateMode('guest')")
  })

  test('42. show_auth_resume sets accountGateMode to signin', () => {
    const section = getAttemptCameraOpenSection()
    expect(section).toContain("setAccountGateMode('signin')")
  })

  test('43. Both auth gates set pendingCameraOpenRef for retry after auth', () => {
    const section = getAttemptCameraOpenSection()
    expect(section).toContain('pendingCameraOpenRef.current = true')
  })
})

describe('Snap Produce: handleSnap still wired (not overwritten)', () => {
  test('44. handleSnap is defined exactly once', () => {
    const matches = homeSource.match(/const handleSnap = useCallback/g)
    expect(matches).toBeTruthy()
    expect(matches.length).toBe(1)
  })

  test('45. attemptCameraOpen is defined exactly once', () => {
    const matches = homeSource.match(/const attemptCameraOpen = useCallback/g)
    expect(matches).toBeTruthy()
    expect(matches.length).toBe(1)
  })
})

describe('Snap Produce: dependency array correctness', () => {
  test('46. attemptCameraOpen depends on serverQuota and refreshQuota', () => {
    const section = getAttemptCameraOpenSection()
    expect(section).toContain('[serverQuota, refreshQuota]')
  })

  test('47. attemptCameraOpen does not depend on filmRollRemaining or filmRollIsPro', () => {
    const section = getAttemptCameraOpenSection()
    // Extract just the dependency array — Prettier may format as multi-line
    const depMatch = section.match(/\[([^\]]*serverQuota[^\]]*)\]/)
    expect(depMatch).toBeTruthy()
    const depArray = depMatch[1]
    expect(depArray).not.toContain('filmRollRemaining')
    expect(depArray).not.toContain('filmRollIsPro')
  })
})

describe('Snap Produce: manual entry unaffected', () => {
  test('48. Manual mode toggle is still present', () => {
    expect(homeSource).toContain('isManualMode')
    expect(homeSource).toContain('setIsManualMode')
  })

  test('49. Manual add handler is still present', () => {
    expect(homeSource).toContain('handleManualAdd')
  })

  test('50. Manual entry does not call attemptCameraOpen', () => {
    const idx = homeSource.indexOf('const handleManualAdd = useCallback')
    const section = homeSource.substring(idx, idx + 300)
    expect(section).not.toContain('attemptCameraOpen')
  })
})

describe('Snap Produce: SUPABASE_CONFIGURED import', () => {
  test('51. SUPABASE_CONFIGURED is imported from subscriptionConfig', () => {
    expect(homeSource).toContain('SUPABASE_CONFIGURED')
    expect(homeSource).toContain('subscriptionConfig')
  })
})

describe('Snap Produce: no empty catch blocks', () => {
  test('52. catch block has meaningful content (Alert.alert and console.warn)', () => {
    const section = getAttemptCameraOpenSection()
    const catchIdx = section.indexOf('catch (e)')
    const catchSection = section.substring(catchIdx, catchIdx + 800)
    expect(catchSection).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/)
    expect(catchSection).toContain('Alert.alert')
    expect(catchSection).toContain('console.warn')
  })
})
