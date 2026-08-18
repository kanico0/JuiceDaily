// ─────────────────────────────────────────────────────────────
// androidPackageIdentity.test.js — Regression coverage for the
// Android production package migration from com.juicingapp.app
// to com.rawlifeflow.juicingdaily.
//
// Proves:
//   A. Expo Android production package is com.rawlifeflow.juicingdaily
//   B. Android production applicationId is com.rawlifeflow.juicingdaily
//   C. Android namespace is com.rawlifeflow.juicingdaily
//   D. Beta applicationId remains EXACTLY com.juicingapp.app.beta
//   E. Play Integrity source fallback package is com.rawlifeflow.juicingdaily
//   F. Device Recall writer source fallback package is com.rawlifeflow.juicingdaily
//   G. Production Play Integrity tests use com.rawlifeflow.juicingdaily
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const APP_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
const BUILD_GRADLE = fs.readFileSync(
  path.join(ROOT, 'android', 'app', 'build.gradle'),
  'utf8',
)

const PRODUCTION_PACKAGE = 'com.rawlifeflow.juicingdaily'
const BETA_PACKAGE = 'com.juicingapp.app.beta'

describe('Android Package Identity Migration', () => {
  // A. Expo Android production package
  test('A. Expo android.package is com.rawlifeflow.juicingdaily', () => {
    expect(APP_JSON.expo.android.package).toBe(PRODUCTION_PACKAGE)
  })

  // B. Android production applicationId
  test('B. build.gradle defaultConfig applicationId is com.rawlifeflow.juicingdaily', () => {
    expect(BUILD_GRADLE).toContain(
      `applicationId '${PRODUCTION_PACKAGE}'`,
    )
  })

  // C. Android namespace
  test('C. build.gradle namespace is com.rawlifeflow.juicingdaily', () => {
    expect(BUILD_GRADLE).toContain(`namespace '${PRODUCTION_PACKAGE}'`)
  })

  // D. Beta applicationId remains EXACTLY com.juicingapp.app.beta
  test('D. beta flavor applicationId is explicitly com.juicingapp.app.beta (not a suffix)', () => {
    // The beta flavor must use an explicit applicationId, NOT applicationIdSuffix
    expect(BUILD_GRADLE).toContain(`applicationId '${BETA_PACKAGE}'`)
    // Ensure NO active applicationIdSuffix directive remains in productFlavors
    // (comments mentioning it are fine, but no actual Gradle statement)
    const flavorBlockMatch = BUILD_GRADLE.match(
      /productFlavors\s*\{([\s\S]*?)\n\s*\}/,
    )
    expect(flavorBlockMatch).not.toBeNull()
    const flavorBlock = flavorBlockMatch[1]
    expect(flavorBlock).not.toMatch(/^\s*applicationIdSuffix\b/m)
  })

  test('D2. beta applicationId does NOT derive from production package', () => {
    // If someone accidentally used applicationIdSuffix ".beta" on the new
    // production applicationId, it would produce com.rawlifeflow.juicingdaily.beta
    // which is NOT the preserved beta identity.
    expect(BUILD_GRADLE).not.toContain(
      'com.rawlifeflow.juicingdaily.beta',
    )
  })

  // E & F. Play Integrity / Device Recall source fallbacks
  test('E/F. analyze-scan source fallback is com.rawlifeflow.juicingdaily', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'supabase', 'functions', 'analyze-scan', 'index.ts'),
      'utf8',
    )
    expect(source).toContain(
      `?? '${PRODUCTION_PACKAGE}'`,
    )
    // Must NOT fall back to the old production package
    expect(source).not.toContain(`?? 'com.juicingapp.app'`)
  })

  test('E/F. analyze-blend source fallback is com.rawlifeflow.juicingdaily', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'supabase', 'functions', 'analyze-blend', 'index.ts'),
      'utf8',
    )
    expect(source).toContain(
      `?? '${PRODUCTION_PACKAGE}'`,
    )
    expect(source).not.toContain(`?? 'com.juicingapp.app'`)
  })

  // G. Production Play Integrity tests use the new package
  test('G. playIntegrityVerifierDeviceRecall test uses com.rawlifeflow.juicingdaily', () => {
    const source = fs.readFileSync(
      path.join(
        ROOT,
        'supabase',
        'functions',
        '__tests__',
        'playIntegrityVerifierDeviceRecall.test.ts',
      ),
      'utf8',
    )
    expect(source).toContain(`'${PRODUCTION_PACKAGE}'`)
    expect(source).not.toContain(
      `const PACKAGE_NAME = 'com.juicingapp.app'`,
    )
  })

  test('G2. deviceRecallWriter test uses com.rawlifeflow.juicingdaily', () => {
    const source = fs.readFileSync(
      path.join(
        ROOT,
        'supabase',
        'functions',
        '__tests__',
        'deviceRecallWriter.test.ts',
      ),
      'utf8',
    )
    expect(source).toContain(`packageName: '${PRODUCTION_PACKAGE}'`)
  })

  // Kotlin package declarations
  test('MainActivity.kt package declaration is com.rawlifeflow.juicingdaily', () => {
    const source = fs.readFileSync(
      path.join(
        ROOT,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'rawlifeflow',
        'juicingdaily',
        'MainActivity.kt',
      ),
      'utf8',
    )
    expect(source.startsWith(`package ${PRODUCTION_PACKAGE}`)).toBe(true)
  })

  test('MainApplication.kt package declaration is com.rawlifeflow.juicingdaily', () => {
    const source = fs.readFileSync(
      path.join(
        ROOT,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'rawlifeflow',
        'juicingdaily',
        'MainApplication.kt',
      ),
      'utf8',
    )
    expect(source.startsWith(`package ${PRODUCTION_PACKAGE}`)).toBe(true)
  })

  test('old Kotlin source path no longer exists', () => {
    const oldPath = path.join(
      ROOT,
      'android',
      'app',
      'src',
      'main',
      'java',
      'com',
      'juicingapp',
    )
    expect(fs.existsSync(oldPath)).toBe(false)
  })

  // Deferred items must NOT be changed
  test('iOS bundleIdentifier remains unchanged (deferred)', () => {
    const config = fs.readFileSync(path.join(ROOT, 'app.config.js'), 'utf8')
    expect(config).toContain("bundleIdentifier: 'com.juicingapp.app'")
  })

  test('deep-link scheme remains juicingapp (deferred)', () => {
    expect(APP_JSON.expo.scheme).toBe('juicingapp')
  })

  test('Apple product IDs remain unchanged (deferred)', () => {
    const config = fs.readFileSync(
      path.join(
        ROOT,
        'src',
        'services',
        'subscriptions',
        'subscriptionConfig.ts',
      ),
      'utf8',
    )
    expect(config).toContain('com.juicingapp.app.pro.monthly')
    expect(config).toContain('com.juicingapp.app.pro.annual')
  })
})
