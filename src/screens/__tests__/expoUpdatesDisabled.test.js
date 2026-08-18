// expoUpdatesDisabled.test.js — Tests for H4: native Expo Updates disabled.
//
// Proves the committed native Android configuration has:
// - expo.modules.updates.ENABLED = false
// - runtime version = 1.0.20-local-build
//
// Does NOT rely on app.config.js alone — inspects the actual native
// manifest and resources that are packaged into the APK.

const fs = require('fs')
const path = require('path')

const manifestPath = path.resolve(__dirname, '../../../android/app/src/main/AndroidManifest.xml')
const manifestSource = fs.readFileSync(manifestPath, 'utf8')

const stringsPath = path.resolve(__dirname, '../../../android/app/src/main/res/values/strings.xml')
const stringsSource = fs.readFileSync(stringsPath, 'utf8')

describe('H4: Native Expo Updates disabled', () => {
  describe('AndroidManifest.xml', () => {
    it('1. expo.modules.updates.ENABLED is false', () => {
      expect(manifestSource).toMatch(/expo\.modules\.updates\.ENABLED.*android:value="false"/)
    })

    it('2. does NOT have ENABLED=true', () => {
      expect(manifestSource).not.toMatch(/expo\.modules\.updates\.ENABLED.*android:value="true"/)
    })

    it('3. EXPO_UPDATES_CHECK_ON_LAUNCH is still present (not removed)', () => {
      expect(manifestSource).toMatch(/EXPO_UPDATES_CHECK_ON_LAUNCH/)
    })

    it('4. EXPO_UPDATE_URL is still present (not removed)', () => {
      expect(manifestSource).toMatch(/EXPO_UPDATE_URL/)
    })
  })

  describe('strings.xml runtime version', () => {
    it('5. expo_runtime_version is 1.0.20-local-build', () => {
      expect(stringsSource).toMatch(/expo_runtime_version.*1\.0\.20-local-build/)
    })

    it('6. does NOT have bare 1.0.20 as runtime version', () => {
      // The old value was exactly "1.0.20" which could match OTA updates
      // published for app version 1.0.20.
      expect(stringsSource).not.toMatch(/expo_runtime_version">1\.0\.20</)
    })
  })

  describe('app.config.js intent is aligned', () => {
    it('7. app.config.js still declares updates.enabled = false', () => {
      const configPath = path.resolve(__dirname, '../../../app.config.js')
      const configSource = fs.readFileSync(configPath, 'utf8')
      expect(configSource).toMatch(/enabled:\s*false/)
    })
  })
})
