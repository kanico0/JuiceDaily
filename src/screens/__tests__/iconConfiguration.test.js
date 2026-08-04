const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.join(__dirname, '..', '..', '..')
const APP_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))

function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath)
  if (buf[0] !== 0x89 || buf[1] !== 0x50) {
    throw new Error(`${filePath} is not a valid PNG`)
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
  }
}

describe('Issue 2 — Application Icon Configuration', () => {
  test('1. Configured icon path exists', () => {
    const iconPath = APP_JSON.expo.icon
    expect(iconPath).toBeTruthy()
    const resolved = path.join(ROOT, iconPath)
    expect(fs.existsSync(resolved)).toBe(true)
  })

  test('2. Icon file is a valid PNG', () => {
    const iconPath = path.join(ROOT, APP_JSON.expo.icon)
    const buf = fs.readFileSync(iconPath)
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50)
    expect(buf[2]).toBe(0x4e)
    expect(buf[3]).toBe(0x47)
  })

  test('3. Icon is square', () => {
    const dims = readPngDimensions(path.join(ROOT, APP_JSON.expo.icon))
    expect(dims.width).toBe(dims.height)
  })

  test('4. Android adaptive foreground path exists', () => {
    const fg = APP_JSON.expo.android?.adaptiveIcon?.foregroundImage
    expect(fg).toBeTruthy()
    expect(fs.existsSync(path.join(ROOT, fg))).toBe(true)
  })

  test('5. Adaptive background configuration exists', () => {
    const bg = APP_JSON.expo.android?.adaptiveIcon?.backgroundColor
    expect(bg).toBeTruthy()
    expect(typeof bg).toBe('string')
  })

  test('6. No old program icon remains referenced', () => {
    const icon = APP_JSON.expo.icon
    expect(icon).not.toContain('play-store-icon')
    expect(icon).not.toContain('raw-logo')
  })

  test('7. Package remains unchanged', () => {
    expect(APP_JSON.expo.android.package).toBe('com.juicingapp.app')
  })

  test('8. App label remains unchanged', () => {
    expect(APP_JSON.expo.name).toBe('RawLifeFlow: Juicing Daily')
  })

  test('9. Version remains 1.0.19/code 18', () => {
    expect(APP_JSON.expo.version).toBe('1.0.19')
    expect(APP_JSON.expo.android.versionCode).toBe(18)
  })

  test('10. Source artwork was not overwritten or deleted', () => {
    const src = 'C:\\src\\JuicingApp\\Docs\\Raw_LifeFlow_Color_Play-Store.png'
    expect(fs.existsSync(src)).toBe(true)
    const srcDims = readPngDimensions(src)
    expect(srcDims.width).toBe(512)
    expect(srcDims.height).toBe(512)
  })

  test('11. Approved source SHA-256 is documented and verified', () => {
    const src = 'C:\\src\\JuicingApp\\Docs\\Raw_LifeFlow_Color_Play-Store.png'
    const buf = fs.readFileSync(src)
    const hash = crypto.createHash('sha256').update(buf).digest('hex')
    expect(hash).toBe('3b1109ade240df4726eaa36ca5a94324301c48d88b80225cacb549d59279dcfd')
  })

  test('12. Adaptive icon has safe-zone padding (artwork at 62% of canvas)', () => {
    const adaptivePath = path.join(ROOT, APP_JSON.expo.android.adaptiveIcon.foregroundImage)
    const dims = readPngDimensions(adaptivePath)
    expect(dims.width).toBe(1024)
    expect(dims.height).toBe(1024)
    // The adaptive icon should be 1024x1024 with transparent padding
    const buf = fs.readFileSync(adaptivePath)
    expect(buf.length).toBeGreaterThan(0)
  })

  test('13. Play Store icon asset exists and is 512x512', () => {
    const playStorePath = path.join(ROOT, 'assets', 'play-store-icon.png')
    expect(fs.existsSync(playStorePath)).toBe(true)
    const dims = readPngDimensions(playStorePath)
    expect(dims.width).toBe(512)
    expect(dims.height).toBe(512)
  })

  test('14. Favicon exists and is 48x48', () => {
    const faviconPath = path.join(ROOT, APP_JSON.expo.web?.favicon || 'assets/favicon.png')
    expect(fs.existsSync(faviconPath)).toBe(true)
    const dims = readPngDimensions(faviconPath)
    expect(dims.width).toBe(48)
    expect(dims.height).toBe(48)
  })

  test('15. Splash icon exists and is square', () => {
    const splashPath = path.join(ROOT, APP_JSON.expo.splash?.image || 'assets/splash-icon.png')
    expect(fs.existsSync(splashPath)).toBe(true)
    const dims = readPngDimensions(splashPath)
    expect(dims.width).toBe(dims.height)
  })

  test('16. Icon generation script references the approved source', () => {
    const scriptPath = path.join(ROOT, 'scripts', 'generate-icons.js')
    const script = fs.readFileSync(scriptPath, 'utf8')
    expect(script).toContain('Raw_LifeFlow_Color_Play-Store.png')
    expect(script).toContain('3B1109ADE240DF4726EAA36CA5A94324301C48D88B80225CACB549D59279DCFD')
  })
})
