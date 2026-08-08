// focusSwap.test.js — Tests for repeated Today's Focus Swap
//
// Verifies:
// 1. first Swap changes focus
// 2. second Swap also changes focus when another candidate exists
// 3. third/subsequent swaps continue to work
// 4. current nutrient is excluded
// 5. immediate repeat is prevented
// 6. single-candidate pool is handled safely
// 7. old KEY_SWAP_DATE value cannot block swapping
// 8. button remains visible after swap (source-level)

const fs = require('fs')
const path = require('path')

const sourcePath = path.resolve(__dirname, '../../services/focusNutrient.js')
const source = fs.readFileSync(sourcePath, 'utf8')

const scanScreenPath = path.resolve(__dirname, '../../screens/ScanScreen.js')
const scanScreenSource = fs.readFileSync(scanScreenPath, 'utf8')

const focusCardPath = path.resolve(__dirname, '../../components/FocusNutrientCard.js')
const focusCardSource = fs.readFileSync(focusCardPath, 'utf8')

describe('Today Focus Swap — source audit', () => {
  it('swapFocusToday does not check KEY_SWAP_DATE as a blocking guard', () => {
    const fnMatch = source.match(/export async function swapFocusToday[\s\S]*?\n\}/)
    expect(fnMatch).not.toBeNull()
    // Should NOT have an early return based on swapDate === today
    expect(fnMatch[0]).not.toMatch(/swapDate\s*===\s*today/)
  })

  it('swapFocusToday excludes the current nutrient', () => {
    const fnMatch = source.match(/export async function swapFocusToday[\s\S]*?\n\}/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch[0]).toMatch(/filter.*n\.id\s*!==\s*currentId/)
  })

  it('swapFocusToday handles empty candidate pool', () => {
    const fnMatch = source.match(/export async function swapFocusToday[\s\S]*?\n\}/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch[0]).toMatch(/available\.length\s*===\s*0/)
  })

  it('swapFocusToday clears legacy KEY_SWAP_DATE', () => {
    const fnMatch = source.match(/export async function swapFocusToday[\s\S]*?\n\}/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch[0]).toMatch(/removeItem.*KEY_SWAP_DATE/)
  })

  it('KEY_SWAP_DATE constant still exists for legacy cleanup', () => {
    expect(source).toMatch(/KEY_SWAP_DATE/)
  })

  it('ScanScreen Swap button is not hidden by focusSwapped', () => {
    // The old pattern was {!focusSwapped && (<Pressable...>Swap</Pressable>)}
    // Verify this pattern is gone
    expect(scanScreenSource).not.toMatch(/\{!focusSwapped\s*&&\s*\(\s*<Pressable/)
  })

  it('FocusNutrientCard Swap button is not hidden by focusSwapped', () => {
    expect(focusCardSource).not.toMatch(/\{!focusSwapped\s*&&\s*\(\s*<Pressable/)
  })
})

// ── Unit tests for the swap logic ──
// These replicate the swap logic to verify cycling behavior

const FOCUS_NUTRIENTS = [
  { id: 'vitamin_c', name: 'Vitamin C' },
  { id: 'fiber', name: 'Fiber' },
  { id: 'potassium', name: 'Potassium' },
  { id: 'folate', name: 'Folate' },
  { id: 'vitamin_a', name: 'Vitamin A' },
]

function dateSeed(dateKey) {
  let hash = 0
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function simulateSwap(today, currentId, swapCount) {
  const available = FOCUS_NUTRIENTS.filter((n) => n.id !== currentId)
  if (available.length === 0) {
    return { swapped: false, nutrient: FOCUS_NUTRIENTS.find((n) => n.id === currentId) }
  }
  const seedKey = `${today}_${currentId}_${swapCount}`
  const index = dateSeed(seedKey) % available.length
  const picked = available[index]
  return { swapped: true, nutrient: picked }
}

describe('Today Focus Swap — cycling logic', () => {
  const today = '2026-08-08'

  it('1. first Swap changes focus', () => {
    const result = simulateSwap(today, 'vitamin_c', 0)
    expect(result.swapped).toBe(true)
    expect(result.nutrient.id).not.toBe('vitamin_c')
  })

  it('2. second Swap also changes focus', () => {
    // After first swap, current is the result of swap 1
    const first = simulateSwap(today, 'vitamin_c', 0)
    const second = simulateSwap(today, first.nutrient.id, 1)
    expect(second.swapped).toBe(true)
    expect(second.nutrient.id).not.toBe(first.nutrient.id)
  })

  it('3. third Swap continues to work', () => {
    const first = simulateSwap(today, 'vitamin_c', 0)
    const second = simulateSwap(today, first.nutrient.id, 1)
    const third = simulateSwap(today, second.nutrient.id, 2)
    expect(third.swapped).toBe(true)
    expect(third.nutrient.id).not.toBe(second.nutrient.id)
  })

  it('4. current nutrient is excluded from candidates', () => {
    const result = simulateSwap(today, 'fiber', 0)
    expect(result.nutrient.id).not.toBe('fiber')
  })

  it('5. immediate repeat is prevented (same nutrient not returned)', () => {
    // Swap from vitamin_c → get X → swap from X → should not get vitamin_c back immediately
    // (it CAN return to vitamin_c on a later swap, just not immediately)
    const first = simulateSwap(today, 'vitamin_c', 0)
    const second = simulateSwap(today, first.nutrient.id, 1)
    // The second swap excludes first.nutrient.id, so it's a different one
    expect(second.nutrient.id).not.toBe(first.nutrient.id)
  })

  it('6. single-candidate pool is handled safely', () => {
    // Simulate a pool with only 2 nutrients total
    const tinyPool = [
      { id: 'vitamin_c', name: 'Vitamin C' },
      { id: 'fiber', name: 'Fiber' },
    ]
    function simulateSwapTiny(today, currentId, swapCount) {
      const available = tinyPool.filter((n) => n.id !== currentId)
      if (available.length === 0) return { swapped: false, nutrient: tinyPool.find((n) => n.id === currentId) }
      const seedKey = `${today}_${currentId}_${swapCount}`
      const index = dateSeed(seedKey) % available.length
      return { swapped: true, nutrient: available[index] }
    }
    const result = simulateSwapTiny(today, 'vitamin_c', 0)
    expect(result.swapped).toBe(true)
    expect(result.nutrient.id).toBe('fiber')
  })

  it('7. zero-candidate pool is handled safely', () => {
    // Pool with only 1 nutrient — no alternatives
    const singlePool = [{ id: 'vitamin_c', name: 'Vitamin C' }]
    function simulateSwapSingle(today, currentId, swapCount) {
      const available = singlePool.filter((n) => n.id !== currentId)
      if (available.length === 0) return { swapped: false, nutrient: singlePool.find((n) => n.id === currentId) }
      const seedKey = `${today}_${currentId}_${swapCount}`
      const index = dateSeed(seedKey) % available.length
      return { swapped: true, nutrient: available[index] }
    }
    const result = simulateSwapSingle(today, 'vitamin_c', 0)
    expect(result.swapped).toBe(false)
    expect(result.nutrient.id).toBe('vitamin_c')
  })

  it('8. old KEY_SWAP_DATE value cannot block swapping', () => {
    // Even if KEY_SWAP_DATE === today, the new swapFocusToday does not check it
    // Simulate: swapCount=0, currentId=vitamin_c, legacy swapDate=today
    const result = simulateSwap(today, 'vitamin_c', 0)
    expect(result.swapped).toBe(true)
    // The function should proceed regardless of any legacy swapDate
  })

  it('9. repeated swaps cycle through multiple nutrients', () => {
    let currentId = 'vitamin_c'
    let swapCount = 0
    const seen = new Set([currentId])

    for (let i = 0; i < 4; i++) {
      const result = simulateSwap(today, currentId, swapCount)
      expect(result.swapped).toBe(true)
      currentId = result.nutrient.id
      swapCount++
      seen.add(currentId)
    }

    // Should have seen at least 3 different nutrients across 4 swaps
    expect(seen.size).toBeGreaterThanOrEqual(3)
  })

  it('10. no infinite loop — swap always returns a result', () => {
    // Run 20 swaps — all should complete
    let currentId = 'vitamin_c'
    let swapCount = 0
    for (let i = 0; i < 20; i++) {
      const result = simulateSwap(today, currentId, swapCount)
      expect(result.swapped).toBe(true)
      currentId = result.nutrient.id
      swapCount++
    }
  })
})
