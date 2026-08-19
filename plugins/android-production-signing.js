// ─────────────────────────────────────────────────────────────
// android-production-signing.js — Local Expo config plugin that
// configures production release signing with a dedicated upload
// keystore during Android prebuild.
//
// The signing credentials are read from the user-level Gradle
// properties file (~/.gradle/gradle.properties) using these names:
//
//   RAWLIFEFLOW_UPLOAD_STORE_FILE
//   RAWLIFEFLOW_UPLOAD_STORE_PASSWORD
//   RAWLIFEFLOW_UPLOAD_KEY_ALIAS
//   RAWLIFEFLOW_UPLOAD_KEY_PASSWORD
//
// This plugin:
//   - Adds a "rawlifeflowUpload" signingConfig to build.gradle
//   - Sets the release build type to use rawlifeflowUpload
//   - Does NOT modify debug or beta signing
//   - Does NOT embed passwords in source
//   - Is idempotent (skips if rawlifeflowUpload already present)
//
// FAIL-CLOSED: If the signing properties are absent, the release
// build type is left WITHOUT a signingConfig (not debug), causing
// bundleProductionRelease to fail with a clear Gradle error rather
// than silently producing a debug-signed AAB.
// ─────────────────────────────────────────────────────────────

const { withAppBuildGradle } = require('expo/config-plugins')

const SIGNING_CONFIG_NAME = 'rawlifeflowUpload'

const SIGNING_CONFIG_BLOCK = `
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        ${SIGNING_CONFIG_NAME} {
            storeFile file(RAWLIFEFLOW_UPLOAD_STORE_FILE)
            storePassword RAWLIFEFLOW_UPLOAD_STORE_PASSWORD
            keyAlias RAWLIFEFLOW_UPLOAD_KEY_ALIAS
            keyPassword RAWLIFEFLOW_UPLOAD_KEY_PASSWORD
        }
    }
`

const RELEASE_BLOCK = `    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.${SIGNING_CONFIG_NAME}
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
            shrinkResources enableShrinkResources.toBoolean()
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
            crunchPngs enablePngCrunchInRelease.toBoolean()
        }
    }
`

/**
 * Replace the signingConfigs and buildTypes blocks in build.gradle.
 * Idempotent: skips if rawlifeflowUpload signingConfig already present.
 */
function applyProductionSigning (buildGradleContent) {
  if (buildGradleContent.includes(`${SIGNING_CONFIG_NAME} {`)) {
    return buildGradleContent
  }

  // Replace the signingConfigs { ... } block
  const signingConfigsRegex = /    signingConfigs \{[\s\S]*?\n    \}/
  if (!signingConfigsRegex.test(buildGradleContent)) {
    throw new Error(
      '[android-production-signing] Could not find signingConfigs block in build.gradle',
    )
  }
  buildGradleContent = buildGradleContent.replace(
    signingConfigsRegex,
    SIGNING_CONFIG_BLOCK.trimEnd(),
  )

  // Replace the buildTypes { ... } block
  const buildTypesRegex = /    buildTypes \{[\s\S]*?\n    \}/
  if (!buildTypesRegex.test(buildGradleContent)) {
    throw new Error(
      '[android-production-signing] Could not find buildTypes block in build.gradle',
    )
  }
  buildGradleContent = buildGradleContent.replace(
    buildTypesRegex,
    RELEASE_BLOCK.trimEnd(),
  )

  return buildGradleContent
}

module.exports = (config) => {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === 'groovy') {
      modConfig.modResults.contents = applyProductionSigning(
        modConfig.modResults.contents,
      )
    }
    return modConfig
  })
}
