// ─────────────────────────────────────────────────────────────
// developmentDevicePromotionProvider.ts — Mock provider for
// local development and testing.
//
// This provider MUST NEVER be enabled in a production release.
// It returns a clearly labeled mock token that the server
// recognizes as a test result only when the server is also in
// development/test mode.
//
// The mock token is a client-generated installation UUID that
// is explicitly NOT a permanent device identifier. It does not
// survive app-data clearing, reinstall, or factory reset.
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native'
import type {
  DevicePromotionProvider,
  AttestationRequestContext,
  AttestationResult,
} from './devicePromotionProvider'

const MOCK_INSTALL_KEY = '@device_pool_mock_install_id'

async function getAsyncStorage (): Promise<typeof import('@react-native-async-storage/async-storage')['default']> {
  const mod = await import('@react-native-async-storage/async-storage')
  return mod.default
}

export class DevelopmentDevicePromotionProvider implements DevicePromotionProvider {
  private cachedInstallId: string | null = null

  isSupported(): boolean {
    return true
  }

  async getAttestationForScan(ctx: AttestationRequestContext): Promise<AttestationResult> {
    const installId = await this.getOrCreateInstallId()
    // The mock token encodes the install ID and request context
    // so the server can validate request binding in test mode.
    const token = `mock_integrity:${installId}:${ctx.challenge}:${ctx.action}`
    return {
      token,
      provider: 'development_mock',
      isMock: true,
    }
  }

  getDevelopmentStatus(): 'development' | 'test' {
    return __DEV__ ? 'development' : 'test'
  }

  getProviderName(): string {
    return 'development_mock'
  }

  private async getOrCreateInstallId(): Promise<string> {
    if (this.cachedInstallId) return this.cachedInstallId
    try {
      const AsyncStorage = await getAsyncStorage()
      let id = await AsyncStorage.getItem(MOCK_INSTALL_KEY)
      if (!id) {
        id = `mock_dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        await AsyncStorage.setItem(MOCK_INSTALL_KEY, id)
      }
      this.cachedInstallId = id
      return id
    } catch {
      // Fallback: generate ephemeral ID if storage fails
      const fallback = `mock_ephemeral_${Date.now()}`
      this.cachedInstallId = fallback
      return fallback
    }
  }
}
