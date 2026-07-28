import { accessibleFeatures, canAccessFeature, type FeatureKey } from '../featureAccess'

const FREE = { isProActive: false }
const PRO = { isProActive: true }

describe('canAccessFeature', () => {
  it('grants ai_scan to free users (server enforces quota)', () => {
    expect(canAccessFeature(FREE, 'ai_scan')).toBe(true)
  })

  it('grants ai_scan to pro users', () => {
    expect(canAccessFeature(PRO, 'ai_scan')).toBe(true)
  })
})

describe('accessibleFeatures', () => {
  it('free users only get free features', () => {
    expect(accessibleFeatures(FREE)).toEqual(['ai_scan'])
  })

  it('pro users get all features', () => {
    expect(accessibleFeatures(PRO)).toEqual(['ai_scan'])
  })
})
