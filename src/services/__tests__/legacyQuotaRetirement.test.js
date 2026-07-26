/* eslint-env jest, node */

const fs = require('fs')
const path = require('path')

function readSource(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8')
}

function readRoot(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', '..', ...segments), 'utf8')
}

describe('Legacy quota UI retirement', () => {
  test('ProStore no longer exposes snapInfo', () => {
    const source = readSource('services', 'ProStore.js')
    expect(source).not.toContain('snapInfo')
  })

  test('ProStore retains unrelated functionality (isPro, subscribe, hasFeatureAccess, toggleDevPro)', () => {
    const source = readSource('services', 'ProStore.js')
    expect(source).toContain('isPro')
    expect(source).toContain('subscribe')
    expect(source).toContain('hasFeatureAccess')
    expect(source).toContain('toggleDevPro')
    expect(source).toContain('usePro')
  })

  test('VaultScreen is no longer imported in App.js', () => {
    const source = readRoot('App.js')
    expect(source).not.toContain('import VaultScreen')
    expect(source).not.toContain("from './src/screens/VaultScreen'")
  })

  test('VaultScreen is no longer registered in navigation', () => {
    const source = readRoot('App.js')
    expect(source).not.toContain('name="Vault"')
    expect(source).not.toContain('component={VaultScreen}')
  })

  test('SnapGateModal has no production imports', () => {
    const screensDir = path.join(__dirname, '..', '..', 'screens')
    const componentsDir = path.join(__dirname, '..', '..', 'components')

    function checkDir(dir) {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        if (item.endsWith('.js') && !item.includes('__tests__')) {
          const content = fs.readFileSync(path.join(dir, item), 'utf8')
          expect(content).not.toContain('import SnapGateModal')
          expect(content).not.toContain('<SnapGateModal')
        }
      }
    }

    checkDir(screensDir)
    checkDir(componentsDir)
  })

  test('no active production import of ProStore.snapInfo', () => {
    const screensDir = path.join(__dirname, '..', '..', 'screens')
    const componentsDir = path.join(__dirname, '..', '..', 'components')
    const dormantFiles = ['VaultScreen.js', 'SnapGateModal.js']

    function checkDir(dir) {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        if (item.endsWith('.js') && !item.includes('__tests__') && !dormantFiles.includes(item)) {
          const content = fs.readFileSync(path.join(dir, item), 'utf8')
          expect(content).not.toContain('snapInfo')
        }
      }
    }

    checkDir(screensDir)
    checkDir(componentsDir)
  })

  test('active quota screens use QuotaStore and selectors, not ProStore snapInfo', () => {
    const homeSource = readSource('screens', 'HomeScreen.js')
    expect(homeSource).toContain('useQuota')
    expect(homeSource).toContain('getQuotaDisplay')
    expect(homeSource).not.toContain('snapInfo')

    const cameraSource = readSource('screens', 'CameraScreen.js')
    expect(cameraSource).toContain('useQuota')
    expect(cameraSource).toContain('getQuotaDisplay')
    expect(cameraSource).not.toContain('snapInfo')

    const settingsSource = readSource('screens', 'SettingsScreen.js')
    expect(settingsSource).toContain('useQuota')
    expect(settingsSource).toContain('getQuotaDisplay')
    expect(settingsSource).not.toContain('snapInfo')

    const scanPlanSource = readSource('components', 'ScanPlanModal.js')
    expect(scanPlanSource).toContain('getQuotaDisplay')
    expect(scanPlanSource).not.toContain('snapInfo')

    const scanQuotaSource = readSource('components', 'ScanQuotaReachedModal.js')
    expect(scanQuotaSource).not.toContain('snapInfo')
  })
})
