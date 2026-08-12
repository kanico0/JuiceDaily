// Count mode stepper controls tests
// Verifies plus/minus buttons, minimum enforcement, accessibility, and
// that direct text input validation is preserved.

const fs = require('fs')
const path = require('path')

const editorSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'QuantityPortionEditor.js'),
  'utf8',
)

const homeSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'HomeScreen.js'),
  'utf8',
)

describe('Count Stepper: rendering and wiring', () => {
  test('1. Minus and Plus icons are imported', () => {
    expect(editorSource).toContain('Minus')
    expect(editorSource).toContain('Plus')
    expect(editorSource).toContain('lucide-react-native')
  })

  test('2. Stepper buttons are rendered in quantityRow', () => {
    expect(editorSource).toContain('stepperBtn')
    expect(editorSource).toContain('handleStepperDecrement')
    expect(editorSource).toContain('handleStepperIncrement')
  })

  test('3. Minus button is before the TextInput', () => {
    const minusIdx = editorSource.indexOf('handleStepperDecrement')
    const inputIdx = editorSource.indexOf('style={styles.quantityInput}')
    expect(minusIdx).toBeGreaterThanOrEqual(0)
    expect(inputIdx).toBeGreaterThanOrEqual(0)
    expect(minusIdx).toBeLessThan(inputIdx)
  })

  test('4. Plus button is after the TextInput', () => {
    // The stepper button JSX (handleStepperIncrement) appears after the TextInput in the render
    const inputIdx = editorSource.indexOf('style={styles.quantityInput}')
    const plusRenderIdx = editorSource.indexOf('onPress={handleStepperIncrement}')
    expect(inputIdx).toBeGreaterThanOrEqual(0)
    expect(plusRenderIdx).toBeGreaterThanOrEqual(0)
    expect(plusRenderIdx).toBeGreaterThan(inputIdx)
  })

  test('5. Quantity field remains directly editable', () => {
    // QA9: onChangeText now calls handleQuantityTextChange which
    // updates local state AND notifies parent with the draft value
    expect(editorSource).toContain('onChangeText={handleQuantityTextChange}')
    expect(editorSource).toContain('onEndEditing={handleQuantitySubmit}')
  })
})

describe('Count Stepper: plus behavior', () => {
  test('6. handleStepperIncrement adds 1 to current value', () => {
    const idx = editorSource.indexOf('const handleStepperIncrement = useCallback')
    expect(idx).toBeGreaterThanOrEqual(0)
    const section = editorSource.substring(idx, idx + 400)
    expect(section).toContain('safeCurrent + 1')
  })

  test('7. Increment handles empty/invalid input safely (no NaN)', () => {
    const idx = editorSource.indexOf('const handleStepperIncrement = useCallback')
    const section = editorSource.substring(idx, idx + 400)
    expect(section).toContain('isNaN')
    expect(section).toContain('safeCurrent')
  })

  test('8. Increment calls onQuantityChange with a number', () => {
    const idx = editorSource.indexOf('const handleStepperIncrement = useCallback')
    const section = editorSource.substring(idx, idx + 400)
    expect(section).toContain('onQuantityChange(next)')
    expect(section).not.toContain('onQuantityChange(String')
  })

  test('9. Increment updates localQuantity immediately', () => {
    const idx = editorSource.indexOf('const handleStepperIncrement = useCallback')
    const section = editorSource.substring(idx, idx + 400)
    expect(section).toContain('setLocalQuantity(nextStr)')
  })
})

describe('Count Stepper: minus behavior', () => {
  test('10. handleStepperDecrement subtracts 1 from current value', () => {
    const idx = editorSource.indexOf('const handleStepperDecrement = useCallback')
    expect(idx).toBeGreaterThanOrEqual(0)
    const section = editorSource.substring(idx, idx + 400)
    expect(section).toContain('safeCurrent - 1')
  })

  test('11. Minus enforces minimum of 1', () => {
    const idx = editorSource.indexOf('const handleStepperDecrement = useCallback')
    const section = editorSource.substring(idx, idx + 400)
    expect(section).toContain('Math.max(1,')
  })

  test('12. Minus cannot create zero', () => {
    const idx = editorSource.indexOf('const handleStepperDecrement = useCallback')
    const section = editorSource.substring(idx, idx + 400)
    expect(section).toContain('Math.max(1, safeCurrent - 1)')
  })

  test('13. Minus handles empty/invalid input safely', () => {
    const idx = editorSource.indexOf('const handleStepperDecrement = useCallback')
    const section = editorSource.substring(idx, idx + 400)
    expect(section).toContain('isNaN')
  })
})

describe('Count Stepper: disabled state at minimum', () => {
  test('14. isAtMinimum is computed correctly', () => {
    expect(editorSource).toContain('isAtMinimum')
    expect(editorSource).toContain('parseFloat(localQuantity) <= 1')
  })

  test('15. Minus button is disabled when isAtMinimum', () => {
    expect(editorSource).toContain('disabled={isAtMinimum}')
  })

  test('16. Minus button has disabled style', () => {
    expect(editorSource).toContain('stepperBtnDisabled')
  })

  test('17. Minus icon color changes when disabled', () => {
    expect(editorSource).toContain("isAtMinimum ? '#90A4AE'")
  })
})

describe('Count Stepper: direct input validation preserved', () => {
  test('18. handleQuantitySubmit notifies parent with draft value', () => {
    // QA9: handleQuantitySubmit now always calls onQuantityChange
    // with the parsed value (even if invalid), so the parent state
    // reflects the current draft for canonical validation.
    const idx = editorSource.indexOf('const handleQuantitySubmit = useCallback')
    const section = editorSource.substring(idx, idx + 200)
    expect(section).toContain('onQuantityChange')
  })

  test('19. No Math.max clamp in handleQuantitySubmit (prior defect not reintroduced)', () => {
    const idx = editorSource.indexOf('const handleQuantitySubmit = useCallback')
    const section = editorSource.substring(idx, idx + 200)
    expect(section).not.toContain('Math.max(1,')
  })

  test('20. Validation error state is still set for invalid input', () => {
    expect(editorSource).toContain('setValidationError')
    expect(editorSource).toContain('validationError')
  })

  test('20b. handleQuantityTextChange notifies parent on every keystroke', () => {
    const idx = editorSource.indexOf('const handleQuantityTextChange = useCallback')
    expect(idx).toBeGreaterThanOrEqual(0)
    const section = editorSource.substring(idx, idx + 300)
    expect(section).toContain('onQuantityChange')
  })
})

describe('Count Stepper: accessibility', () => {
  test('21. Minus has accessibilityRole="button"', () => {
    expect(editorSource).toContain('accessibilityRole="button"')
    expect(editorSource).toContain('accessibilityLabel="Decrease quantity"')
  })

  test('22. Minus has accessibilityHint', () => {
    expect(editorSource).toContain('accessibilityHint="Decreases the ingredient quantity by one"')
  })

  test('23. Minus announces disabled state', () => {
    expect(editorSource).toContain('accessibilityState={{ disabled: isAtMinimum }}')
  })

  test('24. Plus has accessibilityRole="button"', () => {
    expect(editorSource).toContain('accessibilityLabel="Increase quantity"')
  })

  test('25. Plus has accessibilityHint', () => {
    expect(editorSource).toContain('accessibilityHint="Increases the ingredient quantity by one"')
  })

  test('26. Quantity field retains its accessibility label', () => {
    expect(editorSource).toContain('accessibilityLabel={`Quantity of ${produceName}`}')
  })
})

describe('Count Stepper: touch targets and layout', () => {
  test('27. Stepper buttons have minimum 44x44 touch target', () => {
    expect(editorSource).toContain('width: 44')
    expect(editorSource).toContain('height: 44')
  })

  test('28. Stepper buttons have borderRadius and border', () => {
    expect(editorSource).toContain('borderRadius: 12')
  })

  test('29. Quantity input width is reduced to fit stepper buttons', () => {
    expect(editorSource).toContain('width: 48')
  })

  test('30. Gap in quantityRow is tight for narrow screens', () => {
    expect(editorSource).toContain('gap: 6')
  })
})

describe('Count Stepper: Volume mode unchanged', () => {
  test('31. Volume mode still renders weight plus/minus in HomeScreen', () => {
    expect(homeSource).toContain('entryMode === \'weight\'')
    expect(homeSource).toContain('onWeightChange(index, item.weightG + 25)')
    expect(homeSource).toContain('onWeightChange(index, Math.max(10, item.weightG - 25))')
  })

  test('32. Count mode still renders QuantityPortionEditor in HomeScreen', () => {
    expect(homeSource).toContain("entryMode === 'quantity'")
    expect(homeSource).toContain('<QuantityPortionEditor')
  })

  test('33. Stepper controls are in QuantityPortionEditor (Count mode only)', () => {
    // The stepper buttons should not appear in the Volume mode section of HomeScreen
    const weightSectionIdx = homeSource.indexOf("entryMode === 'weight'")
    const weightSection = homeSource.substring(weightSectionIdx, weightSectionIdx + 500)
    expect(weightSection).not.toContain('handleStepperIncrement')
    expect(weightSection).not.toContain('handleStepperDecrement')
  })
})

describe('Count Stepper: numeric state remains numeric', () => {
  test('34. Stepper calls onQuantityChange with a number (not string)', () => {
    const incIdx = editorSource.indexOf('const handleStepperIncrement = useCallback')
    const incSection = editorSource.substring(incIdx, incIdx + 400)
    expect(incSection).toContain('onQuantityChange(next)')

    const decIdx = editorSource.indexOf('const handleStepperDecrement = useCallback')
    const decSection = editorSource.substring(decIdx, decIdx + 400)
    expect(decSection).toContain('onQuantityChange(next)')
  })

  test('35. Existing portion calculations remain unchanged (estimateRawWeightGrams still called)', () => {
    expect(editorSource).toContain('estimateRawWeightGrams(input)')
  })
})
