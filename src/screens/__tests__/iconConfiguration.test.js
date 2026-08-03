const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..', '..')
const APP_JSON = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'),
)

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

  test('9. Version remains 1.0.15/code 14', () => {
    expect(APP_JSON.expo.version).toBe('1.0.15')
    expect(APP_JSON.expo.android.versionCode).toBe(14)
  })

  test('10. Source artwork was not overwritten or deleted', () => {
    const src = 'C:\\src\\JuicingApp\\Docs\\Raw_LifeFlow_Color_Play-Store.png'
    expect(fs.existsSync(src)).toBe(true)
    const srcDims = readPngDimensions(src)
    expect(srcDims.width).toBe(512)
    expect(srcDims.height).toBe(512)
  })
})
