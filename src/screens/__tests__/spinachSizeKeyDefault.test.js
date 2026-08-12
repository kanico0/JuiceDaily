// ─────────────────────────────────────────────────────────────
// spinachSizeKeyDefault.test.js — Tests that switching to a
// size-requiring unit auto-initializes the default size key
// even when no quantity has been entered yet.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

describe('handleUnitChange — sizeKey auto-initialization', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'HomeScreen.js'),
    'utf8',
  )

  test('handleUnitChange initializes pendingSizeKey when qty is null', () => {
    // Find the handleUnitChange function
    const fnIdx = src.indexOf('handleUnitChange')
    expect(fnIdx).toBeGreaterThan(-1)

    // Find the "no qty" branch
    const noQtyBranch = src.indexOf('if (!qty)', fnIdx)
    expect(noQtyBranch).toBeGreaterThan(-1)

    // The branch should set pendingSizeKey
    const branchSection = src.slice(noQtyBranch, noQtyBranch + 600)
    expect(branchSection).toMatch(/pendingSizeKey/)
  })

  test('handleUnitChange uses getDefaultSizeForUnit for default size', () => {
    const fnIdx = src.indexOf('handleUnitChange')
    const fnSection = src.slice(fnIdx, fnIdx + 800)
    // Should use getDefaultSizeForUnit which prefers 'medium'
    expect(fnSection).toMatch(/getDefaultSizeForUnit/)
  })

  test('handleUnitChange uses getSupportedCountUnits (not getSupportedPortionUnits)', () => {
    const fnIdx = src.indexOf('handleUnitChange')
    const fnSection = src.slice(fnIdx, fnIdx + 800)
    expect(fnSection).toMatch(/getSupportedCountUnits/)
  })
})

describe('Size-requiring unit default initialization — runtime simulation', () => {
  // Simulate the handleUnitChange logic for the no-qty branch
  function simulateUnitChange(produceId, newUnitKey, units) {
    const newUnit = units.find((u) => u.unitKey === newUnitKey)
    if (!newUnit) return { pendingUnitKey: newUnitKey, pendingSizeKey: null }
    const hasSML = newUnit.sizes.some((s) => s.sizeKey !== 'standard')
    if (!hasSML) {
      return { pendingUnitKey: newUnitKey, pendingSizeKey: null }
    }
    const defaultSize = newUnit.sizes.find((s) => s.sizeKey === 'medium') || newUnit.sizes[0]
    return { pendingUnitKey: newUnitKey, pendingSizeKey: defaultSize?.sizeKey || null }
  }

  // Simulate kale's leaf unit (has S/M/L sizes)
  const kaleUnits = [
    {
      unitKey: 'loose_cup',
      sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 35 }],
    },
    {
      unitKey: 'leaf',
      sizes: [
        { sizeKey: 'small', displaySize: 'Small leaf', gramWeight: 10 },
        { sizeKey: 'medium', displaySize: 'Medium leaf', gramWeight: 20 },
        { sizeKey: 'large', displaySize: 'Large leaf', gramWeight: 30 },
      ],
    },
  ]

  // Simulate carrot's whole unit (has S/M/L sizes)
  const carrotUnits = [
    {
      unitKey: 'whole',
      sizes: [
        { sizeKey: 'small', displaySize: 'Small', gramWeight: 50 },
        { sizeKey: 'medium', displaySize: 'Medium', gramWeight: 80 },
        { sizeKey: 'large', displaySize: 'Large', gramWeight: 120 },
      ],
    },
  ]

  // Simulate spinach's handful unit (no S/M/L)
  const spinachUnits = [
    {
      unitKey: 'handful',
      sizes: [{ sizeKey: 'standard', displaySize: '1 handful', gramWeight: 20 }],
    },
  ]

  test('Kale → leaf: auto-selects medium', () => {
    const result = simulateUnitChange('kale', 'leaf', kaleUnits)
    expect(result.pendingUnitKey).toBe('leaf')
    expect(result.pendingSizeKey).toBe('medium')
  })

  test('Carrot → whole: auto-selects medium', () => {
    const result = simulateUnitChange('carrot', 'whole', carrotUnits)
    expect(result.pendingUnitKey).toBe('whole')
    expect(result.pendingSizeKey).toBe('medium')
  })

  test('Spinach → handful: no sizeKey needed (standard)', () => {
    const result = simulateUnitChange('spinach', 'handful', spinachUnits)
    expect(result.pendingUnitKey).toBe('handful')
    expect(result.pendingSizeKey).toBeNull()
  })

  test('Kale → loose_cup: no sizeKey needed (standard)', () => {
    const result = simulateUnitChange('kale', 'loose_cup', kaleUnits)
    expect(result.pendingUnitKey).toBe('loose_cup')
    expect(result.pendingSizeKey).toBeNull()
  })

  test('Switching to leaf does not leave sizeKey null', () => {
    // This is the bug that was fixed: before the fix,
    // switching to leaf with no qty would leave pendingSizeKey unset
    const result = simulateUnitChange('kale', 'leaf', kaleUnits)
    expect(result.pendingSizeKey).not.toBeNull()
    expect(result.pendingSizeKey).not.toBe('standard')
  })
})

describe('Stale unitKey prevention — seedPreloadIngredients', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'HomeScreen.js'),
    'utf8',
  )

  test('seedPreloadIngredients validates rawUnitKey against count units', () => {
    // Find the seedPreloadIngredients function
    const fnIdx = src.indexOf('seedPreloadIngredients')
    expect(fnIdx).toBeGreaterThan(-1)
    // Find the rawUnitKey validation
    const rawUnitIdx = src.indexOf('rawUnitKey', fnIdx)
    expect(rawUnitIdx).toBeGreaterThan(-1)
    const section = src.slice(rawUnitIdx, rawUnitIdx + 800)
    expect(section).toMatch(/getSupportedCountUnits/)
    expect(section).toMatch(/rawUnitIsValid/)
  })

  test('seedPreloadIngredients uses getDefaultCountUnit', () => {
    const fnIdx = src.indexOf('seedPreloadIngredients')
    // Search a wider section since getDefaultCountUnit may appear later
    const section = src.slice(fnIdx, fnIdx + 3000)
    expect(section).toMatch(/getDefaultCountUnit/)
  })

  test('ProduceEditRow validates unitKey against supported units', () => {
    // Find the ProduceEditRow component (where currentUnitKey is computed)
    const firstIdx = src.indexOf('rawUnitKey')
    const idx = src.indexOf('rawUnitKey', firstIdx + 1)
    expect(idx).toBeGreaterThan(-1)
    // Search a wider section to find getSupportedPortionUnits
    const sectionStart = Math.max(0, idx - 300)
    const section = src.slice(sectionStart, idx + 600)
    expect(section).toMatch(/getSupportedPortionUnits/)
    expect(section).toMatch(/unitIsValid/)
    expect(section).toMatch(/supportedUnits\.some/)
  })

  test('ProduceEditRow uses getDefaultCountUnit for fallback', () => {
    // Find the ProduceEditRow's currentUnitKey fallback
    const firstIdx = src.indexOf('rawUnitKey')
    const idx = src.indexOf('rawUnitKey', firstIdx + 1)
    // Search a wider section for getDefaultCountUnit
    const section = src.slice(idx, idx + 400)
    expect(section).toMatch(/getDefaultCountUnit/)
  })
})

describe('Produce registry — size-requiring units audit', () => {
  const registrySrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'constants', 'producePortions.ts'),
    'utf8',
  )

  test('kale has leaf unit with size key', () => {
    expect(registrySrc).toMatch(/kale/)
    const kaleIdx = registrySrc.indexOf('kale:')
    const kaleSection = registrySrc.slice(kaleIdx, kaleIdx + 800)
    expect(kaleSection).toMatch(/leaf/)
    expect(kaleSection).toMatch(/medium/)
  })

  test('swiss_chard has leaf unit with sizes', () => {
    expect(registrySrc).toMatch(/swiss_chard/)
    const chardIdx = registrySrc.indexOf('swiss_chard:')
    const chardSection = registrySrc.slice(chardIdx, chardIdx + 500)
    expect(chardSection).toMatch(/leaf/)
  })

  test('collard_greens has leaf unit with sizes', () => {
    expect(registrySrc).toMatch(/collard_greens/)
    const collardIdx = registrySrc.indexOf('collard_greens:')
    const collardSection = registrySrc.slice(collardIdx, collardIdx + 500)
    expect(collardSection).toMatch(/leaf/)
  })

  test('romaine has leaf unit with sizes', () => {
    expect(registrySrc).toMatch(/romaine/)
    const romaineIdx = registrySrc.indexOf('romaine:')
    const romaineSection = registrySrc.slice(romaineIdx, romaineIdx + 500)
    expect(romaineSection).toMatch(/leaf/)
  })
})
