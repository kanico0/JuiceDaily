// ─────────────────────────────────────────────────────────────
// android-package-flavors.js — Local Expo config plugin that
// preserves the side-by-side beta product flavor during Android
// prebuild.
//
// PRODUCTION applicationId: com.rawlifeflow.juicingdaily
//   (from app.json expo.android.package — not modified here)
//
// BETA applicationId: com.juicingapp.app.beta
//   (explicit — NOT a suffix of production, so the existing
//    beta installation upgrades in-place and does NOT become
//    com.rawlifeflow.juicingdaily.beta)
//
// This plugin is idempotent: if the flavor block already exists
// in build.gradle (e.g. from a previous prebuild without --clean),
// it does not duplicate it.
//
// The beta app label "RawLifeFlow Beta" is written to
// android/app/src/beta/res/values/strings.xml so the beta flavor
// shows a distinct label in the launcher.
// ─────────────────────────────────────────────────────────────

const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

const BETA_APPLICATION_ID = 'com.juicingapp.app.beta'
const BETA_APP_LABEL = 'RawLifeFlow Beta'

const FLAVOR_BLOCK = `
    // ── Product flavors for side-by-side beta distribution ──
    // production: default flavor, applicationId stays com.rawlifeflow.juicingdaily
    // beta: side-by-side beta, applicationId is explicitly com.juicingapp.app.beta
    //   (preserved from the prior beta package so existing installs upgrade
    //    in-place; do NOT use applicationIdSuffix here or it would append
    //    to the new production applicationId and change the beta identity.)
    // The beta flavor installs as a separate app alongside production.
    flavorDimensions "distribution"
    productFlavors {
        production {
            dimension "distribution"
        }
        beta {
            dimension "distribution"
            applicationId '${BETA_APPLICATION_ID}'
        }
    }
`

/**
 * Insert the flavor block into android/app/build.gradle between
 * the end of defaultConfig { ... } and the start of signingConfigs.
 * Idempotent: skips if flavorDimensions already present.
 */
function addProductFlavors(buildGradleContent) {
  if (buildGradleContent.includes('flavorDimensions "distribution"')) {
    return buildGradleContent
  }

  // Insert after the closing brace of defaultConfig { ... }
  // The defaultConfig block ends with:
  //   }
  // and is followed by:
  //   signingConfigs {
  const defaultConfigEnd = buildGradleContent.indexOf('signingConfigs {')

  if (defaultConfigEnd === -1) {
    throw new Error(
      '[android-package-flavors] Could not find signingConfigs block in build.gradle',
    )
  }

  return (
    buildGradleContent.slice(0, defaultConfigEnd) +
    FLAVOR_BLOCK +
    '\n    ' +
    buildGradleContent.slice(defaultConfigEnd)
  )
}

/**
 * Update debuggableVariants in the react { } block so Gradle
 * knows which variants to skip JS bundling for.
 * Idempotent: skips if debuggableVariants already set.
 */
function addDebuggableVariants(buildGradleContent) {
  // Check for an ACTIVE (uncommented) debuggableVariants assignment.
  // The Expo template has a commented-out example:
  //   // debuggableVariants = ["liteDebug", "prodDebug"]
  // We must NOT match that comment.
  const activeRegex = /^\s*debuggableVariants\s*=/m
  if (activeRegex.test(buildGradleContent)) {
    return buildGradleContent
  }

  // Replace the commented-out example line with the real one.
  // Use a regex to handle any leading whitespace.
  const commentedRegex =
    /(\s*)\/\/\s*debuggableVariants\s*=\s*\["liteDebug",\s*"prodDebug"\]/

  if (commentedRegex.test(buildGradleContent)) {
    return buildGradleContent.replace(
      commentedRegex,
      '$1debuggableVariants = ["productionDebug", "betaDebug"]',
    )
  }

  // Fallback: insert after the react { opening
  const reactOpen = buildGradleContent.indexOf('react {')
  if (reactOpen === -1) {
    return buildGradleContent
  }

  const insertPos = buildGradleContent.indexOf('\n', reactOpen) + 1
  return (
    buildGradleContent.slice(0, insertPos) +
    '    debuggableVariants = ["productionDebug", "betaDebug"]\n' +
    buildGradleContent.slice(insertPos)
  )
}

/**
 * Create the beta source set with strings.xml so the beta flavor
 * has a distinct app label.
 */
function createBetaStrings(androidProjectDir) {
  const betaStringsDir = path.join(
    androidProjectDir,
    'app',
    'src',
    'beta',
    'res',
    'values',
  )
  const betaStringsPath = path.join(betaStringsDir, 'strings.xml')

  if (fs.existsSync(betaStringsPath)) {
    return
  }

  fs.mkdirSync(betaStringsDir, { recursive: true })
  fs.writeFileSync(
    betaStringsPath,
    `<resources>\n  <string name="app_name">${BETA_APP_LABEL}</string>\n</resources>\n`,
  )
}

module.exports = (config) => {
  // 1. Modify android/app/build.gradle to add product flavors
  config = withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === 'groovy') {
      let contents = modConfig.modResults.contents
      contents = addProductFlavors(contents)
      contents = addDebuggableVariants(contents)
      modConfig.modResults.contents = contents
    }
    return modConfig
  })

  // 2. Create beta source set with strings.xml
  //    Use withProjectBuildGradle as a convenient hook that runs
  //    during Android prebuild with access to the platformProjectRoot.
  config = withProjectBuildGradle(config, (modConfig) => {
    const androidProjectDir = modConfig.modRequest.platformProjectRoot
    if (androidProjectDir) {
      createBetaStrings(androidProjectDir)
    }
    return modConfig
  })

  return config
}
