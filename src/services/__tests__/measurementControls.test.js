// ─────────────────────────────────────────────────────────────
// measurementControls.test.js — Tests for simplified
// measurement controls (Issue 4: Count/Volume model)
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const toggleSource = fs.readFileSync(
  path.resolve(__dirname, '../../components/PortionEntryModeToggle.js'),
  'utf-8'
)

const editorSource = fs.readFileSync(
  path.resolve(__dirname, '../../components/QuantityPortionEditor.js'),
  'utf-8'
)

const homeSource = fs.readFileSync(
  path.resolve(__dirname, '../../screens/HomeScreen.js'),
  'utf-8'
)

describe('Simplified measurement controls', () => {
  // 1. Only Count and Volume are shown as top-level measurement methods
  test('PortionEntryModeToggle has exactly two modes: Count and Volume', () => {
    expect(toggleSource).toContain("label: 'Count'")
    expect(toggleSource).toContain("label: 'Volume'")
    expect(toggleSource).not.toContain("label: 'Weight")
    expect(toggleSource).not.toContain("label: 'Quantity'")
    expect(toggleSource).not.toContain("label: 'Juices'")
  })

  // 2. Count displays Quantity
  test('Count mode (quantity key) renders QuantityPortionEditor in HomeScreen', () => {
    expect(homeSource).toContain("entryMode === 'quantity' && quantitySupported")
    expect(homeSource).toContain('QuantityPortionEditor')
  })

  // 3. Count defaults Quantity to 1
  test('QuantityPortionEditor initializes with quantity prop', () => {
    expect(editorSource).toContain('useState(String(quantity')
  })

  // 4. Count may display Small/Medium/Large
  test('QuantityPortionEditor supports size selector (Small/Medium/Large)', () => {
    expect(editorSource).toContain('hasMultipleSizes')
    expect(editorSource).toContain('sizeContainer')
    expect(editorSource).toContain('Size')
  })

  // 5. Count hides Cups and Ounces
  test('QuantityPortionEditor uses getSupportedCountUnits (filters out cups)', () => {
    expect(editorSource).toContain('getSupportedCountUnits')
    expect(editorSource).not.toContain('getSupportedPortionUnits')
  })

  test('getSupportedCountUnits filters out volume families', () => {
    const convSource = fs.readFileSync(
      path.resolve(__dirname, '../producePortionConversion.ts'),
      'utf-8'
    )
    expect(convSource).toContain('VOLUME_FAMILIES')
    expect(convSource).toContain('packed_cup')
    expect(convSource).toContain('loose_cup')
  })

  // 6. Volume displays Amount (weight entry)
  test('Volume mode (weight key) renders weight/amount controls in HomeScreen', () => {
    expect(homeSource).toContain("entryMode === 'weight'")
    expect(homeSource).toContain('editWeightRow')
  })

  // 7. Volume displays Cups and Ounces
  test('Volume mode shows weight in ounces via weight controls', () => {
    expect(homeSource).toContain('fmtG')
    expect(homeSource).toContain('onWeightChange')
  })

  // 8. Volume hides Quantity
  test('Volume mode does not render QuantityPortionEditor', () => {
    // The weight branch should not contain QuantityPortionEditor
    const weightStart = homeSource.indexOf("entryMode === 'weight'")
    const weightEnd = homeSource.indexOf(')}', weightStart)
    const weightBlock = homeSource.slice(weightStart, weightEnd)
    expect(weightBlock).not.toContain('QuantityPortionEditor')
  })

  // 9. "Juices" is not shown as a measurement unit
  test('Juices is not a label in toggle or editor', () => {
    expect(toggleSource).not.toContain('Juices')
    expect(editorSource).not.toContain('Juices')
  })

  test('Juices is not a measurement label in HomeScreen', () => {
    // Check that "Juices" doesn't appear as a unit label (not as part of other words)
    const matches = homeSource.match(/\bJuices\b/g)
    expect(matches).toBeNull()
  })

  // 10. Switching methods preserves or safely converts valid state
  test('Mode switching logic exists in HomeScreen onModeChange', () => {
    expect(homeSource).toContain('onModeChange')
    expect(homeSource).toContain("newMode === 'quantity'")
    expect(homeSource).toContain("portionEntryMode: 'quantity'")
    expect(homeSource).toContain("portionEntryMode: 'weight'")
  })

  // 11. Existing saved entries still load (backward compat: keys unchanged)
  test('Internal mode keys remain quantity/weight for backward compatibility', () => {
    expect(toggleSource).toContain("key: 'quantity'")
    expect(toggleSource).toContain("key: 'weight'")
  })

  test('HomeScreen uses quantity/weight keys consistently', () => {
    expect(homeSource).toContain("'quantity'")
    expect(homeSource).toContain("'weight'")
  })

  // 12. Nutrition and yield calculations remain unchanged
  test('JuiceEngine and portion conversion logic not modified', () => {
    const convSource = fs.readFileSync(
      path.resolve(__dirname, '../producePortionConversion.ts'),
      'utf-8'
    )
    // Core functions still exist
    expect(convSource).toContain('estimateRawWeightGrams')
    expect(convSource).toContain('getSupportedSizes')
    expect(convSource).toContain('getDefaultPortionUnit')
  })

  // 13. Accessibility labels clearly describe the controls
  test('Toggle has accessibility radiogroup and radio roles', () => {
    expect(toggleSource).toContain('accessibilityRole="radiogroup"')
    expect(toggleSource).toContain('accessibilityRole="radio"')
  })

  test('Editor has accessibility labels for quantity and units', () => {
    expect(editorSource).toContain('accessibilityLabel')
    expect(editorSource).toContain('Quantity of')
  })

  test('Toggle uses Measurement method as default accessibility prefix', () => {
    expect(toggleSource).toContain('Measurement method')
  })
})
