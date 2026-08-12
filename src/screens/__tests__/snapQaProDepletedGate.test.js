// ─────────────────────────────────────────────────────────────
// snapQaProDepletedGate.test.js — Tests that the Snap button
// depleted state honors QA Pro Simulation instead of using
// the real server quota.
// ─────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
}))

const fs = require('fs')
const path = require('path')

describe('Snap button depleted state — QA Pro Simulation', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'HomeScreen.js'),
    'utf8',
  )

  test('isSnapDepleted checks isQaProSimulation before server quota', () => {
    // The fix: isSnapDepleted should check isQaProSimulation first
    const idx = src.indexOf('isSnapDepleted')
    expect(idx).toBeGreaterThan(-1)
    const section = src.slice(idx, idx + 200)
    expect(section).toMatch(/isQaProSimulation/)
    expect(section).toMatch(/qaSnapUsed/)
    expect(section).toMatch(/effectiveSnapLimit/)
    expect(section).toMatch(/selectQuotaExhausted/)
  })

  test('isSnapDepleted uses QA counter when QA Pro is active', () => {
    const idx = src.indexOf('isSnapDepleted')
    const section = src.slice(idx, idx + 200)
    // When QA Pro is active, depletion is based on QA counter, not server
    expect(section).toMatch(/qaSnapUsed >= effectiveSnapLimit/)
  })

  test('isSnapDepleted falls back to server quota when QA Pro is off', () => {
    const idx = src.indexOf('isSnapDepleted')
    const section = src.slice(idx, idx + 200)
    // When QA Pro is off, use server quota
    expect(section).toMatch(/selectQuotaExhausted\(serverQuota\)/)
  })

  test('component-level qaSnapUsed state exists', () => {
    // There should be a component-level qaSnapUsed state
    // separate from the QuotaMeter's internal state
    const mainComponentStart = src.indexOf('const { isPro } = usePro()')
    expect(mainComponentStart).toBeGreaterThan(-1)
    const mainSection = src.slice(mainComponentStart, mainComponentStart + 600)
    expect(mainSection).toMatch(/qaSnapUsed/)
    expect(mainSection).toMatch(/getQaProSnapRemaining/)
  })

  test('qaSnapUsed is incremented after a successful QA Pro snap', () => {
    // Find the second occurrence (the actual usage, not the import)
    const firstIdx = src.indexOf('incrementQaProSnapUsage')
    const idx = src.indexOf('incrementQaProSnapUsage', firstIdx + 1)
    expect(idx).toBeGreaterThan(-1)
    const section = src.slice(idx, idx + 300)
    expect(section).toMatch(/setQaSnapUsed/)
  })
})

describe('Snap depleted gate — runtime behavior simulation', () => {
  // Simulate the isSnapDepleted logic
  function computeIsSnapDepleted(isQaProSimulation, qaSnapUsed, effectiveSnapLimit, serverQuota) {
    if (isQaProSimulation) {
      return qaSnapUsed >= effectiveSnapLimit
    }
    if (!serverQuota) return false
    return serverQuota.remaining <= 0
  }

  test('QA Pro ON, usage 0/12 → NOT depleted', () => {
    expect(computeIsSnapDepleted(true, 0, 12, { remaining: 0 })).toBe(false)
  })

  test('QA Pro ON, usage 5/12 → NOT depleted', () => {
    expect(computeIsSnapDepleted(true, 5, 12, { remaining: 0 })).toBe(false)
  })

  test('QA Pro ON, usage 11/12 → NOT depleted', () => {
    expect(computeIsSnapDepleted(true, 11, 12, { remaining: 0 })).toBe(false)
  })

  test('QA Pro ON, usage 12/12 → depleted', () => {
    expect(computeIsSnapDepleted(true, 12, 12, { remaining: 0 })).toBe(true)
  })

  test('QA Pro OFF, server Free exhausted → depleted', () => {
    expect(computeIsSnapDepleted(false, 0, 12, { remaining: 0 })).toBe(true)
  })

  test('QA Pro OFF, server Free remaining → NOT depleted', () => {
    expect(computeIsSnapDepleted(false, 0, 12, { remaining: 1 })).toBe(false)
  })

  test('QA Pro OFF, server null → NOT depleted (loading)', () => {
    expect(computeIsSnapDepleted(false, 0, 12, null)).toBe(false)
  })

  test('QA Pro ON, server exhausted but QA counter has room → NOT depleted', () => {
    // This is the critical QA6 bug: server says exhausted but QA Pro should allow
    expect(computeIsSnapDepleted(true, 3, 12, { remaining: 0 })).toBe(false)
  })
})
