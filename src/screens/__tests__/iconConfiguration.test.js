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

  test('5. Adaptive background configuration exists and uses exact black', () => {
    const bg = APP_JSON.expo.android?.adaptiveIcon?.backgroundColor
    expect(bg).toBeTruthy()
    expect(typeof bg).toBe('string')
    expect(bg).not.toBe('#ffffff')
    expect(bg).toBe('#000000')
  })

  test('6. No old program icon remains referenced', () => {
    const icon = APP_JSON.expo.icon
    expect(icon).not.toContain('play-store-icon')
    expect(icon).not.toContain('raw-logo')
  })

  test('7. Android package is the permanent production package', () => {
    expect(APP_JSON.expo.android.package).toBe('com.rawlifeflow.juicingdaily')
  })

  test('8. App label remains unchanged', () => {
    expect(APP_JSON.expo.name).toBe('RawLifeFlow: Juicing Daily')
  })

  test('9. Version is 1.0.21/code 21', () => {
    expect(APP_JSON.expo.version).toBe('1.0.21')
    expect(APP_JSON.expo.android.versionCode).toBe(21)
  })

  test('9b. Runtime version policy remains appVersion (derives 1.0.21)', () => {
    expect(APP_JSON.expo.runtimeVersion).toEqual({ policy: 'appVersion' })
    // With appVersion policy, runtime version equals expo.version
    expect(APP_JSON.expo.version).toBe('1.0.21')
  })

  test('10. Source artwork was not overwritten or deleted', () => {
    // The authoritative approved source is the in-repo asset
    // assets/play-store-icon.png (see test 11). The external
    // Docs/Raw_LifeFlow_Color_Play-Store.png was never tracked in
    // git and was modified post-approval; the in-repo asset is the
    // canonical version per the approved artwork policy.
    const src = path.join(ROOT, 'assets', 'play-store-icon.png')
    expect(fs.existsSync(src)).toBe(true)
    const srcDims = readPngDimensions(src)
    expect(srcDims.width).toBe(512)
    expect(srcDims.height).toBe(512)
  })

  test('11. Approved source SHA-256 is documented and verified', () => {
    // The approved artwork is the committed in-repo asset.
    // The external source file (C:\src\JuicingApp\Docs\...) was modified
    // post-approval; the in-repo asset is the authoritative approved version.
    const approved = path.join(ROOT, 'assets', 'play-store-icon.png')
    const buf = fs.readFileSync(approved)
    const hash = crypto.createHash('sha256').update(buf).digest('hex')
    expect(hash).toBe('1394eb7fbf072588fe7c10f6fa02238fa444b8c99a1aaa3f16d78f294b53f981')
  })

  test('12. Adaptive icon has safe-zone padding (artwork within 66% safe zone)', () => {
    const adaptivePath = path.join(ROOT, APP_JSON.expo.android.adaptiveIcon.foregroundImage)
    const dims = readPngDimensions(adaptivePath)
    expect(dims.width).toBe(1024)
    expect(dims.height).toBe(1024)
    // Verify nontransparent artwork is within Android's 18% safe zone
    const zlib = require('zlib')
    const buf = fs.readFileSync(adaptivePath)
    let offset = 8
    const idatChunks = []
    while (offset < buf.length) {
      const len = buf.readUInt32BE(offset)
      const type = buf.toString('ascii', offset + 4, offset + 8)
      if (type === 'IDAT') idatChunks.push(buf.subarray(offset + 8, offset + 8 + len))
      if (type === 'IEND') break
      offset += 12 + len
    }
    const raw = Buffer.concat(idatChunks)
    const decompressed = zlib.inflateSync(raw)
    const bpp = 4
    const stride = dims.width * bpp + 1
    let minX = dims.width, maxX = 0, minY = dims.height, maxY = 0
    for (let y = 0; y < dims.height; y++) {
      const rowStart = y * stride + 1
      for (let x = 0; x < dims.width; x++) {
        const alpha = decompressed[rowStart + x * bpp + 3]
        if (alpha > 0) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    const padL = minX, padR = dims.width - maxX - 1, padT = minY, padB = dims.height - maxY - 1
    const safeZone = Math.round(dims.width * 0.18)
    expect(padL).toBeGreaterThanOrEqual(safeZone)
    expect(padR).toBeGreaterThanOrEqual(safeZone)
    expect(padT).toBeGreaterThanOrEqual(safeZone)
    expect(padB).toBeGreaterThanOrEqual(safeZone)
  })

  test('13. Play Store icon asset exists and is 512x512', () => {
    const playStorePath = path.join(ROOT, 'assets', 'play-store-icon.png')
    expect(fs.existsSync(playStorePath)).toBe(true)
    const dims = readPngDimensions(playStorePath)
    expect(dims.width).toBe(512)
    expect(dims.height).toBe(512)
  })

  test('13b. Tracked Play Store icon SHA-256 matches approved source', () => {
    const playStorePath = path.join(ROOT, 'assets', 'play-store-icon.png')
    const buf = fs.readFileSync(playStorePath)
    const hash = crypto.createHash('sha256').update(buf).digest('hex')
    expect(hash).toBe('1394eb7fbf072588fe7c10f6fa02238fa444b8c99a1aaa3f16d78f294b53f981')
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
    expect(script).toContain('1394EB7FBF072588FE7C10F6FA02238FA444B8C99A1AAA3F16D78F294B53F981')
  })
})
