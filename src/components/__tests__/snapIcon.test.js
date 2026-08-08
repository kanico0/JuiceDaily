// snapIcon.test.js — Tests for RawLifeFlow Snap action icon replacement
//
// Verifies:
// 1. approved camera-icon asset exists inside authoritative repo
// 2. SnapIcon component exists and renders the asset
// 3. primary Snap action (SnapButton) uses SnapIcon
// 4. center FAB (ModernTabBar) uses SnapIcon
// 5. other Snap entry points use the same asset
// 6. old Snap-specific Camera glyph is no longer used at those locations
// 7. onPress/navigation remains unchanged (source-level)
// 8. unrelated camera controls remain unchanged
// 9. Android launcher/Play Store icon configuration remains unchanged

const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '../../..')
const assetPath = path.resolve(repoRoot, 'assets/Raw_LifeFlow_Camera_Icon.png')
const snapIconComponentPath = path.resolve(repoRoot, 'src/components/SnapIcon.js')
const snapButtonPath = path.resolve(repoRoot, 'src/components/SnapButton.js')
const modernTabBarPath = path.resolve(repoRoot, 'src/components/ModernTabBar.js')
const focusNutrientCardPath = path.resolve(repoRoot, 'src/components/FocusNutrientCard.js')
const quickLoggerPath = path.resolve(repoRoot, 'src/components/QuickLogger.js')
const scanScreenPath = path.resolve(repoRoot, 'src/screens/ScanScreen.js')
const todayScreenPath = path.resolve(repoRoot, 'src/screens/TodayScreen.js')
const introLaunchScreenPath = path.resolve(repoRoot, 'src/screens/IntroLaunchScreen.js')
const cameraScreenPath = path.resolve(repoRoot, 'src/screens/CameraScreen.js')
const snapGateModalPath = path.resolve(repoRoot, 'src/components/SnapGateModal.js')
const freePlanUsageCardPath = path.resolve(repoRoot, 'src/components/FreePlanUsageCard.js')
const vaultScreenPath = path.resolve(repoRoot, 'src/screens/VaultScreen.js')
const paywallModalPath = path.resolve(repoRoot, 'src/components/PaywallModal.js')

const snapIconSource = fs.readFileSync(snapIconComponentPath, 'utf8')
const snapButtonSource = fs.readFileSync(snapButtonPath, 'utf8')
const modernTabBarSource = fs.readFileSync(modernTabBarPath, 'utf8')
const focusNutrientCardSource = fs.readFileSync(focusNutrientCardPath, 'utf8')
const quickLoggerSource = fs.readFileSync(quickLoggerPath, 'utf8')
const scanScreenSource = fs.readFileSync(scanScreenPath, 'utf8')
const todayScreenSource = fs.readFileSync(todayScreenPath, 'utf8')
const introLaunchScreenSource = fs.readFileSync(introLaunchScreenPath, 'utf8')
const cameraScreenSource = fs.readFileSync(cameraScreenPath, 'utf8')
const snapGateModalSource = fs.readFileSync(snapGateModalPath, 'utf8')
const freePlanUsageCardSource = fs.readFileSync(freePlanUsageCardPath, 'utf8')
const vaultScreenSource = fs.readFileSync(vaultScreenPath, 'utf8')
const paywallModalSource = fs.readFileSync(paywallModalPath, 'utf8')

describe('Snap icon — asset existence', () => {
  it('approved camera-icon asset exists inside authoritative repo', () => {
    expect(fs.existsSync(assetPath)).toBe(true)
  })

  it('asset is a PNG file', () => {
    const header = fs.readFileSync(assetPath).subarray(0, 8)
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(header[0]).toBe(0x89)
    expect(header[1]).toBe(0x50)
    expect(header[2]).toBe(0x4e)
    expect(header[3]).toBe(0x47)
  })

  it('asset SHA-256 matches approved artwork', () => {
    const crypto = require('crypto')
    const fileBuffer = fs.readFileSync(assetPath)
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
    expect(hash).toBe('1248a1f9a767b1e7eb647179d6bc029ee8044131b980d9e5090471faa812487b')
  })
})

describe('SnapIcon component', () => {
  it('SnapIcon component exists', () => {
    expect(fs.existsSync(snapIconComponentPath)).toBe(true)
  })

  it('SnapIcon requires the approved asset', () => {
    expect(snapIconSource).toMatch(/require\(['"]\.\.\/\.\.\/assets\/Raw_LifeFlow_Camera_Icon\.png['"]\)/)
  })

  it('SnapIcon uses Image component', () => {
    expect(snapIconSource).toMatch(/Image/)
  })

  it('SnapIcon uses contain resizeMode', () => {
    expect(snapIconSource).toMatch(/contain/)
  })

  it('SnapIcon accepts size prop', () => {
    expect(snapIconSource).toMatch(/size/)
  })

  it('SnapIcon accepts color prop for tinting', () => {
    expect(snapIconSource).toMatch(/color/)
    expect(snapIconSource).toMatch(/tintColor/)
  })
})

describe('SnapButton — primary Snap action uses SnapIcon', () => {
  it('imports SnapIcon', () => {
    expect(snapButtonSource).toMatch(/import SnapIcon/)
  })

  it('uses SnapIcon instead of Camera glyph', () => {
    expect(snapButtonSource).toMatch(/<SnapIcon/)
    expect(snapButtonSource).not.toMatch(/<Camera\b/)
  })

  it('does not import Camera from lucide', () => {
    expect(snapButtonSource).not.toMatch(/Camera.*from 'lucide-react-native'/)
  })

  it('preserves onPress handler', () => {
    expect(snapButtonSource).toMatch(/onPress=\{onPress\}/)
  })

  it('preserves Snap Produce label', () => {
    expect(snapButtonSource).toMatch(/Snap Produce/)
  })
})

describe('ModernTabBar — center FAB uses SnapIcon', () => {
  it('imports SnapIcon', () => {
    expect(modernTabBarSource).toMatch(/import SnapIcon/)
  })

  it('FAB uses SnapIcon instead of Scan glyph', () => {
    expect(modernTabBarSource).toMatch(/<SnapIcon/)
    // Scan glyph should no longer be used for the FAB
    // (Scan may still be imported if used elsewhere, but not in the FAB)
    const fabMatch = modernTabBarSource.match(/handleFAB[\s\S]*?<SnapIcon/)
    expect(fabMatch).not.toBeNull()
  })

  it('preserves FAB onPress to ScanFlow', () => {
    expect(modernTabBarSource).toMatch(/ScanFlow/)
    expect(modernTabBarSource).toMatch(/openCamera: true/)
  })

  it('preserves accessibilityLabel for scan', () => {
    expect(modernTabBarSource).toMatch(/accessibilityLabel="Scan produce"/)
  })
})

describe('FocusNutrientCard — Try a Scan CTA uses SnapIcon', () => {
  it('imports SnapIcon', () => {
    expect(focusNutrientCardSource).toMatch(/import SnapIcon/)
  })

  it('uses SnapIcon instead of Camera glyph', () => {
    expect(focusNutrientCardSource).toMatch(/<SnapIcon/)
    expect(focusNutrientCardSource).not.toMatch(/<Camera\b/)
  })

  it('preserves onScan handler', () => {
    expect(focusNutrientCardSource).toMatch(/onScan/)
  })
})

describe('QuickLogger — Snap a Photo option uses SnapIcon', () => {
  it('imports SnapIcon', () => {
    expect(quickLoggerSource).toMatch(/import SnapIcon/)
  })

  it('uses SnapIcon instead of Camera glyph', () => {
    expect(quickLoggerSource).toMatch(/<SnapIcon/)
    expect(quickLoggerSource).not.toMatch(/<Camera\b/)
  })

  it('preserves onCustomIngredients camera callback', () => {
    expect(quickLoggerSource).toMatch(/onCustomIngredients.*camera/)
  })
})

describe('ScanScreen — all Snap-action CTAs use SnapIcon', () => {
  it('imports SnapIcon', () => {
    expect(scanScreenSource).toMatch(/import SnapIcon/)
  })

  it('does not use Camera glyph for Snap actions', () => {
    expect(scanScreenSource).not.toMatch(/<Camera\b/)
  })

  it('uses SnapIcon at multiple Snap-action locations', () => {
    const matches = scanScreenSource.match(/<SnapIcon/g)
    expect(matches).not.toBeNull()
    expect(matches.length).toBeGreaterThanOrEqual(6)
  })

  it('preserves Scan when ready CTA', () => {
    expect(scanScreenSource).toMatch(/Scan when ready/)
  })

  it('preserves Try scanning my produce CTA', () => {
    expect(scanScreenSource).toMatch(/Try scanning my produce/)
  })

  it('preserves Reveal My Nutrients CTA', () => {
    expect(scanScreenSource).toMatch(/Reveal My Nutrients/)
  })

  it('preserves Try a Scan CTA', () => {
    expect(scanScreenSource).toMatch(/Try a Scan/)
  })

  it('preserves Scan Produce label', () => {
    expect(scanScreenSource).toMatch(/Scan Produce/)
  })

  it('preserves navigation to ScanFlow with openCamera', () => {
    expect(scanScreenSource).toMatch(/ScanFlow/)
    expect(scanScreenSource).toMatch(/openCamera: true/)
  })

  it('preserves decorative Scan icon in example mock (not a Snap action)', () => {
    // The decorative Scan icon at the example mock header should remain
    expect(scanScreenSource).toMatch(/<Scan size=\{18\}/)
  })
})

describe('TodayScreen — Snap CTAs use SnapIcon', () => {
  it('imports SnapIcon', () => {
    expect(todayScreenSource).toMatch(/import SnapIcon/)
  })

  it('does not use Camera glyph for Snap actions', () => {
    expect(todayScreenSource).not.toMatch(/<Camera\b/)
  })

  it('uses SnapIcon at Snap-action locations', () => {
    const matches = todayScreenSource.match(/<SnapIcon/g)
    expect(matches).not.toBeNull()
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('preserves Scan My Produce CTA', () => {
    expect(todayScreenSource).toMatch(/Scan My Produce/)
  })

  it('preserves Log Another Juice CTA', () => {
    expect(todayScreenSource).toMatch(/Log Another Juice/)
  })

  it('preserves handleScan navigation to ScanFlow', () => {
    expect(todayScreenSource).toMatch(/ScanFlow/)
    expect(todayScreenSource).toMatch(/openCamera: true/)
  })
})

describe('IntroLaunchScreen — intro CTA uses SnapIcon', () => {
  it('imports SnapIcon', () => {
    expect(introLaunchScreenSource).toMatch(/import SnapIcon/)
  })

  it('uses SnapIcon instead of Camera glyph', () => {
    expect(introLaunchScreenSource).toMatch(/<SnapIcon/)
    expect(introLaunchScreenSource).not.toMatch(/<Camera\b/)
  })

  it('preserves Reveal My Nutrients label', () => {
    expect(introLaunchScreenSource).toMatch(/Reveal My Nutrients/)
  })
})

describe('Unrelated camera controls remain unchanged', () => {
  it('CameraScreen still uses Aperture for permission graphic', () => {
    expect(cameraScreenSource).toMatch(/<Aperture/)
  })

  it('CameraScreen does not use SnapIcon (functional camera screen)', () => {
    expect(cameraScreenSource).not.toMatch(/SnapIcon/)
  })

  it('SnapGateModal still uses Camera for exhausted-state graphic', () => {
    expect(snapGateModalSource).toMatch(/<Camera/)
  })

  it('SnapGateModal does not use SnapIcon (not a Snap-action trigger)', () => {
    expect(snapGateModalSource).not.toMatch(/SnapIcon/)
  })

  it('FreePlanUsageCard still uses Camera for usage display row', () => {
    expect(freePlanUsageCardSource).toMatch(/<Camera/)
  })

  it('FreePlanUsageCard does not use SnapIcon (display only)', () => {
    expect(freePlanUsageCardSource).not.toMatch(/SnapIcon/)
  })

  it('VaultScreen still uses Camera for Pro perks and balance display', () => {
    expect(vaultScreenSource).toMatch(/<Camera/)
  })

  it('VaultScreen does not use SnapIcon (marketing/display only)', () => {
    expect(vaultScreenSource).not.toMatch(/SnapIcon/)
  })

  it('PaywallModal still uses Camera for Pro perks list', () => {
    expect(paywallModalSource).toMatch(/<Camera/)
  })

  it('PaywallModal does not use SnapIcon (marketing only)', () => {
    expect(paywallModalSource).not.toMatch(/SnapIcon/)
  })
})

describe('Android launcher / Play Store icon unchanged', () => {
  it('app.json does not reference the camera icon', () => {
    const appJsonPath = path.resolve(repoRoot, 'app.json')
    const appJson = fs.readFileSync(appJsonPath, 'utf8')
    expect(appJson).not.toMatch(/Raw_LifeFlow_Camera_Icon/)
  })

  it('launcher icon assets still exist', () => {
    expect(fs.existsSync(path.resolve(repoRoot, 'assets/icon.png'))).toBe(true)
    expect(fs.existsSync(path.resolve(repoRoot, 'assets/adaptive-icon.png'))).toBe(true)
  })

  it('Play Store icon still exists', () => {
    expect(fs.existsSync(path.resolve(repoRoot, 'assets/play-store-icon.png'))).toBe(true)
  })

  it('splash icon still exists', () => {
    expect(fs.existsSync(path.resolve(repoRoot, 'assets/splash-icon.png'))).toBe(true)
  })
})
