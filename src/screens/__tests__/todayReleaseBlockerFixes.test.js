// ─────────────────────────────────────────────────────────────
// todayReleaseBlockerFixes.test.js — Regression tests for three
// confirmed physical-device release-blocker defects:
//
//   Defect 1: Today > "Browse Juice Ideas" navigated only to the
//             generic Explore tab root, requiring a second tap to
//             actually open the Juice Ideas (Browse Ideas) modal.
//
//   Defect 2: The Juice Ideas modal header clashed with the iOS
//             status bar/notch (SafeAreaView's automatic top edge
//             inset was not reliable for content inside a
//             transparent full-screen Modal).
//
//   Defect 3: Android "Your Free Plan" did not show the "View Pro"
//             affordance under the same conditions iOS did — it was
//             gated behind quota-exhaustion rather than shown to
//             every Free user.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const TODAY_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'TodayScreen.js'),
  'utf8',
)
const SCAN_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'ScanScreen.js'),
  'utf8',
)
const FREE_PLAN_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'FreePlanUsageCard.js'),
  'utf8',
)

describe('Defect 1 — Today > Juice Ideas navigates directly to the modal', () => {
  test('1. Today "Browse Juice Ideas" navigates to ExploreTab/ExploreHome with openBrowseIdeas param', () => {
    const idx = TODAY_SRC.indexOf('accessibilityLabel="Browse juice ideas"')
    expect(idx).toBeGreaterThan(-1)
    const section = TODAY_SRC.slice(Math.max(0, idx - 400), idx)
    expect(section).toContain("navigation.navigate('ExploreTab', {")
    expect(section).toContain("screen: 'ExploreHome'")
    expect(section).toContain('openBrowseIdeas: true')
  })

  test('2. It no longer merely switches to the bare ExploreTab root', () => {
    const idx = TODAY_SRC.indexOf('accessibilityLabel="Browse juice ideas"')
    const section = TODAY_SRC.slice(Math.max(0, idx - 400), idx)
    expect(section).not.toMatch(/navigation\.navigate\('ExploreTab'\)\s*$/m)
  })

  test('3. ScanScreen (ExploreHome) consumes openBrowseIdeas and opens the modal on arrival', () => {
    const idx = SCAN_SRC.indexOf('openBrowseIdeas')
    expect(idx).toBeGreaterThan(-1)
    const section = SCAN_SRC.slice(idx, idx + 400)
    expect(section).toContain('setShowBrowseModal(true)')
  })

  test('4. The param is cleared after consumption to prevent duplicate re-triggering / re-stacking', () => {
    const idx = SCAN_SRC.indexOf('route?.params?.openBrowseIdeas')
    const section = SCAN_SRC.slice(idx, idx + 400)
    expect(section).toContain('navigation.setParams({ openBrowseIdeas: undefined })')
  })

  test('5. The existing restoreBrowseIdeas (RecipeDetail back-navigation) path is untouched', () => {
    expect(SCAN_SRC).toContain('restoreBrowseIdeas')
    expect(SCAN_SRC).toContain('setBrowseRestorePage(route.params.restorePage || 1)')
  })

  test('6. The existing camera-tab openCamera navigation pattern is unchanged (Explore navigation elsewhere preserved)', () => {
    expect(TODAY_SRC).toContain("navigation.navigate('ScanFlow', { screen: 'ScanHome', params: { openCamera: true } })")
  })
})

describe('Defect 2 — Juice Ideas header respects the safe area', () => {
  test('7. BrowseIdeasModal imports useSafeAreaInsets from react-native-safe-area-context', () => {
    expect(SCAN_SRC).toMatch(
      /import \{ SafeAreaView, useSafeAreaInsets \} from 'react-native-safe-area-context'/,
    )
  })

  test('8. BrowseIdeasModal calls useSafeAreaInsets()', () => {
    const idx = SCAN_SRC.indexOf('function BrowseIdeasModal(')
    const section = SCAN_SRC.slice(idx, idx + 800)
    expect(section).toContain('const insets = useSafeAreaInsets()')
  })

  test('9. The header applies an explicit top inset-aware padding, not a hardcoded platform offset', () => {
    expect(SCAN_SRC).toMatch(
      /paddingTop: BROWSE_HEADER_VERTICAL_PADDING \+ insets\.top/,
    )
    // Must not be a brittle fixed/platform-specific offset.
    expect(SCAN_SRC).not.toMatch(/paddingTop:\s*Platform\.OS === 'ios' \? \d+ : \d+/)
  })

  test('10. SafeAreaView no longer double-applies the top edge (avoids double-padding on top of the explicit inset)', () => {
    const idx = SCAN_SRC.indexOf('browseStyles.safe')
    const jsxSection = SCAN_SRC.slice(Math.max(0, idx - 100), idx + 100)
    expect(jsxSection).toMatch(/edges=\{\['bottom'\]\}/)
    expect(jsxSection).not.toMatch(/edges=\{\['top', 'bottom'\]\}/)
  })

  test('11. Close (X) touch target size is preserved (unchanged 36x36 closeBtn)', () => {
    expect(SCAN_SRC).toMatch(/closeBtn:\s*\{\s*\n\s*width: 36,\s*\n\s*height: 36,/)
  })

  test('12. Header title and close button remain in the same row/alignment structure', () => {
    const idx = SCAN_SRC.indexOf('browseStyles.header')
    const jsxSection = SCAN_SRC.slice(idx, idx + 400)
    expect(jsxSection).toContain('browseStyles.title')
    expect(jsxSection).toContain('browseStyles.closeBtn')
  })
})

describe('Defect 3 — Android "View Pro" affordance parity', () => {
  test('13. FreePlanUsageCard renders "View Pro" unconditionally for Free users (not gated on quota exhaustion)', () => {
    expect(FREE_PLAN_SRC).toContain('<Text style={styles.upgradeText}>View Pro</Text>')
    // The old exhaustion-only guard must be gone.
    expect(FREE_PLAN_SRC).not.toMatch(/\{\(scanRemaining === 0 \|\| blendDisplay === 0\) && \(/)
  })

  test('14. The isPro early-return guard is preserved (Pro users never see the Free-plan upgrade card)', () => {
    expect(FREE_PLAN_SRC).toMatch(/if \(isPro\) \{\s*\n\s*return \(/)
  })

  test('15. "View Pro" onPress still calls the canonical onUpgrade prop (existing RevenueCat paywall path, unchanged)', () => {
    const idx = FREE_PLAN_SRC.indexOf('<Text style={styles.upgradeText}>View Pro</Text>')
    const section = FREE_PLAN_SRC.slice(Math.max(0, idx - 600), idx)
    expect(section).toContain('onPress={onUpgrade}')
  })

  test('16. Accessibility label present on the View Pro affordance', () => {
    expect(FREE_PLAN_SRC).toContain('accessibilityLabel="View Pro plan"')
  })

  test('17. useEffectiveProAccess (canonical entitlement source) is unchanged — no local fake-Pro path introduced', () => {
    expect(FREE_PLAN_SRC).toContain("import { useEffectiveProAccess } from '../hooks/useEffectiveProAccess'")
    expect(FREE_PLAN_SRC).toContain('const { isPro } = useEffectiveProAccess()')
    expect(FREE_PLAN_SRC).not.toMatch(/isPro\s*=\s*true/)
  })

  test('18. Quota rows (AI scans, Expanded Ingredient Analysis) are unchanged — only the upgrade CTA guard changed', () => {
    expect(FREE_PLAN_SRC).toContain('AI image scans')
    expect(FREE_PLAN_SRC).toContain('Expanded Ingredient Analysis')
  })
})
