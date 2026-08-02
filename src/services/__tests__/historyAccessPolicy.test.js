// ─────────────────────────────────────────────────────────────
// historyAccessPolicy.test.js — Tests for the centralized
// history access policy helper.
//
// Covers:
//   1-10.  Pro user access (all features unlocked)
//   11-20. Free preview access (newest entry)
//   21-30. Free locked access (older entries)
//   31-35. getAccessType helper
//   36-40. getEntryPosition helper
//   41-45. Edge cases and immutability
// ─────────────────────────────────────────────────────────────

import {
  getHistoryAccessPolicy,
  getAccessType,
  getEntryPosition,
} from '../historyAccessPolicy'

describe('historyAccessPolicy — Pro user', () => {
  const policy = getHistoryAccessPolicy(true, false)

  test('1. isPro is true', () => {
    expect(policy.isPro).toBe(true)
  })

  test('2. isAdvancedPreview is false', () => {
    expect(policy.isAdvancedPreview).toBe(false)
  })

  test('3. canViewBasicHistory is true', () => {
    expect(policy.canViewBasicHistory).toBe(true)
  })

  test('4. canViewAdvancedDetails is true', () => {
    expect(policy.canViewAdvancedDetails).toBe(true)
  })

  test('5. canMakeAgain is true', () => {
    expect(policy.canMakeAgain).toBe(true)
  })

  test('6. shouldShowPreviewBadge is false', () => {
    expect(policy.shouldShowPreviewBadge).toBe(false)
  })

  test('7. shouldShowPreviewExplanation is false', () => {
    expect(policy.shouldShowPreviewExplanation).toBe(false)
  })

  test('8. shouldShowAdvancedUpgrade is false', () => {
    expect(policy.shouldShowAdvancedUpgrade).toBe(false)
  })

  test('9. shouldShowMakeAgainUpgrade is false', () => {
    expect(policy.shouldShowMakeAgainUpgrade).toBe(false)
  })

  test('10. Pro policy is same even if isAdvancedPreview is true', () => {
    const policy2 = getHistoryAccessPolicy(true, true)
    expect(policy2.isPro).toBe(true)
    expect(policy2.isAdvancedPreview).toBe(false)
    expect(policy2.canViewAdvancedDetails).toBe(true)
  })
})

describe('historyAccessPolicy — Free preview (newest)', () => {
  const policy = getHistoryAccessPolicy(false, true)

  test('11. isPro is false', () => {
    expect(policy.isPro).toBe(false)
  })

  test('12. isAdvancedPreview is true', () => {
    expect(policy.isAdvancedPreview).toBe(true)
  })

  test('13. canViewBasicHistory is true', () => {
    expect(policy.canViewBasicHistory).toBe(true)
  })

  test('14. canViewAdvancedDetails is true', () => {
    expect(policy.canViewAdvancedDetails).toBe(true)
  })

  test('15. canMakeAgain is true', () => {
    expect(policy.canMakeAgain).toBe(true)
  })

  test('16. shouldShowPreviewBadge is true', () => {
    expect(policy.shouldShowPreviewBadge).toBe(true)
  })

  test('17. shouldShowPreviewExplanation is true', () => {
    expect(policy.shouldShowPreviewExplanation).toBe(true)
  })

  test('18. shouldShowAdvancedUpgrade is false', () => {
    expect(policy.shouldShowAdvancedUpgrade).toBe(false)
  })

  test('19. shouldShowMakeAgainUpgrade is false', () => {
    expect(policy.shouldShowMakeAgainUpgrade).toBe(false)
  })

  test('20. Preview has full advanced access like Pro', () => {
    expect(policy.canViewAdvancedDetails).toBe(getHistoryAccessPolicy(true, false).canViewAdvancedDetails)
  })
})

describe('historyAccessPolicy — Free locked (older)', () => {
  const policy = getHistoryAccessPolicy(false, false)

  test('21. isPro is false', () => {
    expect(policy.isPro).toBe(false)
  })

  test('22. isAdvancedPreview is false', () => {
    expect(policy.isAdvancedPreview).toBe(false)
  })

  test('23. canViewBasicHistory is true', () => {
    expect(policy.canViewBasicHistory).toBe(true)
  })

  test('24. canViewAdvancedDetails is false', () => {
    expect(policy.canViewAdvancedDetails).toBe(false)
  })

  test('25. canMakeAgain is false', () => {
    expect(policy.canMakeAgain).toBe(false)
  })

  test('26. shouldShowPreviewBadge is false', () => {
    expect(policy.shouldShowPreviewBadge).toBe(false)
  })

  test('27. shouldShowPreviewExplanation is false', () => {
    expect(policy.shouldShowPreviewExplanation).toBe(false)
  })

  test('28. shouldShowAdvancedUpgrade is true', () => {
    expect(policy.shouldShowAdvancedUpgrade).toBe(true)
  })

  test('29. shouldShowMakeAgainUpgrade is true', () => {
    expect(policy.shouldShowMakeAgainUpgrade).toBe(true)
  })

  test('30. Basic history is always available for locked entries', () => {
    expect(policy.canViewBasicHistory).toBe(true)
  })
})

describe('historyAccessPolicy — getAccessType', () => {
  test('31. Returns "pro" for Pro policy', () => {
    expect(getAccessType(getHistoryAccessPolicy(true, false))).toBe('pro')
  })

  test('32. Returns "free_preview" for preview policy', () => {
    expect(getAccessType(getHistoryAccessPolicy(false, true))).toBe('free_preview')
  })

  test('33. Returns "free_locked" for locked policy', () => {
    expect(getAccessType(getHistoryAccessPolicy(false, false))).toBe('free_locked')
  })

  test('34. Pro with isAdvancedPreview=true still returns "pro"', () => {
    expect(getAccessType(getHistoryAccessPolicy(true, true))).toBe('pro')
  })

  test('35. getAccessType is deterministic', () => {
    expect(getAccessType(getHistoryAccessPolicy(false, true)))
      .toBe(getAccessType(getHistoryAccessPolicy(false, true)))
  })
})

describe('historyAccessPolicy — getEntryPosition', () => {
  test('36. Returns "newest" for preview entry', () => {
    expect(getEntryPosition(true)).toBe('newest')
  })

  test('37. Returns "older" for non-preview entry', () => {
    expect(getEntryPosition(false)).toBe('older')
  })

  test('38. Returns "older" for Pro user (no preview concept)', () => {
    expect(getEntryPosition(false)).toBe('older')
  })

  test('39. Returns "newest" when isAdvancedPreview is true', () => {
    expect(getEntryPosition(true)).toBe('newest')
  })

  test('40. Deterministic output', () => {
    expect(getEntryPosition(true)).toBe(getEntryPosition(true))
    expect(getEntryPosition(false)).toBe(getEntryPosition(false))
  })
})

describe('historyAccessPolicy — edge cases', () => {
  test('41. Policy object is a plain object', () => {
    const p = getHistoryAccessPolicy(true, false)
    expect(typeof p).toBe('object')
    expect(Array.isArray(p)).toBe(false)
  })

  test('42. Policy has all required keys', () => {
    const p = getHistoryAccessPolicy(false, false)
    expect(p).toHaveProperty('isPro')
    expect(p).toHaveProperty('isAdvancedPreview')
    expect(p).toHaveProperty('canViewBasicHistory')
    expect(p).toHaveProperty('canViewAdvancedDetails')
    expect(p).toHaveProperty('canMakeAgain')
    expect(p).toHaveProperty('shouldShowPreviewBadge')
    expect(p).toHaveProperty('shouldShowPreviewExplanation')
    expect(p).toHaveProperty('shouldShowAdvancedUpgrade')
    expect(p).toHaveProperty('shouldShowMakeAgainUpgrade')
  })

  test('43. All values are booleans', () => {
    const p = getHistoryAccessPolicy(false, true)
    Object.values(p).forEach((v) => {
      expect(typeof v).toBe('boolean')
    })
  })

  test('44. Policy is immutable (returns new object each call)', () => {
    const p1 = getHistoryAccessPolicy(false, true)
    const p2 = getHistoryAccessPolicy(false, true)
    expect(p1).not.toBe(p2)
    expect(p1).toEqual(p2)
  })

  test('45. No second subscription boolean — isPro is the single source', () => {
    const p = getHistoryAccessPolicy(true, false)
    const keys = Object.keys(p).filter((k) => k.toLowerCase().includes('sub'))
    expect(keys.length).toBe(0)
  })
})

// ── Loading State (entitlementInitialized=false) ─────────────

describe('historyAccessPolicy — loading state', () => {
  test('46. Loading returns isLoading=true', () => {
    const p = getHistoryAccessPolicy(false, false, false)
    expect(p.isLoading).toBe(true)
  })

  test('47. Loading allows basic history', () => {
    const p = getHistoryAccessPolicy(false, false, false)
    expect(p.canViewBasicHistory).toBe(true)
  })

  test('48. Loading blocks advanced details', () => {
    const p = getHistoryAccessPolicy(false, false, false)
    expect(p.canViewAdvancedDetails).toBe(false)
  })

  test('49. Loading blocks Make Again', () => {
    const p = getHistoryAccessPolicy(false, false, false)
    expect(p.canMakeAgain).toBe(false)
  })

  test('50. Loading hides all premium UI', () => {
    const p = getHistoryAccessPolicy(false, false, false)
    expect(p.shouldShowPreviewBadge).toBe(false)
    expect(p.shouldShowPreviewExplanation).toBe(false)
    expect(p.shouldShowAdvancedUpgrade).toBe(false)
    expect(p.shouldShowMakeAgainUpgrade).toBe(false)
  })

  test('51. Loading is neutral even if isPro=true', () => {
    const p = getHistoryAccessPolicy(true, false, false)
    expect(p.isLoading).toBe(true)
    expect(p.canViewAdvancedDetails).toBe(false)
    expect(p.canMakeAgain).toBe(false)
  })

  test('52. Loading is neutral even if isAdvancedPreview=true', () => {
    const p = getHistoryAccessPolicy(false, true, false)
    expect(p.isLoading).toBe(true)
    expect(p.canViewAdvancedDetails).toBe(false)
  })

  test('53. getAccessType returns loading for unresolved policy', () => {
    const p = getHistoryAccessPolicy(false, false, false)
    expect(getAccessType(p)).toBe('loading')
  })

  test('54. Default entitlementInitialized=true (backward compat)', () => {
    const p = getHistoryAccessPolicy(true, false)
    expect(p.isLoading).toBe(false)
    expect(p.isPro).toBe(true)
  })
})
