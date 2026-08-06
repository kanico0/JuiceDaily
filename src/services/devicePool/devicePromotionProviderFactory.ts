// ─────────────────────────────────────────────────────────────
// devicePromotionProviderFactory.ts — Factory that returns the
// appropriate DevicePromotionProvider based on build config and
// platform.
// ─────────────────────────────────────────────────────────────

import type { DevicePromotionProvider } from './devicePromotionProvider'
import { DevelopmentDevicePromotionProvider } from './developmentDevicePromotionProvider'
import { UnsupportedDevicePromotionProvider } from './unsupportedDevicePromotionProvider'
import { AndroidPlayIntegrityDevicePromotionProvider } from './androidPlayIntegrityDevicePromotionProvider'
import { selectProviderType } from './devicePoolConfig'

let cachedProvider: DevicePromotionProvider | null = null

export function getDevicePromotionProvider (): DevicePromotionProvider {
  if (cachedProvider) return cachedProvider

  const type = selectProviderType()

  switch (type) {
    case 'development_mock':
      cachedProvider = new DevelopmentDevicePromotionProvider()
      break
    case 'android_play_integrity':
      cachedProvider = new AndroidPlayIntegrityDevicePromotionProvider()
      break
    case 'unsupported':
    default:
      cachedProvider = new UnsupportedDevicePromotionProvider()
      break
  }

  return cachedProvider
}

// For testing: allow overriding the provider
export function setDevicePromotionProviderForTest (provider: DevicePromotionProvider | null): void {
  cachedProvider = provider
}
