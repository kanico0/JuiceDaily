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

  // iOS identifiers migrated to com.rawlifeflow.juicingdaily for 1.0.22
  test('iOS bundleIdentifier is com.rawlifeflow.juicingdaily', () => {
    const config = fs.readFileSync(path.join(ROOT, 'app.config.js'), 'utf8')
    expect(config).toContain("bundleIdentifier: 'com.rawlifeflow.juicingdaily'")
  })

  test('deep-link scheme remains juicingapp (deferred)', () => {
    expect(APP_JSON.expo.scheme).toBe('juicingapp')
  })

  test('Apple product IDs are com.rawlifeflow.juicingdaily.pro.*', () => {
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
    expect(config).toContain('com.rawlifeflow.juicingdaily.pro.monthly')
    expect(config).toContain('com.rawlifeflow.juicingdaily.pro.annual')
  })
})

// ─────────────────────────────────────────────────────────────
// TRACKED SOURCE DURABILITY — proves the config plugin (not just
// the generated build.gradle) preserves the beta identity across
// a clean Expo prebuild.
// ─────────────────────────────────────────────────────────────

describe('Android Package Identity — Tracked Source Durability', () => {
  const PLUGIN_PATH = path.join(ROOT, 'plugins', 'android-package-flavors.js')

  test('config plugin is registered in app.json', () => {
    expect(APP_JSON.expo.plugins).toContain(
      './plugins/android-package-flavors',
    )
  })

  test('config plugin file exists and is tracked', () => {
    expect(fs.existsSync(PLUGIN_PATH)).toBe(true)
  })

  test('B. plugin preserves beta applicationId com.juicingapp.app.beta', () => {
    const plugin = fs.readFileSync(PLUGIN_PATH, 'utf8')
    // The plugin defines the beta application ID as a constant
    expect(plugin).toContain(`const BETA_APPLICATION_ID = '${BETA_PACKAGE}'`)
    // And uses it in the flavor block
    expect(plugin).toContain("applicationId '${BETA_APPLICATION_ID}'")
  })

  test('C. plugin does NOT use applicationIdSuffix (would derive from production)', () => {
    const plugin = fs.readFileSync(PLUGIN_PATH, 'utf8')
    // The plugin must not contain applicationIdSuffix as an active directive
    expect(plugin).not.toMatch(/^\s*applicationIdSuffix\b/m)
  })

  test('C2. plugin FLAVOR_BLOCK does NOT produce com.rawlifeflow.juicingdaily.beta', () => {
    const plugin = fs.readFileSync(PLUGIN_PATH, 'utf8')
    // Extract the FLAVOR_BLOCK template string (the actual Gradle code
    // inserted into build.gradle). Comments in the plugin file itself
    // may mention the wrong package as a warning — that's fine.
    const flavorBlockMatch = plugin.match(
      /const FLAVOR_BLOCK = `([\s\S]*?)`/,
    )
    expect(flavorBlockMatch).not.toBeNull()
    const flavorBlock = flavorBlockMatch[1]
    expect(flavorBlock).not.toContain('com.rawlifeflow.juicingdaily.beta')
    // The flavor block must use the explicit beta applicationId
    expect(flavorBlock).toContain("applicationId '${BETA_APPLICATION_ID}'")
  })

  test('D. production and beta IDs are deliberately independent', () => {
    const plugin = fs.readFileSync(PLUGIN_PATH, 'utf8')
    // The plugin must contain BOTH the production and beta identities
    // as separate, independent values — not derived from each other.
    expect(plugin).toContain(PRODUCTION_PACKAGE)
    expect(plugin).toContain(BETA_PACKAGE)
    // They must NOT be the same
    expect(PRODUCTION_PACKAGE).not.toBe(BETA_PACKAGE)
  })

  test('D2. plugin preserves beta label "RawLifeFlow Beta"', () => {
    const plugin = fs.readFileSync(PLUGIN_PATH, 'utf8')
    expect(plugin).toContain('RawLifeFlow Beta')
  })

  test('plugin is idempotent (checks for existing flavorDimensions)', () => {
    const plugin = fs.readFileSync(PLUGIN_PATH, 'utf8')
    expect(plugin).toMatch(/flavorDimensions "distribution"/)
    // The addProductFlavors function must check before inserting
    expect(plugin).toMatch(/includes\('flavorDimensions "distribution"'\)/)
  })
})

// ─────────────────────────────────────────────────────────────
// PRODUCTION SIGNING DURABILITY — proves the signing config plugin
// generates a proper release signingConfig that uses the upload
// keystore, NOT the debug keystore.
// ─────────────────────────────────────────────────────────────

describe('Android Production Signing — Tracked Source Durability', () => {
  const SIGNING_PLUGIN_PATH = path.join(
    ROOT,
    'plugins',
    'android-production-signing.js',
  )

  test('signing config plugin is registered in app.json', () => {
    expect(APP_JSON.expo.plugins).toContain(
      './plugins/android-production-signing',
    )
  })

  test('signing config plugin file exists and is tracked', () => {
    expect(fs.existsSync(SIGNING_PLUGIN_PATH)).toBe(true)
  })

  test('plugin defines rawlifeflowUpload signingConfig', () => {
    const plugin = fs.readFileSync(SIGNING_PLUGIN_PATH, 'utf8')
    expect(plugin).toContain('rawlifeflowUpload')
  })

  test('plugin reads from user gradle.properties (not source)', () => {
    const plugin = fs.readFileSync(SIGNING_PLUGIN_PATH, 'utf8')
    expect(plugin).toContain('RAWLIFEFLOW_UPLOAD_STORE_FILE')
    expect(plugin).toContain('RAWLIFEFLOW_UPLOAD_STORE_PASSWORD')
    expect(plugin).toContain('RAWLIFEFLOW_UPLOAD_KEY_ALIAS')
    expect(plugin).toContain('RAWLIFEFLOW_UPLOAD_KEY_PASSWORD')
  })

  test('plugin does NOT embed production passwords in source', () => {
    const plugin = fs.readFileSync(SIGNING_PLUGIN_PATH, 'utf8')
    // The SIGNING_CONFIG_BLOCK template string must use gradle
    // property references, not hardcoded password values.
    const blockMatch = plugin.match(
      /const SIGNING_CONFIG_BLOCK = `([\s\S]*?)`/,
    )
    expect(blockMatch).not.toBeNull()
    const block = blockMatch[1]
    expect(block).toContain('RAWLIFEFLOW_UPLOAD_STORE_PASSWORD')
    expect(block).toContain('RAWLIFEFLOW_UPLOAD_KEY_PASSWORD')
    // The upload config must NOT contain hardcoded password literals.
    // (The debug block legitimately uses 'android' — that's fine.)
    // Extract just the upload config portion using the template var.
    const uploadSection = block.match(
      /\$\{SIGNING_CONFIG_NAME\} \{[\s\S]*?\}/,
    )
    expect(uploadSection).not.toBeNull()
    expect(uploadSection[0]).not.toMatch(/storePassword\s*['"][^'"]+['"]/)
    expect(uploadSection[0]).not.toMatch(/keyPassword\s*['"][^'"]+['"]/)
  })

  test('plugin sets release to use rawlifeflowUpload, NOT debug', () => {
    const plugin = fs.readFileSync(SIGNING_PLUGIN_PATH, 'utf8')
    // The RELEASE_BLOCK template uses ${SIGNING_CONFIG_NAME} which
    // resolves to 'rawlifeflowUpload'. Check the template content.
    const releaseBlockMatch = plugin.match(
      /const RELEASE_BLOCK = `([\s\S]*?)`/,
    )
    expect(releaseBlockMatch).not.toBeNull()
    const releaseBlock = releaseBlockMatch[1]
    // The release buildType must use the upload signingConfig
    const releaseSection = releaseBlock.match(
      /release \{[\s\S]*?\}/,
    )
    expect(releaseSection).not.toBeNull()
    expect(releaseSection[0]).toContain(
      'signingConfig signingConfigs.${SIGNING_CONFIG_NAME}',
    )
    // The release section must NOT reference debug
    expect(releaseSection[0]).not.toContain('signingConfigs.debug')
  })

  test('plugin does NOT modify debug signing', () => {
    const plugin = fs.readFileSync(SIGNING_PLUGIN_PATH, 'utf8')
    // Debug block must still use debug signingConfig
    const debugMatch = plugin.match(/debug \{[\s\S]*?signingConfig[\s\S]*?\}/)
    expect(debugMatch).not.toBeNull()
    expect(debugMatch[0]).toContain('signingConfigs.debug')
  })

  test('plugin is idempotent (checks for existing signingConfig)', () => {
    const plugin = fs.readFileSync(SIGNING_PLUGIN_PATH, 'utf8')
    expect(plugin).toMatch(/includes\(`\$\{SIGNING_CONFIG_NAME\} \{`\)/)
  })

  test('plugin does NOT modify iOS', () => {
    const plugin = fs.readFileSync(SIGNING_PLUGIN_PATH, 'utf8')
    expect(plugin.toLowerCase()).not.toContain('ios')
    expect(plugin.toLowerCase()).not.toContain('bundleIdentifier')
  })
})
