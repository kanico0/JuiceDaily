import { getTrafficLight, DIRTY_DOZEN, HIGH_SUGAR_PRODUCE, CLEAN_FIFTEEN } from '../educationContent'

describe('getTrafficLight — caution reason labels', () => {
  describe('High Sugar produce', () => {
    test.each(HIGH_SUGAR_PRODUCE)('shows "High Sugar" for %s (conventional, cold-pressed)', (id) => {
      const result = getTrafficLight(id, { isOrganic: false, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('High Sugar')
      expect(result.status).toBe('caution')
      expect(result.reason).toBe('high-sugar')
      expect(result.color).toBe('red')
    })

    test.each(HIGH_SUGAR_PRODUCE)('shows "High Sugar" for %s even when organic', (id) => {
      const result = getTrafficLight(id, { isOrganic: true, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('High Sugar')
      expect(result.status).toBe('caution')
      expect(result.reason).toBe('high-sugar')
    })

    test('pomegranate specifically shows High Sugar', () => {
      const result = getTrafficLight('pomegranate', { isOrganic: false, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('High Sugar')
      expect(result.reason).toBe('high-sugar')
    })

    test('pomegranate shows High Sugar even when organic', () => {
      const result = getTrafficLight('pomegranate', { isOrganic: true, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('High Sugar')
      expect(result.reason).toBe('high-sugar')
    })
  })

  describe('Conventional Dirty Dozen produce', () => {
    const dirtyOnly = DIRTY_DOZEN.filter((id) => !HIGH_SUGAR_PRODUCE.includes(id))

    test.each(dirtyOnly)('shows "Conventional Concern" for %s (conventional, cold-pressed)', (id) => {
      const result = getTrafficLight(id, { isOrganic: false, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('Conventional Concern')
      expect(result.status).toBe('caution')
      expect(result.reason).toBe('conventional-dirty-dozen')
      expect(result.color).toBe('red')
    })

    test.each(dirtyOnly)('clears concern for %s when organic is toggled on', (id) => {
      const result = getTrafficLight(id, { isOrganic: true, juiceMethod: 'cold_pressed' })
      expect(result.status).not.toBe('caution')
      expect(result.label).toBe('Excellent')
    })

    test('celery (dirty dozen, not high-sugar) shows Conventional Concern when conventional', () => {
      const result = getTrafficLight('celery', { isOrganic: false, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('Conventional Concern')
      expect(result.reason).toBe('conventional-dirty-dozen')
    })

    test('celery clears to Excellent when organic is toggled on', () => {
      const result = getTrafficLight('celery', { isOrganic: true, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('Excellent')
      expect(result.reason).toBeNull()
    })
  })

  describe('High-sugar + Dirty Dozen overlap', () => {
    const overlap = DIRTY_DOZEN.filter((id) => HIGH_SUGAR_PRODUCE.includes(id))

    test.each(overlap)('prioritises "High Sugar" for %s even when conventional', (id) => {
      const result = getTrafficLight(id, { isOrganic: false, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('High Sugar')
      expect(result.reason).toBe('high-sugar')
    })

    test.each(overlap)('still shows "High Sugar" for %s when organic', (id) => {
      const result = getTrafficLight(id, { isOrganic: true, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('High Sugar')
      expect(result.reason).toBe('high-sugar')
    })
  })

  describe('Excellent and Good labels preserved', () => {
    test('organic cold-pressed low-sugar shows Excellent', () => {
      const result = getTrafficLight('carrot', { isOrganic: true, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('Excellent')
      expect(result.status).toBe('excellent')
      expect(result.reason).toBeNull()
    })

    test('conventional Clean 15 cold-pressed shows Good', () => {
      const result = getTrafficLight('avocado', { isOrganic: false, juiceMethod: 'cold_pressed' })
      expect(result.label).toBe('Good')
      expect(result.status).toBe('good')
      expect(result.reason).toBeNull()
    })

    test('organic centrifugal shows Good (not Excellent)', () => {
      const result = getTrafficLight('carrot', { isOrganic: true, juiceMethod: 'centrifugal' })
      expect(result.label).toBe('Good')
      expect(result.status).toBe('good')
    })
  })

  describe('Organic toggle transitions', () => {
    test('toggling organic on a dirty-dozen ingredient clears conventional concern', () => {
      const conventional = getTrafficLight('spinach', { isOrganic: false, juiceMethod: 'cold_pressed' })
      const organic = getTrafficLight('spinach', { isOrganic: true, juiceMethod: 'cold_pressed' })
      expect(conventional.label).toBe('Conventional Concern')
      expect(organic.label).toBe('Excellent')
    })

    test('toggling organic on a high-sugar ingredient does NOT clear high-sugar', () => {
      const conventional = getTrafficLight('pomegranate', { isOrganic: false, juiceMethod: 'cold_pressed' })
      const organic = getTrafficLight('pomegranate', { isOrganic: true, juiceMethod: 'cold_pressed' })
      expect(conventional.label).toBe('High Sugar')
      expect(organic.label).toBe('High Sugar')
    })
  })
})
