import { accessibleFeatures, canAccessFeature, type FeatureKey } from '../featureAccess'

const FREE = { isProActive: false }
const PRO = { isProActive: true }

const PRO_ONLY_FEATURES: FeatureKey[] = [
  'advanced_weekly_report',
  'advanced_trends',
  'personalized_challenges',
  'custom_weekly_goals',
  'photo_recaps',
  'advanced_reminders',
  'premium_achievements',
]

describe('canAccessFeature', () => {
  it('grants ai_scan to free users (server enforces quota)', () => {
    expect(canAccessFeature(FREE, 'ai_scan')).toBe(true)
  })

  it('grants ai_scan to pro users', () => {
    expect(canAccessFeature(PRO, 'ai_scan')).toBe(true)
  })

  it.each(PRO_ONLY_FEATURES)('denies %s to free users', (feature) => {
    expect(canAccessFeature(FREE, feature)).toBe(false)
  })

  it.each(PRO_ONLY_FEATURES)('grants %s to pro users', (feature) => {
    expect(canAccessFeature(PRO, feature)).toBe(true)
  })
})

describe('accessibleFeatures', () => {
  it('free users only get free features', () => {
    expect(accessibleFeatures(FREE)).toEqual(['ai_scan'])
  })

  it('pro users get all features', () => {
    expect(accessibleFeatures(PRO)).toHaveLength(8)
  })
})
