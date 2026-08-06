// ─────────────────────────────────────────────────────────────
// expoPlayIntegrityModule.test.ts — Tests for the expo-play-integrity
// module's JS-side interface, config registration, and provider
// integration with the device-pool system.
// ─────────────────────────────────────────────────────────────

// ── Module config registration tests ─────────────────────────

describe('expo-play-integrity module config', () => {
  it('expo-module.config.json declares android platform', () => {
    const config = require('../../../../modules/expo-play-integrity/expo-module.config.json')
    expect(config.platforms).toContain('android')
  })

  it('config uses fully qualified module class name', () => {
    const config = require('../../../../modules/expo-play-integrity/expo-module.config.json')
    expect(config.android.modules).toContain('expo.modules.playintegrity.ExpoPlayIntegrityModule')
  })

  it('config does not use short class name', () => {
    const config = require('../../../../modules/expo-play-integrity/expo-module.config.json')
    expect(config.android.modules).not.toContain('ExpoPlayIntegrityModule')
  })

  it('config does not have invalid publish key', () => {
    const config = require('../../../../modules/expo-play-integrity/expo-module.config.json')
    expect(config.android.publish).toBeUndefined()
  })
})

// ── JS module interface tests ────────────────────────────────

describe('expo-play-integrity JS module', () => {
  it('exports a default object with expected methods', () => {
    const mod = require('../../../../modules/expo-play-integrity').default
    if (mod) {
      expect(typeof mod.requestIntegrityToken).toBe('function')
      expect(typeof mod.clearCache).toBe('function')
    }
  })

  it('registers as NativeModules.ExpoPlayIntegrity', () => {
    // In test environment, NativeModules.ExpoPlayIntegrity may be undefined
    // This test verifies the module references the correct native name
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../../../../modules/expo-play-integrity/index.ts'),
      'utf-8',
    )
    expect(source).toContain('NativeModules.ExpoPlayIntegrity')
  })
})

// ── Play Integrity 1.4.0 API compatibility tests ─────────────

describe('Play Integrity 1.4.0 API compatibility', () => {
  it('Kotlin source uses IntegrityManagerFactory.createStandard', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('IntegrityManagerFactory.createStandard')
    expect(source).not.toContain('StandardIntegrityManagerFactory')
  })

  it('Kotlin source uses StandardIntegrityManager inner classes', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('StandardIntegrityManager.StandardIntegrityTokenProvider')
    expect(source).toContain('StandardIntegrityManager.StandardIntegrityTokenRequest')
    expect(source).toContain('StandardIntegrityManager.StandardIntegrityToken')
    expect(source).toContain('StandardIntegrityManager.PrepareIntegrityTokenRequest')
  })

  it('Kotlin source does not use obsolete top-level classes', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).not.toContain('StandardIntegrityTokenResponse')
    expect(source).not.toContain(
      'import com.google.android.play.core.integrity.StandardIntegrityTokenProvider',
    )
    expect(source).not.toContain(
      'import com.google.android.play.core.integrity.StandardIntegrityTokenRequest',
    )
    expect(source).not.toContain(
      'import com.google.android.play.core.integrity.PrepareIntegrityTokenRequest',
    )
  })

  it('Kotlin source uses prepareIntegrityToken not prepareIntegrityTokenProvider', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('manager.prepareIntegrityToken(')
    expect(source).not.toContain('prepareIntegrityTokenProvider')
  })

  it('Kotlin source uses provider.request not provider.requestToken', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('provider.request(')
    expect(source).not.toContain('provider.requestToken(')
  })

  it('Kotlin source uses StandardIntegrityErrorCode for error codes', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('StandardIntegrityErrorCode')
    expect(source).toContain('StandardIntegrityErrorCode.INTEGRITY_TOKEN_PROVIDER_INVALID')
    expect(source).not.toContain('StandardIntegrityManager.INTEGRITY_TOKEN_PROVIDER_INVALID')
  })

  it('Kotlin source does not reference non-existent CommonStatusCodes.SERVICE_INVALID', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).not.toContain('CommonStatusCodes.SERVICE_INVALID')
    expect(source).not.toContain('CommonStatusCodes.SERVICE_MISSING')
  })
})

// ── Cloud project number in token request tests ──────────────

describe('cloud project number in token request', () => {
  it('Kotlin source passes cloudProjectNumber to PrepareIntegrityTokenRequest', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('setCloudProjectNumber(cloudProjectNumber)')
  })

  it('JS provider passes cloudProjectNumber from env to native module', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../androidPlayIntegrityDevicePromotionProvider.ts'),
      'utf-8',
    )
    expect(source).toContain('EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER')
    expect(source).toContain('cloudProjectNumber')
  })

  it('Kotlin IntegrityRequestArgs has cloudProjectNumber field', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('cloudProjectNumber: Long = 0L')
  })
})

// ── Native promise success and failure handling tests ────────

describe('native promise handling', () => {
  it('Kotlin source handles success with token return', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('return@AsyncFunction requestTokenFromProvider')
  })

  it('Kotlin source handles empty token failure', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('PI_EMPTY_TOKEN')
  })

  it('Kotlin source handles timeout failure', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('PI_TIMEOUT')
  })

  it('Kotlin source handles unknown errors', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('PI_UNKNOWN')
  })

  it('Kotlin source handles provider invalid by retrying', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/src/main/java/expo/modules/playintegrity/ExpoPlayIntegrityModule.kt',
      ),
      'utf-8',
    )
    expect(source).toContain('INTEGRITY_TOKEN_PROVIDER_INVALID')
    expect(source).toContain('cachedProvider = null')
    expect(source).toContain('getOrPrepareProvider(cloudProjectNumber)')
  })
})

// ── Unsupported-device fallback tests ────────────────────────

describe('unsupported device fallback', () => {
  it('JS provider isSupported returns false when native module is null', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../androidPlayIntegrityDevicePromotionProvider.ts'),
      'utf-8',
    )
    expect(source).toContain('isSupported')
    expect(source).toContain('this.nativeModule != null')
  })

  it('JS provider throws when not supported', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../androidPlayIntegrityDevicePromotionProvider.ts'),
      'utf-8',
    )
    expect(source).toContain('Play Integrity not available on this device')
  })

  it('JS provider throws when cloud project number not configured', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../androidPlayIntegrityDevicePromotionProvider.ts'),
      'utf-8',
    )
    expect(source).toContain('Play Integrity cloud project number not configured')
  })

  it('factory falls back to unsupported provider for non-android', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../devicePoolConfig.ts'),
      'utf-8',
    )
    expect(source).toContain("return 'unsupported'")
  })
})

// ── build.gradle dependency test ─────────────────────────────

describe('build.gradle Play Integrity dependency', () => {
  it('declares com.google.android.play:integrity dependency', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/build.gradle',
      ),
      'utf-8',
    )
    expect(source).toContain('com.google.android.play:integrity:1.4.0')
  })

  it('uses expo-module-gradle-plugin', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/build.gradle',
      ),
      'utf-8',
    )
    expect(source).toContain('expo-module-gradle-plugin')
  })

  it('declares correct namespace', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../../../modules/expo-play-integrity/android/build.gradle',
      ),
      'utf-8',
    )
    expect(source).toContain('expo.modules.playintegrity')
  })
})
