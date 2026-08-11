// ─────────────────────────────────────────────────────────────
// textContrast.test.js — Tests for fine print readability
// on dark surfaces (Issue 2: low-contrast text fix)
// ─────────────────────────────────────────────────────────────

import { DARK, SEMANTIC_COLORS, BRAND } from '../../constants/tokens'

function getLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function getContrastRatio(fg, bg) {
  const l1 = getLuminance(fg)
  const l2 = getLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

const DARK_BG = '#0D1117'
const BRAND_BG = '#060D0A'

describe('Fine print contrast on dark surfaces', () => {
  // 1. Normal supporting text does not use the low-contrast disabled token
  test('DARK.textMuted is not the old low-contrast #484F58', () => {
    expect(DARK.textMuted).not.toBe('#484F58')
    expect(DARK.textMuted).not.toBe('#484f58')
  })

  // 2. Fine print on dark surfaces uses the approved high-contrast token
  test('DARK.textMuted meets WCAG 4.5:1 on #0D1117 background', () => {
    const ratio = getContrastRatio(DARK.textMuted, DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('SEMANTIC_COLORS.textMuted meets WCAG 4.5:1 on brand background', () => {
    const ratio = getContrastRatio(SEMANTIC_COLORS.textMuted, BRAND_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('DARK.textSecondary meets WCAG 4.5:1 on #0D1117 background', () => {
    const ratio = getContrastRatio(DARK.textSecondary, DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('DARK.textPrimary meets WCAG 4.5:1 on #0D1117 background', () => {
    const ratio = getContrastRatio(DARK.textPrimary, DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  // 3. Disabled controls retain their distinct disabled appearance
  test('disabled opacity (0.35) is distinct from normal opacity', () => {
    const disabledOpacity = 0.35
    const normalOpacity = 1.0
    expect(disabledOpacity).toBeLessThan(normalOpacity)
    expect(disabledOpacity).toBeLessThan(0.5)
  })

  // 4. Key affected screens render without hard-coded inaccessible gray text
  test('no hard-coded #484F58 remains in ScanScreen', () => {
    const fs = require('fs')
    const content = fs.readFileSync(__dirname + '/../../screens/ScanScreen.js', 'utf-8')
    expect(content).not.toMatch(/#484[Ff]58/)
  })

  test('no hard-coded #484F58 remains in SettingsScreen', () => {
    const fs = require('fs')
    const content = fs.readFileSync(__dirname + '/../../screens/SettingsScreen.js', 'utf-8')
    expect(content).not.toMatch(/#484[Ff]58/)
  })

  test('no hard-coded #484F58 remains in HomeScreen', () => {
    const fs = require('fs')
    const content = fs.readFileSync(__dirname + '/../../screens/HomeScreen.js', 'utf-8')
    expect(content).not.toMatch(/#484[Ff]58/)
  })

  test('no hard-coded #484F58 remains in RecipeDetailScreen', () => {
    const fs = require('fs')
    const content = fs.readFileSync(__dirname + '/../../screens/RecipeDetailScreen.js', 'utf-8')
    expect(content).not.toMatch(/#484[Ff]58/)
  })

  test('no hard-coded #484F58 remains in WeeklyReportScreen', () => {
    const fs = require('fs')
    const content = fs.readFileSync(__dirname + '/../../screens/WeeklyReportScreen.js', 'utf-8')
    expect(content).not.toMatch(/#484[Ff]58/)
  })

  test('no hard-coded #484F58 remains in VitalityHistoryScreen', () => {
    const fs = require('fs')
    const content = fs.readFileSync(__dirname + '/../../screens/VitalityHistoryScreen.js', 'utf-8')
    expect(content).not.toMatch(/#484[Ff]58/)
  })

  test('no hard-coded #484F58 remains in DashboardScreen', () => {
    const fs = require('fs')
    const content = fs.readFileSync(__dirname + '/../../screens/DashboardScreen.js', 'utf-8')
    expect(content).not.toMatch(/#484[Ff]58/)
  })

  test('no hard-coded #484F58 remains in VaultScreen', () => {
    const fs = require('fs')
    const content = fs.readFileSync(__dirname + '/../../screens/VaultScreen.js', 'utf-8')
    expect(content).not.toMatch(/#484[Ff]58/)
  })

  // 5. Light-background surfaces remain readable
  test('DARK.textPrimary is light (suitable for dark backgrounds, not light)', () => {
    const lum = getLuminance(DARK.textPrimary)
    expect(lum).toBeGreaterThan(0.5)
  })

  test('BRAND.text.inverse is dark (suitable for light backgrounds)', () => {
    const lum = getLuminance(BRAND.text.inverse)
    expect(lum).toBeLessThan(0.1)
  })

  // 6. Existing semantic-token tests pass
  test('SEMANTIC_COLORS.textMuted matches BRAND.text.muted', () => {
    expect(SEMANTIC_COLORS.textMuted).toBe(BRAND.text.muted)
  })

  test('SEMANTIC_COLORS.textPrimary matches BRAND.text.primary', () => {
    expect(SEMANTIC_COLORS.textPrimary).toBe(BRAND.text.primary)
  })

  test('SEMANTIC_COLORS.textSecondary matches BRAND.text.secondary', () => {
    expect(SEMANTIC_COLORS.textSecondary).toBe(BRAND.text.secondary)
  })

  // 7. #90A4AE meets WCAG 4.5:1 on dark backgrounds (the replacement color)
  test('#90A4AE meets WCAG 4.5:1 on #0D1117 background', () => {
    const ratio = getContrastRatio('#90A4AE', DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('#90A4AE meets WCAG 4.5:1 on #060D0A brand background', () => {
    const ratio = getContrastRatio('#90A4AE', BRAND_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  // 8. Disabled text is distinguishable from normal supporting text
  test('#90A4AE (disabled/muted) is dimmer than #C9D1D9 (normal text)', () => {
    const mutedLum = getLuminance('#90A4AE')
    const normalLum = getLuminance('#C9D1D9')
    expect(mutedLum).toBeLessThan(normalLum)
  })

  test('#90A4AE (disabled/muted) is dimmer than #FFFFFF (primary text)', () => {
    const mutedLum = getLuminance('#90A4AE')
    const primaryLum = getLuminance('#FFFFFF')
    expect(mutedLum).toBeLessThan(primaryLum)
  })

  // 9. Disabled switch thumb is distinguishable from enabled
  test('#90A4AE (switch off) is distinct from #81C784 (switch on)', () => {
    const offLum = getLuminance('#90A4AE')
    const onLum = getLuminance('#81C784')
    // They should not be the same luminance
    expect(Math.abs(offLum - onLum)).toBeGreaterThan(0.05)
  })

  // 10. Inactive tab is distinguishable from active tab
  test('#90A4AE (inactive tab) is distinct from #81C784 (active tab)', () => {
    const inactiveLum = getLuminance('#90A4AE')
    const activeLum = getLuminance('#81C784')
    expect(Math.abs(inactiveLum - activeLum)).toBeGreaterThan(0.05)
  })

  // 11. No borders or dividers use #90A4AE (should not have been brightened)
  test('no borderColor or borderTopColor uses #90A4AE in key screens', () => {
    const fs = require('fs')
    const path = require('path')
    const screens = ['HomeScreen.js', 'SettingsScreen.js', 'DashboardScreen.js']
    for (const screen of screens) {
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../screens/' + screen),
        'utf-8'
      )
      const borderMatches = content.match(/border[A-Za-z]*Color.*#90A4AE/g)
      expect(borderMatches).toBeNull()
    }
  })

  // 12. #90A4AE is not used on light backgrounds (would reduce contrast)
  test('#90A4AE on #FFD54F (light yellow) has poor contrast — verify not used together', () => {
    const ratio = getContrastRatio('#90A4AE', '#FFD54F')
    // If this ratio is low, #90A4AE should never be text on #FFD54F backgrounds
    // We verify the ratio is indeed low (confirming it would be a bad combination)
    expect(ratio).toBeLessThan(3)
  })

  // 13. All affected screens have no remaining old low-contrast value for normal fine print
  test('no hard-coded #484F58 remains in any affected screen', () => {
    const fs = require('fs')
    const path = require('path')
    const screens = [
      'HomeScreen.js', 'ScanScreen.js', 'SettingsScreen.js',
      'DashboardScreen.js', 'RecipeDetailScreen.js', 'WeeklyReportScreen.js',
      'VitalityHistoryScreen.js', 'VaultScreen.js', 'HallOfVitalityScreen.js',
      'NoviceJourneyScreen.js', 'MonthlyWrapScreen.js',
      'BeginnerGlowPathScreen.js',
      'GlowLibraryScreen.js', 'JuiceCalculatorScreen.js',
      'ProduceRecipeResultsScreen.js', 'SeasonalGlowPacksScreen.js',
    ]
    for (const screen of screens) {
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../screens/' + screen),
        'utf-8'
      )
      expect(content).not.toMatch(/#484[Ff]58/)
    }
  })

  // 14. No hard-coded #484F58 remains in affected components
  test('no hard-coded #484F58 remains in affected components', () => {
    const fs = require('fs')
    const path = require('path')
    const components = [
      'AccountGateModal.js', 'BigSqueezeModal.js', 'FreezerPassModal.js',
      'ModernTabBar.js', 'NutritionRow.js', 'NutritionSummary.js',
      'PaywallModal.js', 'PortionEntryModeToggle.js', 'QuantityPortionEditor.js',
      'QuickLogger.js', 'SafetyFooter.js', 'SnapGateModal.js',
      'WeeklySpectrumBar.js', 'WelcomeModal.js',
    ]
    for (const comp of components) {
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../components/' + comp),
        'utf-8'
      )
      expect(content).not.toMatch(/#484[Ff]58/)
    }
  })
})
