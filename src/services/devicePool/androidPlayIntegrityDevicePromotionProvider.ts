// ─────────────────────────────────────────────────────────────
// androidPlayIntegrityDevicePromotionProvider.ts — Production
// Android provider using Google Play Integrity with Device Recall.
//
// This provider requests a Play Integrity token bound to the
// scan request context using the official requestHash mechanism.
// The token is sent to the server for verification — the client
// never interprets Device Recall values directly.
//
// IMPORTANT:
//   * This provider uses a native Expo module (expo-play-integrity)
//     that must be configured in the native Android project.
//   * Device Recall is a beta feature requiring Google Play
//     Console enrollment and approval.
//   * The provider gracefully degrades to unsupported if the
//     native module is not available.
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native'
import type {
  DevicePromotionProvider,
  AttestationRequestContext,
  AttestationResult,
} from './devicePromotionProvider'

// Lazy-load the native module so the file doesn't crash on
// platforms where it doesn't exist.
function getNativeModule (): any | null {
  if (Platform.OS !== 'android') return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../../../../modules/expo-play-integrity')
    return mod.default ?? mod
  } catch {
    return null
  }
}

export class AndroidPlayIntegrityDevicePromotionProvider implements DevicePromotionProvider {
  private nativeModule: any | null

  constructor () {
    this.nativeModule = getNativeModule()
  }

  isSupported(): boolean {
    return Platform.OS === 'android' && this.nativeModule != null
  }

  async getAttestationForScan(ctx: AttestationRequestContext): Promise<AttestationResult> {
    if (!this.isSupported() || !this.nativeModule) {
      throw new Error('Play Integrity not available on this device')
    }

    // Build the request hash from server-controlled material.
    // The server will recompute and validate this hash.
    const requestHash = [
      ctx.challenge,
      ctx.userId,
      ctx.action,
      ctx.requestPayloadDigest,
    ].join('|')

    const cloudProjectNumberStr = process.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER || ''
    const cloudProjectNumber = parseInt(cloudProjectNumberStr, 10)
    if (!cloudProjectNumber || isNaN(cloudProjectNumber)) {
      throw new Error('Play Integrity cloud project number not configured')
    }

    const token = await this.nativeModule.requestIntegrityToken({
      requestHash,
      cloudProjectNumber,
    })

    return {
      token,
      provider: 'android_play_integrity',
      isMock: false,
    }
  }

  getDevelopmentStatus(): 'production' {
    return 'production'
  }

  getProviderName(): string {
    return 'android_play_integrity'
  }
}
