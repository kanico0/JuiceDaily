import fs from 'fs'
import path from 'path'

const HOME_SRC = fs.readFileSync(path.join(__dirname, '..', 'HomeScreen.js'), 'utf8')

describe('Issue 1 — Juice Snap ingredient controls stacked vertically', () => {
  describe('statusLabelRow style', () => {
    test('statusLabelRow style is defined', () => {
      expect(HOME_SRC).toContain('statusLabelRow:')
    })

    test('statusLabelRow uses flexDirection row for inline badge', () => {
      expect(HOME_SRC).toContain("statusLabelRow: {\n    flexDirection: 'row'")
    })

    test('statusLabelRow uses flexWrap to avoid overflow', () => {
      const styleBlock = HOME_SRC.match(/statusLabelRow: \{[^}]+\}/)
      expect(styleBlock).toBeTruthy()
      expect(styleBlock[0]).toContain('flexWrap')
    })
  })

  describe('organicRow style', () => {
    test('organicRow style is defined', () => {
      expect(HOME_SRC).toContain('organicRow:')
    })

    test('organicRow uses flexDirection row', () => {
      expect(HOME_SRC).toContain("organicRow: {\n    flexDirection: 'row'")
    })
  })

  describe('adjustmentRow style', () => {
    test('adjustmentRow style is defined', () => {
      expect(HOME_SRC).toContain('adjustmentRow:')
    })

    test('adjustmentRow uses flexDirection row', () => {
      expect(HOME_SRC).toContain("adjustmentRow: {\n    flexDirection: 'row'")
    })

    test('adjustmentRow uses flexWrap to avoid overflow', () => {
      const styleBlock = HOME_SRC.match(/adjustmentRow: \{[^}]+\}/)
      expect(styleBlock).toBeTruthy()
      expect(styleBlock[0]).toContain('flexWrap')
    })

    test('adjustmentRow uses gap for spacing', () => {
      const styleBlock = HOME_SRC.match(/adjustmentRow: \{[^}]+\}/)
      expect(styleBlock).toBeTruthy()
      expect(styleBlock[0]).toContain('gap')
    })
  })

  describe('removeRow style', () => {
    test('removeRow style is defined', () => {
      expect(HOME_SRC).toContain('removeRow:')
    })

    test('removeRow uses flexDirection row', () => {
      expect(HOME_SRC).toContain("removeRow: {\n    flexDirection: 'row'")
    })
  })

  describe('vertical stacking in weight mode', () => {
    test('TrafficLightBadge is in its own statusLabelRow View', () => {
      expect(HOME_SRC).toContain('styles.statusLabelRow')
      expect(HOME_SRC).toContain('<TrafficLightBadge')
    })

    test('organic toggle is in its own organicRow View', () => {
      expect(HOME_SRC).toContain('styles.organicRow')
    })

    test('weight controls are in adjustmentRow View', () => {
      expect(HOME_SRC).toContain('styles.adjustmentRow')
    })

    test('remove button is inside adjustmentRow, not in editControlsRow', () => {
      const adjustmentBlock = HOME_SRC.match(/adjustmentRow[\s\S]*?editRemoveBtn[\s\S]*?\}\)/)
      expect(adjustmentBlock).toBeTruthy()
    })

    test('editControlsRow is no longer used for weight mode controls', () => {
      const weightSection = HOME_SRC.match(/entryMode === 'weight'[\s\S]*?\n      \)/)
      expect(weightSection).toBeTruthy()
      expect(weightSection[0]).not.toContain('editControlsRow')
    })
  })

  describe('vertical stacking in quantity mode', () => {
    test('TrafficLightBadge is in statusLabelRow for quantity mode', () => {
      const quantitySection = HOME_SRC.match(
        /entryMode === 'quantity' && quantitySupported[\s\S]*?statusLabelRow/,
      )
      expect(quantitySection).toBeTruthy()
    })

    test('organic toggle is in organicRow for quantity mode', () => {
      const quantitySection = HOME_SRC.match(
        /entryMode === 'quantity' && quantitySupported[\s\S]*?organicRow/,
      )
      expect(quantitySection).toBeTruthy()
    })

    test('QuantityPortionEditor is in editQuantityContainer, not editControlsRow', () => {
      const quantitySection = HOME_SRC.match(
        /entryMode === 'quantity' && quantitySupported[\s\S]*?QuantityPortionEditor/,
      )
      expect(quantitySection).toBeTruthy()
      expect(quantitySection[0]).not.toContain('editControlsRow')
    })

    test('remove button is in removeRow for quantity mode', () => {
      const removeSection = HOME_SRC.match(
        /entryMode === 'quantity' && quantitySupported[\s\S]*?removeRow[\s\S]*?editRemoveBtn/,
      )
      expect(removeSection).toBeTruthy()
    })
  })

  describe('no horizontal overflow', () => {
    test('organicBtn does not have marginRight (no horizontal squeeze)', () => {
      const organicBtnBlock = HOME_SRC.match(/organicBtn: \{[^}]+\}/)
      expect(organicBtnBlock).toBeTruthy()
      expect(organicBtnBlock[0]).not.toContain('marginRight')
    })

    test('editWeightRow does not have marginRight (parent uses gap)', () => {
      const editWeightRowBlock = HOME_SRC.match(/editWeightRow: \{[^}]+\}/)
      expect(editWeightRowBlock).toBeTruthy()
      expect(editWeightRowBlock[0]).not.toContain('marginRight')
    })
  })
})
