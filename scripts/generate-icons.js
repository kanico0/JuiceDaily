// scripts/generate-icons.js — Generate RawLifeFlow icon assets from source
//
// Source: C:\src\JuicingApp\Docs\Raw_LifeFlow_Color_Play-Store.png
// SHA-256: 3B1109ADE240DF4726EAA36CA5A94324301C48D88B80225CACB549D59279DCFD
// Output: assets/icon.png, assets/adaptive-icon.png, assets/favicon.png,
//         assets/splash-icon.png, assets/play-store-icon.png
//
// Safe-zone method: The Android adaptive icon safe zone is the inner
// ~66% (2/3) of the canvas. We place the artwork at 62% of the canvas
// size, centered, ensuring all content survives circular, rounded-square,
// and squircle masks.

const path = require('path')
const sharp = require('sharp')

const SOURCE = 'C:/src/JuicingApp/Docs/Raw_LifeFlow_Color_Play-Store.png'
const ASSETS = path.join(__dirname, '..', 'assets')

const BG_COLOR = '#ffffff'

async function generateIcons () {
  const meta = await sharp(SOURCE).metadata()
  console.log('Source:', meta.width + 'x' + meta.height, 'channels:', meta.channels, 'hasAlpha:', meta.hasAlpha)

  // ── 1. Standard icon (1024×1024) ────────────────────────────
  // Fit artwork into 1024×1024 with ~15% padding on each side.
  // The artwork is square (512×512), so we fit by both dimensions.
  const ICON_SIZE = 1024
  const ICON_FIT_RATIO = 0.70 // artwork occupies 70% of canvas
  const iconTargetW = Math.round(ICON_SIZE * ICON_FIT_RATIO)
  const iconTargetH = iconTargetW // square source

  await sharp(SOURCE)
    .resize(iconTargetW, iconTargetH, { fit: 'fill' })
    .extend({
      top: Math.floor((ICON_SIZE - iconTargetH) / 2),
      bottom: Math.ceil((ICON_SIZE - iconTargetH) / 2),
      left: Math.floor((ICON_SIZE - iconTargetW) / 2),
      right: Math.ceil((ICON_SIZE - iconTargetW) / 2),
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toFile(path.join(ASSETS, 'icon.png'))
  console.log('Generated: icon.png (1024x1024)')

  // ── 2. Android adaptive foreground (1024×1024) ──────────────
  // Safe zone: inner 66% of canvas. We place artwork at 62% to
  // ensure all content survives all mask shapes.
  const ADAPTIVE_SIZE = 1024
  const ADAPTIVE_FIT_RATIO = 0.62
  const adaptiveTargetW = Math.round(ADAPTIVE_SIZE * ADAPTIVE_FIT_RATIO)
  const adaptiveTargetH = adaptiveTargetW // square source

  await sharp(SOURCE)
    .resize(adaptiveTargetW, adaptiveTargetH, { fit: 'fill' })
    .extend({
      top: Math.floor((ADAPTIVE_SIZE - adaptiveTargetH) / 2),
      bottom: Math.ceil((ADAPTIVE_SIZE - adaptiveTargetH) / 2),
      left: Math.floor((ADAPTIVE_SIZE - adaptiveTargetW) / 2),
      right: Math.ceil((ADAPTIVE_SIZE - adaptiveTargetW) / 2),
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toFile(path.join(ASSETS, 'adaptive-icon.png'))
  console.log('Generated: adaptive-icon.png (1024x1024, 62% safe-zone)')

  // ── 3. Favicon (48×48) ──────────────────────────────────────
  // Scale artwork to fit within 48×48 preserving aspect ratio.
  await sharp(SOURCE)
    .resize(48, 48, { fit: 'contain', background: BG_COLOR })
    .png()
    .toFile(path.join(ASSETS, 'favicon.png'))
  console.log('Generated: favicon.png (48x48)')

  // ── 4. Splash icon (1024×1024) ──────────────────────────────
  // Center artwork on white background, fit within canvas.
  await sharp(SOURCE)
    .resize(1024, 1024, { fit: 'contain', background: BG_COLOR })
    .png()
    .toFile(path.join(ASSETS, 'splash-icon.png'))
  console.log('Generated: splash-icon.png (1024x1024)')

  // ── 5. Play Store icon (512×512) ────────────────────────────
  // Full artwork centered with padding, opaque background.
  const PLAY_SIZE = 512
  const PLAY_FIT_RATIO = 0.72
  const playTargetW = Math.round(PLAY_SIZE * PLAY_FIT_RATIO)
  const playTargetH = playTargetW // square source

  await sharp(SOURCE)
    .resize(playTargetW, playTargetH, { fit: 'fill' })
    .extend({
      top: Math.floor((PLAY_SIZE - playTargetH) / 2),
      bottom: Math.ceil((PLAY_SIZE - playTargetH) / 2),
      left: Math.floor((PLAY_SIZE - playTargetW) / 2),
      right: Math.ceil((PLAY_SIZE - playTargetW) / 2),
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: BG_COLOR })
    .png()
    .toFile(path.join(ASSETS, 'play-store-icon.png'))
  console.log('Generated: play-store-icon.png (512x512)')

  console.log('All icons generated successfully.')
}

generateIcons().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
