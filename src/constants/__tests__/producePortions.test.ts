import { PRODUCE_PORTIONS } from '../producePortions'
import { PRODUCE_DATA } from '../../services/JuiceEngine'

const produceDataKeys = Object.keys(PRODUCE_DATA)
const portionKeys = Object.keys(PRODUCE_PORTIONS)

describe('Produce Portion Registry', () => {
  // 1. Coverage
  test('every PRODUCE_DATA key has a PRODUCE_PORTIONS entry', () => {
    for (const key of produceDataKeys) {
      expect(PRODUCE_PORTIONS).toHaveProperty(key)
    }
  })

  // 2. No extras
  test('PRODUCE_PORTIONS has no keys absent from PRODUCE_DATA', () => {
    for (const key of portionKeys) {
      expect(PRODUCE_DATA).toHaveProperty(key)
    }
  })

  // 3. Exact count
  test('registry has exactly 69 records', () => {
    expect(portionKeys.length).toBe(69)
  })

  // 4. Source metadata
  test('every record has at least one sourceRecord', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      expect(record.sourceRecords.length).toBeGreaterThan(0)
    }
  })

  // 5. Positive finite gram weights
  test('all gramWeight values are positive and finite', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      for (const unit of record.units) {
        for (const size of unit.sizes) {
          expect(size.gramWeight).toBeGreaterThan(0)
          expect(Number.isFinite(size.gramWeight)).toBe(true)
        }
      }
    }
  })

  // 6. Size ordering
  test('sizes are ordered small < medium < large by gramWeight', () => {
    const order: Record<string, number> = { small: 0, medium: 1, large: 2, standard: -1 }
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      for (const unit of record.units) {
        for (let i = 1; i < unit.sizes.length; i++) {
          const prev = unit.sizes[i - 1]
          const curr = unit.sizes[i]
          if (order[prev.sizeKey] >= 0 && order[curr.sizeKey] >= 0) {
            expect(order[prev.sizeKey]).toBeLessThan(order[curr.sizeKey])
            expect(prev.gramWeight).toBeLessThan(curr.gramWeight)
          }
        }
      }
    }
  })

  // 7. Default unit resolution
  test('defaultUnitKey resolves to a valid unit or is null', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      if (record.defaultUnitKey !== null) {
        const found = record.units.find((u) => u.unitKey === record.defaultUnitKey)
        expect(found).toBeDefined()
      }
    }
  })

  // 8. No fluid-ounce values
  test('no source mentions fluid ounces', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      for (const sr of record.sourceRecords) {
        expect(sr.sourcePortionDescription).not.toMatch(/fluid\s*ounce|fl\s*oz/i)
        expect(sr.citationText).not.toMatch(/fluid\s*ounce|fl\s*oz/i)
      }
    }
  })

  // 9. No raw/cooked mismatch
  test('all preparationState values contain "raw"', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      for (const sr of record.sourceRecords) {
        expect(sr.preparationState).toMatch(/raw/i)
      }
    }
  })

  // 10. Integer input step
  test('allowDecimal=false requires inputStep=1', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      for (const unit of record.units) {
        if (!unit.allowDecimal) {
          expect(unit.inputStep).toBe(1)
        }
      }
    }
  })

  // 11. Decimal input step
  test('allowDecimal=true requires inputStep > 0', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      for (const unit of record.units) {
        if (unit.allowDecimal) {
          expect(unit.inputStep).toBeGreaterThan(0)
        }
      }
    }
  })

  // 12. Immutability
  test('PRODUCE_PORTIONS is frozen', () => {
    expect(Object.isFrozen(PRODUCE_PORTIONS)).toBe(true)
  })

  // 13. Unit key uniqueness
  test('no duplicate unitKey within a record', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      const keys = record.units.map((u) => u.unitKey)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  // 14. Size key uniqueness
  test('no duplicate sizeKey within a unit', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      for (const unit of record.units) {
        const keys = unit.sizes.map((s) => s.sizeKey)
        expect(new Set(keys).size).toBe(keys.length)
      }
    }
  })

  // 15. Confidence valid
  test('confidence is high, medium, or low', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      expect(['high', 'medium', 'low']).toContain(record.confidence)
    }
  })

  // 16. Authority valid
  test('all sourceRecord authorities are USDA, FDA, or peer-reviewed', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      for (const sr of record.sourceRecords) {
        expect(['USDA', 'FDA', 'peer-reviewed']).toContain(sr.authority)
      }
    }
  })

  // 17. Quantity-supported consistency
  test('quantitySupported=true requires at least one unit', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      if (record.quantitySupported) {
        expect(record.units.length).toBeGreaterThan(0)
      }
    }
  })

  // 18. Weight-only consistency
  test('quantitySupported=false requires zero units', () => {
    for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
      if (!record.quantitySupported) {
        expect(record.units.length).toBe(0)
      }
    }
  })
})
