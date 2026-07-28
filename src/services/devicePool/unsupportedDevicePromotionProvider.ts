// ─────────────────────────────────────────────────────────────
// unsupportedDevicePromotionProvider.ts — Fallback for platforms
// that do not support Play Integrity Device Recall (e.g., iOS,
// emulators, or devices without Google Play services).
//
// Returns unsupported: the server falls back to existing
// account-level quota behavior. No device pool is applied.
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native'
import type {
  DevicePromotionProvider,
  AttestationRequestContext,
  AttestationResult,
} from './devicePromotionProvider'

export class UnsupportedDevicePromotionProvider implements DevicePromotionProvider {
  isSupported(): boolean {
    return false
  }

  async getAttestationForScan(_ctx: AttestationRequestContext): Promise<AttestationResult> {
    return {
      token: '',
      provider: 'unsupported',
      isMock: false,
    }
  }

  getDevelopmentStatus(): 'production' {
    return 'production'
  }

  getProviderName(): string {
    return 'unsupported'
  }
}
