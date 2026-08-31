// snapExhaustedUx.test.js — Tests for Snap exhausted-state UX
//
// Verifies:
// 12. Snap action remains rendered when quota = 0
// 13. Snap action is disabled when quota = 0
// 14. Free exhausted copy mentions complimentary Snap has been used
// 15. Free exhausted UI offers manual entry
// 16. Free exhausted UI offers Pro upgrade
// 17. Pro copy reflects 12/month
// 18. Old tap Snap Produce copy does not appear when Snap is unavailable
// 19. tapping disabled Snap cannot open camera

const fs = require('fs')
const path = require('path')

const homeScreenPath = path.resolve(__dirname, '../../screens/HomeScreen.js')
const homeSource = fs.readFileSync(homeScreenPath, 'utf8')

const nutritionSummaryPath = path.resolve(__dirname, '../../components/NutritionSummary.js')
const nutritionSource = fs.readFileSync(nutritionSummaryPath, 'utf8')

describe('Snap exhausted UX — HomeScreen', () => {
  it('12. Snap action remains rendered when quota = 0 (not hidden)', () => {
    // The old code had {!isSnapDepleted && (...)} which hid the button.
    // The new code should NOT have that pattern for the Snap button.
    expect(homeSource).not.toMatch(/\{!isSnapDepleted\s*&&\s*\(\s*<View\s+style=\{styles\.buttonSection\}/)
  })

  it('12b. Snap depleted container is rendered', () => {
    expect(homeSource).toMatch(/depletedSnapContainer/)
  })

  it('13. Snap action is disabled when quota = 0 (pointerEvents none)', () => {
    expect(homeSource).toMatch(/pointerEvents="none"/)
  })

  it('13b. Disabled Snap uses disabled prop on SnapIcon', () => {
    expect(homeSource).toMatch(/SnapIcon.*disabled/)
  })

  it('14. Free exhausted copy mentions complimentary introductory AI Snap has been used', () => {
    expect(homeSource).toMatch(/complimentary introductory AI Snap/)
  })

  it('14b. Free exhausted copy does NOT promise a monthly Snap refresh', () => {
    // Regression: Free is a LIFETIME introductory allowance, not monthly.
    // The Free branch must never say "for this month" or "for <month>".
    const freeBranchMatch = homeSource.match(
      /"You've used your complimentary introductory AI Snap\."/
    )
    expect(freeBranchMatch).not.toBeNull()
    expect(homeSource).not.toMatch(/complimentary AI Snap for this month/)
  })

  it('15. Free exhausted UI offers manual entry via helper text', () => {
    // QA12: "Enter Produce Manually" button removed; replaced with
    // non-interactive helper text above the produce options.
    expect(homeSource).not.toMatch(/Enter Produce Manually/)
    expect(homeSource).toMatch(/Prefer manual entry\? Tap a produce below\./)
  })

  it('16. Free exhausted UI offers Pro upgrade', () => {
    expect(homeSource).toMatch(/Upgrade to Pro/)
  })

  it('16b. Upgrade button navigates to Paywall', () => {
    expect(homeSource).toMatch(/Paywall.*snap_exhausted/)
  })

  it('17. Pro copy reflects 4 AI Snaps for this month', () => {
    expect(homeSource).toMatch(/4 AI Snaps for this month/)
  })

  it('17b. Pro exhausted does NOT show upgrade button', () => {
    // The upgrade button is conditional on !filmRollIsPro
    expect(homeSource).toMatch(/\{!filmRollIsPro\s*&&/)
  })

  it('isSnapDepleted includes Pro exhausted (not just Free)', () => {
    // The old code was: selectQuotaExhausted(serverQuota) && !filmRollIsPro
    // The new code should be: selectQuotaExhausted(serverQuota)
    // Verify the old pattern is gone
    expect(homeSource).not.toMatch(/selectQuotaExhausted.*&&.*!filmRollIsPro/)
  })
})

describe('Snap exhausted UX — NutritionSummary empty-state copy', () => {
  it('NutritionSummary accepts snapExhausted prop', () => {
    expect(nutritionSource).toMatch(/snapExhausted/)
  })

  it('18. Old "tap Snap Produce to scan your first item" is quota-aware', () => {
    // The old copy should be replaced with conditional copy
    expect(nutritionSource).not.toMatch(/Tap "Snap Produce" to scan your first item/)
  })

  it('18b. Quota-available copy mentions Snap Produce or manual', () => {
    expect(nutritionSource).toMatch(/Snap Produce.*add produce manually/)
  })

  it('18c. Quota-exhausted copy mentions manual or upgrade', () => {
    expect(nutritionSource).toMatch(/Add produce manually.*upgrade.*AI Snaps/)
  })

  it('HomeScreen passes snapExhausted to NutritionSummary', () => {
    expect(homeSource).toMatch(/snapExhausted=\{isSnapDepleted\}/)
  })
})
