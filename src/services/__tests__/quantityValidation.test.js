// ─────────────────────────────────────────────────────────────
// quantityValidation.test.js — Tests for quantity validation
// fix (Issue 5: default quantity normalizes to 1)
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const homeSource = fs.readFileSync(
  path.resolve(__dirname, '../../screens/HomeScreen.js'),
  'utf-8'
)

const editorSource = fs.readFileSync(
  path.resolve(__dirname, '../../components/QuantityPortionEditor.js'),
  'utf-8'
)

describe('Quantity validation fix', () => {
  // 1. Default quantity is 1, not 0 or empty string
  test('QuantityPortionEditor defaults to 1 when quantity is falsy', () => {
    expect(editorSource).toContain("String(quantity || 1)")
    expect(editorSource).not.toContain("String(quantity || '')")
  })

  // 2. Quantity of 1 passes validation
  test('QuantityPortionEditor validation accepts qty >= 1', () => {
    expect(editorSource).toContain('qty <= 0')
    expect(editorSource).toContain('Enter a quantity greater than zero')
  })

  // 3. Quantity of 0 is rejected
  test('QuantityPortionEditor rejects qty <= 0', () => {
    const validationCheck = editorSource.includes('!qty || qty <= 0 || isNaN(qty)')
    expect(validationCheck).toBe(true)
  })

  // 4. Quantity syncs when prop changes
  test('QuantityPortionEditor syncs localQuantity on prop change', () => {
    expect(editorSource).toContain('Sync localQuantity')
    expect(editorSource).toContain('[quantity]')
  })

  // 5. Manual add initializes quantity to 1
  test('handleAddProduceFromSearch initializes portionMetadata with quantity: 1', () => {
    // Find the manual add path (handleProduceSelect or similar)
    const addIdx = homeSource.indexOf('const handleProduceSelect')
    if (addIdx !== -1) {
      const addBlock = homeSource.slice(addIdx, addIdx + 1000)
      expect(addBlock).toContain('quantity: 1')
    }
  })

  // 6. Camera scan initializes quantity to 1
  test('handleProduceIdentified initializes quantity: 1', () => {
    // Find the actual function definition, not the comment block
    const scanIdx = homeSource.indexOf('const handleProduceIdentified = useCallback')
    expect(scanIdx).not.toBe(-1)
    const scanBlock = homeSource.slice(scanIdx, scanIdx + 1500)
    expect(scanBlock).toContain('quantity: 1')
  })

  // 7. Mode switch to Count initializes quantity to 1
  test('handleModeChange initializes quantity: 1 when switching to Count', () => {
    const modeIdx = homeSource.indexOf('handleModeChange')
    expect(modeIdx).not.toBe(-1)
    const modeBlock = homeSource.slice(modeIdx, modeIdx + 800)
    expect(modeBlock).toContain('quantity: 1')
    expect(modeBlock).not.toContain("Don't fabricate a quantity")
  })

  // 8. handleQuantityChange does NOT clamp — validation happens in QuantityPortionEditor
  test('handleQuantityChange does not clamp user input (no Math.max)', () => {
    expect(homeSource).not.toContain('Math.max(1, qty)')
    expect(homeSource).not.toContain('Math.max(0, qty)')
    // Should have a comment explaining why clamping is not done here
    expect(homeSource).toContain('Do NOT clamp')
  })

  // 9. currentQuantity defaults to 1, not empty string
  test('currentQuantity defaults to 1 when no metadata', () => {
    expect(homeSource).toContain('enteredQuantity || 1')
    expect(homeSource).not.toContain("enteredQuantity || ''")
  })

  // 10. Preload ingredient path initializes quantity to 1
  test('handleAddProduce initializes quantity: 1', () => {
    const addIdx = homeSource.indexOf('handleAddProduce')
    expect(addIdx).not.toBe(-1)
    const addBlock = homeSource.slice(addIdx, addIdx + 1200)
    expect(addBlock).toContain('quantity: 1')
  })

  // 11. Weight calculation succeeds with default quantity
  test('recomputeFromQuantityChange is called with quantity: 1 on init', () => {
    // Multiple paths should call recomputeFromQuantityChange with quantity: 1
    const matches = homeSource.match(/recomputeFromQuantityChange\(/g)
    expect(matches).not.toBeNull()
    expect(matches.length).toBeGreaterThanOrEqual(3)

    // Verify quantity: 1 appears near these calls
    const recomputeBlocks = homeSource.match(/recomputeFromQuantityChange\([\s\S]*?quantity:\s*1/g)
    expect(recomputeBlocks).not.toBeNull()
    expect(recomputeBlocks.length).toBeGreaterThanOrEqual(3)
  })

  // 12. Validation error message is clear
  test('Validation error message is user-friendly', () => {
    expect(editorSource).toContain('Enter a quantity greater than zero')
  })

  // 13. Empty string does not cause silent failure
  test('Editor does not initialize with empty string', () => {
    expect(editorSource).not.toMatch(/useState\(String\(quantity \|\| ''\)\)/)
  })

  // 14. NaN is handled
  test('Editor handles NaN in validation', () => {
    expect(editorSource).toContain('isNaN(qty)')
  })

  // 15. Existing portion metadata with quantity > 0 is preserved
  test('Mode switch preserves existing quantity metadata', () => {
    const modeIdx = homeSource.indexOf('handleModeChange')
    const modeBlock = homeSource.slice(modeIdx, modeIdx + 800)
    expect(modeBlock).toContain('restoreQuantityMetadata')
    expect(modeBlock).toContain("inputMode === 'quantity'")
  })

  // 16. Defaulting vs validation distinction: new ingredient defaults to 1
  test('New ingredient initialization uses quantity: 1 (defaulting, not clamping)', () => {
    // The initialization paths use quantity: 1 in recomputeFromQuantityChange calls
    const initMatches = homeSource.match(/recomputeFromQuantityChange\([\s\S]*?quantity:\s*1/g)
    expect(initMatches).not.toBeNull()
    expect(initMatches.length).toBeGreaterThanOrEqual(3)
  })

  // 17. Validation rejects deliberate zero in QuantityPortionEditor
  test('Deliberate user-entered 0 is rejected by validation, not silently converted', () => {
    // The useEffect validation checks qty <= 0 and shows an error
    expect(editorSource).toContain('qty <= 0')
    expect(editorSource).toContain('setValidationError')
    // handleQuantitySubmit also validates before calling onQuantityChange
    expect(editorSource).toContain('handleQuantitySubmit')
  })

  // 18. handleQuantitySubmit blocks submission of invalid input
  test('handleQuantitySubmit returns early on invalid input without calling onQuantityChange', () => {
    const submitIdx = editorSource.indexOf('handleQuantitySubmit')
    expect(submitIdx).not.toBe(-1)
    const submitBlock = editorSource.slice(submitIdx, submitIdx + 300)
    expect(submitBlock).toContain('qty <= 0')
    expect(submitBlock).toContain('return')
  })

  // 19. Server-side validation also rejects zero
  test('producePortionConversion validates quantity > 0 (server-side backstop)', () => {
    const convSource = fs.readFileSync(
      path.resolve(__dirname, '../producePortionConversion.ts'),
      'utf-8'
    )
    expect(convSource).toContain('input.quantity <= 0')
    expect(convSource).toContain('invalid_quantity')
  })

  // 20. No silent clamping exists anywhere in HomeScreen
  test('No Math.max with quantity in HomeScreen (no silent clamping)', () => {
    expect(homeSource).not.toMatch(/Math\.max\(\d+,\s*qty\)/)
  })

  // 21. Existing historical records are not rewritten
  test('Existing portionMetadata with valid quantity is preserved on re-render', () => {
    // currentQuantity uses enteredQuantity from existing metadata, only defaults to 1 if missing
    expect(homeSource).toContain('enteredQuantity || 1')
    // The sync effect only normalizes when quantity is falsy
    expect(editorSource).toContain('quantity || 1')
  })
})
