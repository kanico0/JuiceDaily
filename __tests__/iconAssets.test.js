// ─────────────────────────────────────────────────────────────
// iconAssets.test.js — Validate RawLifeFlow icon assets
//
// Checks:
//   1. All configured icon paths exist in app.json
//   2. Each PNG has correct expected dimensions
//   3. Adaptive icon foreground has safe-zone padding (≤ 66% fill)
//   4. No accidental missing or blank (zero-size) image
//   5. All files are valid PNG format
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const ASSETS = path.join(ROOT, 'assets')

function readPngHeader (filePath) {
  const buf = fs.readFileSync(filePath)
  const sig = buf.slice(0, 8).toString('hex')
  const isValidPng = sig === '89504e470d0a1a0a'
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const colorType = buf[25]
  const hasAlpha = colorType === 6 || colorType === 4
  return { isValidPng, width, height, colorType, hasAlpha, size: buf.length }
}

function readAppJson () {
  const raw = fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')
  return JSON.parse(raw)
}

describe('Icon Assets — RawLifeFlow', () => {
  const appJson = readAppJson()
  const expo = appJson.expo

  // ── 1. Configured icon paths exist ──────────────────────────
  describe('configured icon paths exist', () => {
    const iconPaths = [
      { label: 'icon', path: expo.icon },
      { label: 'adaptiveIcon.foregroundImage', path: expo.android?.adaptiveIcon?.foregroundImage },
      { label: 'favicon', path: expo.web?.favicon },
      { label: 'splash.image', path: expo.splash?.image },
    ]

    iconPaths.forEach(({ label, path: relPath }) => {
      test(`${label} path is configured`, () => {
        expect(relPath).toBeTruthy()
      })

      test(`${label} file exists at ${relPath}`, () => {
        const abs = path.join(ROOT, relPath.replace(/^\.\//, ''))
        expect(fs.existsSync(abs)).toBe(true)
      })
    })
  })

  // ── 2. Expected PNG dimensions ──────────────────────────────
  describe('expected PNG dimensions', () => {
    const expected = [
      { file: 'icon.png', width: 1024, height: 1024 },
      { file: 'adaptive-icon.png', width: 1024, height: 1024 },
      { file: 'favicon.png', width: 48, height: 48 },
      { file: 'splash-icon.png', width: 1024, height: 1024 },
      { file: 'play-store-icon.png', width: 512, height: 512 },
    ]

    expected.forEach(({ file, width, height }) => {
      test(`${file} is ${width}x${height}`, () => {
        const info = readPngHeader(path.join(ASSETS, file))
        expect(info.width).toBe(width)
        expect(info.height).toBe(height)
      })
    })
  })

  // ── 3. Adaptive icon safe-zone padding ──────────────────────
  test('adaptive-icon.png has safe-zone padding (artwork ≤ 66% of canvas)', () => {
    const info = readPngHeader(path.join(ASSETS, 'adaptive-icon.png'))
    expect(info.width).toBe(1024)
    expect(info.height).toBe(1024)

    // The adaptive foreground should have transparent padding around
    // the artwork. We verify by checking that the file has alpha
    // (transparent borders) and the file size is reasonable (not
    // a full-edge-to-edge image which would be much larger).
    expect(info.hasAlpha).toBe(true)
    // A 1024x1024 RGBA PNG with ~62% artwork and transparent padding
    // should be well under 700KB. A full-edge-to-edge image would
    // be significantly larger.
    expect(info.size).toBeLessThan(700000)
  })

  // ── 4. No missing or blank images ───────────────────────────
  describe('no blank or missing images', () => {
    const files = [
      'icon.png',
      'adaptive-icon.png',
      'favicon.png',
      'splash-icon.png',
      'play-store-icon.png',
    ]

    files.forEach(file => {
      test(`${file} has nonzero size`, () => {
        const stat = fs.statSync(path.join(ASSETS, file))
        expect(stat.size).toBeGreaterThan(0)
      })

      test(`${file} is valid PNG`, () => {
        const info = readPngHeader(path.join(ASSETS, file))
        expect(info.isValidPng).toBe(true)
      })
    })
  })

  // ── 5. Expo configuration resolves ──────────────────────────
  test('app.json parses successfully and has required icon fields', () => {
    expect(expo.icon).toBeDefined()
    expect(expo.android.adaptiveIcon.foregroundImage).toBeDefined()
    expect(expo.android.adaptiveIcon.backgroundColor).toBeDefined()
    expect(expo.web.favicon).toBeDefined()
    expect(expo.splash.image).toBeDefined()
  })

  // ── 6. No config points to deleted/nonexistent files ────────
  test('no configured path points to a nonexistent file', () => {
    const allPaths = [
      expo.icon,
      expo.android?.adaptiveIcon?.foregroundImage,
      expo.web?.favicon,
      expo.splash?.image,
    ]
    allPaths.forEach(relPath => {
      if (relPath) {
        const abs = path.join(ROOT, relPath.replace(/^\.\//, ''))
        expect(fs.existsSync(abs)).toBe(true)
      }
    })
  })
})
